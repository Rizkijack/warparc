const hre = require("hardhat");

const CHAIN_CONFIG = {
	ethereum: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	},
	base: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	},
	arbitrum: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	},
	optimism: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	},
	robinhood: {
		// UNVERIFIED: same endpoint used for Robinhood Chain and Arc testnet — confirm against official LayerZero registry before mainnet deployment
		lzEndpoint: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	},
	arc: {
		// UNVERIFIED: same endpoint used for Robinhood Chain and Arc testnet — confirm against official LayerZero registry before mainnet deployment
		lzEndpoint: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	}
};

async function main() {
	const network = hre.network.name;

	// Guard (pentest F2 HIGH): live networks MUST have a real PRIVATE_KEY.
	// A missing, placeholder, or all-zero key would deploy with a null signer.
	const LIVE_NETWORKS = new Set(["ethereum", "base", "arbitrum", "optimism", "robinhood", "arc"]);
	if (LIVE_NETWORKS.has(network)) {
		const rawKey = (process.env.PRIVATE_KEY || "").trim();
		const strippedKey = rawKey.replace(/^0x/i, "");
		const isZeroKey = strippedKey === "" || /^0+$/.test(strippedKey);
		if (rawKey === "" || rawKey === "your_private_key_here" || isZeroKey) {
			console.error(`ERROR: PRIVATE_KEY required for live network ${network} — set it in .env`);
			process.exit(1);
		}
	}

	const config = CHAIN_CONFIG[network];

	if (!config) {
		console.error(`Unknown network: ${network}`);
		console.error(`Available: ${Object.keys(CHAIN_CONFIG).join(", ")}`);
		process.exit(1);
	}

	console.log(`\n=== Deploying to ${network} ===`);
	console.log(`Chain ID: ${hre.network.config.chainId}`);
	console.log(`LZ Endpoint: ${config.lzEndpoint}`);

	const [deployer] = await hre.ethers.getSigners();
	console.log(`Deployer: ${deployer.address}`);

	const BridgeToken = await hre.ethers.getContractFactory("BridgeToken");
	const token = await BridgeToken.deploy(
		config.tokenName,
		config.tokenSymbol,
		config.lzEndpoint,
		deployer.address
	);
	await token.deployed();

	const addr = token.address;
	console.log(`BridgeToken deployed at: ${addr}`);

	console.log(`\n--- Deployment Summary ---`);
	console.log(`Network:   ${network}`);
	console.log(`Token:     ${config.tokenName} (${config.tokenSymbol})`);
	console.log(`Address:   ${addr}`);
	console.log(`LZ Endpoint: ${config.lzEndpoint}`);
	console.log(`Explorer:  ${getExplorerUrl(network, addr)}`);

	return { network, address: addr };
}

function getExplorerUrl(network, addr) {
	const explorers = {
		ethereum: `https://etherscan.io/address/${addr}`,
		base: `https://basescan.org/address/${addr}`,
		arbitrum: `https://arbiscan.io/address/${addr}`,
		optimism: `https://optimistic.etherscan.io/address/${addr}`,
		robinhood: `https://robinhoodchain.blockscout.com/address/${addr}`,
		arc: `https://arcscan.app/address/${addr}`
	};
	return explorers[network] || addr;
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
