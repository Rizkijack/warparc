/**
 * Offline smoke tests for the backend core modules — no network, no keys.
 * Run: node backend/test/smoke.js   (exit 0 = all pass)
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const { Store } = require("../src/store");
const { createChainIndexer, TRANSFER_TOPIC } = require("../src/indexer");
const { parseCctpV2Message, MESSAGE_SENT_TOPIC, isZeroBytes32, CctpParseError } = require("../src/cctp");
const { createRelayer } = require("../src/relayer");
const { createServer } = require("../src/server");
const { acquireLock } = require("../src/lock");

let passed = 0;
function ok(cond, label) {
	assert.ok(cond, label);
	passed++;
	console.log(`  ✓ ${label}`);
}

const ERC20 = "0x3600000000000000000000000000000000000000";
const SYSTEM = "0xfffffffffffffffffffffffffffffffffffffffe";
const ALICE = "0x" + "aa".repeat(20);
const BOB = "0x" + "bb".repeat(20);
const pad32 = (addr) => "0x" + addr.slice(2).toLowerCase().padStart(64, "0");
const hexQty = (n) => "0x" + n.toString(16);

// --- Store -------------------------------------------------------------------

function testStore() {
	console.log("[smoke] Store");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-store-"));
	const s = new Store({ dir });

	s.appendEvent({ chain: "arc", block: 10, from: ALICE, to: BOB, amount6: "100" });
	s.appendEvent({ chain: "arc", block: 11, from: BOB, to: ALICE, amount6: "200" });
	s.appendEvent({ chain: "baseSepolia", block: 5, from: ALICE, to: BOB, amount6: "300" });

	ok(s.queryEvents({ chain: "arc" }).length === 2, "queryEvents filters by chain");
	ok(s.queryEvents({ address: ALICE.toUpperCase() }).length === 3, "queryEvents address match is case-insensitive (from||to)");
	ok(s.queryEvents({ chain: "arc", limit: 1 })[0].block === 11, "queryEvents newest-first + limit");
	ok(s.getState("missing", "fb") === "fb", "getState fallback");
	s.setState("indexer:arc", 1234);
	ok(s.getState("indexer:arc") === 1234, "setState/getState roundtrip");
	const s2 = new Store({ dir });
	ok(s2.getState("indexer:arc") === 1234, "state survives a new Store instance");

	fs.appendFileSync(path.join(dir, "events.jsonl"), "{corrupt\n");
	ok(new Store({ dir }).queryEvents({ limit: 10 }).length === 3, "corrupt events line skipped");
	fs.writeFileSync(path.join(dir, "state.json"), "not json");
	fs.writeFileSync(path.join(dir, "state-indexer.json"), "not json");
	ok(new Store({ dir }).getState("indexer:arc", null) === null, "corrupt state.json → fallback (no throw)");

	// P1-1: split-role fresh-read — a second Store instance must see appends
	// made by the first AFTER the second already loaded its cache.
	const reader = new Store({ dir });
	ok(reader.countEvents() === 3, "countEvents total");
	s.appendEvent({ chain: "arc", block: 12, from: ALICE, to: BOB, amount6: "400" });
	ok(reader.countEvents() === 4, "queryEvents/countEvents re-read file changed by another process");
	ok(reader.countEvents("arc") === 3, "countEvents per chain");
}

// --- Store rotation threshold (synthetic 1MB) --------------------------------

function testRotationThreshold() {
	console.log("[smoke] Store rotation threshold (synthetic 1MB)");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-rotation-"));
	const prev = process.env.BACKEND_EVENTS_MAX_MB;
	process.env.BACKEND_EVENTS_MAX_MB = "1";
	try {
		const s = new Store({ dir });
		const big = "x".repeat(600 * 1024); // ~600KB payload
		const txA = "0x" + "11".repeat(32);
		const txB = "0x" + "22".repeat(32);
		s.appendEvent({ chain: "arc", block: 1, from: ALICE, to: BOB, amount6: "100", kind: "erc20", txHash: txA, logIndex: "0x0", emitter: ERC20, data: big });
		s.appendEvent({ chain: "arc", block: 2, from: ALICE, to: BOB, amount6: "200", kind: "erc20", txHash: txB, logIndex: "0x1", emitter: ERC20, data: big });
		const files = fs.readdirSync(dir);
		const rotated = files.filter((n) => /^events-\d{8}-\d{3}\.jsonl$/.test(n));
		ok(rotated.length >= 1, "rotation created events-YYYYMMDD-NNN.jsonl (threshold 1MB)");
		ok(fs.existsSync(path.join(dir, "events.jsonl")), "active events.jsonl still exists after rotation");
		const both = s.queryEvents({ limit: 10 });
		ok(both.length === 2, "queryEvents across rotated files returns all (2)");
		ok(s.countEvents() === 2, "countEvents after rotation =2");
		const s2 = new Store({ dir });
		ok(s2.queryEvents({ limit: 10 }).length === 2, "second Store instance sees rotated events");
		ok(s2.queryEvents({ limit: 1 })[0].block === 2, "newest-first after rotation");
		ok(typeof s._discoverEventFiles === "function", "_discoverEventFiles exists");
		const discovered = s._discoverEventFiles();
		ok(discovered[0] === s.eventsPath, "_discoverEventFiles newest-first starts with active");
		ok(s._eventsMaxMb() === 1, "_eventsMaxMb respects env");
		ok(typeof s._rotate === "function", "_rotate exists");
	} finally {
		if (prev === undefined) delete process.env.BACKEND_EVENTS_MAX_MB;
		else process.env.BACKEND_EVENTS_MAX_MB = prev;
		try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
	}
}

// --- Store state sharding LWW cross-role ------------------------------------

function testStateShardingLWW() {
	console.log("[smoke] Store state sharding LWW cross-role");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-shard-"));
	const s = new Store({ dir });
	s.setState("indexer:arc", 100);
	s.setState("relayer", { jobs: { a: 1 } });
	ok(fs.existsSync(path.join(dir, "state-indexer.json")), "state-indexer.json created");
	ok(fs.existsSync(path.join(dir, "state-relayer.json")), "state-relayer.json created");
	ok(s.getState("indexer:arc") === 100, "indexer shard readback");
	ok(s.getState("relayer").jobs.a === 1, "relayer shard readback");
	// cross-role: concurrent writes from different Store instances (simulating indexer vs relayer)
	const sIndexer = new Store({ dir });
	const sRelayer = new Store({ dir });
	sIndexer.setState("indexer:arc", 200);
	sRelayer.setState("relayer:budget", { date: "2026-08-26", perChain: {} });
	ok(sIndexer.getState("indexer:arc") === 200, "indexer shard updated via cross-role");
	ok(sRelayer.getState("relayer:budget").date === "2026-08-26", "relayer shard budget written");
	ok(sIndexer.getState("relayer").jobs.a === 1, "relayer key not clobbered by indexer write (sharding LWW)");
	ok(sRelayer.getState("indexer:arc") === 200, "cross-role visibility for indexer key");
	// lazy migration from legacy state.json
	const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-migrate-"));
	fs.writeFileSync(path.join(dir2, "state.json"), JSON.stringify({ "indexer:arc": 999, "relayer": { jobs: { x: 1 } }, "indexer:baseSepolia": 555 }));
	const sMig = new Store({ dir: dir2 });
	ok(sMig.getState("indexer:arc") === 999, "lazy migration indexer from legacy");
	ok(sMig.getState("relayer").jobs.x === 1, "lazy migration relayer from legacy");
	ok(fs.existsSync(path.join(dir2, "state-indexer.json")), "migration created state-indexer.json");
	ok(sMig.getState("indexer:baseSepolia") === 555, "migration preserved other indexed keys");
	sMig.setState("indexer:arc", 1000);
	ok(sMig.getState("indexer:arc") === 1000, "shard setState after migration");
	ok(sMig.getState("relayer").jobs.x === 1, "relayer still intact after indexer update post-migration");
	try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
	try { fs.rmSync(dir2, { recursive: true, force: true }); } catch (_) {}
	ok(typeof s._pathForKey === "function", "_pathForKey exists");
	ok(s._pathForKey("indexer:arc").endsWith("state-indexer.json"), "_pathForKey indexer -> state-indexer.json");
	ok(s._pathForKey("relayer").endsWith("state-relayer.json"), "_pathForKey relayer -> state-relayer.json");
	ok(s._pathForKey("relayer:budget").endsWith("state-relayer.json"), "_pathForKey relayer:budget -> state-relayer.json");
	ok(s._pathForKey("otherKey").endsWith("state.json"), "_pathForKey generic -> state.json");
}

// --- Lock ---------------------------------------------------------------------

function testLock() {
	console.log("[smoke] acquireLock (single-instance per role)");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-lock-"));
	const release = acquireLock({ dir, role: "indexer" });
	ok(fs.existsSync(path.join(dir, "lock-indexer.json")), "lock file created");
	assert.throws(() => acquireLock({ dir, role: "indexer" }), /already running/, "second acquire refused while holder alive");
	const release2 = acquireLock({ dir, role: "server" });
	ok(true, "different role gets its own lock");
	release();
	const release3 = acquireLock({ dir, role: "indexer" });
	ok(true, "re-acquire after release works");
	// stale takeover: fake a dead holder
	release3();
	fs.writeFileSync(path.join(dir, "lock-relayer.json"), JSON.stringify({ pid: 999999999, role: "relayer" }));
	const release4 = acquireLock({ dir, role: "relayer" });
	ok(true, "stale lock (dead PID) taken over");
	release2();
	release4();
}

// --- Indexer -----------------------------------------------------------------

function makeStubRpc(head, logs) {
	return async (method, params) => {
		if (method === "eth_blockNumber") return hexQty(head);
		if (method === "eth_getBlockByNumber") {
			const b = parseInt(params[0], 16);
			return { timestamp: hexQty(1750000000 + b) };
		}
		if (method === "eth_getLogs") {
			const from = parseInt(params[0].fromBlock, 16);
			const to = parseInt(params[0].toBlock, 16);
			return logs.filter((l) => {
				const b = parseInt(l.blockNumber, 16);
				return b >= from && b <= to;
			});
		}
		throw new Error(`unexpected method ${method}`);
	};
}

function logObj(block, logIndex, emitter, from, to, valueRaw, txHash) {
	return {
		address: emitter,
		blockNumber: hexQty(block),
		logIndex: hexQty(logIndex),
		transactionHash: txHash || ("0x" + block.toString(16).padStart(2, "0") + "ab".repeat(31)),
		topics: [TRANSFER_TOPIC, pad32(from), pad32(to)],
		data: "0x" + BigInt(valueRaw).toString(16).padStart(64, "0")
	};
}

function testIndexer() {
	console.log("[smoke] createChainIndexer (Arc dual-emitter)");
	const tx = "0x" + "cd".repeat(32);
	const ZERO20 = "0x" + "0".repeat(20);
	const logs = [
		logObj(100, 1, ERC20, ALICE, BOB, 1_500_000n, tx), // canonical 6-dec
		logObj(100, 2, SYSTEM, ALICE, BOB, 1_500_000n * 10n ** 12n, tx), // mirror 18-dec
		logObj(100, 3, "0x" + "99".repeat(20), ALICE, BOB, 5n, tx), // unknown emitter → skipped
		logObj(99, 0, SYSTEM, ZERO20, BOB, 2_000_000n * 10n ** 12n), // mint (0x0 → BOB)
		logObj(98, 0, SYSTEM, ALICE, ZERO20, 3_000_000n * 10n ** 12n) // burn (ALICE → 0x0)
	];
	const state = new Map();
	const chain = { key: "arc", rpcUrl: "stub", usdcEmitters: [ERC20], systemEmitter: SYSTEM, confirmations: 1 };
	const idx = createChainIndexer({
		chain,
		rpcCall: makeStubRpc(101, logs),
		getState: (k, f) => (state.has(k) ? state.get(k) : f),
		setState: (k, v) => state.set(k, v)
	});

	const r1 = idx.pollOnce();
	ok(r1 instanceof Promise, "pollOnce is async");
	r1.then(({ entries, safeHead, nextBlock }) => {
		ok(safeHead === 100, "confirmations=1 → safeHead = head-1");
		ok(nextBlock === 101, "watermark advanced to safeHead+1");
		ok(entries.length === 4, "unknown emitter skipped, both USDC emitters + mint/burn kept");
		const erc20 = entries.find((e) => e.kind === "erc20");
		const system = entries.find((e) => e.kind === "system" && e.block === 100);
		ok(erc20 && erc20.amount6 === "1500000", "erc20 amount6 = 6-dec raw");
		ok(system && system.amount6 === "1500000", "system 18-dec mirror normalized ÷1e12 to same 6-dec value");
		ok(erc20 && system && erc20.amount6 === system.amount6, "no double-count: both views agree in USDC units");
		ok(erc20 && erc20.from === ALICE && erc20.to === BOB, "from/to parsed from topics");
		const mint = entries.find((e) => e.block === 99);
		const burn = entries.find((e) => e.block === 98);
		ok(mint && mint.direction === "mint" && mint.to === BOB, "mint tagged: Transfer(0x0 → to)");
		ok(burn && burn.direction === "burn" && burn.from === ALICE, "burn tagged: Transfer(from → 0x0)");
		ok(erc20 && erc20.direction === "transfer", "plain transfer tagged");
		ok(mint && mint.blockTimestamp === new Date((1750000000 + 99) * 1000).toISOString(), "blockTimestamp enriched from eth_getBlockByNumber");
		ok(state.get("indexer:arc") === 101, "watermark persisted under indexer:arc");
		return idx.pollOnce().then(({ entries: e2 }) => {
			ok(e2.length === 0, "second poll with same head → 0 entries (watermark)");
			testEvmOnlyChain();
		});
	});
}

function testEvmOnlyChain() {
	console.log("[smoke] createChainIndexer (EVM chain, no system emitter)");
	const logs = [logObj(50, 0, ERC20, ALICE, BOB, 42n)];
	const state = new Map();
	const chain = { key: "baseSepolia", rpcUrl: "stub", usdcEmitters: ["0x" + "12".repeat(20)], systemEmitter: null, confirmations: 1 };
	const idx = createChainIndexer({
		chain,
		rpcCall: makeStubRpc(60, logs),
		getState: (k, f) => (state.has(k) ? state.get(k) : f),
		setState: (k, v) => state.set(k, v)
	});
	idx.pollOnce().then(({ entries }) => {
		ok(entries.length === 0, "emitter not in list → skipped (filter by emitter, never count others)");
		testServerHostGuard();
	});
}

// --- Server host guard + /events kind validation --------------------------------

function testServerHostGuard() {
	console.log("[smoke] Server host guard + /events kind validation");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-srv-"));
	const store = new Store({ dir });
	const backendCfg = {
		network: "testnet",
		cfg: { iris: { testnet: "stub" }, chains: {} },
		server: { host: "127.0.0.1", port: 0 }
	};
	const relayerStub = { stats: () => ({ mode: "watch-only" }), getJobs: () => ({}) };
	const srv = createServer({ backendCfg, store, relayer: relayerStub, iris: null, indexerChains: [], log: silentLog() });

	srv.listen(0, "127.0.0.1", () => {
		const port = srv.address().port;
		backendCfg.server.port = port;

		function httpGet(hostHeader, urlPath) {
			return new Promise((resolve, reject) => {
				http.get({ hostname: "127.0.0.1", port, path: urlPath, headers: { Host: hostHeader } }, (res) => {
					let body = "";
					res.on("data", (chunk) => body += chunk);
					res.on("end", () => {
						const headers = res.headers;
						try { resolve({ status: res.statusCode, headers, body: JSON.parse(body) }); }
						catch (_) { resolve({ status: res.statusCode, headers, body }); }
					});
				}).on("error", reject);
			});
		}

		httpGet(`127.0.0.1:${port}`, "/health")
			.then((r) => {
				ok(r.status === 200, "correct Host header → 200");
				return httpGet("127.0.0.1:9999", "/health");
			})
			.then((r) => {
				ok(r.status === 403, "wrong port in Host → 403");
				return httpGet(`localhost:${port}`, "/health");
			})
			.then((r) => {
				ok(r.status === 200, "localhost:correctport → 200");
				return httpGet(`127.0.0.1:${port}`, "/events?kind=invalid");
			})
			.then((r) => {
				ok(r.status === 400 && /kind/.test(r.body.error), "kind=invalid → 400 with 'kind' in error");
				return httpGet(`127.0.0.1:${port}`, "/events?kind=erc20");
			})
			.then((r) => {
				ok(r.status === 200, "kind=erc20 → 200");
				return httpGet(`127.0.0.1:${port}`, "/events");
			})
			.then((r) => {
				ok(r.status === 200, "no kind param → 200");
				return httpGet(`127.0.0.1:${port}`, "/metrics");
			})
			.then((r) => {
				ok(r.status === 200, "GET /metrics →200");
				ok(String(r.headers["content-type"] || "").includes("text/plain"), "GET /metrics Content-Type text/plain");
				ok(typeof r.body === "string" && r.body.includes("warparc_events_total"), "metrics body contains warparc_events_total");
				ok(typeof r.body === "string" && r.body.includes("warparc_uptime_seconds"), "metrics body contains warparc_uptime_seconds");
				srv.close();
				finish();
			})
			.catch((err) => {
				console.error("[smoke] server test error:", err);
				srv.close();
				process.exitCode = 1;
			});
	});
}

// --- CCTP message parser -------------------------------------------------------

function testCctpParser() {
	console.log("[smoke] parseCctpV2Message (offsets per circlefin/evm-cctp-contracts)");
	// Hand-built message: header(148B) + burn body(228B, no hookData)
	const header =
		"00000002" + // version=2 (uint32)
		"0000001a" + // sourceDomain=26 (Arc)
		"00000000" + // destinationDomain=0 (Ethereum Sepolia)
		"0123456789abcdef".padEnd(64, "0") + // nonce
		pad32(ALICE).slice(2) + // sender
		pad32(BOB).slice(2) + // recipient
		"0".repeat(64) + // destinationCaller = zero → relayable by anyone
		"000003e8" + // minFinalityThreshold=1000
		"00000000"; // finalityThresholdExecuted
	const body =
		"00000002" + // version
		pad32(ERC20).slice(2) + // burnToken
		pad32(BOB).slice(2) + // mintRecipient
		(1_000_000n).toString(16).padStart(64, "0") + // amount = 1 USDC
		pad32(ALICE).slice(2) + // messageSender
		(500n).toString(16).padStart(64, "0") + // maxFee
		"0".repeat(64) + // feeExecuted
		"0".repeat(64); // expirationBlock (body ends here — no hookData)
	const msg = "0x" + header + body;
	const p = parseCctpV2Message(msg);
	ok(p.sourceDomain === 26 && p.destinationDomain === 0, "src/dst domains parsed at offsets 4/8");
	ok(p.destinationCaller === "0x" + "0".repeat(64) && isZeroBytes32(p.destinationCaller), "destinationCaller zero-detect");
	ok(p.burnToken === ERC20 && p.mintRecipient === BOB, "burnToken/mintRecipient parsed from body");
	ok(p.amount === "1000000" && p.maxFee === "500", "amount/maxFee parsed (uint256)");
	ok(p.hasHook === false, "no hookData → hasHook false");
	ok(parseCctpV2Message(msg + "0".repeat(64)).hasHook === true, "any non-empty hookData (even all-zero) counts as a hook");
	ok(MESSAGE_SENT_TOPIC.length === 66, "MessageSent topic0 constant present");

	const dstCallerSet = "0x" + header.slice(0, 216) + "ff".repeat(32) + header.slice(216 + 64) + body;
	ok(!isZeroBytes32(parseCctpV2Message(dstCallerSet).destinationCaller), "non-zero destinationCaller detectable");
	assert.throws(() => parseCctpV2Message("0x1234"), /too short/, "short message rejected");
}

// --- CctpParseError classification ---------------------------------------------

function testCctpParseError() {
	console.log("[smoke] CctpParseError classification");
	const header =
		"00000002" +
		"0000001a" +
		"00000000" +
		"0123456789abcdef".padEnd(64, "0") +
		pad32(ALICE).slice(2) +
		pad32(BOB).slice(2) +
		"0".repeat(64) +
		"000003e8" +
		"00000000";
	const body =
		"00000002" +
		pad32(ERC20).slice(2) +
		pad32(BOB).slice(2) +
		(1_000_000n).toString(16).padStart(64, "0") +
		pad32(ALICE).slice(2) +
		(500n).toString(16).padStart(64, "0") +
		"0".repeat(64) +
		"0".repeat(64);
	const msg = "0x" + header + body;
	const parsed = parseCctpV2Message(msg);
	ok(parsed.version === 2, "valid V2 message parses without throw");
	const v1Msg = "0x" + "00000001" + header.slice(8) + body;
	try {
		parseCctpV2Message(v1Msg);
		ok(false, "version=1 should have thrown");
	} catch (e) {
		ok(e.name === "CctpParseError", "version=1 error name is CctpParseError");
		ok(e instanceof CctpParseError && /version 1/.test(e.message), "version=1 instanceof CctpParseError with 'version 1' in message");
	}
	try {
		parseCctpV2Message("0x1234");
		ok(false, "too-short should have thrown");
	} catch (e) {
		ok(e instanceof CctpParseError && /too short/.test(e.message), "too-short message throws CctpParseError");
	}
}

// --- Store kind filter + read-side dedup ----------------------------------------

function testStoreKindDedup() {
	console.log("[smoke] Store queryEvents kind filter + read-side dedup");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "warparc-kind-"));
	const s = new Store({ dir });
	const txA = "0x" + "ab".repeat(32);
	const txB = "0x" + "cd".repeat(32);
	s.appendEvent({ chain: "arc", block: 10, from: ALICE, to: BOB, amount6: "100", kind: "erc20", txHash: txA, logIndex: "0x1", emitter: ERC20 });
	s.appendEvent({ chain: "arc", block: 11, from: BOB, to: ALICE, amount6: "200", kind: "system", txHash: txB, logIndex: "0x2", emitter: SYSTEM });
	s.appendEvent({ chain: "arc", block: 10, from: ALICE, to: BOB, amount6: "100", kind: "erc20", txHash: txA, logIndex: "0x1", emitter: ERC20 });
	ok(s.queryEvents({ kind: "erc20" }).length === 1, "kind=erc20 returns 1 (duplicate deduped)");
	ok(s.queryEvents({ kind: "system" }).length === 1, "kind=system returns 1");
	ok(s.queryEvents().length === 2, "no kind returns 2 unique events (dedup removed duplicate)");
	ok(s.queryEvents({ kind: "erc20" })[0].block === 10, "dedup kept the erc20 event with correct block");
}

// --- Relayer config guards -----------------------------------------------------

function testRelayerGuards() {
	console.log("[smoke] relayer boot guards");
	const chains = [{ key: "arc", chainId: 5042002, cctpDomain: 26, rpcUrl: "stub", messageTransmitterV2: "0x1", usdc: ERC20, isArc: true }];
	const baseCfg = {
		network: "testnet",
		cfg: { iris: { testnet: "stub" } },
		relayer: {
			enabled: true,
			dryRun: false,
			privateKey: null,
			autoRelay: false,
			allowHooks: false,
			maxRelayUsdc: 1000,
			dailyUsdcBudget: 50,
			dailyEthBudget: 0.5,
			irisChecksPerTick: 20,
			pollMs: 9999,
			attestationTimeoutMs: 1,
			maxSubmitAttempts: 5,
			maxJobs: 500
		},
		server: {}
	};
	assert.throws(() => createRelayer({ backendCfg: baseCfg, chains, store: stubStore(), log: silentLog() }), /RELAYER_PRIVATE_KEY/, "live mode without key fails closed");
	assert.throws(
		() =>
			createRelayer({
				backendCfg: { ...baseCfg, relayer: { ...baseCfg.relayer, enabled: false, dryRun: false, privateKey: "zz" } },
				chains,
				store: stubStore(),
				log: silentLog()
			}),
		/not a valid 64-hex/,
		"malformed key rejected"
	);
	const r = createRelayer({
		backendCfg: { ...baseCfg, relayer: { ...baseCfg.relayer, enabled: false, dryRun: true, privateKey: null } },
		chains,
		store: stubStore(),
		log: silentLog()
	});
	assert.throws(() => r.enqueue("arc", "0x123"), /invalid tx hash/, "bad tx hash rejected");
	assert.throws(() => r.enqueue("nope", "0x" + "ab".repeat(32)), /unknown src chain/, "unknown chain rejected");
	const job = r.enqueue("arc", "0x" + "ab".repeat(32));
	ok(job.status === "queued" && r.getJobs()[job.txHash].status === "queued", "enqueue persists a queued job");
	ok(r.stats().mode === "watch-only", "default boot is watch-only");
	const st = r.stats();
	ok(st.budgets && st.budgets.arc && st.budgets.arc.unit === "USDC" && st.budgets.arc.paused === false, "stats exposes per-chain gas budget (Arc=USDC, not paused)");
	ok(st.budgets && typeof st.budgets === "object" && st.budgets.arc && st.budgets.arc.unit === "USDC", "stats budgets is object with arc chain USDC unit");
}

// --- Relayer module shape -------------------------------------------------------

function testRelayerModuleShape() {
	console.log("[smoke] Relayer module shape");
	ok(typeof createRelayer === "function", "createRelayer exported as function");
	// IRIS_FETCH_TIMEOUT_MS is read at module load from RELAYER_IRIS_TIMEOUT_MS env;
	// full timeout behaviour requires a live Iris mock + async tick — integration only.
	const { ALREADY_RELAYED_RE } = require("../src/relayer");
	ok(ALREADY_RELAYED_RE instanceof RegExp, "ALREADY_RELAYED_RE exported as RegExp");
}

function stubStore() {
	const mem = new Map();
	const jobs = { jobs: {} };
	return {
		getState: (k, f) => (k === "relayer" ? jobs : mem.has(k) ? mem.get(k) : f),
		setState: (k, v) => (k === "relayer" ? Object.assign(jobs, v) : mem.set(k, v))
	};
}
function silentLog() {
	return { info: () => {}, warn: () => {}, error: () => {} };
}

// --- run -----------------------------------------------------------------------

testStore();
testLock();
testCctpParser();
testCctpParseError();
testStoreKindDedup();
testRotationThreshold();
testStateShardingLWW();
testRelayerGuards();
testRelayerModuleShape();
testIndexer(); // async tail → testEvmOnlyChain → testServerHostGuard → finish

function finish() {
	console.log(`\n[smoke] OK — ${passed} assertions passed`);
	process.exitCode = 0;
}
