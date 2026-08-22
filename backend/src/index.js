/**
 * WarpArc backend entry point.
 *
 * Roles (start all by default, or select with --role):
 *   indexer — USDC Transfer indexer (Arc dual-emitter, 1 confirmation, WSS
 *             acceleration when available) into backend/data/events.jsonl
 *   relayer — CCTP V2 burn→mint relayer (watch-only until explicitly armed:
 *             RELAYER_ENABLED=true + RELAYER_DRY_RUN=false + RELAYER_PRIVATE_KEY)
 *   server  — HTTP ops API on 127.0.0.1:8932 (see backend/README.md)
 *
 * Usage:
 *   node backend/src/index.js                    # all roles, testnet
 *   node backend/src/index.js --role=indexer
 *   BACKEND_INDEX_CHAINS=arc,baseSepolia node backend/src/index.js --role=indexer
 *
 * Testnet is the default. Mainnet refuses to boot until official Arc mainnet
 * values exist in frontend/js/config.js (launch: 2026-09-16).
 *
 * Each role takes a single-instance lock (backend/data/lock-<role>.json) —
 * running the same role twice refuses to boot instead of double-appending.
 */
"use strict";

// index.js owns shutdown; suppress runIndexer's own immediate-exit handler.
process.env.BACKEND_NO_SIGINT = "1";

const { loadBackendConfig, getIndexerChains, getRelayerChains } = require("./config");
const { Store } = require("./store");
const { runIndexer } = require("./indexer");
const { createRelayer } = require("./relayer");
const { createIrisClient } = require("./attestation");
const { createServer } = require("./server");
const { acquireLock } = require("./lock");

const role = (() => {
	const argv = process.argv.slice(2);
	let v = "all";
	const i = argv.indexOf("--role");
	if (i >= 0 && argv[i + 1]) v = argv[i + 1];
	else {
		const eq = argv.find((a) => a.startsWith("--role="));
		if (eq) v = eq.slice("--role=".length);
	}
	return ["indexer", "relayer", "server", "all"].includes(v) ? v : null;
})();

if (!role) {
	console.error("usage: node backend/src/index.js --role=indexer|relayer|server|all");
	process.exit(1);
}

function main() {
	const backendCfg = loadBackendConfig();
	const store = new Store({ dir: backendCfg.dataDir });
	console.log(
		`[backend] role=${role} network=${backendCfg.network} data=${backendCfg.dataDir}` +
			` relayer=${backendCfg.relayer.enabled && !backendCfg.relayer.dryRun ? "LIVE" : "watch-only"}`
	);

	// Single-instance per role (double indexer = double-appended events).
	const activeRoles = role === "all" ? ["indexer", "relayer", "server"] : [role];
	const releases = activeRoles.map((r) => {
		const release = acquireLock({ dir: backendCfg.dataDir, role: r });
		console.log(`[backend] lock acquired: ${r} (PID ${process.pid})`);
		return release;
	});

	let relayer = null;
	let iris = null;
	let indexerStop = null;
	let httpServer = null;
	const indexerChains = getIndexerChains(backendCfg);

	if (role === "indexer" || role === "all") {
		indexerStop = runIndexer({ chains: indexerChains, store, pollMs: 5000 });
		console.log(`[backend] indexer started: ${indexerChains.map((c) => c.key).join(", ")}`);
	}

	if (role === "relayer" || role === "all") {
		const chains = getRelayerChains(backendCfg);
		iris = createIrisClient({ baseUrl: backendCfg.cfg.iris[backendCfg.network] });
		relayer = createRelayer({ backendCfg, chains, store });
		relayer.start();
	}

	if (role === "server" || role === "all") {
		httpServer = createServer({ backendCfg, store, relayer, iris, indexerChains });
		httpServer.listen(backendCfg.server.port, backendCfg.server.host, () => {
			console.log(`[backend] API http://${backendCfg.server.host}:${backendCfg.server.port}`);
		});
	}

	async function shutdown(signal) {
		console.log(`\n[backend] ${signal} — shutting down`);
		try {
			if (httpServer) httpServer.close();
		} catch (_) {}
		// Await in-flight ticks/sweeps — they may be mid-write to the store.
		await Promise.allSettled([indexerStop && indexerStop.stop(), relayer && relayer.stop()].filter(Boolean));
		for (const release of releases) {
			try {
				release();
			} catch (_) {}
		}
		process.exit(0);
	}
	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("unhandledRejection", (reason) => {
		console.error("[backend] unhandled rejection (continuing):", reason && reason.stack ? reason.stack : reason);
	});
}

main();
