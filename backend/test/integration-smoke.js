/**
 * Frontend ↔ Backend integration smoke test — REAL-TIME, hits live testnet
 * (Arc + Circle Iris). Read-only against the chain: no keys, no sends.
 *
 * Validates the synchronization paths end-to-end, in-process:
 *   0. Config parity   — backend derives everything from frontend/js/config.js;
 *                        CSP (vercel.json) covers every host config can reach.
 *   1. Boot            — real Store + indexer + relayer (watch-only) + HTTP API
 *                        on an ephemeral port/data dir.
 *   2. Real-time index — an event minted AFTER test start must appear via the
 *                        API within seconds (chain → indexer → store → /events).
 *   3. API consistency  — /health counts == store counts; /events newest-first,
 *                        limit honored, no duplicate (txHash,logIndex) keys.
 *   4. Dual-emitter     — an ERC-20-kind entry has its 18-dec system mirror in
 *                        the same tx (same amount6) — never double-counted.
 *   5. Relayer lifecycle— find a REAL recent CCTP burn on Arc, POST /relay,
 *                        watch the job walk queued → attestation_wait →
 *                        ready|skipped (Iris live), GET /status agrees.
 *
 * Run: node backend/test/integration-smoke.js   (exit 0 = PASS)
 */
"use strict";

process.env.BACKEND_NO_SIGINT = "1"; // this harness owns shutdown

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { ethers } = require("ethers"); // used by Phase 5 to decode CCTP message version

const {
	loadBackendConfig,
	getIndexerChains,
	getRelayerChains,
	loadFrontendConfig
} = require("../src/config");
const { Store } = require("../src/store");
const { runIndexer, makeRpcCall } = require("../src/indexer");
const { createRelayer } = require("../src/relayer");
const { createIrisClient } = require("../src/attestation");
const { createServer } = require("../src/server");
const { MESSAGE_SENT_TOPIC } = require("../src/cctp");

const PORT = 8977;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
const timings = [];
function ok(cond, label) {
	assert.ok(cond, label);
	passed++;
	console.log(`  ✓ ${label}`);
}
function timeit(label, ms) {
	timings.push(`${label}: ${ms}ms`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function api(method, urlPath, body) {
	return new Promise((resolve, reject) => {
		const req = http.request(
			`${BASE}${urlPath}`,
			{ method, headers: body ? { "Content-Type": "application/json" } : {} },
			(res) => {
				let data = "";
				res.on("data", (c) => (data += c));
				res.on("end", () => {
					let parsed = null;
					try {
						parsed = JSON.parse(data);
					} catch (_) {}
					resolve({ status: res.statusCode, body: parsed, raw: data });
				});
			}
		);
		req.on("error", reject);
		if (body) req.write(JSON.stringify(body));
		req.end();
	});
}

async function main() {
	console.log("[integration-smoke] NETWORKED test — Arc Testnet + Circle Iris sandbox (read-only)\n");

	// --- Phase 0: config parity (frontend is the single source of truth) ------
	let indexerStop = null;
	let relayer = null;
	let server = null;
	try {
		console.log("[phase 0] config parity");
		const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-itest-"));
		process.env.BACKEND_DATA_DIR = dataDir;
		// The API below listens on PORT, so the config must agree — otherwise the
		// DNS-rebinding Host guard (server.js) 403s every request as a Host/port
		// mismatch and every /events consumer sees body.events === undefined.
		process.env.BACKEND_PORT = String(PORT);
		const backendCfg = loadBackendConfig();
		const frontend = loadFrontendConfig();
		const indexerChains = getIndexerChains(backendCfg);
		const relayerChains = getRelayerChains(backendCfg);
		ok(indexerChains.length >= 1 && indexerChains[0].key === "arc", "backend indexer derives Arc from frontend config");
		const arcCfg = frontend.chains.arc;
		ok(
			relayerChains.every((c) => frontend.chains[c.key] && frontend.chains[c.key].cctpDomain === c.cctpDomain),
			"relayer chain domains match frontend config"
		);
		ok(backendCfg.cfg.iris.testnet === frontend.iris.testnet, "Iris base URL parity (frontend poller vs backend relayer)");
		const arcChain = relayerChains.find((c) => c.key === "arc");
		ok(
			arcChain && arcChain.messageTransmitterV2 === arcCfg.cctp.messageTransmitterV2,
			"CCTP contract parity (MessageTransmitterV2)"
		);
		// CSP coverage: every RPC/Iris URL the config can reach must be allowed.
		// CSP matching: a host-source without path covers the whole origin; one
		// WITH a path (e.g. …/rpc/v1) covers exactly that path — compare full URLs.
		const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "vercel.json"), "utf8"));
		const csp = vercel.headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
		const cspTokens = /connect-src ([^;]+)/.exec(csp)[1].split(/\s+/);
		const urls = new Set();
		for (const c of Object.values(frontend.chains)) {
			if (!c || !c.rpcUrl) continue;
			urls.add(new URL(c.rpcUrl));
		}
		urls.add(new URL(frontend.iris.mainnet));
		urls.add(new URL(frontend.iris.testnet));
		const covered = (u) =>
			cspTokens.some((t) => {
				if (!/^https?:\/\//.test(t)) return false;
				const tu = new URL(t);
				return tu.origin === u.origin && (tu.pathname === "/" || tu.pathname === u.pathname);
			});
		const missing = [...urls].filter((u) => !covered(u));
		ok(missing.length === 0, `CSP connect-src covers all configured RPC/Iris hosts${missing.length ? " (missing: " + missing.map((u) => u.href).join(", ") + ")" : ""}`);

		// --- Phase 1: boot real components in-process -------------------------------
		console.log("\n[phase 1] boot (store + indexer + relayer watch-only + API)");
		const store = new Store({ dir: dataDir });
		const rpc = makeRpcCall(indexerChains[0].rpcUrl);
		const head0 = parseInt(await rpc("eth_blockNumber", []), 16);
		// Light lookback: the busy testnet yields thousands of events per 2000 blocks.
		const lightChains = indexerChains.map((c) => ({ ...c, startBlock: Math.max(0, head0 - 300) }));
		indexerStop = runIndexer({ chains: lightChains, store, pollMs: 4000 });
		const iris = createIrisClient({ baseUrl: frontend.iris.testnet });
		relayer = createRelayer({ backendCfg, chains: relayerChains, store });
		relayer.start();
		server = createServer({ backendCfg, store, relayer, iris, indexerChains: lightChains });
		await new Promise((res) => server.listen(PORT, "127.0.0.1", res));
		ok(true, `API listening on ${BASE}`);
		// --- Phase 2: real-time indexing latency ---------------------------------
		console.log("\n[phase 2] real-time chain → /events latency");
		const tHead = parseInt(await rpc("eth_blockNumber", []), 16);
		const t0 = Date.now();
		let sawFresh = null;
		for (let i = 0; i < 60 && !sawFresh; i++) {
			await sleep(2000);
			const { body } = await api("GET", "/events?chain=arc&limit=5");
			sawFresh = body.events.find((e) => e.block >= tHead - 2) || null;
		}
		assert.ok(sawFresh, `no event at/after block ${tHead - 2} within 120s — indexer not syncing`);
		const latencyMs = Date.now() - t0;
		ok(true, `event from block ≥ ${tHead - 2} visible via API in ${(latencyMs / 1000).toFixed(1)}s`);
		timeit("chain→API latency", latencyMs);

		// --- Phase 3: API consistency --------------------------------------------
		console.log("\n[phase 3] API/store consistency");
		const health = (await api("GET", "/health")).body;
		ok(health.ok === true && health.network === "testnet", "/health ok, network=testnet");
		ok(
			health.indexer.eventCounts.arc === store.countEvents("arc"),
			`/health eventCounts matches store (${health.indexer.eventCounts.arc})`
		);
		ok(
			health.indexer.chains[0].lastIndexedBlockPlusOne > head0 - 300,
			`watermark advanced past startBlock (=${health.indexer.chains[0].lastIndexedBlockPlusOne})`
		);
		const evts = (await api("GET", "/events?chain=arc&limit=50")).body.events;
		ok(evts.length === 50, "/events honors limit=50");
		const blocksDesc = evts.map((e) => e.block);
		ok(blocksDesc.every((b, i) => i === 0 || b <= blocksDesc[i - 1]), "/events newest-first ordering");
		const keys = new Set(evts.map((e) => `${e.txHash}:${e.logIndex}`));
		ok(keys.size === evts.length, "no duplicate (txHash,logIndex) in /events");
		ok(evts.every((e) => ["erc20", "system"].includes(e.kind) && ["mint", "burn", "transfer"].includes(e.direction)), "every event carries kind + direction");

		// --- Phase 4: dual-emitter pairing --------------------------------------
		console.log("\n[phase 4] dual-emitter pairing (never double-count)");
		const sample = (await api("GET", "/events?chain=arc&limit=300")).body.events;
		const erc20 = sample.find((e) => e.kind === "erc20" && Number(e.amount6) >= 1_000_000);
		if (erc20) {
			const mirror = sample.find((e) => e.kind === "system" && e.txHash === erc20.txHash);
			ok(!!mirror, `erc20 transfer has system mirror in same tx (${erc20.txHash.slice(0, 18)}…)`);
			ok(mirror && mirror.amount6 === erc20.amount6, "mirror amount6 equal after ÷1e12 normalization");
		} else {
			// Rare on this chain, but keep the phase honest rather than fail.
			console.log("  (no erc20-kind transfer ≥1 USDC in window — pairing not exercised this run)");
		}

		// --- Phase 5: relayer job lifecycle with a REAL burn ---------------------
		console.log("\n[phase 5] /relay lifecycle on a real testnet burn (watch-only)");
		const burnLogs = await rpc("eth_getLogs", [
			{
				fromBlock: "0x" + (head0 - 200).toString(16),
				toBlock: "0x" + head0.toString(16),
				address: arcCfg.cctp.messageTransmitterV2,
				topics: [MESSAGE_SENT_TOPIC]
			}
		]);
		assert.ok(Array.isArray(burnLogs) && burnLogs.length > 0, "no MessageSent found on Arc in the last 200 blocks");
		// This relayer is V2-only by design. Arc testnet currently emits mostly
		// (or only) V1 messages, so decode versions and pick accordingly: prefer
		// a real V2 burn; if none exist in the window, use the newest V1 and
		// EXPECT the documented rejection ("unsupported CCTP message version").
		const versionOf = (l) => {
			try {
				return parseInt(ethers.utils.defaultAbiCoder.decode(["bytes"], l.data)[0].slice(2, 10), 16);
			} catch (_) {
				return 0;
			}
		};
		const v2Logs = burnLogs.filter((l) => versionOf(l) === 2);
		const expectV2 = v2Logs.length > 0;
		const chosenLogs = expectV2 ? v2Logs : burnLogs;
		const burnTx = chosenLogs[chosenLogs.length - 1].transactionHash; // newest
		console.log(`  (picked ${expectV2 ? "V2" : "V1"} burn ${burnTx.slice(0, 18)}… — ${v2Logs.length}/${burnLogs.length} V2 in window)`);
		const tPost = Date.now();
		const post = await api("POST", "/relay", { srcChain: "arc", burnTxHash: burnTx });
		ok(post.status === 202 && post.body.job && post.body.job.status === "queued", `POST /relay accepted real burn ${burnTx.slice(0, 18)}… → queued`);
		let job = null;
		for (let i = 0; i < 90; i++) {
			await sleep(2000);
			job = (await api("GET", "/jobs")).body.jobs[burnTx];
			if (job && ["ready", "skipped", "relayed", "failed"].includes(job.status)) break;
		}
		const lifeMs = Date.now() - tPost;
		assert.ok(job, "job disappeared from /jobs");
		// V2 path: ready / skipped / relayed are the successful terminal states.
		// V1 path (Arc testnet currently emits mostly V1): "failed" with the
		// documented parser error IS the correct outcome — the V2-only relayer
		// must refuse V1 bytes. Don't gate success on a V2 burn being present.
		const acceptable = expectV2
			? ["ready", "skipped", "relayed"]
			: ["ready", "skipped", "relayed", "failed"];
		ok(
			acceptable.includes(job.status),
			`job reached acceptable "${job.status}" in ${(lifeMs / 1000).toFixed(1)}s${job.error ? ` (${job.error})` : ""}`
		);
		// V1 burns land in "failed" with the CctpParseError; assert THAT the
		// failure mode is the documented one, not a crash or timeout.
		if (!expectV2) {
			ok(
				job.status === "failed" && /unsupported CCTP message version 1/.test(job.error || ""),
				`V1 burn correctly rejected with parse error: "${job.error}"`
			);
		}
		if (job.status === "ready") {
			ok(!!job.message && !!job.attestation && !!job.dstChain && job.parsed, "ready job carries message+attestation+dstChain+parsed");
		}
		timeit("relay job lifecycle", lifeMs);
		// /status only carries Iris state for jobs that progressed past the parser
		// (a V1 reject never reaches the Iris lookup), so skip the live-Iris check
		// for the V1 path. The V2 path still asserts end-to-end Iris agreement.
		if (expectV2) {
			const status = (await api("GET", `/status?srcChain=arc&txHash=${burnTx}`)).body;
			ok(status.job && status.job.txHash === burnTx, "/status finds the job");
			ok(status.iris && status.iris.status === "complete", "/status agrees with live Iris (status complete)");
		} else {
			ok(true, "/status Iris agreement skipped (V1 burn — relayer never called Iris)");
		}
	} finally {
		// --- cleanup (guards: a phase-0 failure skips boot entirely) -----------
		try {
			if (server) server.close();
		} catch (_) {}
		try {
			if (indexerStop) await indexerStop.stop();
		} catch (_) {}
		try {
			if (relayer) await relayer.stop();
		} catch (_) {}
		await sleep(300); // let any last write land before removing the dir
		const dir = process.env.BACKEND_DATA_DIR;
		if (dir && dir.includes("warparc-itest-")) {
			try {
				// maxRetries: Windows can transiently hold freshly-written files
				// (EBUSY/EPERM) — fs retries beat a leaked temp dir.
				fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
			} catch (_) {}
		}
	}

	console.log(`\n[integration-smoke] PASS — ${passed} assertions`);
	for (const t of timings) console.log(`  ⏱ ${t}`);
	process.exitCode = 0;
}

main().catch((e) => {
	console.error(`\n[integration-smoke] FAIL: ${e && e.message ? e.message : e}`);
	process.exitCode = 1;
});
