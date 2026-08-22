/**
 * Zero-dependency HTTP API for the WarpArc backend (node:http, Node 18+).
 *
 * Routes:
 *   GET  /health                       — liveness + indexer/relayer summary
 *   GET  /events?chain=&address=&limit=— indexed USDC transfers (newest first)
 *   GET  /jobs                         — relayer job list
 *   POST /relay {srcChain, burnTxHash} — queue a burn for relaying
 *   GET  /status?srcChain=&txHash=     — job state + live Iris attestation state
 *
 * Binds 127.0.0.1 by default (BACKEND_HOST/BACKEND_PORT to change) — it is an
 * ops API, not a public service. Responses never contain secrets: the relayer
 * key stays in env and job entries only carry hashes/addresses/statuses.
 */
"use strict";

const http = require("http");
const { URL } = require("url");

const MAX_BODY = 4096;

function createServer({ backendCfg, store, relayer, iris, indexerChains, log = console }) {
	const startedAt = Date.now();
	// CORS is opt-in: no header at all unless an operator explicitly allows an
	// origin — a wildcard on an unauthenticated state-changing route would let
	// any webpage in the operator's browser queue relay jobs.
	const corsOrigin = process.env.BACKEND_CORS_ORIGIN || null;

	function corsHeaders() {
		return corsOrigin
			? {
					"Access-Control-Allow-Origin": corsOrigin,
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type"
				}
			: {};
	}

	function json(res, code, obj) {
		const body = JSON.stringify(obj);
		res.writeHead(code, {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Length": Buffer.byteLength(body),
			...corsHeaders(),
			"Cache-Control": "no-store"
		});
		res.end(body);
	}

	async function readJsonBody(req) {
		const chunks = [];
		let size = 0;
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
			return {
				events: store.queryEvents({
					chain: query.get("chain") || undefined,
					address: query.get("address") || undefined,
					limit
				})
			};
		},

		"GET /jobs": async () => ({ jobs: relayer ? relayer.getJobs() : {} }),

		"POST /relay": async (query, req) => {
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
			if (iris) {
				try {
					const msg = await iris.getMessage(cfgChain.cctpDomain, txHash);
					irisState = msg ? { status: msg.status, eventNonce: msg.eventNonce ?? null } : null;
				} catch (e) {
					irisState = { error: e.message };
				}
			}
			return { job, iris: irisState };
		}
	};

	const server = http.createServer(async (req, res) => {
		try {
			// DNS-rebinding guard: only accept requests addressed to the host:port
			// this server was bound to.
			const hostHeader = String(req.headers.host || "").toLowerCase();
			const expectedHost = `${backendCfg.server.host}:${backendCfg.server.port}`.toLowerCase();
			const hostOnly = hostHeader.split(":")[0];
			if (hostHeader !== expectedHost && hostOnly !== backendCfg.server.host.toLowerCase() && hostOnly !== "localhost") {
				return json(res, 403, { error: "unexpected Host header" });
			}
			const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
			const key = `${req.method} ${url.pathname}`;
			if (req.method === "OPTIONS") {
				res.writeHead(204, corsHeaders());
				res.end();
				return;
			}
			const handler = routes[key];
			if (!handler) return json(res, 404, { error: `no route ${key}` });
			const result = await handler(url.searchParams, req);
			const out = Array.isArray(result) ? result[0] : result;
			const code = Array.isArray(result) ? result[1] || 200 : 200;
			json(res, code, out);
		} catch (e) {
			const code = e.statusCode || 500;
			if (code === 500) log.error(`[server] ${req.method} ${req.url}: ${e.message}`);
			json(res, code, { error: e.message });
		}
	});

	return server;
}

module.exports = { createServer };
