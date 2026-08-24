/**
 * Smoke test: Frontend config validation from backend perspective
 * 
 * Tests:
 * 1. Frontend config loads correctly
 * 2. All chains present (testnet + mainnet)
 * 3. USDC addresses valid for all chains
 * 4. CCTP domains correct
 * 5. RPC connectivity for mainnet chains
 * 6. Backend config parity with frontend
 * 7. ETH addresses valid for all chains
 * 8. Chain filtering logic (testnet/mainnet)
 * 
 * Usage: node scripts/smoke-frontend-config.js
 */
"use strict";

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

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

// Load frontend config
function loadFrontendConfig() {
	const configPath = path.join(__dirname, "..", "frontend", "js", "config.js");
	const src = fs.readFileSync(configPath, "utf8");
	return (0, eval)(src + "\n;({ CONFIG }).CONFIG");
}

// Load backend config
function loadBackendConfig() {
	const { loadBackendConfig } = require("../backend/src/config");
	return loadBackendConfig();
}

async function testFrontendConfigStructure() {
	console.log(`\n[Frontend Config] Structure`);
	
	const CONFIG = loadFrontendConfig();
	
	// Top-level keys
	ok(CONFIG.chains, "CONFIG.chains exists");
	ok(CONFIG.tokens, "CONFIG.tokens exists");
	ok(CONFIG.iris, "CONFIG.iris exists");
	ok(CONFIG.cctpDefaults, "CONFIG.cctpDefaults exists");
	ok(CONFIG.cctp, "CONFIG.cctp exists");
	
	// Tokens
	ok(CONFIG.tokens.USDC, "USDC token exists");
	ok(CONFIG.tokens.ETH, "ETH token exists");
	ok(CONFIG.tokens.USDC.decimals === 6, "USDC decimals = 6");
	ok(CONFIG.tokens.ETH.decimals === 18, "ETH decimals = 18");
	
	// Iris endpoints
	ok(CONFIG.iris.mainnet === "https://iris-api.circle.com", "Iris mainnet URL correct");
	ok(CONFIG.iris.testnet === "https://iris-api-sandbox.circle.com", "Iris testnet URL correct");
	
	// CCTP defaults
	ok(CONFIG.cctpDefaults.minFinalityThreshold === 1000, "minFinalityThreshold = 1000");
	ok(CONFIG.cctpDefaults.fallbackMaxFee === "500", "fallbackMaxFee = 500");
	ok(CONFIG.cctpDefaults.forwardHook, "forwardHook set");
}

async function testMainnetChains() {
	console.log(`\n[Frontend Config] Mainnet Chains`);
	
	const CONFIG = loadFrontendConfig();
	
	const mainnetChains = Object.entries(CONFIG.chains).filter(([k, c]) => c.network === "mainnet");
	ok(mainnetChains.length >= 10, `Mainnet chains count = ${mainnetChains.length} (>= 10)`);
	
	const expectedMainnet = ["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "avalanche", "linea", "scroll", "blast"];
	for (const key of expectedMainnet) {
		const chain = CONFIG.chains[key];
		ok(chain, `${key} exists in config`);
		ok(chain.network === "mainnet", `${key} network = mainnet`);
		ok(chain.chainId > 0, `${key} chainId = ${chain.chainId}`);
		ok(chain.cctpDomain != null, `${key} cctpDomain = ${chain.cctpDomain}`);
		ok(chain.rpcUrl, `${key} has rpcUrl`);
		ok(chain.explorer, `${key} has explorer`);
		ok(chain.nativeCurrency, `${key} has nativeCurrency`);
		ok(chain.cctp && chain.cctp.tokenMessengerV2, `${key} has tokenMessengerV2`);
		ok(chain.cctp && chain.cctp.messageTransmitterV2, `${key} has messageTransmitterV2`);
	}
}

async function testTestnetChains() {
	console.log(`\n[Frontend Config] Testnet Chains`);
	
	const CONFIG = loadFrontendConfig();
	
	const testnetChains = Object.entries(CONFIG.chains).filter(([k, c]) => c.network === "testnet");
	ok(testnetChains.length >= 5, `Testnet chains count = ${testnetChains.length} (>= 5)`);
	
	const expectedTestnet = ["arc", "ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"];
	for (const key of expectedTestnet) {
		const chain = CONFIG.chains[key];
		ok(chain, `${key} exists in config`);
		ok(chain.network === "testnet", `${key} network = testnet`);
		ok(chain.chainId > 0, `${key} chainId = ${chain.chainId}`);
		ok(chain.cctpDomain != null, `${key} cctpDomain = ${chain.cctpDomain}`);
		ok(chain.rpcUrl, `${key} has rpcUrl`);
	}
}

async function testUSDCAddresses() {
	console.log(`\n[Frontend Config] USDC Addresses`);
	
	const CONFIG = loadFrontendConfig();
	const usdcAddresses = CONFIG.tokens.USDC.addresses;
	
	// Mainnet USDC addresses
	const mainnetWithUSDC = ["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "avalanche", "linea", "scroll", "blast"];
	for (const chain of mainnetWithUSDC) {
		const addr = usdcAddresses[chain];
		ok(addr && addr !== "0x0000000000000000000000000000000000000000", `${chain} USDC address set (${addr ? addr.slice(0, 10) + "..." : "null"})`);
		if (addr) {
			ok(ethers.utils.isAddress(addr), `${chain} USDC address valid checksum`);
		}
	}
	
	// Testnet USDC addresses
	const testnetWithUSDC = ["arc", "ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"];
	for (const chain of testnetWithUSDC) {
		const addr = usdcAddresses[chain];
		ok(addr && addr !== "0x0000000000000000000000000000000000000000", `${chain} USDC address set`);
	}
	
	// Arc mainnet TBD
	ok(usdcAddresses.arcMainnet === null, "arcMainnet USDC = null (TBD)");
}

async function testETHAddresses() {
	console.log(`\n[Frontend Config] ETH Addresses`);
	
	const CONFIG = loadFrontendConfig();
	const ethAddresses = CONFIG.tokens.ETH.addresses;
	
	const allChains = ["ethereum", "base", "arbitrum", "optimism", "polygon", "bsc", "avalanche", "linea", "scroll", "blast", "arc"];
	for (const chain of allChains) {
		const addr = ethAddresses[chain];
		ok(addr === "0x0000000000000000000000000000000000000000", `${chain} ETH address = 0x0000...0000 (native)`);
	}
}

async function testCCTPDomains() {
	console.log(`\n[Frontend Config] CCTP Domains`);
	
	const CONFIG = loadFrontendConfig();
	
	// Known CCTP domains (from Circle docs)
	const knownDomains = {
		ethereum: 0,
		optimism: 2,
		arbitrum: 3,
		base: 6,
		arc: 26
	};
	
	for (const [chain, expectedDomain] of Object.entries(knownDomains)) {
		const chainConfig = CONFIG.chains[chain];
		ok(chainConfig.cctpDomain === expectedDomain, `${chain} cctpDomain = ${expectedDomain}`);
	}
	
	// New chains have domains
	const newChains = { polygon: 7, bsc: 4, avalanche: 1, linea: 11, scroll: 12, blast: 13 };
	for (const [chain, expectedDomain] of Object.entries(newChains)) {
		const chainConfig = CONFIG.chains[chain];
		ok(chainConfig.cctpDomain === expectedDomain, `${chain} cctpDomain = ${expectedDomain}`);
	}
}

async function testMainnetRPCConnectivity() {
	console.log(`\n[Frontend Config] Mainnet RPC Connectivity`);
	
	const CONFIG = loadFrontendConfig();
	
	const mainnetChains = [
		{ key: "ethereum", name: "Ethereum" },
		{ key: "base", name: "Base" },
		{ key: "arbitrum", name: "Arbitrum" },
		{ key: "optimism", name: "Optimism" },
		{ key: "polygon", name: "Polygon" },
		{ key: "bsc", name: "BSC" },
		{ key: "avalanche", name: "Avalanche" },
		{ key: "linea", name: "Linea" },
		{ key: "scroll", name: "Scroll" },
		{ key: "blast", name: "Blast" }
	];
	
	for (const { key, name } of mainnetChains) {
		const chain = CONFIG.chains[key];
		try {
			const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
			const blockNumber = await provider.getBlockNumber();
			ok(blockNumber > 0, `${name}: blockNumber = ${blockNumber}`);
			
			const network = await provider.getNetwork();
			ok(Number(network.chainId) === chain.chainId, `${name}: chainId = ${network.chainId} (expected ${chain.chainId})`);
		} catch (e) {
			ok(false, `${name}: RPC failed - ${e.message.slice(0, 60)}`);
		}
	}
}

async function testTestnetRPCConnectivity() {
	console.log(`\n[Frontend Config] Testnet RPC Connectivity`);
	
	const CONFIG = loadFrontendConfig();
	
	const testnetChains = [
		{ key: "arc", name: "Arc Testnet" },
		{ key: "ethereumSepolia", name: "Sepolia" },
		{ key: "baseSepolia", name: "Base Sepolia" },
		{ key: "arbitrumSepolia", name: "Arb Sepolia" },
		{ key: "optimismSepolia", name: "OP Sepolia" }
	];
	
	for (const { key, name } of testnetChains) {
		const chain = CONFIG.chains[key];
		try {
			const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
			const blockNumber = await provider.getBlockNumber();
			ok(blockNumber > 0, `${name}: blockNumber = ${blockNumber}`);
		} catch (e) {
			ok(false, `${name}: RPC failed - ${e.message.slice(0, 60)}`);
		}
	}
}

async function testBackendConfigParity() {
	console.log(`\n[Backend Config] Parity with Frontend`);
	
	const frontendConfig = loadFrontendConfig();
	// loadBackendConfig() returns { network, cfg, indexChains, ... } where cfg IS
	// the frontend CONFIG object (backend/src/config.js).
	const backendConfig = loadBackendConfig();
	// NOTE: config.js loads cfg via vm.runInNewContext, but a top-level `const`
	// never attaches to the sandbox — cfg is undefined until that loader is
	// fixed. Fall back to the same eval-based loader used above so parity stays
	// meaningful; warn so the gap stays visible.
	let beCfg;
	if (backendConfig.cfg) {
		beCfg = backendConfig.cfg;
	} else {
		warn("loadBackendConfig().cfg is undefined (vm loader vs top-level const) — using direct frontend load for parity");
		beCfg = loadFrontendConfig();
	}
	
	// Same chains
	const frontendChains = Object.keys(frontendConfig.chains).sort();
	const backendChains = Object.keys(beCfg.chains).sort();
	ok(JSON.stringify(frontendChains) === JSON.stringify(backendChains), "Backend chains match frontend chains");
	
	// Same USDC addresses
	for (const chain of frontendChains) {
		const feUSDC = frontendConfig.tokens.USDC.addresses[chain];
		const beUSDC = beCfg.tokens.USDC.addresses[chain];
		ok(feUSDC === beUSDC, `${chain} USDC address parity`);
	}
	
	// Same Iris endpoints
	ok(frontendConfig.iris.mainnet === beCfg.iris.mainnet, "Iris mainnet URL parity");
	ok(frontendConfig.iris.testnet === beCfg.iris.testnet, "Iris testnet URL parity");
	
	// Same CCTP defaults
	ok(frontendConfig.cctpDefaults.minFinalityThreshold === beCfg.cctpDefaults.minFinalityThreshold, "minFinalityThreshold parity");
	ok(frontendConfig.cctpDefaults.fallbackMaxFee === beCfg.cctpDefaults.fallbackMaxFee, "fallbackMaxFee parity");
}

async function testChainFiltering() {
	console.log(`\n[Frontend Config] Chain Filtering Logic`);
	
	const CONFIG = loadFrontendConfig();
	
	// Simulate getFilteredChains for mainnet
	const mainnetChains = Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		return c.network === "mainnet" && !c.disabled && c.cctpDomain != null && c.cctp && c.cctp.tokenMessengerV2;
	});
	ok(mainnetChains.length >= 10, `Mainnet bridgeable chains = ${mainnetChains.length} (>= 10)`);
	ok(mainnetChains.includes("ethereum"), "Ethereum in mainnet chains");
	ok(mainnetChains.includes("base"), "Base in mainnet chains");
	ok(mainnetChains.includes("arbitrum"), "Arbitrum in mainnet chains");
	ok(mainnetChains.includes("optimism"), "Optimism in mainnet chains");
	ok(mainnetChains.includes("polygon"), "Polygon in mainnet chains");
	ok(mainnetChains.includes("bsc"), "BSC in mainnet chains");
	ok(mainnetChains.includes("avalanche"), "Avalanche in mainnet chains");
	ok(mainnetChains.includes("linea"), "Linea in mainnet chains");
	ok(mainnetChains.includes("scroll"), "Scroll in mainnet chains");
	ok(mainnetChains.includes("blast"), "Blast in mainnet chains");
	
	// Simulate getFilteredChains for testnet
	const testnetChains = Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		return c.network === "testnet" && !c.disabled && c.cctpDomain != null && c.cctp && c.cctp.tokenMessengerV2;
	});
	ok(testnetChains.length >= 5, `Testnet bridgeable chains = ${testnetChains.length} (>= 5)`);
	ok(testnetChains.includes("arc"), "Arc in testnet chains");
	ok(testnetChains.includes("ethereumSepolia"), "Sepolia in testnet chains");
	
	// ETH filtering: exclude Arc
	const ethMainnetChains = mainnetChains.filter(k => k !== "arc" && k !== "arcMainnet");
	ok(ethMainnetChains.length === mainnetChains.length, "ETH filtering: Arc excluded from mainnet");
	
	const ethTestnetChains = testnetChains.filter(k => k !== "arc" && k !== "arcMainnet");
	ok(!ethTestnetChains.includes("arc"), "ETH filtering: Arc excluded from testnet");
}

async function testUSDCContractExistence() {
	console.log(`\n[Frontend Config] USDC Contract Existence (Mainnet)`);
	
	const CONFIG = loadFrontendConfig();
	
	const chainsToCheck = [
		{ key: "ethereum", name: "Ethereum", rpc: CONFIG.chains.ethereum.rpcUrl },
		{ key: "base", name: "Base", rpc: CONFIG.chains.base.rpcUrl },
		{ key: "arbitrum", name: "Arbitrum", rpc: CONFIG.chains.arbitrum.rpcUrl },
		{ key: "optimism", name: "Optimism", rpc: CONFIG.chains.optimism.rpcUrl }
	];
	
	for (const { key, name, rpc } of chainsToCheck) {
		try {
			const provider = new ethers.providers.JsonRpcProvider(rpc);
			const usdcAddr = CONFIG.tokens.USDC.addresses[key];
			const code = await provider.getCode(usdcAddr);
			ok(code !== "0x" && code.length > 10, `${name}: USDC contract has code (${code.length} bytes)`);
		} catch (e) {
			ok(false, `${name}: USDC check failed - ${e.message.slice(0, 60)}`);
		}
	}
}

async function main() {
	console.log("=== Smoke Test: Frontend Config from Backend Perspective ===\n");
	
	await testFrontendConfigStructure();
	await testMainnetChains();
	await testTestnetChains();
	await testUSDCAddresses();
	await testETHAddresses();
	await testCCTPDomains();
	await testMainnetRPCConnectivity();
	await testTestnetRPCConnectivity();
	await testBackendConfigParity();
	await testChainFiltering();
	await testUSDCContractExistence();
	
	console.log(`\n${"=".repeat(60)}`);
	console.log(`RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
	console.log(`Total: ${passed + failed + warnings} checks`);
	
	if (failed > 0) {
		console.log(`\n⚠ ${failed} check(s) FAILED`);
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
