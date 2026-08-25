/**
 * Offline smoke tests untuk MCP server — tanpa network, tanpa key.
 * Run: node backend/test/mcp-smoke.js   (exit 0 = semua lolos)
 *
 * Liputan: version negotiation initialize, tools/list + tools/call (health,
 * jobs, events, budget, config, guard relay_submit), resources/list + read,
 * prompts/list + get, ping, pemetaan error JSON-RPC; REGRESI audit: gate tulis
 * RELAYER_MCP_SUBMIT (off/on), kemurnian stdout saat submit sukses (log relayer
 * wajib ke stderr via buildStandaloneDeps), withTimeout deadline, dan abort
 * klien Iris; ditambah SATU spawn end-to-end server stdio asli (framing
 * line-delimited lewat child process).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { Store } = require("../src/store");
const {
	createMcpServer,
	buildStandaloneDeps,
	withTimeout,
	PROTOCOL_VERSIONS,
	LATEST_PROTOCOL
} = require("../src/mcp-server");
const { createIrisClient } = require("../src/attestation");

let passed = 0;
function ok(cond, label) {
	assert.ok(cond, label);
	passed++;
	console.log(`  ✓ ${label}`);
}

const ALICE = "0x" + "aa".repeat(20);
const BOB = "0x" + "bb".repeat(20);
const ERC20 = "0x3600000000000000000000000000000000000000";

function silentLog() {
	return { info: () => {}, warn: () => {}, error: () => {} };
}

/** Rekam chunk stdout/stderr selama satu operasi — restore() wajib dipanggil. */
function captureStreams() {
	const out = [];
	const err = [];
	const origOut = process.stdout.write;
	const origErr = process.stderr.write;
	process.stdout.write = (chunk, ...rest) => {
		out.push(typeof chunk === "string" ? chunk : chunk.toString());
		return true;
	};
	process.stderr.write = (chunk, ...rest) => {
		err.push(typeof chunk === "string" ? chunk : chunk.toString());
		return true;
	};
	return {
		out: () => out.join(""),
		err: () => err.join(""),
		restore: () => {
			process.stdout.write = origOut;
			process.stderr.write = origErr;
		}
	};
}

const GATE_TX = "0x" + "ab".repeat(32);
const PURITY_TX = "0x" + "cd".repeat(32);

/** Relayer stub deterministik (offline) — bentuk sama dengan createRelayer. */
function stubRelayer({ validate = async () => true } = {}) {
	const jobs = {};
	return {
		stats: () => ({ mode: "watch-only", total: Object.keys(jobs).length }),
		getJobs: () => jobs,
		enqueue: (srcChain, burnTxHash) => {
			const job = { txHash: burnTxHash.toLowerCase(), srcChain, status: "queued" };
			jobs[job.txHash] = job;
			return job;
		},
		validateBurnTx: validate
	};
}

/** backendCfg lengkap untuk buildStandaloneDeps/createRelayer (tanpa network). */
function standaloneBackendCfg(dir) {
	const chain = (key, name, chainId, cctpDomain) => {
		const mtv2 = "0x" + "77".repeat(20);
		return {
			key,
			name,
			chainId,
			cctpDomain,
			rpcUrl: "stub",
			// dua bentuk: turunan config (cctp.*) + hasil getRelayerChains (flat)
			cctp: { messageTransmitterV2: mtv2 },
			messageTransmitterV2: mtv2,
			usdc: null,
			isArc: key.startsWith("arc")
		};
	};
	return {
		network: "testnet",
		dataDir: dir,
		server: { host: "127.0.0.1", port: 0 },
		indexChains: ["arc"],
		cfg: {
			iris: { testnet: "stub" },
			tokens: {
				USDC: {
					addresses: { arc: "0x" + "55".repeat(20), baseSepolia: "0x" + "66".repeat(20) }
				}
			},
			chains: {
				arc: chain("arc", "Arc Testnet", 5042002, 26),
				baseSepolia: chain("baseSepolia", "Base Sepolia", 84532, 6)
			}
		},
		relayer: {
			enabled: false,
			dryRun: true,
			privateKey: null,
			autoRelay: false,
			allowHooks: false,
			maxRelayUsdc: 1000,
			dailyUsdcBudget: 50,
			dailyEthBudget: 0.5,
			irisChecksPerTick: 20,
			pollMs: 5000,
			attestationTimeoutMs: 600_000,
			maxSubmitAttempts: 5,
			maxJobs: 500
		}
	};
}

function makeServer(opts = {}) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-mcp-"));
	const store = new Store({ dir });
	store.appendEvent({
		chain: "arc", block: 10, from: ALICE, to: BOB, amount6: "100",
		kind: "erc20", direction: "transfer",
		txHash: "0x" + "11".repeat(32), logIndex: 0, emitter: ERC20, ts: "2026-08-23T00:00:00.000Z"
	});
	store.setState("indexer:arc", 11);
	const backendCfg = {
		network: "testnet",
		dataDir: dir,
		server: { host: "127.0.0.1", port: 0 },
		cfg: {
			iris: { testnet: "stub" },
			chains: {
				arc: { name: "Arc Testnet", chainId: 5042002, cctpDomain: 26, rpcUrl: "stub" },
				baseSepolia: { name: "Base Sepolia", chainId: 84532, cctpDomain: 6, rpcUrl: "stub" }
			}
		}
	};
	// relayer null → mode read-only (guard relay_submit harus menolak).
	const indexerChains = [{ key: "arc", rpcUrl: "stub" }];
	const mcp = createMcpServer({
		backendCfg,
		store,
		relayer: opts.relayer ?? null,
		iris: null,
		indexerChains,
		log: silentLog()
	});
	return { mcp, store, dir };
}

async function runUnitTests() {
	console.log("[mcp-smoke] unit (in-process)");
	const { mcp } = makeServer();
	const call = (frame) => mcp.handleFrame(frame);

	// --- lifecycle / protocol ---
	let r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-smoke", version: "0.0.0" } } })));
	ok(r.result && r.result.protocolVersion === "2025-06-18", "initialize negotiates down to client protocol 2025-06-18");
	ok(r.result && r.result.serverInfo.name === "warparc-backend", "initialize.serverInfo.name");
	ok(r.result && r.result.capabilities.tools && r.result.capabilities.resources && r.result.capabilities.prompts, "capabilities advertise tools/resources/prompts");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01", capabilities: {}, clientInfo: { name: "x", version: "1" } } })));
	ok(r.result && r.result.protocolVersion === LATEST_PROTOCOL, "unknown protocol version → server falls back to latest (" + LATEST_PROTOCOL + ")");

	ok((await call(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))) === null, "notification → no response frame");
	ok((await call(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" }))) !== null, "ping answered");
	ok(PROTOCOL_VERSIONS.includes("2026-07-28") && PROTOCOL_VERSIONS.includes("2025-06-18"), "PROTOCOL_VERSIONS export");

	// --- tools ---
	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" })));
	ok(r.result && r.result.tools.length === 7, "tools/list → 7 tools");
	ok(r.result.tools.some((t) => t.name === "warparc_health") && r.result.tools.every((t) => t.inputSchema), "all tools carry inputSchema");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "warparc_health", arguments: {} } })));
	const health = JSON.parse(r.result.content[0].text);
	ok(r.result && !r.result.isError && health.ok === true && health.network === "testnet", "warparc_health → ok, network testnet");
	ok(health.indexer.eventCounts.arc === 1 && health.relayer.mode === "disabled", "health includes indexer counts + relayer disabled (no relayer)");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "warparc_jobs", arguments: {} } })));
	ok(!r.result.isError && JSON.parse(r.result.content[0].text).total === 0, "warparc_jobs → empty store totals 0");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "warparc_events", arguments: { chain: "arc" } } })));
	const ev = JSON.parse(r.result.content[0].text);
	ok(!r.result.isError && ev.count === 1 && ev.events[0].from === ALICE, "warparc_events filter chain");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "warparc_events", arguments: { kind: "invalid" } } })));
	ok(r.result.isError === true && /kind/.test(r.result.content[0].text), "warparc_events kind=invalid → tool isError");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "warparc_events", arguments: { limit: 5000 } } })));
	ok(JSON.parse(r.result.content[0].text).limit === 1000, "warparc_events limit capped at 1000");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "warparc_relay_submit", arguments: { srcChain: "baseSepolia", burnTxHash: "0x" + "ab".repeat(32) } } })));
	ok(r.result.isError === true && /relayer tidak aktif/.test(r.result.content[0].text), "warparc_relay_submit without relayer → refused (fail-closed)");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "warparc_config", arguments: {} } })));
	const cfgText = r.result.content[0].text;
	ok(!r.result.isError && /5042002/.test(cfgText) && /privateKey/.test(cfgText) === false, "warparc_config exposes chains, never secrets");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "no_such_tool", arguments: {} } })));
	ok(r.error && r.error.code === -32602, "unknown tool → JSON-RPC Invalid Params (-32602)");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "warparc_health", arguments: "not-an-object" } })));
	ok(r.error && r.error.code === -32602, "non-object tool arguments → -32602");

	// --- resources ---
	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 14, method: "resources/list" })));
	ok(r.result && r.result.resources.length === 2 && r.result.resources[0].uri === "warparc://state", "resources/list → state + events/recent");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 15, method: "resources/read", params: { uri: "warparc://state" } })));
	ok(!r.error && r.result.contents[0].text.includes('"indexer:arc": 11'), "resources/read warparc://state");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 16, method: "resources/read", params: { uri: "warparc://events/recent" } })));
	ok(!r.error && JSON.parse(r.result.contents[0].text).returned === 1, "resources/read warparc://events/recent");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 17, method: "resources/read", params: { uri: "warparc://nope" } })));
	ok(r.error && r.error.code === -32602, "unknown resource uri → -32602");

	// --- prompts ---
	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 18, method: "prompts/list" })));
	ok(r.result && r.result.prompts.length === 2, "prompts/list → 2");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 19, method: "prompts/get", params: { name: "warparc-audit-relayer" } })));
	ok(!r.error && r.result.messages[0].content.type === "text" && r.result.messages[0].content.text.includes("network:"), "prompts/get audit-relayer renders state");

	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 20, method: "prompts/get", params: { name: "warparc-launch-day" } })));
	ok(!r.error && r.result.messages[0].content.text.includes("2026-09-16"), "prompts/get launch-day mentions mainnet date");

	// --- JSON-RPC error mapping ---
	r = JSON.parse(await call("not json"));
	ok(r.error && r.error.code === -32700 && r.id === null, "malformed frame → Parse error (-32700)");
	r = JSON.parse(await call(JSON.stringify([1, 2])));
	ok(r.error && r.error.code === -32600, "non-object frame → Invalid Request (-32600)");
	r = JSON.parse(await call(JSON.stringify({ jsonrpc: "2.0", id: 21, method: "bogus/method" })));
	ok(r.error && r.error.code === -32601, "unknown method → Method not found (-32601)");
}

/**
 * Regresi audit #3 — gate tulis RELAYER_MCP_SUBMIT (fail-closed):
 * OFF (default) → isError menyebut env-nya; ON → lolos gate sampai enqueue.
 */
async function runGateTests() {
	console.log("[mcp-smoke] submit-gate RELAYER_MCP_SUBMIT");
	const prev = process.env.RELAYER_MCP_SUBMIT;
	delete process.env.RELAYER_MCP_SUBMIT;
	try {
		let validateCalls = 0;
		const relayer = stubRelayer({ validate: async () => void validateCalls++ });
		const { mcp } = makeServer({ relayer });
		const call = (frame) => mcp.handleFrame(frame);
		const submitFrame = (id) =>
			JSON.stringify({
				jsonrpc: "2.0",
				id,
				method: "tools/call",
				params: { name: "warparc_relay_submit", arguments: { srcChain: "baseSepolia", burnTxHash: GATE_TX } }
			});

		let r = JSON.parse(await call(submitFrame(30)));
		ok(r.result.isError === true && /RELAYER_MCP_SUBMIT/.test(r.result.content[0].text), "gate OFF (default): warparc_relay_submit → isError menyebut RELAYER_MCP_SUBMIT");
		ok(validateCalls === 0, "gate OFF: validateBurnTx tidak pernah dipanggil (ditolak sebelum validasi)");

		process.env.RELAYER_MCP_SUBMIT = "true";
		r = JSON.parse(await call(submitFrame(31)));
		const out = JSON.parse(r.result.content[0].text);
		ok(!r.result.isError && out.job && out.job.status === "queued", "gate ON: lolos gate → job tercatat queued");
	} finally {
		if (prev === undefined) delete process.env.RELAYER_MCP_SUBMIT;
		else process.env.RELAYER_MCP_SUBMIT = prev;
	}
}

/**
 * Regresi audit #1 (KUNCI) — kemurnian stdout pada path submit sukses.
 * Relayer dibuat lewat buildStandaloneDeps() TANPA override log oleh test:
 * wiring logger stderr harus datang dari factory itu sendiri. Semua chunk
 * stdout selama exchange wajib parse sebagai frame JSON-RPC; log human
 * "[relayer] queued" wajib mendarat di stderr.
 */
async function runStdoutPurityTest() {
	console.log("[mcp-smoke] stdout purity (standalone deps wiring)");
	const prev = process.env.RELAYER_MCP_SUBMIT;
	process.env.RELAYER_MCP_SUBMIT = "true";
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-mcp-purity-"));
	try {
		const backendCfg = standaloneBackendCfg(dir);
		// TIDAK ada arg log — factory yang memasang makeStderrLogger().
		const deps = buildStandaloneDeps({ backendCfg });
		deps.relayer.validateBurnTx = async () => true; // stub receipt lookup (offline)
		const mcp = createMcpServer({
			backendCfg,
			store: deps.store,
			relayer: deps.relayer,
			iris: deps.iris,
			indexerChains: deps.indexerChains,
			log: silentLog()
		});

		const cap = captureStreams();
		let resp;
		try {
			resp = await mcp.handleFrame(
				JSON.stringify({
					jsonrpc: "2.0",
					id: 40,
					method: "tools/call",
					params: { name: "warparc_relay_submit", arguments: { srcChain: "baseSepolia", burnTxHash: PURITY_TX } }
				})
			);
			// Tulis respons persis seperti loop readline entry standalone —
			// inilah satu-satunya jalur yang BOLEH menyentuh stdout.
			if (resp !== null) process.stdout.write(resp + "\n");
		} finally {
			cap.restore();
		}

		const frames = cap.out().split("\n").filter((l) => l.trim() !== "");
		ok(
			frames.length >= 1 &&
				frames.every((l) => {
					try {
						return JSON.parse(l).jsonrpc === "2.0";
					} catch (_) {
						return false;
					}
				}),
			"stdout purity: setiap chunk stdout adalah frame JSON-RPC valid"
		);

		const parsed = JSON.parse(resp);
		const payload = JSON.parse(parsed.result.content[0].text);
		ok(payload.job && payload.job.status === "queued", "purity path: enqueue sukses (job queued)");

		ok(!/\[relayer\] queued/.test(cap.out()), "stdout bebas log telanjang '[relayer] queued'");
		ok(/\[relayer\] queued/.test(cap.err()), "log relayer '[relayer] queued' diteruskan ke stderr");

		// Enqueue idempotent menulis ke store nyata di tmpdir — bukti jalur penuh.
		ok(deps.store.getState("relayer", { jobs: {} }).jobs[PURITY_TX] !== undefined, "job tersimpan di store standalone deps");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
		if (prev === undefined) delete process.env.RELAYER_MCP_SUBMIT;
		else process.env.RELAYER_MCP_SUBMIT = prev;
	}
}

/**
 * Regresi audit #2 — deadline I/O: withTimeout mengubah promise menggantung
 * menjadi error berlabel; klien Iris membatalkan fetch via AbortController.
 */
async function runTimeoutTests() {
	console.log("[mcp-smoke] timeouts (withTimeout + iris abort)");
	// Deadline timers di sumber di-unref() agar tidak menahan proses server —
	// di smoke tanpa stdio, satu handle keep-alive pengganti stdin.
	const keepAlive = setTimeout(() => {}, 10_000);
	try {
		ok((await withTimeout(Promise.resolve(7), 1000, "fast")) === 7, "withTimeout meneruskan nilai resolve");
		try {
			await withTimeout(new Promise(() => {}), 20, "hung upstream");
			ok(false, "withTimeout: promise menggantung harusnya melempar error");
		} catch (e) {
			ok(/hung upstream timeout \(20ms\)/.test(e.message), "withTimeout: promise menggantung → error deadline berlabel");
		}

		const hangingFetch = (url, init) =>
			new Promise((_, reject) => {
				init.signal.addEventListener("abort", () => {
					const e = new Error("The operation was aborted");
					e.name = "AbortError";
					reject(e);
				});
			});
		const iris = createIrisClient({ baseUrl: "http://iris.stub", fetchImpl: hangingFetch, timeoutMs: 20 });
		try {
			await iris.getMessage(6, PURITY_TX);
			ok(false, "klien Iris: fetch menggantung harusnya dibatalkan");
		} catch (e) {
			ok(/timed out after 20ms/.test(e.message), "klien Iris: fetch menggantung dibatalkan pada timeoutMs");
		}

		// Perilaku lama tetap utk pemanggil tanpa timeoutMs (default 15s > smoke).
		const quickIris = createIrisClient({
			baseUrl: "http://iris.stub",
			fetchImpl: async () => ({ status: 404 }),
			timeoutMs: 500
		});
		ok((await quickIris.getMessage(6, PURITY_TX)) === null, "klien Iris: 404 → null (jalur lama utuh)");
	} finally {
		clearTimeout(keepAlive);
	}
}

async function runSpawnE2E() {
	console.log("[mcp-smoke] E2E stdio spawn (real server process)");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-mcp-e2e-"));
	const child = spawn(process.execPath, [path.join(__dirname, "..", "src", "mcp-server.js")], {
		cwd: path.join(__dirname, "..", ".."),
		env: { ...process.env, BACKEND_DATA_DIR: dir, BACKEND_NETWORK: "testnet" },
		stdio: ["pipe", "pipe", "pipe"]
	});
	let out = "";
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stdout.on("data", (c) => (out += c));

	const waitLines = (n, timeoutMs) =>
		new Promise((resolve, reject) => {
			const t0 = Date.now();
			const timer = setInterval(() => {
				const lines = out.split("\n").filter((l) => l.trim() !== "");
				if (lines.length >= n) {
					clearInterval(timer);
					resolve(lines);
				} else if (Date.now() - t0 > timeoutMs) {
					clearInterval(timer);
					reject(new Error(`timeout waiting for ${n} frames (got ${lines.length})`));
				}
			}, 25);
		});

	child.stdin.write(
		JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-smoke-e2e", version: "0.0.0" } } }) + "\n"
	);
	child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
	const lines = await waitLines(2, 8000);
	const init = JSON.parse(lines[0]);
	const list = JSON.parse(lines[1]);
	ok(init.result.protocolVersion === "2025-06-18" && init.result.serverInfo.name === "warparc-backend", "E2E: initialize handshake via child process");
	ok(list.result.tools.length === 7, "E2E: tools/list from spawned server");

	child.stdin.end();
	await new Promise((resolve) => child.on("exit", resolve));
	ok(child.exitCode === 0, "E2E: clean exit on stdin close (lock released)");
	fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
	await runUnitTests();
	await runGateTests();
	await runStdoutPurityTest();
	await runTimeoutTests();
	await runSpawnE2E();
	console.log(`\n[mcp-smoke] ${passed} assertions passed`);
}

main().catch((e) => {
	console.error("[mcp-smoke] FAIL:", e.stack || e.message);
	process.exitCode = 1;
});



