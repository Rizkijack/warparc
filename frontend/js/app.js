// WarpArc — USDC bridges via Circle CCTP V2 (burn-and-mint, the only canonical
// route to/from Arc per https://docs.arc.io/integrate/infrastructure/bridges).
// Manual flow: approve → depositForBurn → poll Iris attestation → receiveMessage.
// Forwarding Service: approve → depositForBurnWithHook("cctp-forward") → Circle
// submits the destination mint (no destination gas needed). See the official
// quickstart: developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
// The ABT token keeps the DEPRECATED legacy LayerZero OFT path (ABT demo only).
const HISTORY_KEY = "warparc:txHistory";
const PENDING_KEY = "warparc:pendingCctp";

const state = {
	provider: null,
	signer: null,
	account: null,
	chainId: null,
	lastFromBalanceRaw: null,
	isConnecting: false,
	isBridging: false,
	// Default to Testnet — Arc is testnet-only until public mainnet (Sep 16, 2026)
	testnetMode: true,
	txHistory: []
};

const el = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toast = (msg, type = "info") => {
	const c = el("toast-container");
	const t = document.createElement("div");
	t.className = `toast ${type}`;
	t.textContent = msg;
	c.appendChild(t);
	setTimeout(() => t.remove(), 4000);
};

const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);

// --- persistence (localStorage) ----------------------------------------------

function saveTxHistory() {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(state.txHistory.slice(-50)));
	} catch { /* storage full/blocked — history stays in-memory only */ }
}

function loadTxHistory() {
	try {
		const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
		if (Array.isArray(raw)) {
			state.txHistory = raw.filter(e =>
				e && typeof e.id === "string" && typeof e.label === "string" &&
				["pending", "success", "failed"].includes(e.status) &&
				(typeof e.hash === "string" || e.hash == null)
			);
		}
	} catch { /* corrupt payload — start fresh */ }
}

// One interrupted CCTP transfer may be resumed after a reload: the burn already
// succeeded on-chain, so the mint (or the forward-completion poll) can be
// redone from the saved burn hash alone.
function savePendingCctp(p) {
	try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { }
}

function loadPendingCctp() {
	try {
		const p = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
		// recipient is optional but must be a string when present — a non-string
		// from a hand-corrupted payload would throw inside shortAddr/showPendingBanner
		// and abort the rest of page init.
		if (p && p.burnHash && p.fromKey && p.toKey && CONFIG.chains[p.fromKey] && CONFIG.chains[p.toKey] &&
			(p.recipient == null || typeof p.recipient === "string")) {
			return p;
		}
	} catch { }
	return null;
}

function clearPendingCctp() {
	try { localStorage.removeItem(PENDING_KEY); } catch { }
	const banner = el("pending-resume");
	if (banner) banner.style.display = "none";
}

function showPendingBanner() {
	const banner = el("pending-resume");
	const p = loadPendingCctp();
	if (!banner || !p) return;
	banner.style.display = "block";
	const text = banner.querySelector(".pending-text");
	if (text) {
		text.textContent = `Unfinished bridge: ${p.amount} USDC burned on ${CONFIG.chains[p.fromKey].shortName} → ${CONFIG.chains[p.toKey].shortName}` +
			(p.forward ? " (waiting for Circle forward)" : " (mint not yet submitted)") +
			(p.recipient ? ` · penerima ${shortAddr(p.recipient)}` : "");
	}
}

function addTxEntry(txId, label, status, chainKey) {
	state.txHistory.push({ id: txId, label, status, hash: "", chainKey });
	saveTxHistory();
	renderTxHistory();
}

function updateTxEntry(txId, status, hash) {
	const entry = state.txHistory.find(e => e.id === txId);
	if (!entry) return;
	entry.status = status;
	entry.hash = hash;
	saveTxHistory();
	renderTxHistory();
}

function renderTxHistory() {
	const list = el("tx-list");
	if (!list) return;
	list.innerHTML = "";
	if (state.txHistory.length === 0) {
		const empty = document.createElement("div");
		empty.className = "empty-state";
		empty.textContent = "No transactions yet";
		list.appendChild(empty);
		return;
	}
	state.txHistory.slice().reverse().forEach(entry => {
		const item = document.createElement("div");
		item.className = "tx-item";

		const status = document.createElement("span");
		status.className = "tx-status " + entry.status;
		item.appendChild(status);

		const detail = document.createElement("div");
		detail.className = "tx-detail";

		const action = document.createElement("div");
		action.className = "tx-action";
		action.textContent = entry.label;
		detail.appendChild(action);

		if (entry.hash) {
			const chain = CONFIG.chains[entry.chainKey];
			if (chain && chain.explorer && chain.explorer.startsWith("https://")) {
				const link = document.createElement("a");
				link.className = "tx-hash";
				link.href = chain.explorer + "/tx/" + entry.hash;
				link.target = "_blank";
				link.rel = "noopener";
				link.textContent = entry.hash.slice(0, 6) + "..." + entry.hash.slice(-4);
				detail.appendChild(link);
			}
		}
		item.appendChild(detail);

		const badge = document.createElement("span");
		badge.className = "tx-badge " + entry.status;
		badge.textContent = entry.status;
		item.appendChild(badge);

		list.appendChild(item);
	});
}

function getChainKey(chainId) {
	return Object.keys(CONFIG.chains).find(k => CONFIG.chains[k].chainId === chainId) || null;
}

async function switchChain(chainId) {
	if (!window.ethereum) return;
	try {
		await window.ethereum.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId: "0x" + chainId.toString(16) }]
		});
	} catch (e) {
		// Some wallets wrap chain-not-added as -32603 with data.originalError.code 4902
		const code = e.code ?? e.data?.originalError?.code;
		if (code === 4902) {
			const chain = Object.values(CONFIG.chains).find(c => c.chainId === chainId);
			if (!chain) return;
			await window.ethereum.request({
				method: "wallet_addEthereumChain",
				params: [{
					chainId: "0x" + chainId.toString(16),
					chainName: chain.name,
					rpcUrls: [chain.rpcUrl],
					nativeCurrency: chain.nativeCurrency,
					blockExplorerUrls: [chain.explorer]
				}]
			});
		} else throw e;
	}
}

// Re-create provider/signer after a wallet chain switch — ethers caches the
// network on the BrowserProvider instance, so a stale signer would send the
// mint transaction to the wrong chain.
async function refreshProvider() {
	state.provider = new ethers.BrowserProvider(window.ethereum);
	state.signer = await state.provider.getSigner();
	state.chainId = Number(await window.ethereum.request({ method: "eth_chainId" }));
}

async function connectWallet() {
	if (state.isConnecting) return;
	if (!window.ethereum) {
		toast("No wallet detected. Install MetaMask.", "error");
		return;
	}
	state.isConnecting = true;
	updateConnectBtn("Connecting...");
	try {
		const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
		state.provider = new ethers.BrowserProvider(window.ethereum);
		state.signer = await state.provider.getSigner();
		state.account = accounts[0];
		state.chainId = Number(await window.ethereum.request({ method: "eth_chainId" }));
		onAccountChange();
	} catch (e) {
		toast("Connection rejected: " + e.message, "error");
		updateConnectBtn("Connect Wallet");
	} finally {
		state.isConnecting = false;
	}
}

function updateConnectBtn(text) {
	const btn = el("connect-btn");
	if (btn) btn.textContent = text;
}

function disconnectWallet() {
	state.provider = null;
	state.signer = null;
	state.account = null;
	state.chainId = null;
	state.isConnecting = false;
	onAccountChange();
}

function onAccountChange() {
	const btn = el("connect-btn");
	const badge = el("network-badge");
	const card = document.querySelector(".bridge-card");

	if (state.account) {
		const short = state.account.slice(0, 6) + "..." + state.account.slice(-4);
		btn.textContent = short;
		btn.className = "btn btn-sm";

		const chain = getChainConfig(state.chainId);
		if (chain) {
			badge.innerHTML = `<span class="dot"></span> ${chain.shortName}`;
			badge.style.display = "flex";
		} else {
			badge.innerHTML = `<span style="background:var(--red);width:6px;height:6px;border-radius:50%;display:inline-block"></span> Unsupported`;
			badge.style.display = "flex";
		}

		if (card) card.classList.remove("disconnected");
		loadBalances();
		updateContractInfo();
	} else {
		btn.textContent = "Connect Wallet";
		btn.className = "btn btn-primary btn-sm";
		badge.style.display = "none";
		if (card) card.classList.add("disconnected");
	}
}

function getChainConfig(chainId) {
	return Object.values(CONFIG.chains).find(c => c.chainId === chainId);
}

function getFromChain() {
	const v = el("from-chain").value;
	return CONFIG.chains[v];
}

function getToChain() {
	const v = el("to-chain").value;
	return CONFIG.chains[v];
}

function getSelectedToken() {
	return el("token-select").value;
}

function isForwardEnabled() {
	const t = el("forward-toggle");
	return !!(t && t.checked);
}

function getBridgeContract(chainKey, signerOrProvider, token) {
	const t = token || getSelectedToken();
	if (t === "USDC") {
		const addr = CONFIG.bridgeAdapter.deployments[chainKey];
		if (!addr) return null;
		return new ethers.Contract(addr, OFT_ABI, signerOrProvider);
	}
	const addr = CONFIG.bridgeToken.deployments[chainKey];
	if (!addr) return null;
	return new ethers.Contract(addr, OFT_ABI, signerOrProvider);
}

// Read-only provider for the SELECTED source chain. Balances and gas estimates
// must reflect what the user picked in the UI — not whatever chain the wallet
// happens to be connected to. Falls back to the chain's public RPC (all hosts
// are allow-listed in the CSP) when the wallet sits elsewhere.
const readProviders = {};
function getReadProvider(chainKey) {
	const chain = CONFIG.chains[chainKey];
	if (!chain) return null;
	if (state.provider && state.chainId === chain.chainId) return state.provider;
	if (!readProviders[chainKey]) {
		readProviders[chainKey] = new ethers.JsonRpcProvider(chain.rpcUrl);
	}
	return readProviders[chainKey];
}

// Overlapping balance reads (fast token/chain flips) can resolve out of
// order — only the latest invocation may write the balance display.
let balSeq = 0;

async function loadBalances() {
	if (!state.account) return;

	const token = getSelectedToken();
	const fromKey = el("from-chain").value;
	const provider = getReadProvider(fromKey);
	if (!fromKey || !provider) { state.lastFromBalanceRaw = null; el("from-balance").textContent = "0.00"; return; }

	const seq = ++balSeq;
	const isStale = () => seq !== balSeq;
	try {
		if (token === "ABT") {
			const contract = getBridgeContract(fromKey, provider, "ABT");
			if (contract) {
				const bal = await contract.balanceOf(state.account);
				if (isStale()) return;
				state.lastFromBalanceRaw = bal;
				el("from-balance").textContent = truncateUnits(bal, 18, 4);
			} else {
				state.lastFromBalanceRaw = null;
				el("from-balance").textContent = "N/A";
			}
		} else if (token === "USDC") {
			// Always the 6-dec ERC-20 view (on Arc it is the same asset as native
			// gas — one balance, two views; never sum or convert between them).
			const addr = CONFIG.tokens.USDC.addresses[fromKey];
			if (addr && addr !== "0x0000000000000000000000000000000000000000") {
				const contract = new ethers.Contract(addr, ERC20_ABI, provider);
				const bal = await contract.balanceOf(state.account);
				if (isStale()) return;
				state.lastFromBalanceRaw = bal;
				el("from-balance").textContent = truncateUnits(bal, 6, 2);
			} else {
				state.lastFromBalanceRaw = null;
				el("from-balance").textContent = "N/A";
			}
		} else {
			state.lastFromBalanceRaw = null;
			el("from-balance").textContent = "0.00";
		}
	} catch {
		if (isStale()) return;
		state.lastFromBalanceRaw = null;
		el("from-balance").textContent = "0.00";
	}
}

// Truncates (never rounds up) to `places` fractional digits via string
// manipulation — Number() would lose precision on huge balances and toFixed()
// rounds half-up, which let MAX submit more than the actual balance.
function truncateUnits(value, decimals, places) {
	try {
		let s = ethers.formatUnits(value, decimals);
		if (!s.includes(".")) s += ".";
		const [int, frac = ""] = s.split(".");
		const padded = frac.padEnd(places, "0").slice(0, places);
		return (int + "." + padded).replace(/\.?0+$/, "").replace(/\.$/, "");
	} catch {
		return "0";
	}
}

function updateContractInfo() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const c1 = el("from-contracts");
	const c2 = el("to-contracts");

	c1.innerHTML = "";
	c2.innerHTML = "";
	c1.appendChild(renderContractList(fromKey));
	c2.appendChild(renderContractList(toKey));

	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	el("from-chain-name").textContent = fromChain.shortName;
	el("to-chain-name").textContent = toChain.shortName;
	el("from-domain").textContent = fromChain.cctpDomain != null ? fromChain.cctpDomain : "—";
	el("to-domain").textContent = toChain.cctpDomain != null ? toChain.cctpDomain : "—";
	el("from-cid").textContent = fromChain.chainId;
	el("to-cid").textContent = toChain.chainId;
}

function renderContractList(chainKey) {
	const chain = CONFIG.chains[chainKey] || {};
	const c = chain.cctp || {};
	const entries = [];
	if (getSelectedToken() === "ABT") {
		// Legacy LayerZero OFT deployments (deprecated; ABT demo only) — addresses are filled
		// by scripts/deploy-all.js; null means not deployed on this chain.
		entries.push(["BridgeToken (OFT)", CONFIG.bridgeToken.deployments[chainKey]]);
		entries.push(["BridgeAdapter (OFT)", CONFIG.bridgeAdapter.deployments[chainKey]]);
	} else {
		const usdcAddr = c.usdc || (CONFIG.tokens.USDC.addresses || {})[chainKey];
		if (usdcAddr) entries.push(["USDC", usdcAddr]);
		if (c.tokenMessengerV2) entries.push(["TokenMessenger V2", c.tokenMessengerV2]);
		if (c.messageTransmitterV2) entries.push(["MessageTransmitter V2", c.messageTransmitterV2]);
		if (c.tokenMinterV2) entries.push(["TokenMinter V2", c.tokenMinterV2]);
	}

	const container = document.createElement("div");
	container.className = "contract-list";
	if (entries.length === 0) {
		const none = document.createElement("div");
		none.className = "contract-item";
		none.textContent = "No contracts";
		container.appendChild(none);
		return container;
	}
	entries.forEach(([label, addr]) => {
		const item = document.createElement("div");
		item.className = "contract-item";

		const labelSpan = document.createElement("span");
		labelSpan.className = "contract-label";
		labelSpan.textContent = label;
		item.appendChild(labelSpan);

		const addrSpan = document.createElement("span");
		addrSpan.className = "contract-addr";
		addrSpan.textContent = addr || "not deployed";
		addrSpan.title = addr || "not deployed";
		if (addr) addrSpan.addEventListener("click", () => copyAddr(addr));
		item.appendChild(addrSpan);

		container.appendChild(item);
	});
	return container;
}

async function copyAddr(addr) {
	try {
		await navigator.clipboard.writeText(addr);
		toast("Address copied", "success");
	} catch { }
}

// ---------------------------------------------------------------------------
// Fee estimation
// ---------------------------------------------------------------------------

// Burn fee quote from Circle Iris (units of the burn token, 6 dec).
// GET /v2/burn/USDC/fees/{src}/{dst}[?forward=true] (verified live 2026-08-22):
//   [{"finalityThreshold":1000,"minimumFee":1},
//    {"finalityThreshold":1000,"minimumFee":1,"forwardFee":{"low":18076,"med":18497,"high":19625}}]
// Manual mode: maxFee = 10× the fast minimum (floor 500 = official quickstart
// value) so the burn doesn't revert if the fee ticks up before landing —
// feeExecuted at destination is capped by maxFee.
// Forwarding mode REQUIRES a live quote: its fee is orders of magnitude above
// the manual minimum, so no hardcoded fallback is ever used (returns null).
async function quoteBurnFee(fromChain, toChain, forward, amountSubunits = 0n) {
	try {
		const url = `${CONFIG.iris[fromChain.network]}/v2/burn/USDC/fees/${fromChain.cctpDomain}/${toChain.cctpDomain}${forward ? "?forward=true" : ""}`;
		const res = await fetch(url);
		if (res.ok) {
			const data = await res.json();
			const q = extractFastQuote(data);
			if (q) {
				// Protocol component scales with the burn amount — canonical quickstart
				// Step 4 math: protocolFee = amount × minimumFee × 100 / 1e6
				// (developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc).
				const protocolFee = (amountSubunits * BigInt(Math.round(Number(q.minimumFee) * 100))) / 1_000_000n;
				if (forward) {
					if (!q.forwardFee) return null; // forwarding not quoted for this route
					// maxFee cap = forwarding fee (quoted med) + protocol component,
					// mirroring the quickstart's maxFee = forwardFee + protocolFee.
					const maxFee = BigInt(q.forwardFee.med) + protocolFee;
					return { maxFee, forwardFee: q.forwardFee.med, minimumFee: q.minimumFee };
				}
				const buffered = q.minimumFee * 10n;
				const maxFee = buffered > protocolFee + 500n ? buffered : protocolFee + 500n;
				return { maxFee, forwardFee: null, minimumFee: q.minimumFee };
			}
		}
	} catch { /* fall through */ }
	if (forward) return null; // never guess a forwarding fee
	return { maxFee: BigInt(CONFIG.cctpDefaults.fallbackMaxFee), forwardFee: null, minimumFee: BigInt(CONFIG.cctpDefaults.fallbackMaxFee) };
}

function extractFastQuote(data) {
	// Fast transfer = finalityThreshold 1000 (2000+ is standard/finalized)
	const list = Array.isArray(data) ? data : [data];
	const fast = list.find(e => e && Number(e.finalityThreshold) === 1000);
	if (!fast || fast.minimumFee == null) return null;
	try {
		const minimumFee = BigInt(fast.minimumFee);
		let forwardFee = null;
		if (fast.forwardFee && fast.forwardFee.high != null) {
			forwardFee = {
				low: BigInt(fast.forwardFee.low),
				med: BigInt(fast.forwardFee.med),
				high: BigInt(fast.forwardFee.high)
			};
		}
		return { minimumFee, forwardFee };
	} catch {
		return null;
	}
}

// Overlapping estimates (fast typing, chain flips) can resolve out of order —
// only the latest invocation may write to the fee display.
let estSeq = 0;

async function estimateGas() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	if (!fromChain || !toChain || fromKey === toKey) return;

	const seq = ++estSeq;
	const isStale = () => seq !== estSeq;
	const elEst = el("gas-fee");
	const elFeeUsdc = el("gas-fee-usdc");
	elEst.textContent = "Estimating...";
	if (elFeeUsdc) elFeeUsdc.textContent = "Estimating...";

	try {
		const token = getSelectedToken();

		if (token === "USDC") {
			// Source-side gas for depositForBurn (native gas units of the source chain)
			const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
			if (!usdcAddr || !fromChain.cctp) { elEst.textContent = "N/A"; if (elFeeUsdc) elFeeUsdc.textContent = "N/A"; return; }

			const forward = isForwardEnabled();
			const quote = await quoteBurnFee(fromChain, toChain, forward, 1_000_000n);
			if (isStale()) return;
			if (elFeeUsdc) {
				if (!quote) {
					elFeeUsdc.textContent = "quote unavailable";
				} else if (forward) {
					elFeeUsdc.textContent = "~" + truncateUnits(quote.minimumFee + quote.forwardFee, 6, 4) + " USDC (forward)";
				} else {
					elFeeUsdc.textContent = "~" + truncateUnits(quote.minimumFee, 6, 4) + " USDC (fast)";
				}
			}

			const provider = getReadProvider(fromKey);
			if (provider) {
				const messenger = new ethers.Contract(fromChain.cctp.tokenMessengerV2, TOKEN_MESSENGER_V2_ABI, provider);
				const maxFee = quote ? quote.maxFee : BigInt(CONFIG.cctpDefaults.fallbackMaxFee);
				const mintRecipient = ethers.zeroPadValue(state.account || ethers.ZeroAddress, 32);
				const populated = forward
					? await messenger.depositForBurnWithHook.populateTransaction(
						ethers.parseUnits("1", 6), toChain.cctpDomain, mintRecipient,
						usdcAddr, ethers.ZeroHash, maxFee, CONFIG.cctpDefaults.minFinalityThreshold,
						CONFIG.cctpDefaults.forwardHook
					)
					: await messenger.depositForBurn.populateTransaction(
						ethers.parseUnits("1", 6), toChain.cctpDomain, mintRecipient,
						usdcAddr, ethers.ZeroHash, maxFee, CONFIG.cctpDefaults.minFinalityThreshold
					);
				const [gas, feeData] = await Promise.all([
					provider.estimateGas({ ...populated, from: state.account }),
					provider.getFeeData()
				]);
				if (isStale()) return;
				const price = feeData.maxFeePerGas || feeData.gasPrice || 0n;
				const cost = gas * price;
				const decimals = fromChain.nativeCurrency.decimals;
				elEst.textContent = truncateUnits(cost, decimals, 6) + " " + fromChain.nativeCurrency.symbol;
			} else {
				elEst.textContent = "N/A";
			}
			return;
		}

		// ABT — deprecated legacy LayerZero OFT quote (ABT demo only)
		const contract = getBridgeContract(fromKey, state.provider, token);
		if (!contract) { elEst.textContent = "N/A (deploy first)"; return; }

		const dstEid = toChain.eid;
		const toBytes32 = "0x" + "0".repeat(24) + state.account.slice(2);
		const amount = el("amount").value.trim();
		const tokenDecimals = 18;
		const amountLD = amount ? ethers.parseUnits(amount, tokenDecimals) : ethers.parseUnits("1", tokenDecimals);

		const sendParam = {
			dstEid: dstEid,
			to: toBytes32,
			amountLD: amountLD,
			minAmountLD: amountLD,
			extraOptions: "0x",
			composeMsg: "0x",
			oftCmd: "0x"
		};

		const quote = await contract.quoteSend(sendParam, false);
		const feeBuffer = quote.nativeFee * 110n / 100n;
		if (isStale()) return;
		elEst.textContent = truncateUnits(feeBuffer, 18, 6);
	} catch (e) {
		if (!isStale()) elEst.textContent = "N/A";
	}
}

// ---------------------------------------------------------------------------
// Bridging — USDC via CCTP V2, ABT via legacy OFT
// ---------------------------------------------------------------------------

async function bridge() {
	if (state.isBridging) return;
	state.isBridging = true;

	try {
		if (!state.signer || !state.account) {
			await connectWallet();
			return;
		}

		const fromKey = el("from-chain").value;
		const toKey = el("to-chain").value;
		const amount = el("amount").value.trim();
		const token = getSelectedToken();
		const tokenDecimals = token === "USDC" ? 6 : 18;

		if (!amount) { toast("Enter a valid amount", "error"); return; }

		let parsedAmount;
		try {
			parsedAmount = ethers.parseUnits(amount, tokenDecimals);
		} catch {
			toast("Invalid amount format", "error");
			return;
		}
		if (parsedAmount === 0n) { toast("Amount must be greater than 0", "error"); return; }
		// lastFromBalanceRaw tracks the SELECTED source chain — reject before the
		// approve can succeed and strand the user at a reverting burn.
		if (state.lastFromBalanceRaw != null && parsedAmount > state.lastFromBalanceRaw) {
			toast("Amount exceeds your " + token + " balance on " + CONFIG.chains[fromKey].shortName, "error");
			return;
		}

		if (token === "USDC") {
			await bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey);
		} else {
			await bridgeLegacyOFT(amount, parsedAmount, fromKey, toKey, token);
		}
	} finally {
		state.isBridging = false;
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// Circle CCTP V2 burn-and-mint. forward=true routes through Circle's
// Forwarding Service (depositForBurnWithHook + "cctp-forward" hook) so the
// destination mint is submitted by Circle — essential when the recipient has
// no gas on the destination (USDC is gas on Arc).
// Reference quickstart: https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc
async function bridgeUSDCViaCCTP(amount, parsedAmount, fromKey, toKey) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
	const forward = isForwardEnabled();

	if (!usdcAddr || !fromChain.cctp || !toChain.cctp) {
		toast("CCTP not available on this route", "error");
		return;
	}
	if (fromChain.network !== toChain.network) {
		toast("Source and destination must be on the same network (testnet/mainnet)", "error");
		return;
	}

	const arcOverrides = (key) => key === "arc"
		// Arc: type-2 tx, maxFeePerGas ≥ 20 Gwei floor, priority tip 0 is accepted
		? { maxFeePerGas: ethers.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0n }
		: {};

	const quote = await quoteBurnFee(fromChain, toChain, forward, parsedAmount);
	if (!quote) {
		toast("Forwarding fee quote unavailable — turn off Forwarding Service or retry", "error");
		return;
	}
	// The executed fee is deducted from the transferred amount — an amount at or
	// below the fee would burn everything (or revert).
	const feeTotal = quote.minimumFee + (quote.forwardFee || 0n);
	if (parsedAmount <= feeTotal) {
		toast("Amount must exceed the CCTP fee (" + truncateUnits(feeTotal, 6, 4) + " USDC)", "error");
		return;
	}

	const burnTxId = "burn-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	let subTxId = null; // fwd-/att- sub-entry — must not stay "pending" on abort

	// Initialize CCTP step tracker
	resetStepper();
	showStepper();
	updateStepper("burn", "active");

	try {
		// 1. Make sure the wallet is on the source chain (and signer is fresh)
		if (state.chainId !== fromChain.chainId) {
			toast(`Switching wallet to ${fromChain.name}...`, "info");
			await switchChain(fromChain.chainId);
			await refreshProvider();
		}
		const expectedAccount = state.account;
		// A wallet account/chain switch mid-flow would send from the wrong key
		// or chain — abort before any transaction is submitted.
		const assertWalletStable = () => {
			if (state.account !== expectedAccount || state.chainId !== fromChain.chainId) {
				throw new Error("Wallet account or chain changed mid-flow — aborting before send (no transaction was submitted)");
			}
		};

		// 2. Approve TokenMessengerV2 to burn USDC
		const messengerAddr = fromChain.cctp.tokenMessengerV2;
		const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, state.signer);
		const allowance = await usdc.allowance(state.account, messengerAddr);
		if (allowance < parsedAmount + quote.maxFee) {
			assertWalletStable();
			btn.textContent = "Approving USDC...";
			toast("Approving USDC for TokenMessengerV2...", "info");
			const approveTx = await usdc.approve(messengerAddr, parsedAmount + quote.maxFee, arcOverrides(fromKey));
			await approveTx.wait();
			toast("USDC approved", "success");
		}

		// 3. Burn on the source chain
		assertWalletStable();
		btn.textContent = `Burning ${amount} USDC...`;
		addTxEntry(burnTxId, `Burn ${amount} USDC on ${fromChain.shortName}`, "pending", fromKey);
		const messenger = new ethers.Contract(messengerAddr, TOKEN_MESSENGER_V2_ABI, state.signer);
		const mintRecipient = ethers.zeroPadValue(state.account, 32);
		// destinationCaller = zero bytes32 → any address may submit receiveMessage.
		// Forward path burns totalAmount = amount + maxFee (quickstart Step 3.2/3.3)
		// so the recipient receives the nominal amount after Circle's fee deduction;
		// the direct-mint path burns the plain amount exactly like the quickstart.
		const burnAmount = forward ? parsedAmount + quote.maxFee : parsedAmount;
		const burnArgs = [
			burnAmount,
			toChain.cctpDomain,
			mintRecipient,
			usdcAddr,
			ethers.ZeroHash,
			quote.maxFee,
			CONFIG.cctpDefaults.minFinalityThreshold
		];
		const burnTx = forward
			? await messenger.depositForBurnWithHook(...burnArgs, CONFIG.cctpDefaults.forwardHook, arcOverrides(fromKey))
			: await messenger.depositForBurn(...burnArgs, arcOverrides(fromKey));
		updateTxEntry(burnTxId, "pending", burnTx.hash);
		const burnReceipt = await burnTx.wait();
		if (burnReceipt.status !== 1) throw new Error("Burn transaction failed");
		updateTxEntry(burnTxId, "success", burnTx.hash);

		// Stepper: burn done → attestation/forward active
		updateStepper("burn", "done");
		updateStepperLine("burn", "done");
		updateStepper("attest", "active");

		// Persist enough to resume if the flow dies before the mint lands
		savePendingCctp({
			burnHash: burnTx.hash,
			fromKey, toKey, amount,
			forward,
			recipient: state.account,
			createdAt: Date.now()
		});
		showPendingBanner();

		if (forward) {
			// 4a. Circle's relayer submits the mint; we only wait for its tx hash
			btn.textContent = "Waiting for Circle forward...";
			const fwdTxId = "fwd-" + Date.now();
			subTxId = fwdTxId;
			addTxEntry(fwdTxId, `Forward mint on ${toChain.shortName} (Circle)`, "pending", toKey);
			let forwardHash;
			try {
				forwardHash = await pollForwardCompletion(CONFIG.iris[fromChain.network], fromChain.cctpDomain, burnTx.hash);
			} catch (e) {
				if (e.name !== "ForwardTimeoutWithAttestation") throw e;
				// Forwarder stalled but the attestation is signed — mint manually
				// (fwd- is done; the fallback mint gets its own entry).
				updateTxEntry(fwdTxId, "failed", "");
				await manualMintFallback(toChain, toKey, e.att, amount);
				return;
			}
			updateTxEntry(fwdTxId, "success", forwardHash);
			toast(`Bridge complete! ${amount} USDC → ${toChain.shortName} (forwarded by Circle)`, "success");
			clearPendingCctp();
			loadBalances();
			// Stepper: all done
			updateStepper("attest", "done");
			updateStepperLine("attest", "done");
			updateStepper("mint", "done");
		} else {
			// 4b. Wait for Circle to sign the attestation (fast ≈ seconds)
			btn.textContent = "Waiting for attestation...";
			const attTxId = "att-" + Date.now();
			subTxId = attTxId;
			addTxEntry(attTxId, "Circle attestation (fast)", "pending", fromKey);
			const att = await pollAttestation(CONFIG.iris[fromChain.network], fromChain.cctpDomain, burnTx.hash);
			updateTxEntry(attTxId, "success", burnTx.hash);

			// Stepper: attestation done → mint active
			updateStepper("attest", "done");
			updateStepperLine("attest", "done");
			updateStepper("mint", "active");

			// 5. Mint on the destination chain
			btn.textContent = `Minting on ${toChain.shortName}...`;
			toast(`Switching wallet to ${toChain.name} to mint...`, "info");
			await switchChain(toChain.chainId);
			await refreshProvider();
			onAccountChange();
			// Defensive: the wallet must sit on the destination before receiveMessage.
			if (state.chainId !== toChain.chainId) {
				throw new Error("Wallet chain changed mid-flow — aborting before mint (no transaction was submitted)");
			}

			const mintTxId = "mint-" + Date.now();
			addTxEntry(mintTxId, `Mint ${amount} USDC on ${toChain.shortName}`, "pending", toKey);
			await submitMint(toChain, att, mintTxId, toKey, amount);
		}
	} catch (e) {
		if (state.txHistory.find(t => t.id === burnTxId && t.status === "pending")) {
			updateTxEntry(burnTxId, "failed", "");
		}
		if (subTxId && state.txHistory.find(t => t.id === subTxId && t.status === "pending")) {
			updateTxEntry(subTxId, "failed", "");
		}
		toast("Bridge failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
		// Mark the currently-active stepper step as failed
		["burn", "attest", "mint"].forEach(s => {
			const stepEl = el("step-" + s);
			if (stepEl && stepEl.classList.contains("active")) updateStepper(s, "failed");
		});
	}
}

// receiveMessage on the destination MessageTransmitterV2. Tolerates the case
// where a relayer already processed the nonce — then the funds HAVE arrived,
// which is a success, not an error.
async function submitMint(toChain, att, mintTxId, toKey, amount) {
	const transmitter = new ethers.Contract(toChain.cctp.messageTransmitterV2, MESSAGE_TRANSMITTER_V2_ABI, state.signer);
	const overrides = toKey === "arc"
		? { maxFeePerGas: ethers.parseUnits("30", "gwei"), maxPriorityFeePerGas: 0n }
		: {};
	try {
		const mintTx = await transmitter.receiveMessage(att.message, att.attestation, overrides);
		updateTxEntry(mintTxId, "pending", mintTx.hash);
		const mintReceipt = await mintTx.wait();
		if (mintReceipt.status === 1) {
			updateTxEntry(mintTxId, "success", mintTx.hash);
			toast(`Bridge complete! ${amount} USDC → ${toChain.shortName}`, "success");
			clearPendingCctp();
			updateStepper("mint", "done");
		} else {
			updateTxEntry(mintTxId, "failed", mintTx.hash);
			toast("Mint transaction failed", "error");
			updateStepper("mint", "failed");
		}
	} catch (e) {
		const msg = String(e.reason || e.shortMessage || e.message || "");
		if (/already|replay|used/i.test(msg)) {
			updateTxEntry(mintTxId, "success", "");
			toast("Mint was already submitted by a relayer — funds are on " + toChain.shortName, "success");
			clearPendingCctp();
			updateStepper("mint", "done");
		} else {
			// Rejected/reverted mint: the burn is safe on-chain — KEEP the pending
			// record so the resume banner survives for a retry.
			updateTxEntry(mintTxId, "failed", "");
			updateStepper("mint", "failed");
			throw e;
		}
	} finally {
		loadBalances();
	}
}

// Forwarder stalled but Iris already signed the attestation — anyone may
// submit receiveMessage (destinationCaller = zero), so finish the mint by
// hand. submitMint clears the pending record on success, keeps it on failure.
async function manualMintFallback(toChain, toKey, att, amount, labelSuffix = " (manual fallback)") {
	toast("Forwarder belum selesai — melanjutkan dengan mint manual…", "info");
	await switchChain(toChain.chainId);
	await refreshProvider();
	onAccountChange();
	// Same defense as the other pre-mint paths: a silently-ignored chain switch
	// would send the mint to the wrong network (wasted gas — USDC on Arc).
	if (state.chainId !== toChain.chainId) {
		throw new Error(`Wallet is not on ${toChain.name} — mint aborted before send`);
	}
	const mintTxId = "mint-" + Date.now();
	addTxEntry(mintTxId, `Mint ${amount} USDC on ${toChain.shortName}${labelSuffix}`, "pending", toKey);
	await submitMint(toChain, att, mintTxId, toKey, amount);
}

// Resume an interrupted transfer after a reload: the burn hash is enough to
// redo either the attestation+mint (manual) or the forward-completion wait.
async function resumePendingCctp() {
	if (state.isBridging) { toast("Another bridge flow is in progress", "error"); return; }
	const p = loadPendingCctp();
	if (!p) return;
	if (!state.signer || !state.account) {
		toast("Connect your wallet first, then resume", "error");
		return;
	}
	const fromChain = CONFIG.chains[p.fromKey];
	const toChain = CONFIG.chains[p.toKey];
	if (!fromChain || !toChain || fromChain.network !== toChain.network) {
		clearPendingCctp();
		return;
	}

	state.isBridging = true;
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	const resumeId = "resume-" + Date.now();

	try {
		if (p.forward) {
			addTxEntry(resumeId, `Forward mint on ${toChain.shortName} (Circle, resumed)`, "pending", p.toKey);
			let forwardHash;
			try {
				forwardHash = await pollForwardCompletion(CONFIG.iris[fromChain.network], fromChain.cctpDomain, p.burnHash);
			} catch (e) {
				if (e.name !== "ForwardTimeoutWithAttestation") throw e;
				updateTxEntry(resumeId, "failed", "");
				await manualMintFallback(toChain, p.toKey, e.att, p.amount, " (resumed, manual fallback)");
				return;
			}
			updateTxEntry(resumeId, "success", forwardHash);
			toast("Forward completed — funds are on " + toChain.shortName, "success");
			clearPendingCctp();
		} else {
			// The mint always pays the ORIGINAL recipient; a different connected
			// account only pays the gas — make that explicit before proceeding.
			if (p.recipient && state.account && p.recipient.toLowerCase() !== state.account.toLowerCase() &&
				!window.confirm("Burn ini dibuat untuk penerima " + shortAddr(p.recipient) + ", BUKAN akun yang tersambung sekarang. Mint manual akan mengirim dana ke penerima asli (gas dibayar akun sekarang). Lanjutkan?")) {
				return;
			}
			btn.textContent = "Waiting for attestation...";
			const att = await pollAttestation(CONFIG.iris[fromChain.network], fromChain.cctpDomain, p.burnHash);
			if (state.chainId !== toChain.chainId) {
				toast(`Switching wallet to ${toChain.name} to mint...`, "info");
				await switchChain(toChain.chainId);
				await refreshProvider();
				onAccountChange();
			}
			// Chain-only assertion: the account may differ from the burner (the
			// confirm above already covers that case).
			if (state.chainId !== toChain.chainId) {
				throw new Error("Wallet chain changed mid-flow — aborting before mint (no transaction was submitted)");
			}
			const mintTxId = "mint-" + Date.now();
			addTxEntry(mintTxId, `Mint ${p.amount} USDC on ${toChain.shortName} (resumed)`, "pending", p.toKey);
			await submitMint(toChain, att, mintTxId, p.toKey, p.amount);
		}
	} catch (e) {
		if (state.txHistory.find(t => t.id === resumeId && t.status === "pending")) {
			updateTxEntry(resumeId, "failed", "");
		}
		toast("Resume failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
	} finally {
		state.isBridging = false;
		setFlowsBusy(false);
		updateBridgeBtn();
	}
}

// For forwarded burns, completion = Iris reports the relayer's forwardTxHash
// (the mint itself was submitted by Circle on the destination chain).
async function pollForwardCompletion(irisBase, srcDomain, txHash, timeoutMs = 600000) {
	const url = `${irisBase}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
	const fetchMsg = async () => {
		try {
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				return (data && data.messages && data.messages[0]) || null;
			}
		} catch { /* transient network error — keep polling */ }
		return null;
	};
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const msg = await fetchMsg();
		if (msg && msg.forwardTxHash) {
			return msg.forwardTxHash;
		}
		await sleep(5000);
	}
	// Timeout: a signed attestation still lets the caller mint manually
	// (destinationCaller = zero) — surface it instead of dead-ending.
	const msg = await fetchMsg();
	if (msg && msg.status === "complete" && msg.message && msg.attestation) {
		const e = new Error("Forward completion timeout — attestation signed, manual mint possible");
		e.name = "ForwardTimeoutWithAttestation";
		e.att = msg;
		throw e;
	}
	throw new Error("Forward completion timeout — attestation not signed yet; Circle may still forward it, or resume later from this page");
}

// Poll Iris until the burn message is signed. 404 = not observed yet; 5s
// interval stays far below the 40 req/s attestation-service rate limit.
async function pollAttestation(irisBase, srcDomain, txHash, timeoutMs = 600000) {
	const url = `${irisBase}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) {
				const data = await res.json();
				const msg = data && data.messages && data.messages[0];
				if (msg && msg.status === "complete" && msg.message && msg.attestation) {
					return msg;
				}
			}
		} catch { /* transient network error — keep polling */ }
		await sleep(5000);
	}
	throw new Error("Attestation timeout — the burn succeeded; mint can be retried with the burn tx hash");
}

// DEPRECATED LayerZero OFT path, kept for the ABT demo token only.
async function bridgeLegacyOFT(amount, parsedAmount, fromKey, toKey, token) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.chainId !== state.chainId) {
		toast(`Switch to ${fromChain.name}`, "error");
		try { await switchChain(fromChain.chainId); await refreshProvider(); } catch { return; }
	}

	const contract = getBridgeContract(fromKey, state.signer, token);
	if (!contract) {
		toast("Bridge token not deployed on " + fromChain.shortName, "error");
		return;
	}

	const txId = "tx-" + Date.now();
	const btn = el("bridge-btn");
	setFlowsBusy(true);
	btn.textContent = `Bridging ${amount} ${token}...`;

	addTxEntry(txId, `Bridge ${amount} ${token} → ${toChain.shortName}`, "pending", fromKey);

	try {
		const dstEid = toChain.eid;
		const toBytes32 = "0x" + "0".repeat(24) + state.account.slice(2);

		const amountLD = parsedAmount;
		const minAmountLD = amountLD * 995n / 1000n;

		const sendParam = {
			dstEid: dstEid,
			to: toBytes32,
			amountLD: amountLD,
			minAmountLD: minAmountLD,
			extraOptions: "0x",
			composeMsg: "0x",
			oftCmd: "0x"
		};

		const fee = await contract.quoteSend(sendParam, false);
		const feeBuffer = fee.nativeFee * 110n / 100n;

		const tx = await contract.send(
			sendParam,
			{ nativeFee: feeBuffer, lzTokenFee: 0n },
			state.account,
			{ value: feeBuffer }
		);

		updateTxEntry(txId, "pending", tx.hash);

		const receipt = await tx.wait();

		if (receipt.status === 1) {
			updateTxEntry(txId, "success", tx.hash);
			toast(`Bridge complete! ${amount} ${token} → ${toChain.shortName}`, "success");
			loadBalances();
		} else {
			updateTxEntry(txId, "failed", tx.hash);
			toast("Transaction failed", "error");
		}
	} catch (e) {
		updateTxEntry(txId, "failed", "");
		toast("Bridge failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
	}
}

// Both action buttons go quiet while any bridge/resume flow runs; only the
// disabled state is touched — labels stay owned by updateBridgeBtn/the flow.
function setFlowsBusy(busy) {
	const b = el("bridge-btn");
	if (b) b.disabled = busy;
	const r = el("resume-btn");
	if (r) r.disabled = busy;
}

function updateBridgeBtn() {
	const btn = el("bridge-btn");
	const account = state.account;
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const amount = el("amount").value.trim();
	const token = getSelectedToken();

	if (!account) { btn.textContent = "Connect Wallet"; btn.disabled = false; return; }
	if (fromKey === toKey) { btn.textContent = "Same chain selected"; btn.disabled = true; return; }

	if (token === "USDC") {
		if (!CONFIG.tokens.USDC.addresses[fromKey] || !CONFIG.chains[fromKey].cctp) {
			btn.textContent = "USDC bridging unavailable on " + CONFIG.chains[fromKey].shortName;
			btn.disabled = true;
			return;
		}
	} else {
		// Truthy check: testnet keys are absent from deployments (undefined),
		// which must count as not deployed — `!== null` would let them through.
		const bridgeDeployed = !!CONFIG.bridgeToken.deployments[fromKey];
		if (!bridgeDeployed) {
			btn.textContent = "Bridge not deployed on " + CONFIG.chains[fromKey].shortName;
			btn.disabled = true;
			return;
		}
	}

	if (!amount || Number(amount) <= 0) { btn.textContent = "Enter amount"; btn.disabled = true; return; }

	btn.textContent = `Bridge ${amount} ${token} to ${CONFIG.chains[toKey].shortName}`;
	btn.disabled = false;
}

// A chain is bridgeable in the UI when Circle publishes a CCTP domain for it
// (robinhood has none yet; arcMainnet stays disabled until launch-day values
// are filled in — MAINNET-CHECKLIST.md Phase 1/2).
function isBridgeableChain(chainKey) {
	const c = CONFIG.chains[chainKey];
	return !!(c && !c.disabled && c.cctpDomain != null && c.cctp && c.cctp.tokenMessengerV2);
}

function getFilteredChains() {
	const mode = state.testnetMode ? "testnet" : "mainnet";
	return Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		return c.network === mode && isBridgeableChain(k);
	});
}

function populateChainSelects() {
	const from = el("from-chain");
	const to = el("to-chain");
	from.innerHTML = "";
	to.innerHTML = "";
	const keys = getFilteredChains();
	keys.forEach(k => {
		const c = CONFIG.chains[k];
		const opt = `<option value="${k}">${c.name}</option>`;
		from.insertAdjacentHTML("beforeend", opt);
		to.insertAdjacentHTML("beforeend", opt);
	});
	if (keys.length > 0) {
		const arcIndex = keys.indexOf("arc");
		if (arcIndex >= 0) {
			// Prefer Arc as the default destination (the product's home chain):
			// fund it from the first partner testnet.
			to.value = "arc";
			from.value = keys.find(k => k !== "arc") || keys[0];
		} else {
			from.value = keys[0];
			to.value = keys[1] || keys[0];
		}
		if (from.value === to.value) to.value = keys.find(k => k !== from.value) || keys[0];
	}
}

function onChainChange() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;

	if (fromKey === toKey) {
		const keys = getFilteredChains();
		const next = keys.find(k => k !== fromKey);
		if (next) el("to-chain").value = next;
	}

	updateContractInfo();
	updateBridgeBtn();
	if (state.account) loadBalances();
	estimateGas();
}

function onAmountChange() {
	updateBridgeBtn();
	estimateGas();
}

function onTokenChange() {
	const token = getSelectedToken();
	const meta = CONFIG.tokens[token] || CONFIG.bridgeToken;
	const img = el("token-tag").querySelector("img");
	const sym = el("token-symbol");
	img.src = meta.icon || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%232775CA'/%3E%3Cpath d='M16 7v18M20.8 11.2c-.8-1.2-2.6-1.9-4.8-1.9-2.7 0-4.7 1.3-4.7 3.3 0 4.4 9.6 2.4 9.6 6.7 0 2.1-2.1 3.4-5.1 3.4-2.5 0-4.3-.9-5.1-2.2' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
	sym.textContent = meta.symbol;

	// Forwarding Service only exists on the CCTP USDC path
	const forwardRow = el("forward-row");
	if (forwardRow) forwardRow.style.display = token === "USDC" ? "flex" : "none";

	if (state.account) loadBalances();
	estimateGas();
	updateBridgeBtn();
	updateContractInfo();
}

function setMax() {
	const token = getSelectedToken();
	const decimals = token === "USDC" ? 6 : 18;
	const places = token === "USDC" ? 2 : 4;
	if (state.lastFromBalanceRaw != null) {
		el("amount").value = truncateUnits(state.lastFromBalanceRaw, decimals, places);
		updateBridgeBtn();
		estimateGas();
		return;
	}
	const bal = el("from-balance").textContent;
	if (bal && bal !== "0.00" && bal !== "N/A") {
		el("amount").value = bal;
		updateBridgeBtn();
		estimateGas();
	}
}

// ---------------------------------------------------------------------------
// Chain swap (interactive arrow button)
// ---------------------------------------------------------------------------

function swapChains() {
	const from = el("from-chain");
	const to = el("to-chain");
	const tmp = from.value;
	from.value = to.value;
	to.value = tmp;
	// Animate the swap icon
	const btn = el("swap-chains-btn");
	if (btn) {
		btn.classList.add("swapped");
		setTimeout(() => btn.classList.remove("swapped"), 300);
	}
	onChainChange();
}

// ---------------------------------------------------------------------------
// Preset amount buttons (25% / 50% / 75%)
// ---------------------------------------------------------------------------

function setPresetAmount(pct) {
	if (state.lastFromBalanceRaw == null || state.lastFromBalanceRaw === 0n) return;
	const token = getSelectedToken();
	const decimals = token === "USDC" ? 6 : 18;
	const places = token === "USDC" ? 2 : 4;
	const portion = state.lastFromBalanceRaw * BigInt(pct) / 100n;
	el("amount").value = truncateUnits(portion, decimals, places);
	updateBridgeBtn();
	estimateGas();
}

// ---------------------------------------------------------------------------
// CCTP V2 Step Tracker
// ---------------------------------------------------------------------------

function updateStepper(step, state) {
	const stepEl = el("step-" + step);
	if (!stepEl) return;
	// Clear previous states
	stepEl.classList.remove("active", "done", "failed");
	if (state) stepEl.classList.add(state);
}

function updateStepperLine(line, state) {
	const lineEl = el("line-" + line);
	if (!lineEl) return;
	lineEl.classList.remove("active", "done");
	if (state) lineEl.classList.add(state);
}

function showStepper() {
	const stepper = el("cctp-stepper");
	if (stepper) stepper.style.display = "flex";
}

function hideStepper() {
	const stepper = el("cctp-stepper");
	if (stepper) stepper.style.display = "none";
}

function resetStepper() {
	["burn", "attest", "mint"].forEach(s => updateStepper(s, null));
	["burn", "attest"].forEach(l => updateStepperLine(l, null));
	hideStepper();
}

document.addEventListener("DOMContentLoaded", () => {
	if (window.ethereum) {
		window.ethereum.on("accountsChanged", async (accounts) => {
			if (accounts.length === 0) disconnectWallet();
			else {
				state.account = accounts[0];
				state.provider = new ethers.BrowserProvider(window.ethereum);
				state.signer = await state.provider.getSigner();
				onAccountChange();
			}
		});
		window.ethereum.on("chainChanged", async (chainId) => {
			state.chainId = Number(chainId);
			await refreshProvider();
			onAccountChange();
		});
	}

	el("from-chain").addEventListener("change", onChainChange);
	el("to-chain").addEventListener("change", onChainChange);
	el("token-select").addEventListener("change", onTokenChange);
	el("amount").addEventListener("input", onAmountChange);

	// Bound in JS (not inline onclick) so the strict CSP in vercel.json —
	// script-src 'self' + cdnjs, no 'unsafe-inline' — cannot block them.
	el("connect-btn").addEventListener("click", connectWallet);
	el("max-btn").addEventListener("click", setMax);
	el("bridge-btn").addEventListener("click", bridge);

	// Chain swap button
	const swapBtn = el("swap-chains-btn");
	if (swapBtn) {
		swapBtn.addEventListener("click", swapChains);
	}

	// Preset amount buttons (25%, 50%, 75%)
	document.querySelectorAll(".preset-btn").forEach(btn => {
		btn.addEventListener("click", () => {
			const pct = Number(btn.dataset.pct);
			if (pct > 0) setPresetAmount(pct);
		});
	});

	const forwardToggle = el("forward-toggle");
	if (forwardToggle) {
		forwardToggle.addEventListener("change", estimateGas);
	}

	const resumeBtn = el("resume-btn");
	if (resumeBtn) {
		resumeBtn.addEventListener("click", resumePendingCctp);
	}
	const dismissBtn = el("pending-dismiss");
	if (dismissBtn) {
		dismissBtn.addEventListener("click", () => {
			const p = loadPendingCctp();
			// Forwarded transfers complete on their own — dismiss clears the
			// state. Manual ones stay resumable; dismiss only hides the banner.
			if (p && p.forward) clearPendingCctp();
			else el("pending-resume").style.display = "none";
		});
	}

	const toggle = el("network-mode-toggle");
	if (toggle) {
		toggle.checked = state.testnetMode;
		toggle.addEventListener("change", () => {
			state.testnetMode = toggle.checked;
			populateChainSelects();
			onChainChange();
		});
	}

	loadTxHistory();
	renderTxHistory();
	showPendingBanner();
	populateChainSelects();
	onTokenChange();
	updateBridgeBtn();

	// Start in disconnected state — card shows form but muted
	const card = document.querySelector(".bridge-card");
	if (card && !state.account) card.classList.add("disconnected");
});

