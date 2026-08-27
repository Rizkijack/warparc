/**
 * Zero-dependency HTTP API for the WarpArc backend (node:http, Node 18+).
 *
 * Routes:
 *   GET  /health                       — liveness + indexer/relayer summary
 *   GET  /events?chain=&address=&kind=&limit= — indexed USDC transfers (newest first; kind = erc20|system)
 *   GET  /jobs                         — relayer job list
 *   POST /relay {srcChain, burnTxHash} — queue a burn for relaying
 *   GET  /status?srcChain=&txHash=     — job state + live Iris attestation state
 *   GET  /metrics                      — Prometheus text exposition (no auth)
 *
 * Binds 127.0.0.1 by default (BACKEND_HOST/BACKEND_PORT to change) — it is an
 * ops API, not a public service. Responses never contain secrets: the relayer
 * key stays in env and job entries only carry hashes/addresses/statuses.
 */
"use strict";

const http = require("http");
const { URL } = require("url");

const MAX_BODY = 4096;
const { createLogger } = require("./logger");

// Prometheus metrics renderer — <50 lines, zero-dep.
function renderMetrics({ store, relayer, indexerChains, startTime, requestCounts }) {
	const lines = [];
	const uptime = Math.floor((Date.now() - startTime) / 1000);
	lines.push("# HELP warparc_uptime_seconds Backend uptime in seconds.");
	lines.push("# TYPE warparc_uptime_seconds gauge");
	lines.push(`warparc_uptime_seconds ${uptime}`);
	lines.push("# HELP warparc_events_total Total indexed events.");
	lines.push("# TYPE warparc_events_total counter");
	let perChain = {};
	if (typeof store.getMetrics === "function") {
		try { perChain = store.getMetrics().perChainCounts || {}; } catch (_) { perChain = {}; }
	} else {
		for (const c of indexerChains) perChain[c.key] = store.countEvents(c.key);
	}
	for (const c of indexerChains) {
		const v = perChain[c.key] != null ? perChain[c.key] : store.countEvents(c.key);
		lines.push(`warparc_events_total{chain="${c.key}"} ${v}`);
	}
	lines.push("# HELP warparc_indexer_last_indexed_block_plus_one Next block to index.");
	lines.push("# TYPE warparc_indexer_last_indexed_block_plus_one gauge");
	for (const c of indexerChains) {
		const raw = store.getState(`indexer:${c.key}`, 0);
		const n = raw == null ? 0 : Number(raw);
		lines.push(`warparc_indexer_last_indexed_block_plus_one{chain="${c.key}"} ${Number.isFinite(n) ? n : 0}`);
	}
	lines.push("# HELP warparc_relayer_jobs_total Relayer jobs by status.");
	lines.push("# TYPE warparc_relayer_jobs_total gauge");
	const byStatus = relayer ? (relayer.stats().byStatus || {}) : {};
	for (const [st, cnt] of Object.entries(byStatus)) lines.push(`warparc_relayer_jobs_total{status="${st}"} ${cnt}`);
	lines.push("# HELP warparc_relayer_budget_spent Gas budget spent per chain.");
	lines.push("# TYPE warparc_relayer_budget_spent gauge");
	const budgets = relayer ? (relayer.stats().budgets || {}) : {};
	for (const [chain, b] of Object.entries(budgets)) lines.push(`warparc_relayer_budget_spent{chain="${chain}",unit="${b.unit}"} ${b.spent}`);
	if (requestCounts && Object.keys(requestCounts).length) {
		lines.push("# HELP warparc_api_requests_total API requests by route.");
		lines.push("# TYPE warparc_api_requests_total counter");
		for (const [route, cnt] of Object.entries(requestCounts)) lines.push(`warparc_api_requests_total{route="${route}"} ${cnt}`);
	}
	return lines.join("\n") + "\n";
}

// In-memory rate limiter for POST /relay: max 10 requests per minute per IP.
const relayRateLimit = new Map();
const RELAY_RATE_LIMIT_MAX = 10;
const RELAY_RATE_LIMIT_WINDOW_MS = 60_000;

function checkRelayRateLimit(ip) {
	const now = Date.now();
	const entry = relayRateLimit.get(ip);
	if (!entry || now > entry.resetAt) {
		relayRateLimit.set(ip, { count: 1, resetAt: now + RELAY_RATE_LIMIT_WINDOW_MS });
		return true;
	}
	entry.count++;
	return entry.count <= RELAY_RATE_LIMIT_MAX;
}

// Periodic prune to avoid unbounded Map growth (e.g. many distinct IPs / spoofed).
setInterval(() => {
	const now = Date.now();
	for (const [ip, ent] of relayRateLimit) {
		if (now > ent.resetAt + 60_000) relayRateLimit.delete(ip);
	}
}, 60_000).unref();

// Token bucket for the /status Iris lookup: the relayer round-robins its Iris
// polling to stay under the global 40 req/s budget, so an operator script
// hammering /status must not spend that budget independently.
const STATUS_IRIS_RPS_DEFAULT = 2;

function statusIrisMinIntervalMs() {
	const raw = Number(process.env.BACKEND_STATUS_IRIS_RPS);
	if (!Number.isFinite(raw) || raw <= 0) return 1000 / STATUS_IRIS_RPS_DEFAULT;
	return 1000 / raw;
}

function createServer({ backendCfg, store, relayer, iris, indexerChains, log = console }) {
	const startedAt = Date.now();
	const logger = log === console ? createLogger("server") : log;
	const apiRequests = {};
	// CORS is opt-in: no header at all unless an operator explicitly allows an
	// origin — a wildcard on an unauthenticated state-changing route would let
	// any webpage in the operator's browser queue relay jobs.
	const _rawCorsOrigin = process.env.BACKEND_CORS_ORIGIN;
	let corsOrigin = _rawCorsOrigin ? _rawCorsOrigin.trim() : null;
	if (corsOrigin === "") corsOrigin = null;
	// Guard CRLF injection: reject if value contains \r or \n (trim handles edges, this handles interior).
	if (corsOrigin && /[\r\n]/.test(corsOrigin)) {
		logger.warn("[server] BACKEND_CORS_ORIGIN contains CRLF — rejected (fail-closed)");
		corsOrigin = null;
	}
	// Reject wildcard "*" — fail-closed: treat as no header (any origin could enqueue).
	if (corsOrigin && corsOrigin.trim() === "*") {
		logger.warn('[server] BACKEND_CORS_ORIGIN="*" rejected — wildcard CORS is not allowed (fail-closed)');
		corsOrigin = null;
	}
	// Timestamp of the last live Iris lookup made by /status (any outcome).
	let lastIrisCallAt = 0;

	function corsHeaders() {
		return corsOrigin
			? {
					"Access-Control-Allow-Origin": corsOrigin,
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization"
				}
			: {};
	}

	function json(res, code, obj, extraHeaders = {}) {
		const body = JSON.stringify(obj);
		res.writeHead(code, {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Length": Buffer.byteLength(body),
			...corsHeaders(),
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
			"X-Frame-Options": "DENY",
			...extraHeaders
		});
		res.end(body);
	}

	async function readJsonBody(req) {
		const chunks = [];
		let size = 0;
		let timeout;
		const timeoutPromise = new Promise((_, reject) => {
			timeout = setTimeout(() => {
				try {
					req.destroy();
				} catch (_) {}
				reject(Object.assign(new Error("request timeout"), { statusCode: 408 }));
			}, 30000);
			if (timeout.unref) timeout.unref();
		});
		try {
			const readPromise = (async () => {
				for await (const chunk of req) {
					size += chunk.length;
					if (size > MAX_BODY) throw Object.assign(new Error("body too large"), { statusCode: 413 });
					chunks.push(chunk);
				}
				if (chunks.length === 0) throw Object.assign(new Error("empty body"), { statusCode: 400 });
				try {
					return JSON.parse(Buffer.concat(chunks).toString("utf8"));
				} catch (_) {
					throw Object.assign(new Error("body is not valid JSON"), { statusCode: 400 });
				}
			})();
			const result = await Promise.race([readPromise, timeoutPromise]);
			clearTimeout(timeout);
			return result;
		} catch (e) {
			clearTimeout(timeout);
			throw e;
		}
	}

	const routes = {
		"GET /health": async () => ({
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
		}),

		"GET /events": async (query) => {
			const limitRaw = parseInt(query.get("limit") || "100", 10);
			const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 1000 ? limitRaw : 100;
			const offsetRaw = parseInt(query.get("offset") || "0", 10);
			const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
			// Dual-emitter Arc events carry kind: "erc20" | "system" — summing
			// across kinds double-counts, so let consumers pick exactly one.
			const kind = query.get("kind");
			if (kind !== null && kind !== "erc20" && kind !== "system") {
				throw Object.assign(new Error(`kind must be "erc20" or "system"`), { statusCode: 400 });
			}
			const result = store.queryEvents({
				chain: query.get("chain") || undefined,
				address: query.get("address") || undefined,
				kind: kind || undefined,
				limit,
				offset
			});
			return {
				events: result.events,
				pagination: {
					limit,
					offset,
					hasMore: result.hasMore,
					nextOffset: result.hasMore ? offset + limit : null
				}
			};
		},

		"GET /jobs": async () => ({ jobs: relayer ? relayer.getJobs() : {} }),

		"POST /relay": async (query, req) => {
			// Rate limit check: 10 requests per minute per IP (before auth to throttle brute-force).
			const clientIp = req.socket.remoteAddress || "unknown";
			if (!checkRelayRateLimit(clientIp)) {
				const entry = relayRateLimit.get(clientIp);
				const retryAfter = entry ? Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 60;
				return [{ error: "rate limit exceeded" }, 429, { "Retry-After": String(retryAfter) }];
			}
			// Auth check: if BACKEND_API_TOKEN is set, require matching Bearer token.
			const apiToken = process.env.BACKEND_API_TOKEN;
			if (apiToken) {
				const auth = req.headers.authorization || "";
				if (auth !== `Bearer ${apiToken}`) {
					return [{ error: "unauthorized" }, 401];
				}
			}
			if (!relayer) return [{ error: "relayer role not running" }, 503];
			const body = await readJsonBody(req);
			if (!body || typeof body !== "object") throw Object.assign(new Error("body must be a JSON object"), { statusCode: 400 });
			const { srcChain, burnTxHash } = body;
			if (typeof srcChain !== "string" || typeof burnTxHash !== "string") {
				throw Object.assign(new Error("expected {srcChain, burnTxHash}"), { statusCode: 400 });
			}
			try {
				// Reject junk before it occupies the job store: the burn tx must
				// actually exist on its source chain.
				await relayer.validateBurnTx(srcChain, burnTxHash);
				const job = relayer.enqueue(srcChain, burnTxHash);
				return [{ job }, 202];
			} catch (e) {
				throw Object.assign(new Error(e.message), { statusCode: 400 });
			}
		},

		"GET /status": async (query) => {
			const srcChain = query.get("srcChain");
			const txHash = (query.get("txHash") || "").toLowerCase();
			if (!srcChain || !txHash) throw Object.assign(new Error("srcChain and txHash required"), { statusCode: 400 });
			if (!/^0x[0-9a-f]{64}$/.test(txHash)) throw Object.assign(new Error("txHash must be a 0x-hex transaction hash"), { statusCode: 400 });
			const cfgChain = backendCfg.cfg.chains[srcChain];
			if (!cfgChain || cfgChain.cctpDomain == null) {
				throw Object.assign(new Error(`unknown srcChain "${srcChain}"`), { statusCode: 400 });
			}
			const job = relayer ? relayer.getJobs()[txHash] || null : null;
			let irisState = null;
			// Minimum spacing between live Iris lookups; a call (success OR fail)
			// spends the slot, so failures cannot be used to bypass the budget.
			const now = Date.now();
			if (iris && now - lastIrisCallAt >= statusIrisMinIntervalMs()) {
				lastIrisCallAt = now;
				try {
					const msg = await iris.getMessage(cfgChain.cctpDomain, txHash);
					irisState = msg ? { status: msg.status, eventNonce: msg.eventNonce ?? null } : null;
				} catch (e) {
					irisState = { error: e.message };
				}
			} else if (iris) {
				// Job data is still returned — dashboards keep working while the
				// Iris poll budget is reserved for the relayer.
				irisState = { throttled: true };
			}
			return { job, iris: irisState };
		}
	};

	const server = http.createServer(async (req, res) => {
		const t0 = Date.now();
		try {
			// DNS-rebinding guard: strict allow-list — only requests whose Host
			// header is exactly this server's host:port (or localhost on the same
			// port) get through; a wrong port is as suspect as a wrong host.
			const hostHeader = String(req.headers.host || "").toLowerCase();
			const expectedHost = `${backendCfg.server.host}:${backendCfg.server.port}`.toLowerCase();
			const localhostHost = `localhost:${backendCfg.server.port}`;
			if (hostHeader !== expectedHost && hostHeader !== localhostHost) {
				json(res, 403, { error: "unexpected Host header" });
				logger.info("request", { method: req.method, path: req.url, status: 403, durationMs: Date.now() - t0 });
				return;
			}
			const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
			const key = `${req.method} ${url.pathname}`;
			// In-memory per-route counter for Prometheus (optional).
			apiRequests[key] = (apiRequests[key] || 0) + 1;
			if (req.method === "OPTIONS") {
				res.writeHead(204, corsHeaders());
				res.end();
				logger.info("request", { method: req.method, path: url.pathname, status: 204, durationMs: Date.now() - t0 });
				return;
			}
			if (req.method === "GET" && url.pathname === "/metrics") {
				const body = renderMetrics({ store, relayer, indexerChains, startTime: startedAt, requestCounts: apiRequests });
				res.writeHead(200, {
					"Content-Type": "text/plain; version=0.0.4",
					"Content-Length": Buffer.byteLength(body),
					...corsHeaders(),
					"Cache-Control": "no-store",
					"X-Content-Type-Options": "nosniff",
					"X-Frame-Options": "DENY"
				});
				res.end(body);
				logger.info("request", { method: req.method, path: url.pathname, status: 200, durationMs: Date.now() - t0 });
				return;
			}
			const handler = routes[key];
			if (!handler) {
				json(res, 404, { error: `no route ${key}` });
				logger.info("request", { method: req.method, path: url.pathname, status: 404, durationMs: Date.now() - t0 });
				return;
			}
			const result = await handler(url.searchParams, req);
			const out = Array.isArray(result) ? result[0] : result;
			const code = Array.isArray(result) ? result[1] || 200 : 200;
			const extraHeaders = Array.isArray(result) && result[2] && typeof result[2] === "object" ? result[2] : {};
			json(res, code, out, extraHeaders);
			logger.info("request", { method: req.method, path: url.pathname, status: code, durationMs: Date.now() - t0 });
		} catch (e) {
			const code = e.statusCode || 500;
			if (code === 500) logger.error(`[server] ${req.method} ${req.url}: ${e.message}`, { method: req.method, path: req.url, status: code });
			else logger.info("request", { method: req.method, path: req.url, status: code, durationMs: Date.now() - t0, error: e.message });
			json(res, code, { error: e.message });
		}
	});
	server.timeout = 30000;
	server.headersTimeout = 31000;
	server.requestTimeout = 30000;

	return server;
}

module.exports = { createServer, renderMetrics, createLogger };
