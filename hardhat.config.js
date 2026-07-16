require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = {
	solidity: {
		version: "0.8.24",
		settings: {
			optimizer: { enabled: true, runs: 200 },
			evmVersion: "paris"
		}
	},
	networks: {
		ethereum: {
			url: process.env.ETH_RPC || "https://cloudflare-eth.com",
			chainId: 1,
			accounts: [PRIVATE_KEY]
		},
		base: {
			url: process.env.BASE_RPC || "https://mainnet.base.org",
			chainId: 8453,
			accounts: [PRIVATE_KEY]
		},
		arbitrum: {
			url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
			chainId: 42161,
			accounts: [PRIVATE_KEY]
		},
		optimism: {
			url: process.env.OPTIMISM_RPC || "https://mainnet.optimism.io",
			chainId: 10,
			accounts: [PRIVATE_KEY]
		},
		robinhood: {
			url: process.env.RHC_RPC || "https://rpc.mainnet.chain.robinhood.com",
			chainId: 4663,
			accounts: [PRIVATE_KEY]
		},
		arc: {
			url: process.env.ARC_RPC || "https://5042.rpc.thirdweb.com",
			chainId: 5042,
			accounts: [PRIVATE_KEY]
		},
		localhost: {
			url: "http://127.0.0.1:8545",
			chainId: 31337,
			accounts: [PRIVATE_KEY]
		}
	}
};
