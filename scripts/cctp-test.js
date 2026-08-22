/**
 * CCTP V2 end-to-end test — the script twin of the frontend bridge flow:
 *   fee quote → approve → depositForBurn → poll Iris attestation → receiveMessage
 *
 * Testnet ONLY (Arc is testnet until public mainnet Sep 16, 2026; MAINNET-CHECKLIST).
 * Runs the REAL flow against real RPCs — it moves real (faucet) USDC between
 * your own addresses. Fund the wallet at https://faucet.circle.com first.
 *
 * Usage:
 *   node scripts/cctp-test.js                       # ethereumSepolia → arc, 1 USDC
 *   node scripts/cctp-test.js arc baseSepolia 0.5   # arc → Base Sepolia, 0.5 USDC
 *   node scripts/cctp-test.js --check               # route/config sanity check, sends nothing
 *
 * Requires PRIVATE_KEY in .env. Node 18+ (global fetch). Uses root ethers v5.
 */
"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const IRIS_TIMEOUT_MS = 600_000; // 10 min cap for attestation polling
const POLL_MS = 5_000;           // far below Iris's 40 req/s limit

// --- load frontend CONFIG (single source of truth for chains/addresses) ------
const configSrc = fs.readFileSync(path.join(__dirname, "..", "frontend", "js", "config.js"), "utf8");
const { CONFIG, TOKEN_MESSENGER_V2_ABI, MESSAGE_TRANSMITTER_V2_ABI, ERC20_ABI } =
	(0, eval)(configSrc + "\n;({ CONFIG, TOKEN_MESSENGER_V2_ABI, MESSAGE_TRANSMITTER_V2_ABI, ERC20_ABI });");

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes("--check");
const positional = args.filter(a => !a.startsWith("--"));

const fromKey = positional[0] || "ethereumSepolia";
const toKey = positional[1] || "arc";
const amountHuman = positional[2] || "1";

const fromChain = CONFIG.chains[fromKey];
const toChain = CONFIG.chains[toKey];

function fail(msg) {
	console.error(`ERROR: ${msg}`);
	process.exit(1);
}

if (!fromChain || !toChain) fail(`unknown chain key(s): ${fromKey} / ${toKey}`);
if (fromChain.network !== "testnet" || toChain.network !== "testnet") {
	fail("this harness is testnet-only by design (Arc mainnet is not live yet)");
}
if (!fromChain.cctp || !toChain.cctp) fail("CCTP contracts missing for the selected route");
if (!CONFIG.tokens.USDC.addresses[fromKey]) fail(`no USDC address for ${fromKey}`);

const log = (s) => console.log(`[cctp-test] ${s}`);

// --- fee quote (same parsing as the frontend, verified live 2026-08-22) ------
async function quoteMaxFee() {
	const url = `${CONFIG.iris.testnet}/v2/burn/USDC/fees/${fromChain.cctpDomain}/${toChain.cctpDomain}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fee endpoint HTTP ${res.status}`);
	const data = await res.json();
	const fast = (Array.isArray(data) ? data : [data]).find(e => e && Number(e.finalityThreshold) === 1000);
	if (!fast || fast.minimumFee == null) throw new Error(`unexpected fee quote ${JSON.stringify(data)}`);
	const minFee = ethers.BigNumber.from(BigInt(fast.minimumFee));
	const buffered = BigInt(fast.minimumFee) * 10n;
	return { minFee, maxFee: ethers.BigNumber.from(buffered > 500n ? buffered : 500n) };
}

async function pollAttestation(burnHash) {
	const url = `${CONFIG.iris.testnet}/v2/messages/${fromChain.cctpDomain}?transactionHash=${burnHash}`;
	const deadline = Date.now() + IRIS_TIMEOUT_MS;
	while (Date.now() < deadline) {
		// Per-request timeout so one hung fetch can't stall the loop past the
		// deadline (same AbortController pattern as phase0-monitor.js).
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10_000);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (res.ok) {
				const data = await res.json();
				const msg = data && data.messages && data.messages[0];
				if (msg && msg.status === "complete" && msg.message && msg.attestation) return msg;
				if (msg) log(`attestation status: ${msg.status}`);
			}
		} catch (e) { log(`poll error (retrying): ${e.message}`); }
		finally { clearTimeout(timer); }
		await new Promise(r => setTimeout(r, POLL_MS));
	}
	throw new Error("attestation timeout");
}

async function main() {
	log(`route: ${fromChain.name} → ${toChain.name}, ${amountHuman} USDC (testnet)`);

	const { minFee, maxFee } = await quoteMaxFee();
	log(`fee quote: minimum ${minFee} subunits → maxFee cap ${maxFee} subunits`);

	if (CHECK_ONLY) {
		log("--check complete: route, contracts, USDC addresses and fee endpoint all reachable. Nothing sent.");
		return;
	}

	const rawKey = (process.env.PRIVATE_KEY || "").trim();
	if (!rawKey || rawKey === "your_private_key_here" || /^0?x?0+$/i.test(rawKey.replace(/^0x/i, ""))) {
		fail("PRIVATE_KEY missing/placeholder in .env — fund a testnet wallet via https://faucet.circle.com");
	}

	const fromProvider = new ethers.providers.JsonRpcProvider(fromChain.rpcUrl);
	const wallet = new ethers.Wallet(rawKey, fromProvider);
	log(`wallet: ${wallet.address}`);

	const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
	const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, wallet);

	const balance = await usdc.balanceOf(wallet.address);
	const amount = ethers.utils.parseUnits(amountHuman, 6);
	log(`USDC balance on ${fromChain.shortName}: ${ethers.utils.formatUnits(balance, 6)}`);
	// On Arc, USDC is also the GAS token — budget for burn + mint gas on top of
	// amount + fee cap (1.5M gas × 30 Gwei ≈ 0.045 USDC per tx, 2 txs worst case).
	const gasBudget = fromKey === "arc" ? ethers.utils.parseUnits("0.1", 6) : ethers.constants.Zero;
	const need = amount.add(maxFee).add(gasBudget);
	if (balance.lt(need)) {
		fail(`insufficient USDC: need ${ethers.utils.formatUnits(need, 6)} (amount + fee cap${fromKey === "arc" ? " + Arc gas" : ""}) — use https://faucet.circle.com`);
	}

	// 1. approve
	const messengerAddr = fromChain.cctp.tokenMessengerV2;
	if ((await usdc.allowance(wallet.address, messengerAddr)).lt(amount.add(maxFee))) {
		log("approving TokenMessengerV2...");
		const atx = await usdc.approve(messengerAddr, amount.add(maxFee));
		await atx.wait();
		log(`approved: ${atx.hash}`);
	}

	// 2. burn (fast transfer). Arc gas rules: type-2, ≥20 Gwei floor, tip 0 OK.
	const messenger = new ethers.Contract(messengerAddr, TOKEN_MESSENGER_V2_ABI, wallet);
	const overrides = fromKey === "arc" ? { maxFeePerGas: ethers.utils.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0 } : {};
	log("depositForBurn...");
	const burnTx = await messenger.depositForBurn(
		amount,
		toChain.cctpDomain,
		ethers.utils.hexZeroPad(wallet.address, 32),
		usdcAddr,
		ethers.constants.HashZero,
		maxFee,
		CONFIG.cctpDefaults.minFinalityThreshold,
		overrides
	);
	log(`burn tx: ${burnTx.hash} (${fromChain.explorer}/tx/${burnTx.hash})`);
	const burnReceipt = await burnTx.wait();
	if (burnReceipt.status !== 1) fail("burn transaction reverted");
	log("burn confirmed");

	// 3. attestation
	log("waiting for Circle attestation...");
	const att = await pollAttestation(burnTx.hash);
	log("attestation complete");

	// 4. mint on destination
	const toProvider = new ethers.providers.JsonRpcProvider(toChain.rpcUrl);
	const toWallet = new ethers.Wallet(rawKey, toProvider);
	const transmitter = new ethers.Contract(toChain.cctp.messageTransmitterV2, MESSAGE_TRANSMITTER_V2_ABI, toWallet);
	const mintOverrides = toKey === "arc" ? { maxFeePerGas: ethers.utils.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0 } : {};
	const toUsdc = new ethers.Contract(CONFIG.tokens.USDC.addresses[toKey], ERC20_ABI, toWallet);
	const before = await toUsdc.balanceOf(wallet.address);
	log(`dest balance before: ${ethers.utils.formatUnits(before, 6)} USDC`);

	const mintTx = await transmitter.receiveMessage(att.message, att.attestation, mintOverrides);
	log(`mint tx: ${mintTx.hash} (${toChain.explorer}/tx/${mintTx.hash})`);
	const mintReceipt = await mintTx.wait();
	if (mintReceipt.status !== 1) fail("mint transaction reverted");

	const after = await toUsdc.balanceOf(wallet.address);
	const received = after.sub(before);
	log(`dest balance after:  ${ethers.utils.formatUnits(after, 6)} USDC (received ${ethers.utils.formatUnits(received, 6)})`);

	// Tolerance = the same maxFee cap granted to depositForBurn — the executed
	// fee can be anything up to that, so anything smaller must land.
	const expected = amount.sub(maxFee);
	if (received.lt(expected)) {
		fail(`received ${ethers.utils.formatUnits(received, 6)} < expected ~${ethers.utils.formatUnits(expected, 6)} (amount − maxFee) — investigate before running again`);
	}
	log("E2E OK ✅  burn → attestation → mint completed end-to-end");
}

main().catch(e => fail(e.reason || e.message));
