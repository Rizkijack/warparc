const hre = require("hardhat");

const DEPLOYMENTS = {
	// Populate these after deployment
	// ethereum: "0x...",   // OFT (ABT)
	// base: "0x...",
	// arbitrum: "0x...",
	// optimism: "0x...",
	// robinhood: "0x...",
	// arc: "0x..."
};

const ADAPTER_DEPLOYMENTS = {
	// Populate these after deployment (only for chains with USDC)
	// ethereum: "0x...",   // OFTAdapter (USDC)
	// base: "0x...",
	// arbitrum: "0x...",
	// optimism: "0x..."
};

const CHAIN_EIDS = {
	ethereum: 30101,
	base: 30184,
	arbitrum: 30110,
	optimism: 30111,
	robinhood: 30416,
	arc: 30417
};

// Returns the bytes32 left-padded address
function toBytes32(addr) {
	return hre.ethers.utils.hexZeroPad(addr, 32);
}

async function setPeersFor(contractName, deployments) {
	const network = hre.network.name;
	const myAddr = deployments[network];
	if (!myAddr) return [];

	const failures = [];

	console.log(`\n=== Configuring peers on ${network} for ${contractName} ===`);
	console.log(`Contract: ${myAddr}`);

	const Contract = await hre.ethers.getContractFactory(contractName);
	const contract = Contract.attach(myAddr);

	for (const [chain, addr] of Object.entries(deployments)) {
		if (chain === network) continue;
		const eid = CHAIN_EIDS[chain];
		const peer = toBytes32(addr);

		try {
			const tx = await contract.setPeer(eid, peer);
			await tx.wait();
			console.log(`  Peer set: ${chain} (EID ${eid}) -> ${addr}`);
		} catch (err) {
			console.error(`  Failed to set peer ${chain}:`, err.message);
			failures.push({ chain, contractName, message: err.message });
		}
	}

	return failures;
}

async function main() {
	const network = hre.network.name;

	// Set peers for OFT
	const failures = [
		...(await setPeersFor("BridgeToken", DEPLOYMENTS)),
		// Set peers for OFTAdapter
		...(await setPeersFor("BridgeAdapter", ADAPTER_DEPLOYMENTS))
	];

	console.log(`\nPeer configuration complete for ${network}`);

	if (failures.length > 0) {
		console.error(`\n${failures.length} peer configuration(s) failed:`);
		for (const f of failures) {
			console.error(`Failed to set peer on ${f.chain} (${f.contractName}): ${f.message}`);
		}
		process.exitCode = 1;
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
