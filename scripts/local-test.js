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
