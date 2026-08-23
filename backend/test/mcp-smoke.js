/**
 * Offline smoke tests untuk MCP server — tanpa network, tanpa key.
 * Run: node backend/test/mcp-smoke.js   (exit 0 = semua lolos)
 *
 * Liputan: version negotiation initialize, tools/list + tools/call (health,
 * jobs, events, budget, config, guard relay_submit), resources/list + read,
 * prompts/list + get, ping, pemetaan error JSON-RPC, dan SATU spawn end-to-end
 * server stdio asli (framing line-delimited lewat child process).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { Store } = require("../src/store");
const { createMcpServer, PROTOCOL_VERSIONS, LATEST_PROTOCOL } = require("../src/mcp-server");

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
	const mcp = createMcpServer({ backendCfg, store, relayer: null, iris: null, indexerChains, log: silentLog() });
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
	await runSpawnE2E();
	console.log(`\n[mcp-smoke] ${passed} assertions passed`);
}

main().catch((e) => {
	console.error("[mcp-smoke] FAIL:", e.stack || e.message);
	process.exitCode = 1;
});



