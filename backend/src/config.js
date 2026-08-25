/**
 * Backend configuration — merges frontend/js/config.js (single source of truth
 * for chains/RPC/CCTP addresses) with process env overrides.
 *
 * Sources:
 *   - docs.arc.io/integrate/infrastructure/bridges      (relayer rules, USDC gas)
 *   - docs.arc.io/integrate/infrastructure/indexing-events (indexer design)
 *   - DEPLOY.md §6 (event indexing) + Path B (backend relayers)
 *
 * Security rules:
 *   - Testnet is the default; BACKEND_NETWORK=mainnet refuses to boot while any
 *     required chain value is still TBD (Arc mainnet launches 2026-09-16).
 *   - Secrets (RELAYER_PRIVATE_KEY) come from env only — never logged, never
 *     echoed into API responses, never written to the store.
 *   - The relayer never moves user funds: receiveMessage mints to the burn's
 *     original recipient; the relayer only spends its own gas.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const FRONTEND_CONFIG = path.join(ROOT, "frontend", "js", "config.js");

// Testnet chain keys that participate in CCTP routing (frontend CONFIG order).
const TESTNET_CCTP_CHAINS = ["arc", "ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"];
const MAINNET_CCTP_CHAINS = ["ethereum", "base", "arbitrum", "optimism", "arcMainnet"];

/** Load the frontend CONFIG object without a bundler (vm sandbox). */
function loadFrontendConfig() {
	const src = fs.readFileSync(FRONTEND_CONFIG, "utf8");
	// const is block-scoped in vm — expose CONFIG to the sandbox explicitly
	const wrapped = src + "\n;this.CONFIG = CONFIG;";
	const sandbox = {};
	vm.runInNewContext(wrapped, sandbox, {
		filename: FRONTEND_CONFIG,
		timeout: 100,
		codeGeneration: { strings: false, wasm: false }
	});
	return sandbox.CONFIG;
}

function boolEnv(name, fallback) {
	const v = process.env[name];
	if (v === undefined) return fallback;
	return v.trim().toLowerCase() === "true";
}

function intEnv(name, fallback) {
	const v = parseInt(process.env[name], 10);
	return Number.isInteger(v) && v > 0 ? v : fallback;
}

function numEnv(name, fallback) {
	const v = parseFloat(process.env[name]);
	return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/**
 * Resolve backend runtime config.
 * @returns {{ network, dataDir, indexChains: string[], relayer: object, server: object, cfg: object }}
 */
function loadBackendConfig() {
	const cfg = loadFrontendConfig();
	const network = (process.env.BACKEND_NETWORK || "testnet").trim().toLowerCase();
	if (network !== "testnet" && network !== "mainnet") {
		throw new Error(`BACKEND_NETWORK must be "testnet" or "mainnet" (got "${network}")`);
	}

	// Fail closed on mainnet while Arc mainnet is TBD (values stay null until
	// launch day — never guess, MAINNET-CHECKLIST Phase 1).
	if (network === "mainnet") {
		const arcMainnet = cfg.chains.arcMainnet;
		const missing = !arcMainnet || !arcMainnet.rpcUrl || !arcMainnet.cctp || arcMainnet.disabled;
		if (missing) {
			throw new Error(
				"BACKEND_NETWORK=mainnet but frontend/js/config.js chains.arcMainnet is still TBD/disabled. " +
					"Fill official values from docs.arc.io on launch day (2026-09-16) first."
			);
		}
	}

	const defaultIndexChains = network === "testnet" ? ["arc"] : ["arcMainnet"];
	const indexChains = (process.env.BACKEND_INDEX_CHAINS || defaultIndexChains.join(","))
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

	return {
		network,
		cfg,
		indexChains,
		dataDir: process.env.BACKEND_DATA_DIR || path.join(ROOT, "backend", "data"),
		relayer: {
			// Submission requires BOTH flags: RELAYER_ENABLED=true AND
			// RELAYER_DRY_RUN=false. Anything else is watch-only (default).
			enabled: boolEnv("RELAYER_ENABLED", false),
			dryRun: boolEnv("RELAYER_DRY_RUN", true),
			privateKey: process.env.RELAYER_PRIVATE_KEY || null,
			autoRelay: boolEnv("BACKEND_AUTO_RELAY", false),
			// Hook burns (depositForBurnWithHook) execute arbitrary logic at the
			// destination — off by default, this relayer does plain burn-and-mint.
			allowHooks: boolEnv("RELAYER_ALLOW_HOOKS", false),
			maxRelayUsdc: intEnv("RELAYER_MAX_USDC_PER_TX", 1000),
			// Daily gas budget per destination chain — submissions pause when
			// spent (from receipts) reaches the budget for the UTC day.
			dailyUsdcBudget: numEnv("RELAYER_DAILY_USDC_BUDGET", 50), // Arc (gas = USDC)
			dailyEthBudget: numEnv("RELAYER_DAILY_ETH_BUDGET", 0.5), // EVM destinations (gas = ETH)
			// Iris rate limit is 40 req/s — attestation checks are round-robined
			// so at most this many pending jobs hit Iris per tick.
			irisChecksPerTick: intEnv("RELAYER_IRIS_CHECKS_PER_TICK", 20),
			pollMs: intEnv("RELAYER_POLL_MS", 5000),
			attestationTimeoutMs: intEnv("RELAYER_ATTESTATION_TIMEOUT_MS", 600_000),
			maxSubmitAttempts: intEnv("RELAYER_MAX_ATTEMPTS", 5),
			maxJobs: (() => {
				const v = parseInt(process.env.RELAYER_MAX_JOBS, 10);
				return Number.isInteger(v) && v >= 0 ? v : 500;
			})()
		},
		server: {
			host: process.env.BACKEND_HOST || "127.0.0.1",
			port: intEnv("BACKEND_PORT", 8932)
		}
	};
}

/**
 * Derive per-role chain specs from the frontend CONFIG.
 * Indexer chains get USDC emitter addresses (Arc has the dual-emitter system
 * address; EVM chains index the ERC-20 USDC only).
 */
function getIndexerChains(backendCfg) {
	const out = [];
	for (const key of backendCfg.indexChains) {
		const c = backendCfg.cfg.chains[key];
		if (!c || !c.rpcUrl) throw new Error(`BACKEND_INDEX_CHAINS: unknown/misconfigured chain "${key}"`);
		const usdc = backendCfg.cfg.tokens.USDC.addresses[key];
		if (!usdc) throw new Error(`BACKEND_INDEX_CHAINS: no USDC address for "${key}"`);
		out.push({
			key,
			chainId: c.chainId,
			rpcUrl: c.rpcUrl,
			// Official WSS provider (ARC-REFERENCE §10 / CSP allowlist) — used for
			// newHeads acceleration when the runtime exposes a WebSocket client.
			// Arc mainnet WSS: TBD until launch day.
			wsUrl: key === "arc" ? "wss://rpc.testnet.arc.io" : null,
			usdcEmitters: [usdc.toLowerCase()],
			// EIP-7708 system emitter — Arc only (docs.arc.io/arc/references/usdc-system-events)
			systemEmitter: key.startsWith("arc") ? "0xfffffffffffffffffffffffffffffffffffffffe" : null,
			// 1 confirmation — deterministic finality on Arc (bridges checklist).
			// EVM testnets can reorg 1 block in rare cases; acceptable here
			// because the store is an ops view, not an accounting ledger.
			confirmations: 1,
			// Arc RPC caps getLogs result size (~860 blocks × 2 emitters today) —
			// chunk sweeps at 500 to stay well below the cap
			maxBlockRange: key.startsWith("arc") ? 500 : 1000,
			explorer: c.explorer
		});
	}
	return out;
}

/**
 * Relayer source chains — every chain with CCTP V2 contracts configured for
 * the active network. Burns are discovered on the source; the mint destination
 * is parsed from the message itself (CCTP V2 header, offset 8).
 */
function getRelayerChains(backendCfg) {
	const keys = backendCfg.network === "testnet" ? TESTNET_CCTP_CHAINS : MAINNET_CCTP_CHAINS;
	const out = [];
	for (const key of keys) {
		const c = backendCfg.cfg.chains[key];
		if (!c || !c.rpcUrl || !c.cctp || !c.cctp.messageTransmitterV2) continue;
		out.push({
			key,
			chainId: c.chainId,
			cctpDomain: c.cctpDomain,
			rpcUrl: c.rpcUrl,
			messageTransmitterV2: c.cctp.messageTransmitterV2,
			usdc: backendCfg.cfg.tokens.USDC.addresses[key] || null,
			isArc: key === "arc" || key === "arcMainnet",
			explorer: c.explorer
		});
	}
	return out;
}

module.exports = { loadBackendConfig, getIndexerChains, getRelayerChains, loadFrontendConfig, TESTNET_CCTP_CHAINS, MAINNET_CCTP_CHAINS };
