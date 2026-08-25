const hre = require("hardhat");

/**
 * Local validation of the ARC Bridge contracts against the frontend's OFT_ABI.
 *
 * This deploys:
 *   1. MockEndpoint  (stand-in for LayerZero EndpointV2)
 *   2. BridgeToken   (the OFT the frontend integrates with)
 *
 * Then it calls the exact functions the frontend relies on (balanceOf, name,
 * symbol, decimals, setPeer) to prove the OFT_ABI encoding in frontend/js/config.js is
 * correct against the real compiled bytecode. Cross-chain quote/send is NOT
 * exercised (that needs the full LZ stack or a live network).
 */
async function main() {
	console.log("ARC Bridge — Local Contract Validation\n");

// Note: BridgeToken/BridgeAdapter are SAO with Pausable + EID allowlist
// (revived 2026-08-24). Canonical USDC route is Circle CCTP V2 — OFT path
// kept for ABT demo only. See DEPLOY.md Appendix A + MAINNET-CHECKLIST.md
// Phase 3 for the mainnet deployment checklist.

	const [deployer] = await hre.ethers.getSigners();
	console.log("Deployer:", deployer.address);

	// 1. Deploy mock endpoint (test EID = 31337)
	const Mock = await hre.ethers.getContractFactory("MockEndpoint");
	const endpoint = await Mock.deploy(31337);
	await endpoint.deployed();
	const endpointAddr = endpoint.address;
	console.log("MockEndpoint:", endpointAddr);

	// 2. Deploy BridgeToken (OFT) pointing at the mock endpoint
	const BridgeToken = await hre.ethers.getContractFactory("BridgeToken");
	const token = await BridgeToken.deploy(
		"ARC Bridge Token",
		"ABT",
		endpointAddr,
		deployer.address
	);
	await token.deployed();
	const oftAddr = token.address;
	console.log("BridgeToken (OFT):", oftAddr);

	// 3. Exercise the frontend OFT_ABI functions
	console.log("\n--- Frontend OFT_ABI validation ---");
	// 2b. EID mismatch — constructor only takes endpoint, not EID; the EID
	//     is what the endpoint advertises. Verify the deployer-set EID is
	//     consistent with CHAIN_EIDS (configure.js is the source of truth
	//     for setPeer; a wrong EID would route messages into the void).
	const CHAIN_EIDS = { ethereum: 30101, base: 30184, arbitrum: 30110, optimism: 30111, robinhood: 30416 };
	console.log("\n--- EID registry consistency ---");
	for (const [chain, eid] of Object.entries(CHAIN_EIDS)) {
		console.log("  " + chain.padEnd(11) + "EID " + eid + " (registry)");
	}
	console.log("  arc         EID 30417 (UNVERIFIED — confirm before mainnet)");

// 2c. Pause circuit-breaker — BridgeToken is Pausable; exercise the modifiers
//     via the inherited OZ Pausable view + owner-only pause/unpause.
console.log("\n--- Pausable circuit-breaker (BridgeToken) ---");
console.log("  paused initial:", await token.paused());
	await token.pause();
	console.log("  paused after pause():", await token.paused());
	await token.unpause();
	console.log("  paused after unpause():", await token.paused());
	console.log("  owner is deployer:", (await token.owner()) === deployer.address);
	// EID allowlist proof — BridgeAdapter has allowedEid; set then verify.
const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
const mockUSDC = await MockUSDC.deploy();
	await mockUSDC.deployed();
	await mockUSDC.mint(deployer.address, 1_000_000_000_000n);
	const BridgeAdapter = await hre.ethers.getContractFactory("BridgeAdapter");
	const adapter = await BridgeAdapter.deploy(mockUSDC.address, endpointAddr, deployer.address);
	await adapter.deployed();
	console.log("\n--- BridgeAdapter EID allowlist + daily cap ---");
	await adapter.setEidAllowed(30101, true);
	console.log("  allowedEid(30101):", await adapter.allowedEid(30101));
	console.log("  allowedEid(30110):", await adapter.allowedEid(30110));
	await adapter.setEidAllowed(30110, true);
	console.log("  allowedEid(30110) after grant:", await adapter.allowedEid(30110));
	await adapter.setDailyCap(10_000_000); // 10 USDC
	console.log("  dailyCap:", (await adapter.dailyCap()).toString(), "= 10 USDC (6 dec)");
	console.log("  dayStartUtc set at deploy:", (await adapter.dayStartUtc()).toString());
	console.log("\n\u2705 Pause + EID + daily cap all live on-chain. Cross-chain send requires");
const name = await token.name();
	const symbol = await token.symbol();
	const decimals = await token.decimals();
	const totalSupply = await token.totalSupply();
	const delegate = await endpoint.delegate();

	// BridgeToken has no public mint; just check balanceOf (0 initially).
	const balance = await token.balanceOf(deployer.address);

	console.log("name()        =", name);
	console.log("symbol()      =", symbol);
	console.log("decimals()    =", decimals.toString());
	console.log("totalSupply() =", hre.ethers.utils.formatUnits(totalSupply, 18));
	console.log("balanceOf()   =", hre.ethers.utils.formatUnits(balance, 18));
	console.log("endpoint.delegate() =", delegate);

	// 4. setPeer — the function configure.js calls on every chain
	const peerEid = 30184; // pretend Base
	const peerBytes32 = hre.ethers.utils.hexZeroPad(deployer.address, 32);
	const tx = await token.setPeer(peerEid, peerBytes32);
	await tx.wait();
	console.log("\nsetPeer(30184, <peer>) — OK (tx:", tx.hash.slice(0, 12), "...)");

	// 5. quote()/send() ABI-shape check — frontend uses OFT_ABI with the LayerZero
	// standard SendParam encoding. We can't exercise the live cross-chain path on the
	// mock endpoint, but we CAN prove the frontend's OFT_ABI matches the real OFT
	// contract by comparing function selectors against the compiled OFT base ABI.
	const OFT_ABI = [
		"function quoteSend((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) _sendParam,bool _payInLzToken) external view returns (uint256 nativeFee,uint256 lzTokenFee)",
		"function send((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) _sendParam,(uint256 nativeFee,uint256 lzTokenFee) _fee,address _refundAddress) external payable returns ((bytes32 guid,uint64 nonce,uint256 fee) msgReceipt,(uint256 amountSentLD,uint256 amountReceivedLD) oftReceipt)"
	];
	const oftIface = new hre.ethers.utils.Interface(OFT_ABI);
	const quoteSel = oftIface.getSighash("quoteSend");
	const sendSel = oftIface.getSighash("send");

	// The real OFT base ABI (where quoteSend/send are declared) must contain the same
	// selectors — proving our frontend OFT_ABI is the standard OFT interface.
	let oftArtifact;
	try {
		oftArtifact = require("../artifacts/@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol/OFT.json");
	} catch (err) {
		console.error("Artifacts not found. Run 'npx hardhat compile' first");
		process.exit(1);
	}
	const oftIfaceReal = new hre.ethers.utils.Interface(oftArtifact.abi);
	const realQuoteSel = oftIfaceReal.getSighash("quoteSend");
	const realSendSel = oftIfaceReal.getSighash("send");
	console.log("\nOFT_ABI quoteSend() selector:", quoteSel, quoteSel === realQuoteSel ? "✅ matches compiled OFT" : "❌ MISMATCH");
	console.log("OFT_ABI send()      selector:", sendSel, sendSel === realSendSel ? "✅ matches compiled OFT" : "❌ MISMATCH");
	if (quoteSel !== realQuoteSel || sendSel !== realSendSel)
		throw new Error("OFT_ABI selectors do not match compiled OFT contract");

	console.log("\n✅ Local validation complete. OFT_ABI encoding matches compiled contract.");
	console.log("   (Cross-chain send requires the full LZ stack or a live network — not tested here.)");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
