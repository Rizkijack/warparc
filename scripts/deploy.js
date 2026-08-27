const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const CHAIN_CONFIG = {
	ethereum: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		// Verified canonical mainnet USDC (developers.circle.com/stablecoins/usdc-contract-addresses)
		usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		mode: "both"
	},
	base: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		// Verified canonical mainnet USDC (developers.circle.com/stablecoins/usdc-contract-addresses)
		usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		mode: "both"
	},
	arbitrum: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		// Verified canonical mainnet USDC (developers.circle.com/stablecoins/usdc-contract-addresses)
		usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
		mode: "both"
	},
	optimism: {
		lzEndpoint: "0x1a44076050125825900e736c501f859c50fe728c",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		// Verified canonical mainnet USDC (developers.circle.com/stablecoins/usdc-contract-addresses)
		usdcAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
		mode: "both"
	},
	robinhood: {
		// UNVERIFIED: same endpoint used for Robinhood Chain and Arc testnet — confirm against official LayerZero registry before mainnet deployment
		lzEndpoint: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "oft"
	},
	arc: {
		// CCTP-only chain — no custom deployment (MAINNET-CHECKLIST Phase 3 pt 3); use canonical USDC/gateway addresses
		// UNVERIFIED: same endpoint used for Robinhood Chain and Arc testnet — confirm against official LayerZero registry before mainnet deployment
		lzEndpoint: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b",
		tokenName: "ARC Bridge Token",
		tokenSymbol: "ABT",
		mode: "cctp-only"
	}
};

async function main() {
	const network = hre.network.name;

// Note: BridgeToken/BridgeAdapter are SAO contracts with Pausable + daily-cap
// circuit breakers and an EID allowlist (revived 2026-08-24). They compile
// and may be deployed, but the canonical USDC route is Circle CCTP V2 — the
// OFT path is kept only for the ABT demo token. Review DEPLOY.md Appendix A
// and MAINNET-CHECKLIST.md Phase 3 before mainnet deployment.

	// Guard (pentest F2 HIGH): live networks MUST have a real PRIVATE_KEY.
	// A missing, placeholder, or all-zero key would deploy with a null signer.
	const LIVE_NETWORKS = new Set(["ethereum", "base", "arbitrum", "optimism", "robinhood", "arc"]);
	if (LIVE_NETWORKS.has(network)) {
		const rawKey = (process.env.PRIVATE_KEY || "").trim();
		const strippedKey = rawKey.replace(/^0x/i, "");
		const isZeroKey = strippedKey === "" || /^0+$/.test(strippedKey);
		// 0x11…11 is hardhat.config's well-known dummy key — never sign live with it
		const isDummyKey = strippedKey === "11".repeat(32);
		if (rawKey === "" || rawKey === "your_private_key_here" || isZeroKey || isDummyKey) {
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

	// Guard (audit): BridgeAdapter (OFT USDC) is legacy path — canonical USDC is CCTP V2.
	// Require explicit ENABLE_OFT_ADAPTER=1 for any live deployment that includes the adapter.
	if (LIVE_NETWORKS.has(network) && config.mode === "both" && process.env.ENABLE_OFT_ADAPTER !== "1") {
		console.error(`ERROR: BridgeAdapter (OFT USDC) is legacy — canonical route is CCTP V2. Set ENABLE_OFT_ADAPTER=1 to confirm OFT adapter deploy on ${network}.`);
		console.error(`Refusing to deploy BridgeAdapter without explicit opt-in (see DEPLOY.md Appendix A).`);
		process.exit(1);
	}

	console.log(`\n=== Deploying to ${network} ===`);
	console.log(`Chain ID: ${hre.network.config.chainId}`);
	console.log(`LZ Endpoint: ${config.lzEndpoint}`);

	const [deployer] = await hre.ethers.getSigners();
	console.log(`Deployer: ${deployer.address}`);

	const BridgeToken = await hre.ethers.getContractFactory("BridgeToken");

	const deployBridgeToken = async () => {
		const token = await BridgeToken.deploy(
			config.tokenName,
			config.tokenSymbol,
			config.lzEndpoint,
			deployer.address
		);
		await token.deployed();
		console.log(`BridgeToken (OFT) deployed at: ${token.address}`);
		return token.address;
	};

	switch (config.mode) {
		case "cctp-only":
			// Arc is a CCTP-only chain (MAINNET-CHECKLIST Phase 3 pt 3) — no custom deployment (MAINNET-CHECKLIST Phase 3 pt 3); use canonical USDC/gateway addresses
			// Only canonical USDC / CCTP gateway addresses are used; bridged USDC flows via CCTP.
			console.log(`\n=== Skipping ${network}: CCTP-only chain — no custom deployment (MAINNET-CHECKLIST Phase 3 pt 3); use canonical USDC/gateway addresses ===`);
			return { network, skipped: true };

		case "both": {
			const addrOFT = await deployBridgeToken();

			const BridgeAdapter = await hre.ethers.getContractFactory("BridgeAdapter");
			const adapter = await BridgeAdapter.deploy(
				config.usdcAddress,
				config.lzEndpoint,
				deployer.address
			);
			await adapter.deployed();
			const addrAdapter = adapter.address;
			console.log(`BridgeAdapter deployed at: ${addrAdapter}`);

			console.log(`\n--- Deployment Summary ---`);
			console.log(`Network:        ${network}`);
			console.log(`Token:          ${config.tokenName} (${config.tokenSymbol})`);
			console.log(`OFT Address:    ${addrOFT}`);
			console.log(`Adapter Address: ${addrAdapter}`);
			console.log(`USDC:           ${config.usdcAddress}`);
			console.log(`LZ Endpoint:    ${config.lzEndpoint}`);
			console.log(`Explorer (OFT):    ${getExplorerUrl(network, addrOFT)}`);
			console.log(`Explorer (Adapter): ${getExplorerUrl(network, addrAdapter)}`);

			return { network, token: addrOFT, adapter: addrAdapter };
		}

		case "oft":
		default: {
			const addr = await deployBridgeToken();

			console.log(`\n--- Deployment Summary ---`);
			console.log(`Network:   ${network}`);
			console.log(`Token:     ${config.tokenName} (${config.tokenSymbol})`);
			console.log(`Address:   ${addr}`);
			console.log(`LZ Endpoint: ${config.lzEndpoint}`);
			console.log(`Explorer:  ${getExplorerUrl(network, addr)}`);

			return { network, address: addr };
		}
	}
}

function getExplorerUrl(network, addr) {
	const explorers = {
		ethereum: `https://etherscan.io/address/${addr}`,
		base: `https://basescan.org/address/${addr}`,
		arbitrum: `https://arbiscan.io/address/${addr}`,
		optimism: `https://optimistic.etherscan.io/address/${addr}`,
		robinhood: `https://robinhoodchain.blockscout.com/address/${addr}`,
		arc: `https://testnet.arcscan.app/address/${addr}`
	};
	return explorers[network] || addr;
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
