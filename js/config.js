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
		icon: "https://icons-ckg.pages.dev/lz-scan/protocols/usd-coin.svg"
	},
	chains: {
		ethereum: {
			chainId: 1,
			eid: 30101,
			name: "Ethereum Mainnet",
			shortName: "Ethereum",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://cloudflare-eth.com",
			explorer: "https://etherscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/ethereum.svg",
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
			chainId: 8453,
			eid: 30184,
			name: "Base Mainnet",
			shortName: "Base",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://mainnet.base.org",
			explorer: "https://basescan.org",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/base.svg",
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
			chainId: 42161,
			eid: 30110,
			name: "Arbitrum One",
			shortName: "Arbitrum",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://arb1.arbitrum.io/rpc",
			explorer: "https://arbiscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/arbitrum.svg",
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
			chainId: 10,
			eid: 30111,
			name: "Optimism Mainnet",
			shortName: "Optimism",
			nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
			rpcUrl: "https://mainnet.optimism.io",
			explorer: "https://optimistic.etherscan.io",
			icon: "https://icons-ckg.pages.dev/lz-scan/networks/optimism.svg",
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
			// Gas token = USDC (native 18 dec / ERC-20 iface 6 dec, same balance)
			chainId: 5042002,
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
				arc: "0x3600000000000000000000000000000000000000"
			},
			icon: "https://icons-ckg.pages.dev/lz-scan/protocols/usd-coin.svg"
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
				arc: "0x0000000000000000000000000000000000000000"
			},
			icon: "https://icons-ckg.pages.dev/lz-scan/protocols/ether.svg"
		}
	},
	lzScan: "https://layerzeroscan.com"
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
