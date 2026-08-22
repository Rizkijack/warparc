/**
 * Inbound CCTP relay — complete Steps 4–6 of the official Ethereum→Arc
 * quickstart for burns whose recipient holds no Arc gas:
 *   https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
 * (Step 3.3 retrieveAttestation → Step 3.4 mintUSDC) and the inbound flow of
 *   https://docs.arc.io/integrate/exchanges/cctp-bridging (Steps 4–6).
 *
 * Given a SOURCE-chain burn tx hash, poll Iris for message + attestation and
 * submit receiveMessage(message, attestation) on Arc's MessageTransmitterV2
 * with the relayer wallet (.env PRIVATE_KEY). On Arc the gas token IS native
 * USDC, so the relayer pays mint gas in USDC — per
 *   https://docs.arc.io/integrate/infrastructure/bridges ("Fund relayers with
 *   USDC for gas") relayers are funded with USDC, NEVER ETH.
 *
 * Usage:
 *   node scripts/mint-arc.js --tx <burnTxHash> [--source ethereumSepolia] [--dry-run] [--once]
 *   node scripts/mint-arc.js --discover [lookbackBlocks=2000] [--source ethereumSepolia]
 *   node scripts/mint-arc.js --check
 *
 *   --tx        poll Iris until attested, then mint on Arc
 *   --dry-run   stop after the attestation; print the decoded message header
 *   --once      single Iris query — report status and exit 1 if not ready yet
 *   --discover  eth_getLogs over the last N blocks on the source
 *               TokenMessengerV2 (no topic filter) to surface candidate burn
 *               tx hashes for --tx
 *   --check     offline sanity check of config/route/ABIs; sends nothing
 *
 * Testnet ONLY (Arc mainnet launches Sep 16, 2026 — MAINNET-CHECKLIST).
 * Node 18+ (global fetch). Uses root ethers v5. Never prints keys.
 */
"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const IRIS_TIMEOUT_MS = 600_000; // 10 min cap for attestation polling
const POLL_MS = 5_000;           // quickstart polls every 5s (far below Iris's 40 req/s cap)
const DISCOVER_CHUNK = 900;      // initial eth_getLogs window; split adaptively below
const MIN_RELAYER_USDC = "0.05"; // native-USDC floor before submitting (18-dec base layer)

const USAGE =
	"usage:\n" +
	"  node scripts/mint-arc.js --tx <burnTxHash> [--source ethereumSepolia] [--dry-run] [--once]\n" +
	"  node scripts/mint-arc.js --discover [lookbackBlocks=2000] [--source ethereumSepolia]\n" +
	"  node scripts/mint-arc.js --check";

// --- load frontend CONFIG (single source of truth, same pattern as cctp-test.js)
const configSrc = fs.readFileSync(path.join(__dirname, "..", "frontend", "js", "config.js"), "utf8");
const { CONFIG, TOKEN_MESSENGER_V2_ABI, MESSAGE_TRANSMITTER_V2_ABI } =
	(0, eval)(configSrc + "\n;({ CONFIG, TOKEN_MESSENGER_V2_ABI, MESSAGE_TRANSMITTER_V2_ABI });");

const args = process.argv.slice(2);
const getOpt = (name) => {
	const i = args.indexOf(name);
	return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const CHECK_ONLY = args.includes("--check");
const DRY_RUN = args.includes("--dry-run");
const ONCE = args.includes("--once");
const DISCOVER = args.includes("--discover");
const txHash = getOpt("--tx");
const srcKey = getOpt("--source") || "ethereumSepolia";
const discIdx = args.indexOf("--discover");
const lookbackRaw = DISCOVER && /^\d+$/.test(args[discIdx + 1] || "") ? parseInt(args[discIdx + 1], 10) : null;
const LOOKBACK = lookbackRaw || 2_000;

const srcChain = CONFIG.chains[srcKey];
const arcChain = CONFIG.chains.arc;

function fail(msg) {
	console.error(`[mint-arc] ERROR: ${msg}`);
	process.exit(1);
}

const log = (s) => console.log(`[mint-arc] ${s}`);

// --- shared route validation (spec item 1; runs for every mode) --------------
if (!srcChain) fail(`unknown chain key: ${srcKey}`);
if (!CONFIG.iris[srcChain.network]) fail(`no Iris host configured for network tier "${srcChain.network}"`);
if (srcChain.network !== "testnet" || arcChain.network !== "testnet") {
	fail("this harness is testnet-only by design (Arc mainnet is not live yet)");
}
if (!srcChain.cctp || !srcChain.cctp.tokenMessengerV2) fail(`CCTP contracts missing for ${srcKey}`);
if (!arcChain.cctp || !arcChain.cctp.messageTransmitterV2 || !arcChain.rpcUrl) {
	fail("CCTP contracts or RPC missing for arc");
}
// Registry cross-check: chains.arc.cctpDomain must agree with CONFIG.cctp.domains
// (developers.circle.com/cctp/references/contract-addresses lists Arc testnet as domain 26)
if (arcChain.cctpDomain !== CONFIG.cctp.domains.arc) {
	fail(`config inconsistent: chains.arc.cctpDomain=${arcChain.cctpDomain} vs cctp.domains.arc=${CONFIG.cctp.domains.arc}`);
}

const modes = [CHECK_ONLY, !!txHash, DISCOVER].filter(Boolean).length;
if (modes === 0) fail(`pick a mode (--tx | --discover | --check)\n${USAGE}`);
if (modes > 1) fail(`--tx, --discover and --check are mutually exclusive\n${USAGE}`);

// --- --check: offline sanity, no network required, exit 0 --------------------
function runCheck() {
	log("--check (offline sanity — nothing sent, no network used)");
	log(`config loaded from frontend/js/config.js`);
	log(`route: ${srcKey} (${srcChain.name}, domain ${srcChain.cctpDomain}) → arc (${arcChain.name}, domain ${arcChain.cctpDomain})`);
	log(`registry cross-check OK: chains.arc.cctpDomain === cctp.domains.arc === ${CONFIG.cctp.domains.arc}`);
	log(`source TokenMessengerV2:    ${srcChain.cctp.tokenMessengerV2}`);
	log(`arc MessageTransmitterV2:   ${arcChain.cctp.messageTransmitterV2} (chainId ${arcChain.chainId})`);
	log(`iris[${srcChain.network}]: ${CONFIG.iris[srcChain.network]} (mainnet tier: ${CONFIG.iris.mainnet})`);
	log(`arc rpc: ${arcChain.rpcUrl}, explorer: ${arcChain.explorer}`);
	const hasBurn = TOKEN_MESSENGER_V2_ABI.some(f => f.startsWith("function depositForBurn"));
	const hasReceive = MESSAGE_TRANSMITTER_V2_ABI.some(f => f.startsWith("function receiveMessage"));
	if (!hasBurn || !hasReceive) fail("required ABI fragment(s) missing from frontend/js/config.js");
	log(`ABI fragments present: depositForBurn=${hasBurn ? "yes" : "no"}, receiveMessage=${hasReceive ? "yes" : "no"}`);
	log("--check OK ✅");
	return 0;
}

// --- Step 4/5: Iris message + attestation -----------------------------------
// Mirrors quickstart retrieveAttestation: GET /v2/messages/{srcDomain}?transactionHash=
// until messages[0].status === "complete", capturing message + attestation verbatim.
// pending_http_not_found just means the burn isn't indexed yet — tolerated.
async function pollAttestation(burnHash) {
	const url = `${CONFIG.iris[srcChain.network]}/v2/messages/${srcChain.cctpDomain}?transactionHash=${burnHash}`;
	const maxAttempts = ONCE ? 1 : Math.ceil(IRIS_TIMEOUT_MS / POLL_MS);
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		// Per-request timeout so one hung fetch can't stall past the deadline
		// (same AbortController pattern as cctp-test.js / phase0-monitor.js).
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10_000);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (res.ok) {
				const data = await res.json();
				const msg = data && data.messages && data.messages[0];
				if (msg && msg.status === "complete" && msg.message && msg.attestation) return msg;
				if (msg) log(`attestation status: ${msg.status}`);
				else log(`unexpected response shape: ${JSON.stringify(data).slice(0, 200)}`);
			} else {
				const body = await res.text().catch(() => "");
				if (!body.includes("pending_http_not_found")) {
					log(`HTTP ${res.status} while polling${body ? `: ${body.slice(0, 160)}` : ""}`);
				}
			}
		} catch (e) { log(`poll error (retrying): ${e.message}`); }
		finally { clearTimeout(timer); }
		if (attempt < maxAttempts) await new Promise(r => setTimeout(r, POLL_MS));
	}
	throw new Error(ONCE ? "attestation not ready after 1 query (--once)" : "attestation timeout after 10 min");
}

// Decodes only what the official layout documents — developers.circle.com/cctp/
// references/technical-guide#message-header (version@0 uint32, sourceDomain@4
// uint32, destinationDomain@8 uint32, nonce@12 bytes32, recipient@76 bytes32,
// minFinalityThreshold@140 uint32, messageBody@148) and #message-body
// BurnMessageV2 (version@0, mintRecipient@36, amount@68 uint256) offset from
// body start at 148. printDecoded self-validates before trusting any of it.
function decodeMessage(messageHex) {
	const b = ethers.utils.arrayify(messageHex);
	const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
	const word = (o) => ethers.utils.hexZeroPad(ethers.utils.hexlify(b.slice(o, o + 32)), 32);
	const asAddressOrWord = (w) =>
		w.startsWith("0x000000000000000000000000") ? ethers.utils.getAddress(w.slice(-40)) : w;
	return {
		version: u32(0),
		sourceDomain: u32(4),
		destinationDomain: u32(8),
		nonce: word(12),
		recipient: asAddressOrWord(word(76)),
		minFinalityThreshold: u32(140),
		bodyVersion: u32(148),
		mintRecipient: asAddressOrWord(word(148 + 36)),
		amount: ethers.BigNumber.from(b.slice(148 + 68, 148 + 100)), // burnToken subunits
	};
}

function printDecoded(attMsg) {
	try {
		const d = decodeMessage(attMsg.message);
		// Trust the decode only when it self-validates against the route we
		// actually queried — wrong offsets would produce garbage that fails here,
		// and then we say so instead of guessing (never invent values).
		if (d.sourceDomain !== srcChain.cctpDomain || d.destinationDomain !== arcChain.cctpDomain) {
			throw new Error(
				`decoded domains (${d.sourceDomain}→${d.destinationDomain}) don't match the queried route ` +
				`(${srcChain.cctpDomain}→${arcChain.cctpDomain})`
			);
		}
		log(`message version: ${d.version}, body version: ${d.bodyVersion}`);
		log(`domains: source ${d.sourceDomain} → destination ${d.destinationDomain}`);
		log(`nonce: ${d.nonce}`);
		log(`minFinalityThreshold: ${d.minFinalityThreshold}`);
		log(`recipient (message handler): ${d.recipient}`);
		log(`mintRecipient: ${d.mintRecipient}`);
		log(`amount: ${ethers.utils.formatUnits(d.amount, 6)} USDC (${d.amount} 6-dec subunits)`);
	} catch (e) {
		log(`could not decode message header confidently (${e.message})`);
		log(`raw message prefix: ${String(attMsg.message).slice(0, 74)}…`);
	}
}

// --- Step 6: receiveMessage on Arc's MessageTransmitterV2 --------------------
async function mintOnArc(attMsg) {
	const rawKey = (process.env.PRIVATE_KEY || "").trim();
	if (!rawKey || rawKey === "your_private_key_here" || /^0?x?0+$/i.test(rawKey.replace(/^0x/i, ""))) {
		// Thrown (not process.exit) — this runs after network I/O, and a hard
		// exit here trips a libuv teardown assertion on Windows.
		throw new Error("PRIVATE_KEY missing/placeholder in .env — needed to submit receiveMessage on Arc");
	}

	const provider = new ethers.providers.JsonRpcProvider(arcChain.rpcUrl);
	const net = await provider.getNetwork(); // connect-to-arc.md: chainId 5042002
	if (net.chainId !== arcChain.chainId) {
		throw new Error(`Arc RPC reports chainId ${net.chainId}, expected ${arcChain.chainId} — wrong network?`);
	}
	const relayer = new ethers.Wallet(rawKey, provider);
	log(`relayer: ${relayer.address}`);

	// Gas-fail grace — Arc charges gas in NATIVE USDC (18-dec at the base layer),
	// never ETH (bridges.md "Fund relayers with USDC for gas"). Bail BEFORE
	// submitting rather than firing a tx that can never land.
	const native = await provider.getBalance(relayer.address); // bridges.md formats getBalance at 18 dec
	log(`relayer native balance: ${ethers.utils.formatUnits(native, 18)} USDC (Arc gas token)`);
	const minGas = ethers.utils.parseUnits(MIN_RELAYER_USDC, 18);
	if (native.lt(minGas)) {
		throw new Error(
			`relayer holds ${ethers.utils.formatUnits(native, 18)} native USDC (< ${MIN_RELAYER_USDC} needed for mint gas)` +
			` — fund it with native USDC (https://faucet.circle.com); per bridges.md relayers are funded with` +
			` USDC, NOT ETH — ETH has no function on Arc`
		);
	}

	const transmitter = new ethers.Contract(arcChain.cctp.messageTransmitterV2, MESSAGE_TRANSMITTER_V2_ABI, relayer);
	// Arc gas rules (docs.arc.io/arc/references/gas-and-fees): type-2 fees with a
	// ≥20 Gwei floor — headroom at 30 Gwei, tip 0, exactly like cctp-test.js.
	const overrides = { maxFeePerGas: ethers.utils.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0 };

	log(`submitting receiveMessage on ${arcChain.cctp.messageTransmitterV2}…`);
	let receipt;
	try {
		const mintTx = await transmitter.receiveMessage(attMsg.message, attMsg.attestation, overrides);
		log(`mint tx: ${mintTx.hash} (${arcChain.explorer}/tx/${mintTx.hash})`);
		receipt = await mintTx.wait();
		if (receipt.status !== 1) throw new Error("receiveMessage transaction reverted");
	} catch (e) {
		// Each CCTP message can only be received once per domain pair
		// (cctp-bridging.md warning). A revert saying so means someone already
		// minted — success-noop, not an error to retry.
		const text = String(e.reason || (e.error && e.error.message) || e.message || e);
		if (/already|duplicate/i.test(text)) {
			log("message already received on Arc (nonce spent) — nothing to mint, treated as success-noop ✅");
			return;
		}
		throw e;
	}

	log(`mint confirmed in block ${receipt.blockNumber} — USDC landed on the mintRecipient`);
	log(`view: ${arcChain.explorer}/tx/${receipt.transactionHash}`);
}

// --- --discover: surface candidate burn tx hashes ----------------------------
// eth_getLogs over the source TokenMessengerV2 WITHOUT a topic filter
// (publicnode serves unfiltered logs but caps range/result size — walk ~900-block
// windows and halve any rejected window, same -32602 strategy as watch-usdc.js).
async function collectLogs(provider, address, fromBlock, toBlock, out) {
	if (fromBlock > toBlock) return;
	if (toBlock - fromBlock + 1 > DISCOVER_CHUNK) {
		const mid = Math.floor((fromBlock + toBlock) / 2);
		await collectLogs(provider, address, fromBlock, mid, out);
		await collectLogs(provider, address, mid + 1, toBlock, out);
		return;
	}
	try {
		out.push(...await provider.getLogs({ address, fromBlock, toBlock }));
	} catch (e) {
		if (fromBlock === toBlock || !/-32602|max.?results|max.?allowed|too.?large/i.test(e.message)) throw e;
		const mid = Math.floor((fromBlock + toBlock) / 2);
		console.error(`[mint-arc] window ${fromBlock}-${toBlock} rejected by RPC — splitting at ${mid}`);
		await collectLogs(provider, address, fromBlock, mid, out);
		await collectLogs(provider, address, mid + 1, toBlock, out);
	}
}

async function discover(lookback) {
	const provider = new ethers.providers.JsonRpcProvider(srcChain.rpcUrl);
	const latest = await provider.getBlockNumber();
	const start = Math.max(0, latest - lookback + 1);
	const messengerAddr = srcChain.cctp.tokenMessengerV2;
	log(`--discover: eth_getLogs on ${srcChain.name} blocks ${start}..${latest} (${latest - start + 1})`);
	log(`emitter: TokenMessengerV2 ${messengerAddr}, NO topic filter`);

	const logs = [];
	await collectLogs(provider, messengerAddr, start, latest, logs);

	if (logs.length === 0) {
		log(`zero logs from TokenMessengerV2 in blocks ${start}..${latest} — try a bigger window, e.g.`);
		log(`  node scripts/mint-arc.js --discover 10000 --source ${srcKey}`);
		return;
	}

	// Event-type discrimination is deliberately NOT applied: every log under
	// TokenMessengerV2 is kept regardless of topics[0]. Identify which hash is a
	// real depositForBurn by inspecting each topics[0] yourself — this tool never
	// guesses event signatures.
	const byTx = new Map(); // txHash -> {first, last, count, topics0: Map}
	for (const lg of logs) {
		const e = byTx.get(lg.transactionHash) || { first: lg.blockNumber, last: lg.blockNumber, count: 0, topics0: {} };
		e.first = Math.min(e.first, lg.blockNumber);
		e.last = Math.max(e.last, lg.blockNumber);
		e.count += 1;
		const t0 = (lg.topics && lg.topics[0]) || "(anonymous log)";
		e.topics0[t0] = (e.topics0[t0] || 0) + 1;
		byTx.set(lg.transactionHash, e);
	}

	const ordered = [...byTx.entries()].sort((a, b) => b[1].last - a[1].last); // newest first
	log(`${logs.length} log(s) across ${ordered.length} transaction(s), newest first:`);
	for (const [hash, e] of ordered) {
		const span = e.first === e.last ? `block ${e.last}` : `blocks ${e.first}-${e.last}`;
		console.log(`  ${span}  ×${e.count}  ${hash}`);
		for (const [t0, n] of Object.entries(e.topics0)) console.log(`      topics[0] ${t0} ×${n}`);
		console.log(`      ${srcChain.explorer}/tx/${hash}`);
	}

	const freq = {};
	for (const [, e] of byTx) for (const [t0, n] of Object.entries(e.topics0)) freq[t0] = (freq[t0] || 0) + n;
	log(`topics[0] frequency table (event identity = keccak(signature); verify externally, not guessed here):`);
	for (const [t0, n] of Object.entries(freq).sort((a, b) => b[1] - a[1])) console.log(`  ${t0}  ×${n}`);

	log(`feed a burn tx to the minter: node scripts/mint-arc.js --tx <hash> [--dry-run]`);
}

async function main() {
	if (CHECK_ONLY) {
		runCheck();
		return;
	}

	if (DISCOVER) {
		await discover(LOOKBACK);
		return;
	}

	// --tx flow: quickstart Step 3.3 (retrieveAttestation) → Step 3.4 (mintUSDC),
	// run standalone with a relayer wallet.
	if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) fail(`--tx expects a 32-byte transaction hash, got "${txHash}"\n${USAGE}`);

	log(`route: ${srcChain.name} (domain ${srcChain.cctpDomain}) → ${arcChain.name} (domain ${arcChain.cctpDomain})`);
	log(`polling ${CONFIG.iris[srcChain.network]} for burn ${txHash}${ONCE ? " (--once: single query)" : ""}`);

	const attMsg = await pollAttestation(txHash);
	log("attestation complete");

	printDecoded(attMsg);
	if (DRY_RUN) {
		log("--dry-run: stopping before the on-chain submit.");
		return;
	}

	await mintOnArc(attMsg);
	log("done ✅");
}

// Post-network failures unwind naturally (process.exitCode, no process.exit):
// hard-exiting while the last fetch's sockets are still tearing down trips a
// libuv assertion on Windows and would mask the real exit code.
main().catch(e => {
	console.error(`[mint-arc] ERROR: ${e.reason || e.message}`);
	process.exitCode = 1;
});
