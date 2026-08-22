const hre = require("hardhat");

const DEPLOYMENTS = {
	// Populate these after deployment
	// ethereum: "0x...",   // OFT (ABT)
	// base: "0x...",
	// arbitrum: "0x...",
	// optimism: "0x...",
	// robinhood: "0x..."
	// NOTE: no `arc` entry — intentionally absent/unused. Arc is CCTP-only
	// (no OFT peer); see MAINNET-CHECKLIST.md Phase 3 pt 3 and the
	// disabled-contract hard-block below.
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
	arc: 30417 // UNVERIFIED against official LayerZero registry — confirm before mainnet
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

		// Pre-flight: a typo'd peer would accept setPeer on-chain yet route
		// messages into the void — require contract code at the target first.
		try {
			const code = await hre.ethers.provider.getCode(addr);
			if (code === "0x") throw new Error(`no contract code at ${addr} - wrong address or not deployed`);
		} catch (err) {
			console.error(`  Skipped peer ${chain}: ${err.message}`);
			failures.push({ chain, contractName, message: err.message });
			continue;
		}

		try {
			const tx = await contract.setPeer(eid, peer);
			await tx.wait();
			console.log(`  Peer set: ${chain} (EID ${eid}) -> ${addr}`);

			// Readback verification (pentest F4): `peers` is a public mapping in OAppCore v3
			const stored = await contract.peers(eid);
			if (stored.toLowerCase() !== peer.toLowerCase()) {
				const msg = `Peer readback mismatch after setPeer ${chain}: expected ${peer}, got ${stored}`;
				console.error(`  ${msg}`);
				failures.push({ chain, contractName, message: msg });
			}
		} catch (err) {
			console.error(`  Failed to set peer ${chain}:`, err.message);
			failures.push({ chain, contractName, message: err.message });
		}
	}

	return failures;
}

async function main() {
	const network = hre.network.name;

	// Contracts are disabled (BridgeToken.sol.disabled / BridgeAdapter.sol.disabled):
	// the OFT path is deprecated — canonical USDC route is Circle CCTP V2.
	// Same hard-block as deploy.js / local-test.js.
	const fs = require("fs");
	const path = require("path");
	if (!fs.existsSync(path.join(__dirname, "..", "contracts", "BridgeToken.sol"))) {
		console.error("BLOCKED: BridgeToken/BridgeAdapter are DISABLED (.sol.disabled) — the LayerZero");
		console.error("OFT path is deprecated; the canonical USDC route is Circle CCTP V2.");
		process.exit(1);
	}
	// Only comments in both address maps — nothing to configure (pentest F3).
	if (Object.keys(DEPLOYMENTS).length === 0 && Object.keys(ADAPTER_DEPLOYMENTS).length === 0) {
		console.error("DEPLOYMENTS empty — nothing to configure. Fill addresses after deployment.");
		process.exit(1);
	}

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
