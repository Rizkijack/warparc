/**
 * CCTP V2 end-to-end test — the script twin of the frontend bridge flow:
 *   fee quote → approve → depositForBurn → poll Iris attestation → receiveMessage
 *   (--forward routes via Circle's Forwarding Service: depositForBurnWithHook,
 *    Circle's relayer submits the destination mint — no gas needed on Arc)
 *
 * Testnet ONLY (Arc is testnet until public mainnet Sep 16, 2026; MAINNET-CHECKLIST).
 * Runs the REAL flow against real RPCs — it moves real (faucet) USDC between
 * your own addresses. Fund the wallet at https://faucet.circle.com first.
 *
 * Usage:
 *   node scripts/cctp-test.js                       # ethereumSepolia → arc, 1 USDC
 *   node scripts/cctp-test.js arc baseSepolia 0.5   # arc → Base Sepolia, 0.5 USDC
 *   node scripts/cctp-test.js --check               # sanity check + forward fee breakdown, sends nothing
 *   node scripts/cctp-test.js --forward             # Forwarding Service path: Circle mints on the destination
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
const FORWARD = args.includes("--forward");
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
// Forwarding Service hook ("cctp-forward", 32 bytes) — canonical value from
// https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
const FORWARD_HOOK = "0x636374702d666f72776172640000000000000000000000000000000000000000";
if (CONFIG.cctpDefaults.forwardHook !== FORWARD_HOOK) {
	fail(`config cctpDefaults.forwardHook != canonical "cctp-forward" hook — refusing to burn with the wrong hook`);
}

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

// Forwarding Service quote — same fees endpoint with ?forward=true. Math mirrors
// quickstart Step 3.1 exactly (minimumFee × 100 rounded through Number()):
//   protocolFee = amount × minimumFee × 100 / 1e6
//   maxFee      = forwardFee.med + protocolFee   (covers both fees)
//   totalAmount = amount + maxFee                (what we burn and approve)
async function quoteForwardFee(amount) {
	const url = `${CONFIG.iris.testnet}/v2/burn/USDC/fees/${fromChain.cctpDomain}/${toChain.cctpDomain}?forward=true`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`forward fee endpoint HTTP ${res.status}`);
	const data = await res.json();
	const fast = (Array.isArray(data) ? data : [data]).find(e => e && Number(e.finalityThreshold) === 1000 && e.forwardFee);
	if (!fast || fast.minimumFee == null || !fast.forwardFee.med) throw new Error("forwarding not quoted");
	const amt = BigInt(amount.toString());
	const protocolFee = amt * BigInt(Math.round(Number(fast.minimumFee) * 100)) / 1_000_000n;
	const maxFee = BigInt(fast.forwardFee.med) + protocolFee;
	const totalAmount = amt + maxFee;
	return {
		forwardFee: fast.forwardFee,
		minimumFee: fast.minimumFee,
		protocolFee,
		maxFee: ethers.BigNumber.from(maxFee),
		totalAmount: ethers.BigNumber.from(totalAmount),
	};
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

// Forward burns: completion = Iris shows Circle's relayer mint on the
// destination chain (forwardTxHash) — same semantics as app.js
// pollForwardCompletion, minus the manual-mint fallback (this harness never
// signs a destination tx). Same 10-min cap and abort-guard as pollAttestation.
async function pollForwardCompletion(burnHash) {
	const url = `${CONFIG.iris.testnet}/v2/messages/${fromChain.cctpDomain}?transactionHash=${burnHash}`;
	const deadline = Date.now() + IRIS_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10_000);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (res.ok) {
				const data = await res.json();
				const msg = data && data.messages && data.messages[0];
				if (msg) {
					if (msg.forwardTxHash) return msg;
					log(`forward status: ${msg.status || "pending"}${msg.eventMessageReceipt ? " (eventMessageReceipt seen)" : ""}`);
				}
			}
		} catch (e) { log(`poll error (retrying): ${e.message}`); }
		finally { clearTimeout(timer); }
		await new Promise(r => setTimeout(r, POLL_MS));
	}
	throw new Error("forward completion timeout — relayer mint not observed within 10 min");
}

async function main() {
	log(`route: ${fromChain.name} → ${toChain.name}, ${amountHuman} USDC (testnet)`);

	const amount = ethers.utils.parseUnits(amountHuman, 6);

	if (CHECK_ONLY) {
		const { minFee, maxFee } = await quoteMaxFee();
		log(`fee quote: minimum ${minFee} subunits → maxFee cap ${maxFee} subunits`);
		// Forward quote is free — always show its components in check mode.
		const fwdQ = await quoteForwardFee(amount);
		log(`forward fee quote: minimum ${fwdQ.minimumFee} subunits, forwardFee low ${fwdQ.forwardFee.low} / med ${fwdQ.forwardFee.med} / high ${fwdQ.forwardFee.high}`);
		log(`--check forward breakdown: protocolFee ${fwdQ.protocolFee}, maxFee ${fwdQ.maxFee}, totalAmount ${fwdQ.totalAmount} subunits for ${amountHuman} USDC. Nothing sent.`);
		log("--check complete: route, contracts, USDC addresses and fee endpoint all reachable. Nothing sent.");
		return;
	}

	// Fee quote — direct mint caps the fee at 10× minimumFee; --forward instead
	// charges forwardFee.med + a protocol fee on top of the burned amount.
	let maxFee, spendTotal;
	if (FORWARD) {
		const fwd = await quoteForwardFee(amount);
		maxFee = fwd.maxFee;
		spendTotal = fwd.totalAmount;
		log(`forward fee quote: minimum ${fwd.minimumFee} subunits, forwardFee low ${fwd.forwardFee.low} / med ${fwd.forwardFee.med} / high ${fwd.forwardFee.high}`);
		log(`forward fees: protocolFee ${fwd.protocolFee} subunits → maxFee ${maxFee} subunits → total burn ${spendTotal} subunits`);
	} else {
		const q = await quoteMaxFee();
		maxFee = q.maxFee;
		spendTotal = amount.add(q.maxFee);
		log(`fee quote: minimum ${q.minFee} subunits → maxFee cap ${q.maxFee} subunits`);
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
	log(`USDC balance on ${fromChain.shortName}: ${ethers.utils.formatUnits(balance, 6)}`);
	// On Arc, USDC is also the GAS token — budget for burn + mint gas on top of
	// amount + fee cap (1.5M gas × 30 Gwei ≈ 0.045 USDC per tx, 2 txs worst case).
	const gasBudget = fromKey === "arc" ? ethers.utils.parseUnits("0.1", 6) : ethers.constants.Zero;
	const need = amount.add(spendTotal).add(gasBudget);
	if (balance.lt(need)) {
		fail(`insufficient USDC: need ${ethers.utils.formatUnits(need, 6)} (amount + fee cap${fromKey === "arc" ? " + Arc gas" : ""}) — use https://faucet.circle.com`);
	}

	// 1. approve
	const messengerAddr = fromChain.cctp.tokenMessengerV2;
	if ((await usdc.allowance(wallet.address, messengerAddr)).lt(spendTotal)) {
		log(FORWARD ? "approving TokenMessengerV2 (total burn = amount + maxFee)..." : "approving TokenMessengerV2...");
		const atx = await usdc.approve(messengerAddr, spendTotal);
		await atx.wait();
		log(`approved: ${atx.hash}`);
	}

	// 2. burn (fast transfer). Arc gas rules: type-2, ≥20 Gwei floor, tip 0 OK.
	const messenger = new ethers.Contract(messengerAddr, TOKEN_MESSENGER_V2_ABI, wallet);
	const overrides = fromKey === "arc" ? { maxFeePerGas: ethers.utils.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0 } : {};
	// Forward path: snapshot the destination balance before burning — Circle's
	// relayer mints on its own, so the balance delta is our completion proof.
	let fwdDest = null;
	if (FORWARD) {
		fwdDest = {
			address: wallet.address,
			usdc: new ethers.Contract(CONFIG.tokens.USDC.addresses[toKey], ERC20_ABI, new ethers.providers.JsonRpcProvider(toChain.rpcUrl)),
		};
		fwdDest.before = await fwdDest.usdc.balanceOf(wallet.address);
		log(`dest balance before: ${ethers.utils.formatUnits(fwdDest.before, 6)} USDC`);
	}

	log(FORWARD ? "depositForBurnWithHook..." : "depositForBurn...");
	const burnTx = FORWARD
		? await messenger.depositForBurnWithHook(
			spendTotal,
			toChain.cctpDomain,
			ethers.utils.hexZeroPad(wallet.address, 32),
			usdcAddr,
			ethers.constants.HashZero,
			maxFee,
			CONFIG.cctpDefaults.minFinalityThreshold,
			CONFIG.cctpDefaults.forwardHook,
			overrides
		)
		: await messenger.depositForBurn(
			amount,
			toChain.cctpDomain,
			ethers.utils.hexZeroPad(wallet.address, 32),
			usdcAddr,
			ethers.constants.HashZero,
			maxFee,
			CONFIG.cctpDefaults.minFinalityThreshold,
			overrides
		);
	const burnReceipt = await burnTx.wait();
	if (burnReceipt.status !== 1) fail("burn transaction reverted");

	log("burn confirmed");

	// Forward path: Circle submits the destination mint — we never sign a
	// destination tx, so finish via the relayer-mint poll + balance check.
	if (FORWARD) {
		await finishForward(burnTx.hash, fwdDest, amount, maxFee);
		return;
	}

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

// Forward-path tail: wait for Circle's relayer mint, then verify the funds
// actually landed. Fees are deducted from the burned total on the destination,
// so the tolerance here is maxFee itself (same reasoning as the direct path).
async function finishForward(burnHash, fwdDest, amount, maxFee) {
	log("waiting for Circle relayer to submit the destination mint (no receiveMessage needed)...");
	const msg = await pollForwardCompletion(burnHash);
	log(`relayer mint: ${msg.forwardTxHash} (${toChain.explorer}/tx/${msg.forwardTxHash})`);

	const after = await fwdDest.usdc.balanceOf(fwdDest.address);
	const received = after.sub(fwdDest.before);
	log(`dest balance after:  ${ethers.utils.formatUnits(after, 6)} USDC (received ${ethers.utils.formatUnits(received, 6)})`);

	const expected = amount.sub(maxFee);
	if (received.lt(expected)) {
		fail(`received ${ethers.utils.formatUnits(received, 6)} < expected ~${ethers.utils.formatUnits(expected, 6)} (amount − maxFee) — investigate before running again`);
	}
	log("E2E OK ✅  burn → forwarded relayer mint completed end-to-end");
}

main().catch(e => fail(e.reason || e.message));
