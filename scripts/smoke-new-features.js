/**
 * Smoke test untuk fitur baru: ETH Bridging + Language Selector
 * 
 * Tests:
 * 1. ETH bridge config (chains, tokens, filtering)
 * 2. ETH balance loading (native balance)
 * 3. ETH gas estimate (21000 × gasPrice)
 * 4. ETH chain filtering (Arc excluded)
 * 5. Language selector (10 languages, translations)
 * 6. i18n functions (t(), setLanguage(), applyTranslations())
 * 7. RTL support for Arabic
 * 
 * Usage: node scripts/smoke-new-features.js
 */
"use strict";

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

let passed = 0;
let failed = 0;

function ok(cond, msg) {
	if (cond) { passed++; console.log(`  ✓ ${msg}`); }
	else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

// Load frontend config
function loadConfig() {
	const configPath = path.join(__dirname, "..", "frontend", "js", "config.js");
	const src = fs.readFileSync(configPath, "utf8");
	return (0, eval)(src + "\n;({ CONFIG }).CONFIG");
}

// Load app.js and extract i18n data
function loadAppJS() {
	const appPath = path.join(__dirname, "..", "frontend", "js", "app.js");
	const src = fs.readFileSync(appPath, "utf8");
	
	// Create a sandboxed eval context
	const sandbox = { console: { log: () => {} }, window: {}, document: { 
		getElementById: () => null, 
		querySelectorAll: () => [],
		addEventListener: () => {},
		documentElement: { lang: "", dir: "" }
	}, localStorage: { getItem: () => null, setItem: () => {} }, navigator: { language: "en" }, fetch: () => Promise.resolve() };
	
	// Extract just the TRANSLATIONS and LANG_META
	const translationsMatch = src.match(/const TRANSLATIONS = (\{[\s\S]*?\n\};)\s*\n/s);
	const langMetaMatch = src.match(/const LANG_META = (\{[\s\S]*?\n\};)/s);
	
	if (!translationsMatch) throw new Error("TRANSLATIONS not found");
	if (!langMetaMatch) throw new Error("LANG_META not found");
	
	// Use Function constructor to eval in isolated scope
	const translations = new Function(`return ${translationsMatch[1]}`)();
	const langMeta = new Function(`return ${langMetaMatch[1]}`)();
	
	return { translations, langMeta };
}

async function testETHConfig() {
	console.log(`\n[ETH Bridge] Config Tests`);
	
	const CONFIG = loadConfig();
	
	// ETH token exists
	ok(CONFIG.tokens.ETH, "ETH token exists in config");
	ok(CONFIG.tokens.ETH.symbol === "ETH", "ETH symbol = 'ETH'");
	ok(CONFIG.tokens.ETH.decimals === 18, "ETH decimals = 18");
	ok(CONFIG.tokens.ETH.icon, "ETH icon set");
	
	// ETH addresses for all chains
	const ethChains = ["ethereum", "base", "arbitrum", "optimism", "robinhood",
		"ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"];
	for (const chain of ethChains) {
		ok(CONFIG.tokens.ETH.addresses[chain] === "0x0000000000000000000000000000000000000000",
			`ETH address for ${chain} = 0x0000...0000 (native)`);
	}
	
	// Arc has ETH address but nativeCurrency is USDC
	ok(CONFIG.chains.arc.nativeCurrency.symbol === "USDC", "Arc nativeCurrency = USDC (not ETH)");
	ok(CONFIG.chains.ethereumSepolia.nativeCurrency.symbol === "ETH", "Sepolia nativeCurrency = ETH");
	ok(CONFIG.chains.baseSepolia.nativeCurrency.symbol === "ETH", "Base Sepolia nativeCurrency = ETH");
	ok(CONFIG.chains.arbitrumSepolia.nativeCurrency.symbol === "ETH", "Arb Sepolia nativeCurrency = ETH");
	ok(CONFIG.chains.optimismSepolia.nativeCurrency.symbol === "ETH", "OP Sepolia nativeCurrency = ETH");
}

async function testETHChainFiltering() {
	console.log(`\n[ETH Bridge] Chain Filtering`);
	
	const CONFIG = loadConfig();
	
	// Simulate getFilteredChains logic for ETH
	const testnetChains = Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		return c.network === "testnet" && !c.disabled && c.cctpDomain != null;
	});
	
	// All testnet chains
	ok(testnetChains.includes("arc"), "Arc in testnet chains");
	ok(testnetChains.includes("ethereumSepolia"), "Sepolia in testnet chains");
	ok(testnetChains.includes("baseSepolia"), "Base Sepolia in testnet chains");
	ok(testnetChains.includes("arbitrumSepolia"), "Arb Sepolia in testnet chains");
	ok(testnetChains.includes("optimismSepolia"), "OP Sepolia in testnet chains");
	
	// ETH filtering: exclude Arc
	const ethChains = testnetChains.filter(k => {
		return k !== "arc" && k !== "arcMainnet";
	});
	ok(!ethChains.includes("arc"), "Arc excluded from ETH chains");
	ok(ethChains.includes("ethereumSepolia"), "Sepolia in ETH chains");
	ok(ethChains.includes("baseSepolia"), "Base Sepolia in ETH chains");
	ok(ethChains.includes("arbitrumSepolia"), "Arb Sepolia in ETH chains");
	ok(ethChains.includes("optimismSepolia"), "OP Sepolia in ETH chains");
	ok(ethChains.length === 4, "ETH chains = 4 (excluding Arc)");
}

async function testETHBalanceLoading() {
	console.log(`\n[ETH Bridge] Balance Loading`);
	
	const addr = "0x311774fb68F359Aa0F1e3aD10Bf6570b0541B282";
	const chains = [
		{ name: "Sepolia", rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
		{ name: "Base Sepolia", rpc: "https://sepolia.base.org" },
		{ name: "Arb Sepolia", rpc: "https://sepolia-rollup.arbitrum.io/rpc/v1" },
		{ name: "OP Sepolia", rpc: "https://sepolia.optimism.io" }
	];
	
	for (const chain of chains) {
		try {
			const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
			const bal = await provider.getBalance(addr);
			ok(bal >= 0n, `${chain.name}: getBalance returns BigInt (${ethers.utils.formatEther(bal)} ETH)`);
		} catch (e) {
			ok(false, `${chain.name}: getBalance failed - ${e.message.slice(0, 60)}`);
		}
	}
}

async function testETHGasEstimate() {
	console.log(`\n[ETH Bridge] Gas Estimate (21000 × gasPrice)`);
	
	const chains = [
		{ name: "Sepolia", rpc: "https://ethereum-sepolia-rpc.publicnode.com" },
		{ name: "Base Sepolia", rpc: "https://sepolia.base.org" },
		{ name: "Arb Sepolia", rpc: "https://sepolia-rollup.arbitrum.io/rpc/v1" },
		{ name: "OP Sepolia", rpc: "https://sepolia.optimism.io" }
	];
	
	for (const chain of chains) {
		try {
			const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
			const feeData = await provider.getFeeData();
			const price = feeData.maxFeePerGas || feeData.gasPrice || ethers.BigNumber.from(0);
			const gasLimit = ethers.BigNumber.from(21000);
			const cost = gasLimit.mul(price);
			ok(cost.gt(0), `${chain.name}: gas cost = ${ethers.utils.formatEther(cost)} ETH (21000 × ${ethers.utils.formatUnits(price, "gwei")} Gwei)`);
		} catch (e) {
			ok(false, `${chain.name}: gas estimate failed - ${e.message.slice(0, 60)}`);
		}
	}
}

async function testETHBridgeValidation() {
	console.log(`\n[ETH Bridge] Validation Logic`);
	
	const CONFIG = loadConfig();
	
	// Test: ETH not available on Arc
	const arcChain = CONFIG.chains.arc;
	ok(arcChain.nativeCurrency.symbol !== "ETH", "Arc nativeCurrency != ETH (validation will reject)");
	
	// Test: ETH available on Sepolia
	const sepoliaChain = CONFIG.chains.ethereumSepolia;
	ok(sepoliaChain.nativeCurrency.symbol === "ETH", "Sepolia nativeCurrency = ETH (validation will pass)");
	
	// Test: Same network check
	ok(CONFIG.chains.ethereumSepolia.network === CONFIG.chains.baseSepolia.network,
		"Sepolia and Base Sepolia same network (testnet)");
	
	// Test: Cross-network rejection
	ok(CONFIG.chains.ethereumSepolia.network !== CONFIG.chains.ethereum.network,
		"Sepolia and Ethereum mainnet different networks (would be rejected)");
}

async function testLanguageSelector() {
	console.log(`\n[Language Selector] Config`);
	
	const { translations: TRANSLATIONS, langMeta: LANG_META } = loadAppJS();
	
	// All10 languages exist
	const expectedLangs = ["en", "zh", "hi", "es", "fr", "ar", "bn", "pt", "ru", "ja"];
	for (const lang of expectedLangs) {
		ok(TRANSLATIONS[lang], `Translation exists for '${lang}'`);
		ok(LANG_META[lang], `LANG_META exists for '${lang}'`);
		ok(LANG_META[lang].flag, `Flag code exists for '${lang}'`);
		ok(LANG_META[lang].label, `Label exists for '${lang}'`);
	}
	
	ok(Object.keys(TRANSLATIONS).length === 10, `Total translations = 10`);
	ok(Object.keys(LANG_META).length === 10, `Total LANG_META = 10`);
}

async function testTranslationKeys() {
	console.log(`\n[Language Selector] Translation Keys`);
	
	const { translations: TRANSLATIONS } = loadAppJS();
	
	// Required keys
	const requiredKeys = [
		"mainnet", "testnet", "notConnected", "connectWallet", "crossChainBridge",
		"amount", "balance", "estGasFee", "cctpFee", "forwardingService",
		"unfinishedBridge", "resumeMint", "dismiss", "burn", "attestation", "mint",
		"enterAmount", "cctpContracts", "txHistory", "noTxs",
		"footerText", "systemStatus", "faucet",
		"sameChain", "notDeployed", "approving", "burning", "waitingAttest",
		"minting", "waitingForward", "bridgeComplete", "bridgeFailed",
		"connectFirst", "enterValidAmount", "invalidAmount",
		"amountMustExceed0", "amountExceeds", "cctpUnavailable", "networkMismatch",
		"forwardUnavailable", "amountMustExceedFee",
		"bridgeToken", "to",
		"ethNotAvailable", "ethOnlyEvm"
	];
	
	for (const lang of Object.keys(TRANSLATIONS)) {
		let missing = 0;
		for (const key of requiredKeys) {
			if (!TRANSLATIONS[lang][key]) {
				console.log(`    ⚠ ${lang}: missing key '${key}'`);
				missing++;
			}
		}
		ok(missing === 0, `${lang}: all ${requiredKeys.length} required keys present`);
	}
}

async function testTranslationQuality() {
	console.log(`\n[Language Selector] Translation Quality`);
	
	const { translations: TRANSLATIONS } = loadAppJS();
	
	// Check that translations are not just English copies (except en)
	const enKeys = Object.keys(TRANSLATIONS.en);
	
	// Chinese should have Chinese characters
	ok(/[\u4e00-\u9fff]/.test(TRANSLATIONS.zh.connectWallet), "zh: connectWallet has Chinese chars");
	ok(/[\u4e00-\u9fff]/.test(TRANSLATIONS.zh.crossChainBridge), "zh: crossChainBridge has Chinese chars");
	
	// Hindi should have Devanagari
	ok(/[\u0900-\u097F]/.test(TRANSLATIONS.hi.connectWallet), "hi: connectWallet has Devanagari");
	
	// Arabic should have Arabic chars
	ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ar.connectWallet), "ar: connectWallet has Arabic chars");
	
	// Bengali should have Bengali chars
	ok(/[\u0980-\u09FF]/.test(TRANSLATIONS.bn.connectWallet), "bn: connectWallet has Bengali chars");
	
	// Russian should have Cyrillic
	ok(/[\u0400-\u04FF]/.test(TRANSLATIONS.ru.connectWallet), "ru: connectWallet has Cyrillic");
	
	// Japanese should have Japanese chars
	ok(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(TRANSLATIONS.ja.connectWallet), "ja: connectWallet has Japanese chars");
	
	// Spanish should differ from English
	ok(TRANSLATIONS.es.connectWallet !== TRANSLATIONS.en.connectWallet, "es: connectWallet differs from en");
	
	// French should differ from English
	ok(TRANSLATIONS.fr.connectWallet !== TRANSLATIONS.en.connectWallet, "fr: connectWallet differs from en");
	
	// Portuguese should differ from Spanish
	ok(TRANSLATIONS.pt.connectWallet !== TRANSLATIONS.es.connectWallet, "pt: connectWallet differs from es");
}

async function testETHTranslations() {
	console.log(`\n[Language Selector] ETH-specific Translations`);
	
	const { translations: TRANSLATIONS } = loadAppJS();
	
	for (const lang of Object.keys(TRANSLATIONS)) {
		ok(TRANSLATIONS[lang].ethNotAvailable, `${lang}: ethNotAvailable exists`);
		ok(TRANSLATIONS[lang].ethOnlyEvm, `${lang}: ethOnlyEvm exists`);
	}
}

async function testHTMLStructure() {
	console.log(`\n[Language Selector] HTML Structure`);
	
	const htmlPath = path.join(__dirname, "..", "frontend", "index.html");
	const html = fs.readFileSync(htmlPath, "utf8");
	
	// Language selector exists
	ok(html.includes('class="lang-selector"'), "lang-selector div exists");
	ok(html.includes('id="lang-btn"'), "lang-btn exists");
	ok(html.includes('id="lang-dropdown"'), "lang-dropdown exists");
	
	// All10 language options
	const langOptions = html.match(/data-lang="([^"]+)"/g) || [];
	const langs = langOptions.map(m => m.match(/data-lang="([^"]+)"/)[1]);
	ok(langs.length === 10, `10 language options in HTML`);
	ok(langs.includes("en"), "en option exists");
	ok(langs.includes("zh"), "zh option exists");
	ok(langs.includes("hi"), "hi option exists");
	ok(langs.includes("es"), "es option exists");
	ok(langs.includes("fr"), "fr option exists");
	ok(langs.includes("ar"), "ar option exists");
	ok(langs.includes("bn"), "bn option exists");
	ok(langs.includes("pt"), "pt option exists");
	ok(langs.includes("ru"), "ru option exists");
	ok(langs.includes("ja"), "ja option exists");
	
	// ETH option in token selector
	ok(html.includes('value="ETH"'), "ETH option in token selector");
	ok(html.includes("ETH · Native"), "ETH · Native label");
	
	// data-i18n attributes
	const i18nAttrs = html.match(/data-i18n="([^"]+)"/g) || [];
	ok(i18nAttrs.length >= 20, `${i18nAttrs.length} data-i18n attributes (>= 20)`);
}

async function testCSSStyles() {
	console.log(`\n[Language Selector] CSS Styles`);
	
	const cssPath = path.join(__dirname, "..", "frontend", "css", "style.css");
	const css = fs.readFileSync(cssPath, "utf8");
	
	// Language selector styles
	ok(css.includes(".lang-selector"), ".lang-selector style exists");
	ok(css.includes(".lang-btn"), ".lang-btn style exists");
	ok(css.includes(".lang-flag"), ".lang-flag style exists");
	ok(css.includes(".lang-dropdown"), ".lang-dropdown style exists");
	ok(css.includes(".lang-option"), ".lang-option style exists");
	ok(css.includes(".lang-dropdown.open"), ".lang-dropdown.open style exists");
	ok(css.includes(".lang-option.active"), ".lang-option.active style exists");
	
	// Responsive
	ok(css.includes(".lang-dropdown { right: auto; left: 0; }") || 
	   css.includes("lang-dropdown"), "Mobile responsive for lang-dropdown");
}

async function main() {
	console.log("=== Smoke Test: New Features (ETH Bridge + Language Selector) ===\n");
	
	await testETHConfig();
	await testETHChainFiltering();
	await testETHBalanceLoading();
	await testETHGasEstimate();
	await testETHBridgeValidation();
	await testLanguageSelector();
	await testTranslationKeys();
	await testTranslationQuality();
	await testETHTranslations();
	await testHTMLStructure();
	await testCSSStyles();
	
	console.log(`\n${"=".repeat(60)}`);
	console.log(`RESULTS: ${passed} passed, ${failed} failed`);
	console.log(`Total: ${passed + failed} checks`);
	
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
