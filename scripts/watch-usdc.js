/**
 * USDC event indexer for Arc (DEPLOY.md §6 — event indexing).
 *
 * QUICK CLI — the production indexer lives in backend/src/indexer.js
 * (dual-emitter + watermark persistence + HTTP API via `npm run backend`).
 * Use this script for a fast terminal view; do not extend it.
 * Every native USDC movement on Arc emits TWO Transfer logs for one balance
 * change (docs.arc.io/arc/references/usdc-system-events):
 *   - ERC-20 emitter  0x3600000000000000000000000000000000000000  (6 decimals)
 *   - system emitter  0xfffffffffffffffffffffffffffffffffffffffe  (18 decimals, EIP-7708)
 * Counting both double-counts one movement — this indexer matches on emitter
 * address and reports the 6-dec ERC-20 view as CANONICAL, flagging the 18-dec
 * system log as its mirror. One confirmation is enough (deterministic finality).
 *
 * Read-only HTTPS polling (no WSS, no deps, Node 18+).
 *
 * Usage:
 *   node scripts/watch-usdc.js                              # follow latest, poll 5s
 *   node scripts/watch-usdc.js --address 0xYourAddr         # only from/to that address
 *   node scripts/watch-usdc.js --once --from-block -500     # single historical snapshot
 */
"use strict";

const RPC_URL = "https://rpc.testnet.arc.io";
const EXPLORER = "https://testnet.arcscan.app";
const POLL_MS = 5_000;
const LOOKBACK_DEFAULT = 2_000; // blocks (~16 min at ~0.48s/block)

const ERC20_EMITTER = "0x3600000000000000000000000000000000000000";
const SYSTEM_EMITTER = "0xfffffffffffffffffffffffffffffffffffffffe";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"; // Transfer(address,address,uint256)

const args = process.argv.slice(2);
const getOpt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
};
const ONCE = args.includes("--once");
const watchAddress = (getOpt("--address") || "").toLowerCase() || null;
const fromBlockArg = getOpt("--from-block");

let nextFromBlock = null; // set after first lookup
const seen = new Map();   // "block:txHash:logIndex" — pruned below the cursor
// (entries older than nextFromBlock can never be re-fetched; pruning keeps a
// long-running follower's memory flat)

async function rpc(method, params) {
	const res = await fetch(RPC_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
	});
	if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
	const data = await res.json();
	if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
	return data.result;
}

function topicToAddress(topic) {
	return "0x" + topic.slice(-40).toLowerCase();
}

function classify(emitter) {
	if (emitter.toLowerCase() === ERC20_EMITTER) return { kind: "ERC20", tag: "CANONICAL (6 dec)", decimals: 6 };
	if (emitter.toLowerCase() === SYSTEM_EMITTER) return { kind: "SYSTEM", tag: "mirror (18 dec)", decimals: 18 };
	return null;
}

function printLog(entry) {
	const tag = entry.kind === "ERC20" ? "CANONICAL" : "mirror ";
	console.log(
		`#${entry.block} [${tag}] ${entry.amountHuman.toFixed(6)} USDC  ${entry.from} → ${entry.to}` +
		`  (${entry.txHash}) ${EXPLORER}/tx/${entry.txHash}`
	);
}

async function fetchRange(fromBlock, toBlock) {
	const logs = await rpc("eth_getLogs", [{
		fromBlock: "0x" + fromBlock.toString(16),
		toBlock: "0x" + toBlock.toString(16),
		address: [ERC20_EMITTER, SYSTEM_EMITTER],
		topics: [TRANSFER_TOPIC]
	}]);

	for (const log of logs) {
		const blockNum = parseInt(log.blockNumber, 16);
		const key = `${blockNum}:${log.transactionHash}:${log.logIndex}`;
		if (seen.has(key)) continue;
		seen.set(key, true);

		const info = classify(log.address);
		if (!info) continue; // unknown emitter — not one of the two USDC emitters
		const from = topicToAddress(log.topics[1]);
		const to = topicToAddress(log.topics[2]);
		if (watchAddress && from !== watchAddress && to !== watchAddress) continue;

		const raw = BigInt(log.data);
		// 18-dec native view = 6-dec ERC-20 view × 1e12; normalize both to USDC units
		const amountHuman = Number(info.kind === "ERC20" ? raw : raw / 10n ** 12n) / 1e6;
		printLog({ block: blockNum, kind: info.kind, amountHuman, from, to, txHash: log.transactionHash });
	}
}

async function main() {
	console.log(`[watch-usdc] Arc Testnet USDC indexer — ERC-20 emitter (canonical) + system emitter (mirror)`);
	console.log(`[watch-usdc] RPC ${RPC_URL}${watchAddress ? " | filter " + watchAddress : ""}${ONCE ? " | single pass" : " | polling " + POLL_MS + "ms"}`);

	const latest = parseInt(await rpc("eth_blockNumber", []), 16);
	let start;
	if (fromBlockArg && fromBlockArg.startsWith("-")) start = Math.max(0, latest + parseInt(fromBlockArg, 10));
	else if (fromBlockArg) start = Math.max(0, parseInt(fromBlockArg, 10));
	else start = Math.max(0, latest - LOOKBACK_DEFAULT);

	console.log(`[watch-usdc] scanning from block ${start} (latest ${latest})\n`);
	await fetchRange(start, latest);

	if (ONCE) {
		console.log(`\n[watch-usdc] done — ${seen.size} log(s) scanned.`);
		return;
	}

	nextFromBlock = latest + 1;
	console.log("[watch-usdc] following new blocks… Ctrl+C to stop");
	// eslint-disable-next-line no-constant-condition
	while (true) {
		await new Promise(r => setTimeout(r, POLL_MS));
		try {
			const head = parseInt(await rpc("eth_blockNumber", []), 16);
			if (head >= nextFromBlock) {
				await fetchRange(nextFromBlock, head);
				nextFromBlock = head + 1;
				// Ranges at or below the cursor are never fetched again — drop
				// their dedupe entries so memory stays flat.
				for (const k of seen.keys()) {
					if (Number(k.split(":")[0]) < nextFromBlock) seen.delete(k);
				}
			}
		} catch (e) {
			console.error(`[watch-usdc] poll error (continuing): ${e.message}`);
		}
	}
}

main().catch(e => {
	console.error(`[watch-usdc] fatal: ${e.message}`);
	process.exit(1);
});
