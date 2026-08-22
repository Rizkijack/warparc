// wagmi config — Arc Testnet + the four CCTP testnet partners.
// arcTestnet is built into viem/chains; no custom chain definition needed.
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet, sepolia, baseSepolia, arbitrumSepolia, optimismSepolia } from "viem/chains";

export const supportedChains = [
	arcTestnet,
	sepolia,
	baseSepolia,
	arbitrumSepolia,
	optimismSepolia
];

// App Kit string chain identifiers (case-sensitive — official tables):
// https://developers.circle.com (supported chains & domains)
export const CHAIN_ID_TO_KIT_NAME = {
	[arcTestnet.id]: "Arc_Testnet",
	[sepolia.id]: "Ethereum_Sepolia",
	[baseSepolia.id]: "Base_Sepolia",
	[arbitrumSepolia.id]: "Arbitrum_Sepolia",
	[optimismSepolia.id]: "Optimism_Sepolia"
};

export const config = createConfig({
	chains: supportedChains,
	connectors: [injected()],
	transports: Object.fromEntries(
		supportedChains.map(c => [c.id, http()])
	)
});
