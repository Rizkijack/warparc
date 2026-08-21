require("dotenv").config();
const { execSync } = require("child_process");

const CHAINS = [
	{ name: "ethereum",  chainId: 1,     eid: 30101, endpoint: "0x1a44076050125825900e736c501f859c50fe728c" },
	{ name: "base",      chainId: 8453,  eid: 30184, endpoint: "0x1a44076050125825900e736c501f859c50fe728c" },
	{ name: "arbitrum",  chainId: 42161, eid: 30110, endpoint: "0x1a44076050125825900e736c501f859c50fe728c" },
	{ name: "optimism",  chainId: 10,    eid: 30111, endpoint: "0x1a44076050125825900e736c501f859c50fe728c" },
	{ name: "robinhood", chainId: 4663,  eid: 30416, endpoint: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b" },
	// UNVERIFIED: Arc EID 30417 / endpoint 0x6f4756... — confirm against official LayerZero registry before mainnet deployment
	{ name: "arc",       chainId: 5042002, eid: 30417, endpoint: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b" }
];

// ARC is a placeholder in DEPLOY.md (mainnet RPC unreachable) — skip it.
const DEPLOY_CHAINS = CHAINS.filter(c => c.name !== "arc");

async function main() {
	console.log("ARC Bridge - Full Deployment Script");
	console.log("===================================\n");
	console.log(`This script will deploy BridgeToken to ${DEPLOY_CHAINS.length} chains (ARC skipped, RPC unreachable — see DEPLOY.md).\n`);
	console.log("Chains to deploy:");
	DEPLOY_CHAINS.forEach(c => console.log(`  - ${c.name} (chain ${c.chainId}, EID ${c.eid})`));
	console.log("");

	if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === "your_private_key_here") {
		console.error("ERROR: Set PRIVATE_KEY in .env file first!");
		process.exit(1);
	}

	const results = {};
	const failedDeploys = [];

	for (const chain of DEPLOY_CHAINS) {
		console.log(`\n--- Deploying to ${chain.name} ---`);
		try {
			const output = execSync(
				`npx hardhat run scripts/deploy.js --network ${chain.name}`,
				{ encoding: "utf8", env: { ...process.env } }
			);
			console.log(output);

			const match = output.match(/Address:\s+(0x[a-fA-F0-9]{40})/);
			if (match) {
				results[chain.name] = match[1];
			}
		} catch (err) {
			console.error(`Deployment failed on ${chain.name}:`, err.message);
			failedDeploys.push(chain.name);
		}
	}

	console.log("\n\n=== Deployment Results ===");
	Object.entries(results).forEach(([chain, addr]) => {
		console.log(`${chain.padEnd(12)} ${addr}`);
	});

	// Chains attempted but missing from results (deploy error or no address match) count as failed.
	const failedChains = [...new Set([...failedDeploys, ...DEPLOY_CHAINS.filter((c) => !results[c.name])])];
	if (failedChains.length > 0) {
		console.error("\nDeployment failed for:");
		failedChains.forEach((c) => console.error(`  - ${c.name}`));
		process.exit(1);
	}

	console.log("\n\nTo configure peers, update DEPLOYMENTS in scripts/configure.js");
	console.log("with the addresses above, then run:");
	console.log("  npx hardhat run scripts/configure.js --network <chain>");
	console.log("for each chain.\n");
}

main().catch(console.error);
