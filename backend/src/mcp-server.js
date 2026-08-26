/**
 * MCP server (stdio) untuk backend WarpArc — Model Context Protocol.
 *
 * Spec: https://modelcontextprotocol.io (2025-06-18 & 2026-07-28 — dinegosiasikan
 * via initialize.protocolVersion). Transport: JSON-RPC 2.0 line-delimited over
 * stdio — stdout HANYA untuk protocol, semua log ke stderr.
 *
 * Menyalurkan permukaan ops backend ke MCP client (agent):
 *   Tools     — warparc_health, warparc_jobs, warparc_events, warparc_status,
 *               warparc_relay_submit, warparc_budget, warparc_config
 *   Resources — warparc://state, warparc://events/recent
 *   Prompts   — warparc-audit-relayer, warparc-launch-day
 *
 * Keamanan (fail-closed, sama seperti server.js):
 *   - Read-only kecuali warparc_relay_submit, yang memakai GUARD relayer yang
 *     sama dengan POST /relay: enqueue hanya mencatat job ops — pengiriman
 *     on-chain hanya dijalankan proses backend yang LIVE
 *     (RELAYER_ENABLED=true && RELAYER_DRY_RUN=false && RELAYER_PRIVATE_KEY).
 *   - Respons tidak pernah memuat secret (key tetap di env; job hanya hash).
 *   - Instance standalone TIDAK menjalankan tick relayer (tidak ada double-
 *     submit dengan `npm run backend`); hanya menyediakan API baca/tulis job.
 *   - Transport stdio = proses lokal. Rencana remote (Streamable HTTP + auth)
 *     ada di mcp/README.md — jangan expose tanpa auth.
 *
 * Run : node backend/src/mcp-server.js   (atau npm run backend:mcp)
 * Test: node backend/test/mcp-smoke.js
 */
"use strict";

const fs = require("fs");

const { loadBackendConfig, getIndexerChains, getRelayerChains } = require("./config");
const { Store } = require("./store");
const { createRelayer } = require("./relayer");
const { createIrisClient } = require("./attestation");
const { acquireLock } = require("./lock");

// Versi protocol MCP yang dipahami server (terbaru dulu). Per spec: server
// memakai protocolVersion client bila didukung, selain itu versi terbarunya.
const PROTOCOL_VERSIONS = ["2026-07-28", "2025-06-18"];
const LATEST_PROTOCOL = PROTOCOL_VERSIONS[0];
const SERVER_VERSION = "1.0.0";

// JSON-RPC 2.0 error codes
const ERR_PARSE = -32700;
const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_INTERNAL = -32603;

// /status Iris throttle — sama seperti GET /status (server.js): lookup live
// tidak boleh memakai budget 40 req/s Iris milik relayer.
const STATUS_IRIS_RPS_DEFAULT = 2;

function statusIrisMinIntervalMs() {
	const raw = Number(process.env.BACKEND_STATUS_IRIS_RPS);
	if (!Number.isFinite(raw) || raw <= 0) return 1000 / STATUS_IRIS_RPS_DEFAULT;
	return 1000 / raw;
}

/** Ambil string non-kosong dari argumen tool; null bila absen. */
function reqString(args, key) {
	const v = args ? args[key] : undefined;
	return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** Error domain tool — ditampilkan sebagai content isError, bukan protocol error. */
function toolError(message) {
	const e = new Error(message);
	e.mcpToolError = true;
	return e;
}

/**
 * Buat MCP server. Param-param identik dengan createServer() (backend/src/server.js):
 * @param {{ backendCfg, store, relayer?, iris?, indexerChains?, log? }} deps
 *   relayer/iris boleh null (mode read-only) — cocok untuk test offline.
 * @returns {{ handleFrame(line: string): Promise<string|null> }}
 */
function createMcpServer({ backendCfg, store, relayer = null, iris = null, indexerChains = [], log = console }) {
	let clientProtocol = LATEST_PROTOCOL;
	const startedAt = Date.now();
	let lastIrisCallAt = 0;

	// ---- tool handlers (function declarations — di-hoist; TOOLS di bawah) ----

	async function hHealth() {
		return {
			ok: true,
			network: backendCfg.network,
			uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
			indexer: {
				chains: indexerChains.map((c) => ({
					key: c.key,
					lastIndexedBlockPlusOne: store.getState(`indexer:${c.key}`, null)
				})),
				eventCounts: Object.fromEntries(indexerChains.map((c) => [c.key, store.countEvents(c.key)]))
			},
			relayer: relayer ? relayer.stats() : { mode: "disabled" }
		};
	}

	async function hJobs(args) {
		const all = relayer ? relayer.getJobs() : {};
		const status = reqString(args, "status");
		const jobs = Object.values(all).filter((j) => (status === null ? true : j.status === status));
		return { total: Object.keys(all).length, status: status || "all", jobs };
	}

	async function hEvents(args) {
		const chain = reqString(args, "chain");
		const address = reqString(args, "address");
		const kind = reqString(args, "kind");
		if (kind !== null && kind !== "erc20" && kind !== "system") {
			throw toolError("kind must be 'erc20' or 'system' (Arc dual-emitter — jangan jumlahkan lintas kind)");
		}
		// Chain WAJIB dan harus dikenal — konsisten dengan GET /events
		// (backend/src/server.js): chain typo tidak boleh diam-diam return
		// kosong karena tak terbedakan dari "belum ada event terindeks".
		if (!chain) throw toolError("chain is required (mis. 'arc', 'baseSepolia')");
		if (!backendCfg.cfg.chains[chain]) {
			throw toolError(`unknown chain \"${chain}\"`);
		}
		const lim = parseInt(args && args.limit, 10);
		const limit = Number.isInteger(lim) && lim > 0 ? Math.min(lim, 1000) : 100;
		const events = store.queryEvents({ chain, address, kind, limit });
		return { count: events.length, limit, events };
	}

	async function hStatus(args) {
		const srcChain = reqString(args, "srcChain");
		const txHash = reqString(args, "txHash");
		if (!srcChain || !txHash) throw toolError("srcChain and txHash are required");
		const tx = txHash.toLowerCase();
		if (!/^0x[0-9a-f]{64}$/.test(tx)) throw toolError("txHash must be a 0x-hex transaction hash");
		const cfgChain = backendCfg.cfg.chains[srcChain];
		if (!cfgChain || cfgChain.cctpDomain == null) throw toolError(`unknown srcChain "${srcChain}"`);
		const job = relayer ? relayer.getJobs()[tx] || null : null;
		let irisState = null;
		const now = Date.now();
		if (iris && now - lastIrisCallAt >= statusIrisMinIntervalMs()) {
			lastIrisCallAt = now; // panggilan (sukses ATAU gagal) memakai slot
			try {
				const msg = await iris.getMessage(cfgChain.cctpDomain, tx);
				irisState = msg ? { status: msg.status, eventNonce: msg.eventNonce ?? null } : null;
			} catch (e) {
				irisState = { error: e.message };
			}
		} else if (iris) {
			irisState = { throttled: true };
		}
		return { job, iris: irisState };
	}

	async function hRelaySubmit(args) {
		if (!relayer) throw toolError("relayer tidak aktif — jalankan backend dulu (npm run backend) untuk queue job");
		const srcChain = reqString(args, "srcChain");
		const burnTxHash = reqString(args, "burnTxHash");
		if (!srcChain || !burnTxHash) throw toolError("srcChain and burnTxHash are required");
		try {
			await relayer.validateBurnTx(srcChain, burnTxHash);
			const job = relayer.enqueue(srcChain, burnTxHash);
			return {
				job,
				note: "queued (entri ops) — pengiriman on-chain hanya terjadi bila backend relayer LIVE: RELAYER_ENABLED=true && RELAYER_DRY_RUN=false && RELAYER_PRIVATE_KEY"
			};
		} catch (e) {
			throw toolError(e.message);
		}
	}

	async function hBudget() {
		const st = relayer ? relayer.stats() : { mode: "disabled" };
		return {
			mode: st.mode,
			budgetDate: st.budgetDate || null,
			budgets: st.budgets || {}
		};
	}

	async function hConfig() {
		const chains = [];
		for (const [key, c] of Object.entries(backendCfg.cfg.chains || {})) {
			if (!c || typeof c !== "object") continue;
			chains.push({
				key,
				name: c.name || null,
				chainId: c.chainId ?? null,
				cctpDomain: c.cctpDomain ?? null,
				rpcUrl: c.rpcUrl || null,
				disabled: !!c.disabled
			});
		}
		return {
			network: backendCfg.network,
			relayerMode: relayer ? relayer.stats().mode : "disabled",
			indexChains: indexerChains.map((c) => c.key),
			dataDir: backendCfg.dataDir,
			chains
		};
	}

	// ---- tool registry (deskripsi jujur utk agent discoverability) -----------

	const TOOLS = [
		{
			name: "warparc_health",
			description: "Backend liveness: network, uptime, watermark & jumlah event indexer per chain, mode relayer + distribusi status job.",
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "warparc_jobs",
			description: "Daftar job relayer, opsional difilter status lifecyle (queued, attestation_wait, ready, submitting, relayed, skipped, failed).",
			inputSchema: { type: "object", properties: { status: { type: "string", description: "Filter status (opsional)" } } }
		},
		{
			name: "warparc_events",
			description: "Query event transfer USDC terindeks, terbaru dulu. chain/address/kind/limit; kind=erc20|system — Arc memancarkan DUA log per pergerakan, jangan dijumlahkan lintas kind.",
			inputSchema: {
				type: "object",
				properties: {
					chain: { type: "string" },
					address: { type: "string" },
					kind: { type: "string", enum: ["erc20", "system"] },
					limit: { type: "integer", maximum: 1000 }
				}
			}
		},
		{
			name: "warparc_status",
			description: "State job + state attestation Circle Iris live untuk satu burn tx (di-throttle agar tidak memakai budget Iris 40 req/s milik relayer).",
			inputSchema: { type: "object", properties: { srcChain: { type: "string" }, txHash: { type: "string" } } }
		},
		{
			name: "warparc_relay_submit",
			description: "Queue satu burn tx untuk di-relay — GUARD sama dengan POST /relay: hanya mencatat job ops; pengiriman on-chain tetap dijalankan backend relayer yang LIVE (RELAYER_ENABLED=true && RELAYER_DRY_RUN=false && RELAYER_PRIVATE_KEY).",
			inputSchema: { type: "object", properties: { srcChain: { type: "string" }, burnTxHash: { type: "string" } } }
		},
		{
			name: "warparc_budget",
			description: "Budget gas harian per chain tujuan (USDC di Arc, ETH di EVM) + state pause per tanggal UTC.",
			inputSchema: { type: "object", properties: {} }
		},
		{
			name: "warparc_config",
			description: "Ringkasan network: chain aktif, chainId, CCTP domain, RPC URL, mode relayer, data dir. Tidak pernah memuat secret.",
			inputSchema: { type: "object", properties: {} }
		}
	];
	const TOOL_HANDLERS = {
		warparc_health: hHealth,
		warparc_jobs: hJobs,
		warparc_events: hEvents,
		warparc_status: hStatus,
		warparc_relay_submit: hRelaySubmit,
		warparc_budget: hBudget,
		warparc_config: hConfig
	};

	// ---- resources -------------------------------------------------------------

	const RESOURCES = [
		{
			uri: "warparc://state",
			name: "Backend state.json",
			description: "Raw state: watermark (indexer:<chain>, relayer:watch:<chain>), job relayer & budget gas harian. File kecil — aman dibaca utuh.",
			mimeType: "application/json"
		},
		{
			uri: "warparc://events/recent",
			name: "Event USDC terindeks (terbaru)",
			description: "Maks 500 event terbaru (events.jsonl bisa >50MB — gunakan tool warparc_events untuk query terfilter).",
			mimeType: "application/json"
		}
	];

	function readStateRaw() {
		try {
			return fs.readFileSync(store.statePath, "utf8");
		} catch (e) {
			if (e.code === "ENOENT") return "{}\n";
			throw e;
		}
	}

	async function readResource(uri) {
		if (uri === "warparc://state") {
			return [{ uri, mimeType: "application/json", text: readStateRaw() }];
		}
		if (uri === "warparc://events/recent") {
			const total = store.countEvents();
			const events = store.queryEvents({ limit: 500 });
			return [{ uri, mimeType: "application/json", text: JSON.stringify({ total, returned: events.length, events }, null, 2) }];
		}
		throw Object.assign(new Error(`Unknown resource: ${uri}`), { mcpInvalidParams: true });
	}

	// ---- prompts ---------------------------------------------------------------

	const PROMPTS = [
		{ name: "warparc-audit-relayer", description: "Audit kesehatan relayer: mode, distribusi status job, budget gas per chain." },
		{ name: "warparc-launch-day", description: "Runbook singkat hari publik mainnet Arc (2026-09-16): fail-closed, isi nilai hanya dari docs.arc.io." }
	];

	async function getPrompt(name) {
		if (name === "warparc-audit-relayer") {
			const health = await hHealth();
			const budget = await hBudget();
			const text = [
				"Audit relayer WarpArc:",
				`- network: ${health.network}, mode: ${health.relayer.mode}`,
				`- indexer: ${JSON.stringify(health.indexer)}`,
				`- job per status: ${JSON.stringify(health.relayer.byStatus || {})}`,
				`- budget ${budget.budgetDate}: ${JSON.stringify(budget.budgets)}`,
				"Langkah lanjutan: cek job 'ready' lewat warparc_jobs(status=ready); periksa Iris via warparc_status per burnTxHash; pastikan mode watch-only bila tidak ada izin LIVE."
			].join("\n");
			return { messages: [{ role: "user", content: { type: "text", text } }] };
		}
		if (name === "warparc-launch-day") {
			const text = [
				"Runbook launch-day (Arc mainnet publik — 2026-09-16):",
				"1. Ambil nilai RESMI dari https://docs.arc.io: chain ID, RPC, WSS, contract addresses, CCTP domain mainnet, gas floor.",
				"2. Isi frontend/js/config.js chains.arcMainnet + .env ARC_MAINNET_RPC / ARC_MAINNET_CHAIN_ID — backend mainnet menolak boot sebelum lengkap.",
				"3. JANGAN menyalin nilai testnet; verifikasi ulang setiap angka di docs.arc.io.",
				"4. Komit hanya setelah smoke test read-only + review manual (PR)."
			].join("\n");
			return { messages: [{ role: "user", content: { type: "text", text } }] };
		}
		throw Object.assign(new Error(`Unknown prompt: ${name}`), { mcpInvalidParams: true });
	}

	// ---- dispatcher JSON-RPC 2.0 (satu frame = satu baris) ----------------------

	function pickProtocol(requested) {
		return PROTOCOL_VERSIONS.includes(requested) ? requested : LATEST_PROTOCOL;
	}

	function rpc(id, result) {
		return JSON.stringify({ jsonrpc: "2.0", id, result });
	}

	function rpcErr(id, code, message) {
		return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
	}

	/**
	 * Proses satu frame (line) JSON-RPC.
	 * @returns {Promise<string|null>} frame respons, atau null untuk notifikasi.
	 */
	async function handleFrame(line) {
		let msg = null;
		try {
			msg = JSON.parse(line);
		} catch (_) {
			return rpcErr(null, ERR_PARSE, "Parse error");
		}
		if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
			return rpcErr(null, ERR_INVALID_REQUEST, "Invalid Request");
		}
		const { id, method, params } = msg;
		const notification = id === undefined || id === null;

		if (method === "initialize") {
			// Version negotiation (spec): pakai protocolVersion client bila
			// didukung; server mengembalikan versi yang dia setujui.
			clientProtocol = pickProtocol(params && typeof params.protocolVersion === "string" ? params.protocolVersion : null);
			if (!notification) {
				return rpc(id, {
					protocolVersion: clientProtocol,
					capabilities: {
						tools: { listChanged: false },
						resources: { listChanged: false, subscribe: false },
						prompts: { listChanged: false }
					},
					serverInfo: { name: "warparc-backend", version: SERVER_VERSION }
				});
			}
			return null;
		}

		// Notifikasi (initialized, cancelled, progress, …) : tanpa respons.
		if (notification) return null;

		try {
			switch (method) {
			case "ping":
				return rpc(id, {});
			case "tools/list":
				return rpc(id, { tools: TOOLS });
			case "tools/call": {
				const name = params && typeof params.name === "string" ? params.name : null;
				if (!name || !TOOL_HANDLERS[name]) {
					throw Object.assign(new Error(`Unknown tool: ${name}`), { mcpInvalidParams: true });
				}
				const args = params && params.arguments !== undefined ? params.arguments : {};
				if (!args || typeof args !== "object" || Array.isArray(args)) {
					throw Object.assign(new Error("tool arguments must be an object"), { mcpInvalidParams: true });
				}
				try {
					const out = await TOOL_HANDLERS[name](args);
					return rpc(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
				} catch (e) {
					// Error domain tool → isError content (bukan protocol error).
					return rpc(id, { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true });
				}
			}
			case "resources/list":
				return rpc(id, { resources: RESOURCES });
			case "resources/read": {
				const uri = params && typeof params.uri === "string" ? params.uri : null;
				if (!uri) throw Object.assign(new Error("uri required"), { mcpInvalidParams: true });
				const contents = await readResource(uri);
				return rpc(id, { contents });
			}
			case "prompts/list":
				return rpc(id, { prompts: PROMPTS });
			case "prompts/get": {
				const name = params && typeof params.name === "string" ? params.name : null;
				if (!name) throw Object.assign(new Error("prompt name required"), { mcpInvalidParams: true });
				const result = await getPrompt(name);
				return rpc(id, result);
			}
			default:
				return rpcErr(id, ERR_METHOD_NOT_FOUND, `Method not found: ${method}`);
			}
		} catch (e) {
			if (e.mcpInvalidParams) return rpcErr(id, ERR_INVALID_PARAMS, e.message);
			log.error(`[mcp] ${method} failed: ${e.message}`);
			return rpcErr(id, ERR_INTERNAL, e.message);
		}
	}

	return { handleFrame };
}

// ---- standalone entry --------------------------------------------------------
// `node backend/src/mcp-server.js` (npm run backend:mcp). Mirip index.js tetapi:
//   - relayer dibuat TANPA start() → MCP adalah sesi ops pasif: tidak ada tick,
//     tidak ada submit ganda dengan proses `npm run backend` (lock relayer
//     tetap milik backend utama). Enqueue via warparc_relay_submit tetap aman.
//   - lock role terpisah ("mcp") mencegah dua proses MCP pada store yang sama.
if (require.main === module) {
	const backendCfg = loadBackendConfig();
	const store = new Store({ dir: backendCfg.dataDir });
	const release = acquireLock({ dir: backendCfg.dataDir, role: "mcp" });
	const indexerChains = getIndexerChains(backendCfg);
	const chains = getRelayerChains(backendCfg);
	const iris = createIrisClient({ baseUrl: backendCfg.cfg.iris[backendCfg.network] });
	const relayer = createRelayer({ backendCfg, chains, store });
	const mcp = createMcpServer({ backendCfg, store, relayer, iris, indexerChains });
	console.error(
		`[mcp] stdio ready — network=${backendCfg.network} protocol=${LATEST_PROTOCOL}` +
			` relayer=idle (no tick; submit via backend LIVE) data=${backendCfg.dataDir}`
	);

	const readline = require("readline");
	// Cap frame (line-delimited): baris >256KB ditolak tanpa diproses — mencegah
	// flooding stdin menumpuk memori tak terbatas (mirror MAX_BODY server.js).
	const MAX_LINE_BYTES = 262144;
	// Serialisasi handler: request ke-N menunggu ke-(N-1) selesai (antrean
	// berurutan; respons tetap benar urut via id-matching).
	let chain = Promise.resolve();
	const enqueue = (job) => {
		chain = chain.then(job, job);
		return chain;
	};
	const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
	rl.on("line", (line) => {
		if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
			process.stdout.write(
				JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: ERR_INVALID_REQUEST, message: "request too large" } }) + "\n"
			);
			return;
		}
		enqueue(async () => {
			try {
				const resp = await mcp.handleFrame(line);
				if (resp !== null) process.stdout.write(resp + "\n");
			} catch (e) {
				console.error(`[mcp] handler error: ${e.message}`);
			}
		});
	});
	function shutdown() {
		try {
			release();
		} catch (_) {}
		process.exit(0);
	}
	rl.on("close", shutdown);
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

module.exports = { createMcpServer, PROTOCOL_VERSIONS, LATEST_PROTOCOL };



