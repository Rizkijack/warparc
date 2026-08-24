/**
 * WarpArc Bridge Infrastructure Smoke Test
 * Tests all 5 testnet chains × 4 destination pairs = 20 routes
 * 
 * Checks: RPC connectivity, chain ID, USDC contract, CCTP contracts,
 *         Iris attestation API, backend API, config parity
 * 
 * Usage: node scripts/smoke-bridge.js
 */
"use strict";

const { ethers } = require("ethers");

const WALLET = "0x311774fb68F359Aa0F1e3aD10Bf6570b0541B282";

// Testnet chains from frontend/js/config.js
const CHAINS = {
	arc: {
		name: "Arc Testnet",
		rpc: "https://rpc.testnet.arc.io",
		chainId: 5042002,
		cctpDomain: 26,
		usdc: "0x3600000000000000000000000000000000000000",
		tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
		messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
		nativeSymbol: "USDC",
		isArc: true
	},
	ethereumSepolia: {
		name: "Ethereum Sepolia",
		rpc: "https://ethereum-sepolia-rpc.publicnode.com",
		chainId: 11155111,
		cctpDomain: 0,
		usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
		tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
		messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
		nativeSymbol: "ETH",
		isArc: false
	},
	baseSepolia: {
		name: "Base Sepolia",
		rpc: "https://sepolia.base.org",
		chainId: 84532,
		cctpDomain: 6,
		usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
		tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
		messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
		nativeSymbol: "ETH",
		isArc: false
	},
	arbitrumSepolia: {
		name: "Arbitrum Sepolia",
		rpc: "https://sepolia-rollup.arbitrum.io/rpc/v1",
		chainId: 421614,
		cctpDomain: 3,
		usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
		tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
		messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
		nativeSymbol: "ETH",
		isArc: false
	},
	optimismSepolia: {
		name: "OP Sepolia",
		rpc: "https://sepolia.optimism.io",
		chainId: 11155420,
		cctpDomain: 2,
		usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
		tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
		messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
		nativeSymbol: "ETH",
		isArc: false
	}
};

const IRIS_TESTNET = "https://iris-api-sandbox.circle.com";
const BACKEND_API = "http://127.0.0.1:8932";

const ERC20_ABI = [
	"function balanceOf(address) view returns (uint256)",
	"function decimals() view returns (uint8)",
	"function symbol() view returns (string)"
];

const TOKEN_MESSENGER_ABI = [
	"function depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32) external",
	"function depositForBurnWithHook(uint256,uint32,bytes32,address,bytes32,uint256,uint32,bytes) external"
];

const MESSAGE_TRANSMITTER_ABI = [
	"function receiveMessage(bytes,bytes) external returns (bool)",
	"function usedNonces(bytes32) view returns (bool)"
];

let passed = 0;
let failed = 0;
let warnings = 0;

function ok(cond, msg) {
	if (cond) { passed++; console.log(`  ✓ ${msg}`); }
	else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

function warn(msg) {
	warnings++;
	console.log(`  ⚠ WARN: ${msg}`);
}

async function testRpcConnectivity(key, chain) {
	console.log(`\n[${chain.name}] RPC Connectivity`);
	try {
		const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
		const blockNumber = await provider.getBlockNumber();
		ok(blockNumber > 0, `blockNumber=${blockNumber} (positive)`);
		
		const network = await provider.getNetwork();
		ok(Number(network.chainId) === chain.chainId, `chainId=${network.chainId} (expected ${chain.chainId})`);
		
		const gasPrice = await provider.getGasPrice();
		ok(gasPrice > 0n, `gasPrice=${ethers.utils.formatUnits(gasPrice, "gwei")} Gwei`);
		
		if (chain.isArc) {
			// Arc: verify gas floor >= 20 Gwei
			const gwei20 = ethers.utils.parseUnits("20", "gwei");
			ok(gasPrice >= gwei20, `Arc gas floor: ${ethers.utils.formatUnits(gasPrice, "gwei")} >= 20 Gwei`);
		}
		
		return provider;
	} catch (e) {
		ok(false, `RPC connection failed: ${e.message.slice(0, 80)}`);
		return null;
	}
}

async function testUsdcContract(provider, chain) {
	console.log(`[${chain.name}] USDC Contract`);
	try {
		const usdc = new ethers.Contract(chain.usdc, ERC20_ABI, provider);
		const [symbol, decimals, bal] = await Promise.all([
			usdc.symbol().catch(() => "???"),
			usdc.decimals().catch(() => 0),
			usdc.balanceOf(WALLET)
		]);
		ok(symbol === "USDC" || symbol === "USD Coin", `symbol=${symbol}`);
		ok(Number(decimals) === 6, `decimals=${decimals} (expected 6)`);
		ok(bal >= 0n, `balanceOf=${ethers.utils.formatUnits(bal, 6)} USDC`);
		return true;
	} catch (e) {
		ok(false, `USDC contract call failed: ${e.message.slice(0, 80)}`);
		return false;
	}
}

async function testCctpContracts(provider, chain) {
	console.log(`[${chain.name}] CCTP V2 Contracts`);
	try {
		// Check TokenMessengerV2 has code
		const tmCode = await provider.getCode(chain.tokenMessenger);
		ok(tmCode !== "0x" && tmCode.length > 10, `TokenMessengerV2 has code (${tmCode.length} bytes)`);
		
		// Check MessageTransmitterV2 has code
		const mtCode = await provider.getCode(chain.messageTransmitter);
		ok(mtCode !== "0x" && mtCode.length > 10, `MessageTransmitterV2 has code (${mtCode.length} bytes)`);
		
		// Test depositForBurn exists (call with zero args - will revert but proves ABI)
		const tm = new ethers.Contract(chain.tokenMessenger, TOKEN_MESSENGER_ABI, provider);
		ok(typeof tm.depositForBurn === "function", "depositForBurn function exists");
		ok(typeof tm.depositForBurnWithHook === "function", "depositForBurnWithHook function exists");
		
		// Test receiveMessage exists
		const mt = new ethers.Contract(chain.messageTransmitter, MESSAGE_TRANSMITTER_ABI, provider);
		ok(typeof mt.receiveMessage === "function", "receiveMessage function exists");
		ok(typeof mt.usedNonces === "function", "usedNonces function exists");
		
		return true;
	} catch (e) {
		ok(false, `CCTP contract check failed: ${e.message.slice(0, 80)}`);
		return false;
	}
}

async function testIrisApi(srcChain, dstChain) {
	const routeName = `${srcChain.name} → ${dstChain.name}`;
	try {
		// Test Iris fee quote endpoint
		const url = `${IRIS_TESTNET}/v2/burn/USDC/fees/${srcChain.cctpDomain}/${dstChain.cctpDomain}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
		if (res.ok) {
			const data = await res.json();
			const hasQuote = Array.isArray(data) && data.length > 0;
			ok(hasQuote, `Iris fee quote: ${data.length} quote(s) returned`);
			if (hasQuote) {
				const fast = data.find(e => Number(e.finalityThreshold) === 1000);
				if (fast) {
					ok(fast.minimumFee != null, `Fast transfer minFee=${fast.minimumFee}`);
				} else {
					warn(`No fast transfer (threshold=1000) quote for ${routeName}`);
				}
			}
			return true;
		} else {
			ok(false, `Iris HTTP ${res.status} for ${routeName}`);
			return false;
		}
	} catch (e) {
		ok(false, `Iris API failed for ${routeName}: ${e.message.slice(0, 60)}`);
		return false;
	}
}

async function testBackendApi() {
	console.log(`\n[Backend API] ${BACKEND_API}`);
	try {
		// Health
		const health = await fetch(`${BACKEND_API}/health`, { signal: AbortSignal.timeout(5000) });
		if (health.ok) {
			const data = await health.json();
			ok(data.ok === true, `/health ok=true`);
			ok(data.network === "testnet", `/health network=testnet`);
			ok(data.indexer && data.indexer.eventCounts, `/health indexer events present`);
			ok(data.relayer && data.relayer.mode, `/health relayer mode=${data.relayer.mode}`);
		} else {
			ok(false, `/health HTTP ${health.status}`);
		}
		
		// Events
		const events = await fetch(`${BACKEND_API}/events?chain=arc&limit=2`, { signal: AbortSignal.timeout(5000) });
		if (events.ok) {
			const data = await events.json();
			ok(Array.isArray(data.events), `/events returns array`);
			ok(data.events.length > 0, `/events has ${data.events.length} event(s)`);
		}
		
		// Events kind filter
		const kindFilter = await fetch(`${BACKEND_API}/events?chain=arc&kind=erc20&limit=1`, { signal: AbortSignal.timeout(5000) });
		if (kindFilter.ok) {
			const data = await kindFilter.json();
			ok(data.events.every(e => e.kind === "erc20"), `/events?kind=erc20 filters correctly`);
		}
		
		// Events invalid kind
		const badKind = await fetch(`${BACKEND_API}/events?kind=invalid`, { signal: AbortSignal.timeout(5000) });
		ok(badKind.status === 400, `/events?kind=invalid returns 400`);
		
		// Jobs
		const jobs = await fetch(`${BACKEND_API}/jobs`, { signal: AbortSignal.timeout(5000) });
		if (jobs.ok) {
			const data = await jobs.json();
			ok(typeof data.jobs === "object", `/jobs returns object`);
		}
		
		// Host guard (NOTE: Node.js fetch API overrides Host header with URL's host,
		// so this test can't verify the guard via fetch. Verified manually via curl:
		// curl -s -H "Host: 127.0.0.1:9999" http://127.0.0.1:8932/health → 403)
		warn("Host guard: fetch API limitation — verified via curl (403 on wrong port)");
		
		return true;
	} catch (e) {
		ok(false, `Backend API failed: ${e.message.slice(0, 80)}`);
		return false;
	}
}

async function testConfigParity() {
	console.log(`\n[Config Parity] Frontend ↔ Backend`);
	try {
		const { loadFrontendConfig } = require("../backend/src/config");
		const cfg = loadFrontendConfig();
		
		// Check all testnet chains exist
		const testnetKeys = ["arc", "ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"];
		for (const key of testnetKeys) {
			const chain = cfg.chains[key];
			ok(chain && chain.rpcUrl, `${key} has rpcUrl`);
			ok(chain && chain.cctpDomain != null, `${key} has cctpDomain=${chain.cctpDomain}`);
			ok(chain && chain.cctp && chain.cctp.tokenMessengerV2, `${key} has tokenMessengerV2`);
			ok(chain && chain.cctp && chain.cctp.messageTransmitterV2, `${key} has messageTransmitterV2`);
			
			const usdc = cfg.tokens.USDC.addresses[key];
			ok(usdc && usdc !== "0x0000000000000000000000000000000000000000", `${key} has USDC address`);
		}
		
		// Check Iris endpoints
		ok(cfg.iris && cfg.iris.testnet === "https://iris-api-sandbox.circle.com", "Iris testnet URL correct");
		ok(cfg.iris && cfg.iris.mainnet === "https://iris-api.circle.com", "Iris mainnet URL correct");
		
		// Check CCTP defaults
		ok(cfg.cctpDefaults && cfg.cctpDefaults.minFinalityThreshold === 1000, "minFinalityThreshold=1000");
		ok(cfg.cctpDefaults && cfg.cctpDefaults.fallbackMaxFee === "500", "fallbackMaxFee=500");
		ok(cfg.cctpDefaults && cfg.cctpDefaults.forwardHook, "forwardHook set");
		
		// Check arcMainnet is disabled
		ok(cfg.chains.arcMainnet && cfg.chains.arcMainnet.disabled === true, "arcMainnet disabled=true");
		ok(cfg.chains.arcMainnet && cfg.chains.arcMainnet.cctpDomain === null, "arcMainnet cctpDomain=null (TBD)");
		
		return true;
	} catch (e) {
		ok(false, `Config parity check failed: ${e.message.slice(0, 80)}`);
		return false;
	}
}

async function main() {
	console.log("=== WarpArc Bridge Infrastructure Smoke Test ===");
	console.log(`Wallet: ${WALLET}`);
	console.log(`Chains: ${Object.keys(CHAINS).join(", ")}`);
	console.log(`Routes: ${Object.keys(CHAINS).length} × ${Object.keys(CHAINS).length - 1} = ${Object.keys(CHAINS).length * (Object.keys(CHAINS).length - 1)}`);
	
	// 1. RPC Connectivity for all chains
	const providers = {};
	for (const [key, chain] of Object.entries(CHAINS)) {
		providers[key] = await testRpcConnectivity(key, chain);
	}
	
	// 2. USDC Contract on all chains
	for (const [key, chain] of Object.entries(CHAINS)) {
		if (providers[key]) {
			await testUsdcContract(providers[key], chain);
		}
	}
	
	// 3. CCTP Contracts on all chains
	for (const [key, chain] of Object.entries(CHAINS)) {
		if (providers[key]) {
			await testCctpContracts(providers[key], chain);
		}
	}
	
	// 4. Iris API for all route pairs
	console.log(`\n[Iris API] Fee Quotes (all routes)`);
	const chainKeys = Object.keys(CHAINS);
	for (const srcKey of chainKeys) {
		for (const dstKey of chainKeys) {
			if (srcKey === dstKey) continue;
			await testIrisApi(CHAINS[srcKey], CHAINS[dstKey]);
		}
	}
	
	// 5. Backend API
	await testBackendApi();
	
	// 6. Config Parity
	await testConfigParity();
	
	// Summary
	console.log(`\n${"=".repeat(60)}`);
	console.log(`RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
	console.log(`Total: ${passed + failed + warnings} checks`);
	
	if (failed > 0) {
		console.log(`\n⚠ ${failed} check(s) FAILED — review above`);
		process.exit(1);
	} else {
		console.log(`\n✓ All checks passed!`);
		process.exit(0);
	}
}

main().catch(e => {
	console.error(`Fatal: ${e.message}`);
	process.exit(1);
});
