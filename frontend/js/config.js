// WarpArc configuration — canonical USDC route is Circle CCTP V2 (burn-and-mint).
// Every Arc value traces to https://docs.arc.io (see ARC-REFERENCE.md, the local
// source handbook — ARC-SOURCES.md is local-only and may be absent). Never fill
// an unknown value from memory — re-fetch from the official docs instead.
//
// Legacy LayerZero V2 OFT data (chains.*.layerZero, OFT_ABI) is DEPRECATED and
// kept for the ABT demo path only (deprecated legacy OFT path).
const CONFIG = {
	bridgeToken: {
		deployments: {
			ethereum:  null,
			base:      null,
			arbitrum:  null,
			optimism:  null,
			robinhood: null,
			arc:       null
		},
		decimals: 18,
		symbol: "ABT",
		name: "ARC Bridge Token",
		icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect x='4' y='4' width='10' height='10' rx='2' fill='%239b6ef0'/%3E%3Crect x='18' y='4' width='10' height='10' rx='2' fill='%239b6ef0' opacity='0.5'/%3E%3Crect x='4' y='18' width='10' height='10' rx='2' fill='%2310b981'/%3E%3Crect x='18' y='18' width='10' height='10' rx='2' fill='%2310b981' opacity='0.5'/%3E%3C/svg%3E"
	},
	bridgeAdapter: {
		deployments: {
			ethereum:  null,
			base:      null,
			arbitrum:  null,
			optimism:  null,
			robinhood: null,
			arc:       null
		},
		decimals: 6,
		symbol: "USDC",
		name: "ARC Bridge USDC Adapter",
		icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Cpath d='M16 7v18M20.8 11.2c-.8-1.2-2.6-1.9-4.8-1.9-2.7 0-4.7 1.3-4.7 3.3 0 4.4 9.6 2.4 9.6 6.7 0 2.1-2.1 3.4-5.1 3.4-2.5 0-4.3-.9-5.1-2.2' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
	},
	chains: {
		ethereum: {
			network: "mainnet",
			chainId: 1,
			cctpDomain: 0,
			eid: 30101,
			name: "Ethereum Mainnet",
			shortName: "Ethereum",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://rpc.ankr.com/eth",
			explorer: "https://etherscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/ethereum.svg",
			cctp: {
				// Canonical CCTP V2 (https://developers.circle.com/cctp/evm-smart-contracts)
				tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
				messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
			},
			layerZero: {
				endpointV2: "0x1a44076050125825900e736c501f859c50fe728c",
				sendUln302: "0xbb2ea70c9e858123480642cf96acbcce1372dce1",
				receiveUln302: "0xc02ab410f0734efa3f14628780e6e695156024c2",
				executor: "0x173272739bd7aa6e4e214714048a9fe699453059",
				blockedMessageLib: "0x1ccbf0db9c192d969de57e25b3ff09a25bb1d862",
				deadDVN: "0x747c741496a507e4b404b50463e691a8d692f6ac",
				endpointV2View: "0x8fafc84caea1cef8475cb5cb344658d160c9ce0b",
				lzExecutor: "0xbf2e102fb382d6ec52823c8f81a45e9caa951320",
				readLib1002: "0x74f55bc2a79a27a0bf1d1a35db5d0fc36b9fdb9d"
			}
		},
		base: {
			network: "mainnet",
			chainId: 8453,
			cctpDomain: 6,
			eid: 30184,
			name: "Base Mainnet",
			shortName: "Base",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://mainnet.base.org",
			explorer: "https://basescan.org",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/base.svg",
			cctp: {
				tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
				messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
			},
			layerZero: {
				endpointV2: "0x1a44076050125825900e736c501f859c50fe728c",
				sendUln302: "0xb5320b0b3a13cc860893e2bd79fcd7e13484dda2",
				receiveUln302: "0xc70ab6f32772f59fbfc23889caf4ba3376c84baf",
				executor: "0x2cca08ae69e0c44b18a57ab2a87644234daebae4",
				blockedMessageLib: "0x1ccbf0db9c192d969de57e25b3ff09a25bb1d862",
				deadDVN: "0x6498b0632f3834d7647367334838111c8c889703",
				endpointV2View: "0x5e2a88c385b86f00eb8f4d9f861649a6feb93f24",
				lzExecutor: "0x125bd5c6c5066dcb4bb448b6ea8b9234ed60e160"
			}
		},
		arbitrum: {
			network: "mainnet",
			chainId: 42161,
			cctpDomain: 3,
			eid: 30110,
			name: "Arbitrum One",
			shortName: "Arbitrum",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://arb1.arbitrum.io/rpc",
			explorer: "https://arbiscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/arbitrum.svg",
			cctp: {
				tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
				messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
			},
			layerZero: {
				endpointV2: "0x1a44076050125825900e736c501f859c50fe728c",
				sendUln302: "0x975bcd720be66659e3eb3c0e4f1866a3020e493a",
				receiveUln302: "0x7b9e184e07a6ee1ac23eae0fe8d6be2f663f05e6",
				executor: "0x31cae3b7fb82d847621859fb1585353c5720660d",
				blockedMessageLib: "0x1ccbf0db9c192d969de57e25b3ff09a25bb1d862",
				deadDVN: "0x758c419533ad64ce9d3413bc8d3a97b026098ec1",
				endpointV2View: "0x5440e2097c41f8e0a8551521d569c71de70fde23",
				lzExecutor: "0x6862ded20594da16b7cbb282894fae23043a32bc"
			}
		},
		optimism: {
			network: "mainnet",
			chainId: 10,
			cctpDomain: 2,
			eid: 30111,
			name: "Optimism Mainnet",
			shortName: "Optimism",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://mainnet.optimism.io",
			explorer: "https://optimistic.etherscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/optimism.svg",
			cctp: {
				tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
				messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
			},
			layerZero: {
				endpointV2: "0x1a44076050125825900e736c501f859c50fe728c",
				sendUln302: "0x1322871e4ab09bc7f5717189434f97bbd9546e95",
				receiveUln302: "0x3c4962ff6258dcfcafd23a814237b7d6eb712063",
				executor: "0x2d2ea0697bdbede3f01553d2ae4b8d0c486b666e",
				blockedMessageLib: "0x1ccbf0db9c192d969de57e25b3ff09a25bb1d862",
				deadDVN: "0xebc3065003e67caac747836da272d9e5271a37e1",
				endpointV2View: "0xecee8b581960634af89f467ae624ff468a9db14b",
				lzExecutor: "0xb02763373589c440ed6ff32f47cf4b81ca285d01"
			}
		},
		robinhood: {
			// NOT in Circle's published CCTP domain list — excluded from USDC bridging
			// until officially confirmed (watched in MAINNET-CHECKLIST Phase 0).
			// Legacy LayerZero data only; no USDC route exists here today.
			network: "mainnet",
			chainId: 4663,
			eid: 30416,
			name: "Robinhood Chain",
			shortName: "RHC",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
			explorer: "https://robinhoodchain.blockscout.com",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/robinhood.svg",
			layerZero: {
				endpointV2: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b",
				sendUln302: "0xc39161c743d0307eb9bcc9fef03eeb9dc4802de7",
				receiveUln302: "0xe1844c5d63a9543023008d332bd3d2e6f1fe1043",
				executor: "0x4208d6e27538189bb48e603d6123a94b8abe0a0b",
				blockedMessageLib: "0xc1ce56b2099ca68720592583c7984cab4b6d7e7a",
				deadDVN: "0x6788f52439aca6bff597d3eec2dc9a44b8fee842",
				endpointV2View: "0xaab5a48cfc03efa9cc34a2c1aacccb84b4b770e4",
				lzExecutor: "0x41bdb4aa4a63a5b2efc531858d3118392b1a1c3d"
			}
		},
		arc: {
			// Arc Testnet — official docs https://docs.arc.io/arc/references/connect-to-arc
			// Gas token = USDC (native 18 dec / ERC-20 iface 6 dec, same balance).
			// Show balances via the 6-dec ERC-20 view; never sum the two views.
			network: "testnet",
			chainId: 5042002,
			eid: 30417, // UNVERIFIED against official LayerZero registry — confirm before mainnet
			cctpDomain: 26,
			name: "Arc Testnet",
			shortName: "ARC",
			nativeCurrency: { name: "USDC Token", symbol: "USDC", decimals: 18 },
			rpcUrl: "https://rpc.testnet.arc.io",
			explorer: "https://testnet.arcscan.app",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/arc.svg",
			cctp: {
				// Canonical CCTP V2 contracts on Arc Testnet (https://docs.arc.io/arc/references/contract-addresses)
				usdc: "0x3600000000000000000000000000000000000000",
				tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
				messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
				tokenMinterV2: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192",
				messageV2: "0xbaC0179bB358A8936169a63408C8481D582390C4",
				gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
				gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B"
			},
			layerZero: { // LEGACY — deprecated with the OFT path; kept for reference only
				endpointV2: "0x6f475642a6e85809b1c36fa62763669b1b48dd5b",
				sendUln302: "0xc39161c743d0307eb9bcc9fef03eeb9dc4802de7",
				receiveUln302: "0xe1844c5d63a9543023008d332bd3d2e6f1fe1043",
				executor: "0x4208d6e27538189bb48e603d6123a94b8abe0a0b",
				blockedMessageLib: "0xc1ce56b2099ca68720592583c7984cab4b6d7e7a",
				deadDVN: "0x6788f52439aca6bff597d3eec2dc9a44b8fee842",
				endpointV2View: "0xaab5a48cfc03efa9cc34a2c1aacccb84b4b770e4",
				lzExecutor: "0x41bdb4aa4a63a5b2efc531858d3118392b1a1c3d"
			}
		},
		ethereumSepolia: {
			// Testnet CCTP pair for Arc — USDC via faucet.circle.com
			network: "testnet",
			chainId: 11155111,
			cctpDomain: 0,
			name: "Ethereum Sepolia",
			shortName: "Sepolia",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
			explorer: "https://sepolia.etherscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/ethereum.svg",
			cctp: {
				// Same canonical CCTP V2 deployment on all Circle testnets
				// (https://developers.circle.com/cctp/evm-smart-contracts)
				tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
				messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
			}
		},
		baseSepolia: {
			network: "testnet",
			chainId: 84532,
			cctpDomain: 6,
			name: "Base Sepolia",
			shortName: "Base Sepolia",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://sepolia.base.org",
			explorer: "https://sepolia.basescan.org",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/base.svg",
			cctp: {
				tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
				messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
			}
		},
		arbitrumSepolia: {
			network: "testnet",
			chainId: 421614,
			cctpDomain: 3,
			name: "Arbitrum Sepolia",
			shortName: "Arb Sepolia",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://sepolia.arbitrum.io",
			explorer: "https://sepolia.arbiscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/arbitrum.svg",
			cctp: {
				tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
				messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
			}
		},
		optimismSepolia: {
			network: "testnet",
			chainId: 11155420,
			cctpDomain: 2,
			name: "OP Sepolia",
			shortName: "OP Sepolia",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://sepolia.optimism.io",
			explorer: "https://sepolia-optimism.etherscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/optimism.svg",
			cctp: {
				tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
				messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
			}
		},
		arcMainnet: {
			// SKELETON ONLY — public mainnet launches September 16, 2026.
			// Every value MUST come from docs.arc.io on launch day
			// (MAINNET-CHECKLIST.md Phase 1). Never carry testnet values over.
			// `disabled` keeps it out of the UI until real values are filled in.
			disabled: true,
			network: "mainnet",
			chainId: null,           // ?TBD?
			eid: null,               // UNVERIFIED — do NOT set from testnet value
			cctpDomain: null,        // ?TBD?
			name: "Arc Mainnet",
			shortName: "Arc",
			nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
			rpcUrl: null,            // ?TBD?
			explorer: null,          // ?TBD?
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/arc.svg",
			cctp: {
				usdc: null,              // ?TBD?
				tokenMessengerV2: null,  // ?TBD?
				messageTransmitterV2: null, // ?TBD?
				tokenMinterV2: null,     // ?TBD?
				messageV2: null,         // ?TBD?
				gatewayWallet: null,     // ?TBD?
				gatewayMinter: null      // ?TBD?
			}
		}
	},
	tokens: {
		ABT: {
			name: "ARC Bridge Token",
			symbol: "ABT",
			decimals: 18,
			addresses: {
				ethereum:  null,
				base:      null,
				arbitrum:  null,
				optimism:  null,
				robinhood: null,
				arc:       null
			},
			icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Crect x='4' y='4' width='10' height='10' rx='2' fill='%239b6ef0'/%3E%3Crect x='18' y='4' width='10' height='10' rx='2' fill='%239b6ef0' opacity='0.5'/%3E%3Crect x='4' y='18' width='10' height='10' rx='2' fill='%2310b981'/%3E%3Crect x='18' y='18' width='10' height='10' rx='2' fill='%2310b981' opacity='0.5'/%3E%3C/svg%3E"
		},
		USDC: {
			name: "USD Coin",
			symbol: "USDC",
			decimals: 6,
			addresses: {
				ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
				optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
				robinhood: null,
				// Arc Testnet ERC-20 interface (native USDC is the same asset, 18 dec native view)
				arc: "0x3600000000000000000000000000000000000000",
				// Testnet USDC (faucet.circle.com) — verified from
				// https://developers.circle.com/stablecoins/usdc-contract-addresses
				ethereumSepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
				baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				arbitrumSepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
				optimismSepolia: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
				// Arc mainnet USDC — ?TBD? (MAINNET-CHECKLIST.md Phase 1)
				arcMainnet: null
			},
			icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Cpath d='M16 7v18M20.8 11.2c-.8-1.2-2.6-1.9-4.8-1.9-2.7 0-4.7 1.3-4.7 3.3 0 4.4 9.6 2.4 9.6 6.7 0 2.1-2.1 3.4-5.1 3.4-2.5 0-4.3-.9-5.1-2.2' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
		},
		ETH: {
			name: "Ether",
			symbol: "ETH",
			decimals: 18,
			addresses: {
				ethereum: "0x0000000000000000000000000000000000000000",
				base: "0x0000000000000000000000000000000000000000",
				arbitrum: "0x0000000000000000000000000000000000000000",
				optimism: "0x0000000000000000000000000000000000000000",
				robinhood: "0x0000000000000000000000000000000000000000",
				arc: "0x0000000000000000000000000000000000000000",
				ethereumSepolia: "0x0000000000000000000000000000000000000000",
				baseSepolia: "0x0000000000000000000000000000000000000000",
				arbitrumSepolia: "0x0000000000000000000000000000000000000000",
				optimismSepolia: "0x0000000000000000000000000000000000000000",
				arcMainnet: "0x0000000000000000000000000000000000000000"
			},
			icon: "https://icons-ckg.pages.dev/lz-scan/protocols/ether.svg"
		}
	},
	// Circle Iris attestation API (CCTP V2) — technical guide:
	// https://developers.circle.com/cctp/technical-guide
	iris: {
		mainnet: "https://iris-api.circle.com",
		testnet: "https://iris-api-sandbox.circle.com"
	},
	// CCTP V2 defaults per the official Ethereum→Arc quickstart:
	// https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
	cctpDefaults: {
		minFinalityThreshold: 1000, // 1000 = fast transfer, 2000+ = standard
		fallbackMaxFee: "500",      // 0.0005 USDC, in 6-dec burn-token subunits
		// Forwarding Service hook label ("cctp-forward", 32 bytes) — Circle's
		// infra submits the destination mint. Fee quote: /v2/burn/USDC/fees/...?forward=true
		forwardHook: "0x636374702d666f72776172640000000000000000000000000000000000000000"
	},
	// CCTP V2 registry — canonical values from developers.circle.com/cctp/references/
	// contract-addresses + contract-interfaces (fetched 2026-08-22). Contract addresses
	// are shared per network tier (Circle bridges testnet<->testnet, mainnet<->mainnet).
	cctp: {
		domains: {
			ethereum: 0,
			optimism: 2,
			arbitrum: 3,
			base: 6,
			robinhood: null, // not in the CCTP domain registry
			arc: 26,
			arcMainnet: null // UNVERIFIED until the Arc mainnet domain publishes
		},
		contracts: {
			testnet: {
				tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
				messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"
			},
			mainnet: {
				tokenMessengerV2: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
				messageTransmitterV2: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"
			}
		},
		attestationApi: "https://iris-api.circle.com/v2/attestations",
		MESSAGE_SENT_TOPIC0: "0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0"
	},
	// WalletConnect — remote/mobile wallet sessions. projectId comes from
	// https://cloud.walletconnect.com (free tier); it is a public client-side
	// value. EMPTY => the WalletConnect option stays disabled (fail-closed).
	walletconnect: {
		projectId: "74c3944c7d1579478f020903a8e6d008",
		sdkVersion: "2" // pinned @walletconnect/ethereum-provider major, served via jsdelivr +esm
	},
	lzScan: "https://layerzeroscan.com",
	// ETH Bridge Protocol Configuration — native ETH cross-chain bridging
	ethBridge: {
		lifiApi: "https://li.quest/v1",
		acrossApi: "https://app.across.to/api",
		socketApi: "https://public-backend.socket.tech/v3",
		relayApi: "https://api.relay.link",
		// Stargate Router V2 — same address on all EVM chains
		stargateRouterAddress: "0x150f4E4bD86B9b3655702eFEfB78c8b1D9b5d6c0",
		// API keys — set via env or localStorage; never hardcode secrets here
		apiKeys: {
			across: "",       // set via ACROSS_API_KEY env or localStorage
			acrossIntegratorId: "0xdead",
			relay: ""          // set via RELAY_API_KEY env or localStorage
		}
	},
};

const LZ_ENDPOINT_ABI = [
	"function send(bytes calldata _payload, bytes calldata _options, address _sendLib, address _receiveLib) external payable",
	"function send(address _lzReceive, address _compose, uint32 _dstEid, bytes32 _messageGuid, bytes calldata _message, bytes calldata _extraOptions, address _receiveLib, address _sendLib) external payable",
	"function quote(bytes calldata _payload, bytes calldata _options, address _sendLib, address _receiveLib) external view returns (uint256 nativeFee, uint256 lzTokenFee)",
	"function estimateFees(uint32 _dstEid, address _receiver, bytes calldata _message, bool _payInZRO, bytes calldata _adapterParams) external view returns (uint256 nativeFee, uint256 lzTokenFee)",
	"function lzReceive(uint32 _srcEid, bytes32 _sender, uint64 _nonce, bytes calldata _message, address _executor) external payable"
];

const ERC20_ABI = [
	"function approve(address spender, uint256 amount) external returns (bool)",
	"function allowance(address owner, address spender) external view returns (uint256)",
	"function balanceOf(address account) external view returns (uint256)",
	"function decimals() external view returns (uint8)",
	"function symbol() external view returns (string)",
	"function name() external view returns (string)"
];

// Circle CCTP V2 — verified against circlefin/evm-cctp-contracts
// (src/v2/TokenMessengerV2.sol, src/interfaces/IReceiver.sol)
const TOKEN_MESSENGER_V2_ABI = [
	"function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) external returns (uint64 nonce)",
	"function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes calldata hookData) external"
];

const MESSAGE_TRANSMITTER_V2_ABI = [
	"function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)",
	"function usedNonces(bytes32 nonce) external view returns (bool)",
	"event MessageSent(bytes message)"
];

const OFT_ABI = [
	"function send((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) _sendParam,(uint256 nativeFee,uint256 lzTokenFee) _fee,address _refundAddress) external payable returns ((bytes32 guid,uint64 nonce,uint256 fee) msgReceipt,(uint256 amountSentLD,uint256 amountReceivedLD) oftReceipt)",
	"function quoteSend((uint32 dstEid,bytes32 to,uint256 amountLD,uint256 minAmountLD,bytes extraOptions,bytes composeMsg,bytes oftCmd) _sendParam,bool _payInLzToken) external view returns (uint256 nativeFee,uint256 lzTokenFee)",
	"function setPeer(uint32 _eid,bytes32 _peer) external",
	"function balanceOf(address account) external view returns (uint256)",
	"function approve(address spender,uint256 amount) external returns (bool)",
	"function allowance(address owner,address spender) external view returns (uint256)",
	"function transfer(address to,uint256 amount) external returns (bool)",
	"function transferFrom(address from,address to,uint256 amount) external returns (bool)",
	"function totalSupply() external view returns (uint256)",
	"function decimals() external view returns (uint8)",
	"function symbol() external view returns (string)",
	"function name() external view returns (string)"
];

// Stargate V2 Router ABI — native ETH cross-chain bridging (minimal)
const STARGATE_ROUTER_ABI = [
	"function swapETH(uint16 _dstChainId, address payable _refundAddress, bytes calldata _toAddress, uint256 _amountLD, uint256 _minAmountLD, uint256 _dstGasForCall) external payable returns (uint256, uint256)",
	"function quoteSendFee(uint16 _dstChainId, uint256 _amount) external view returns (uint256 nativeFee, uint256 zroFee)"
];

// Native ETH address constant (same across all EVM chains)
const NATIVE_ETH_ADDRESS = "0x0000000000000000000000000000000000000000";


