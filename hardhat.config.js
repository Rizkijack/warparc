require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
// Well-known throwaway key (address 0x19E7...ff2A, zero balance) so that
// `hardhat compile` and tests run without a real deployer key. Deploy scripts
// refuse to sign with it.
const DUMMY_KEY = "0x" + "11".repeat(32);

let ACTIVE_KEY;
if (
	!PRIVATE_KEY ||
	PRIVATE_KEY.trim() === "your_private_key_here" ||
	PRIVATE_KEY.trim() === "replace_with_your_private_key"
) {
	console.warn("WARN: PRIVATE_KEY unset or placeholder — using dummy key (compile/test only)");
	ACTIVE_KEY = DUMMY_KEY;
} else if (!/^(0x)?[0-9a-fA-F]{64}$/.test(PRIVATE_KEY.trim())) {
	console.error("ERROR: PRIVATE_KEY in .env is not a valid 64-hex-char private key");
	process.exit(1);
} else {
	ACTIVE_KEY = PRIVATE_KEY.trim();
}

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
			url: process.env.ETH_RPC || "https://rpc.ankr.com/eth",
			chainId: 1,
			accounts: [ACTIVE_KEY]
		},
		base: {
			url: process.env.BASE_RPC || "https://mainnet.base.org",
			chainId: 8453,
			accounts: [ACTIVE_KEY]
		},
		arbitrum: {
			url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
			chainId: 42161,
			accounts: [ACTIVE_KEY]
		},
		optimism: {
			url: process.env.OPTIMISM_RPC || "https://mainnet.optimism.io",
			chainId: 10,
			accounts: [ACTIVE_KEY]
		},
		robinhood: {
			url: process.env.RHC_RPC || "https://rpc.mainnet.chain.robinhood.com",
			chainId: 4663,
			accounts: [ACTIVE_KEY]
		},
		arcMainnet: {
			// LAUNCH-DAY (MAINNET-CHECKLIST Phase 2): fill url ONLY from
			// https://docs.arc.io/arc/references/connect-to-arc once mainnet is public.
			// chainId intentionally absent — Hardhat infers it from the RPC response, so a
			// mismatched guess can never slip through the chainId validator. Empty url =
			// fail closed: any run against this network errors out at connect time.
			url: process.env.ARC_MAINNET_RPC || "",
			accounts: [ACTIVE_KEY]
			// chainId: TBD — do NOT hardcode (MAINNET-CHECKLIST Phase 2)
			// gasPrice: set on launch day to >= mainnet min base fee + margin (testnet floor 20 Gwei, used 30)
		},
		arc: {
			// Arc Testnet (official docs: https://docs.arc.io/arc/references/connect-to-arc)
			// Gas token = USDC (18 dec native / 6 dec ERC-20 iface). Gas floor 20 Gwei.
			// No network-level gasPrice: ethers v5 would then send a LEGACY (type-0)
			// tx, but Arc requires EIP-1559 type-2. Fees come from RPC suggestions;
			// senders that must pin the 20 Gwei floor do it per-transaction via
			// maxFeePerGas overrides (see scripts/cctp-test.js).
			url: process.env.ARC_RPC || "https://rpc.testnet.arc.io",
			chainId: 5042002,
			accounts: [ACTIVE_KEY],
			gas: 1_500_000
		},
		localhost: {
			url: "http://127.0.0.1:8545",
			chainId: 31337,
			accounts: [ACTIVE_KEY]
		}
	}
};

// Arc Mainnet (public launch September 16, 2026) — entry activates ONLY when
// official values are provided via env. Never guess them: chain ID, RPC and
// gas floor must come from docs.arc.io on launch day
// (MAINNET-CHECKLIST.md Phase 1/2). gasPrice is intentionally unset so Hardhat
// uses the RPC-reported fees instead of a carried-over testnet assumption.
const ARC_MAINNET_CHAIN_ID = parseInt(process.env.ARC_MAINNET_CHAIN_ID, 10);
if (process.env.ARC_MAINNET_RPC && Number.isInteger(ARC_MAINNET_CHAIN_ID) && ARC_MAINNET_CHAIN_ID > 0) {
	module.exports.networks.arcMainnet = {
		url: process.env.ARC_MAINNET_RPC,
		chainId: ARC_MAINNET_CHAIN_ID,
		accounts: [ACTIVE_KEY],
		gas: 1_500_000
	};
}
