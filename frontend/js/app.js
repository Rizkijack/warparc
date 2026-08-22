const state = {
	provider: null,
	signer: null,
	account: null,
	chainId: null,
	isConnecting: false,
	testnetMode: false,
	txHistory: []
};

const el = (id) => document.getElementById(id);
const toast = (msg, type = "info") => {
	const c = el("toast-container");
	const t = document.createElement("div");
	t.className = `toast ${type}`;
	t.textContent = msg;
	c.appendChild(t);
	setTimeout(() => t.remove(), 4000);
};

function addTxEntry(txId, label, status, chainKey) {
	state.txHistory.push({ id: txId, label, status, hash: "", chainKey });
	renderTxHistory();
}

function updateTxEntry(txId, status, hash) {
	const entry = state.txHistory.find(e => e.id === txId);
	if (!entry) return;
	entry.status = status;
	entry.hash = hash;
	renderTxHistory();
}

function renderTxHistory() {
	const list = el("tx-list");
	if (!list) return;
	if (state.txHistory.length === 0) {
		list.innerHTML = '<div class="empty-state">No transactions yet</div>';
		return;
	}
	const esc = (s) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
	const items = state.txHistory.slice().reverse().map(entry => {
		const hash = entry.hash;
		const shortHash = hash ? hash.slice(0, 6) + "…" + hash.slice(-4) : "";
		return `<div class="tx-item"><span class="tx-status ${entry.status}"></span><div class="tx-detail"><div class="tx-action">${esc(entry.label)}</div>${hash ? `<a class="tx-hash" href="${CONFIG.chains[entry.chainKey].explorer}/tx/${hash}" target="_blank" rel="noopener">${shortHash}</a>` : ""}</div><span class="tx-badge ${entry.status}">${entry.status}</span></div>`;
	}).join("");
	list.innerHTML = items;
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
		if (e.code === 4902) {
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
		state.isConnecting = false;
		updateConnectBtn("Connect Wallet");
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
	const bridgeArea = el("bridge-area");

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

		bridgeArea.style.display = "block";
		loadBalances();
		updateContractInfo();
		renderTxHistory();
	} else {
		btn.textContent = "Connect Wallet";
		btn.className = "btn btn-primary btn-sm";
		badge.style.display = "none";
		bridgeArea.style.display = "none";
		renderTxHistory();
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

async function loadBalances() {
	if (!state.provider || !state.account) return;

	const token = getSelectedToken();
	const fromKey = getChainKey(state.chainId);
	if (!fromKey) { el("from-balance").textContent = "0.00"; return; }

	try {
		if (token === "ABT") {
			const contract = getBridgeContract(fromKey, state.provider, "ABT");
			if (contract) {
				const bal = await contract.balanceOf(state.account);
				el("from-balance").textContent = formatUnits(bal, 18, 4);
			} else {
				el("from-balance").textContent = "N/A";
			}
		} else if (token === "USDC") {
			const addr = CONFIG.tokens.USDC.addresses[fromKey];
			if (addr && addr !== "0x0000000000000000000000000000000000000000") {
				const contract = new ethers.Contract(addr, ERC20_ABI, state.provider);
				const bal = await contract.balanceOf(state.account);
				el("from-balance").textContent = formatUnits(bal, 6, 2);
			} else {
				el("from-balance").textContent = "N/A";
			}
		} else {
			el("from-balance").textContent = "0.00";
		}
	} catch {
		el("from-balance").textContent = "0.00";
	}
}

function formatUnits(wei, decimals, places) {
	try {
		const val = ethers.formatUnits(wei, decimals);
		return Number(val).toFixed(places);
	} catch {
		return "0.00";
	}
}

function updateContractInfo() {
	const fromChain = getFromChain();
	const toChain = getToChain();
	const c1 = el("from-contracts");
	const c2 = el("to-contracts");

	const routeMode = getRouteMode(el("from-chain").value, el("to-chain").value, getSelectedToken());
	c1.innerHTML = renderContractList(fromChain, el("from-chain").value, routeMode);
	c2.innerHTML = renderContractList(toChain, el("to-chain").value, routeMode);

	el("from-chain-name").textContent = fromChain.shortName;
	el("to-chain-name").textContent = toChain.shortName;
	el("from-eid").textContent = fromChain.eid;
	el("to-eid").textContent = toChain.eid;
	el("from-cid").textContent = fromChain.chainId;
	el("to-cid").textContent = toChain.chainId;
}

function renderContractList(chain, chainKey, routeMode) {
	if (routeMode === "cctp") {
		// CCTP route: show the burn-and-mint stack. The Arc side renders from its own
		// chains.<key>.cctp block; other sides read the shared tier registry (values
		// identical per tier — developers.circle.com/cctp/references/contract-addresses).
		const c = chain.cctp || CONFIG.cctp.contracts[chain.chainId === 5042002 ? "testnet" : "mainnet"];
		const entries = [
			["USDC", (chain.cctp && chain.cctp.usdc) || CONFIG.tokens.USDC.addresses[chainKey]],
			["TokenMessengerV2", c.tokenMessengerV2],
			["MessageTransmitterV2", c.messageTransmitterV2],
			["CCTP Domain", String(CONFIG.cctp.domains[chainKey])]
		];
		return entries.map(([label, addr]) =>
			`<div class="contract-item">
				<span class="contract-label">${label}</span>
				<span class="contract-addr" onclick="copyAddr('${addr}')" title="${addr}">${addr}</span>
			</div>`
		).join("");
	}
	const lz = chain.layerZero;
	const entries = [
		["Endpoint V2", lz.endpointV2],
		["SendUln302", lz.sendUln302],
		["ReceiveUln302", lz.receiveUln302],
		["Executor", lz.executor]
	];
	return entries.map(([label, addr]) =>
		`<div class="contract-item">
			<span class="contract-label">${label}</span>
			<span class="contract-addr" onclick="copyAddr('${addr}')" title="${addr}">${addr}</span>
		</div>`
	).join("");
}

async function copyAddr(addr) {
	try {
		await navigator.clipboard.writeText(addr);
		toast("Address copied", "success");
	} catch { }
}

async function estimateGas() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	if (!fromChain || !toChain || fromKey === toKey) return;

	const elEst = el("gas-fee");
	elEst.textContent = "Estimating...";

	try {
		const token = getSelectedToken();
		const contract = getBridgeContract(fromKey, state.provider, token);
		if (!contract) { elEst.textContent = "N/A (deploy first)"; return; }

		const dstEid = toChain.eid;
		const toBytes32 = "0x" + "0".repeat(24) + state.account.slice(2);
		const amount = el("amount").value.trim();
		const tokenDecimals = token === "USDC" ? 6 : 18;
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

		const fee = await contract.quoteSend(sendParam, false);

		const gasValue = Number(ethers.formatUnits(fee.nativeFee, 18));
		elEst.textContent = gasValue < 0.001 ? "< 0.001" : gasValue.toFixed(6);
	} catch (e) {
		elEst.textContent = "N/A";
	}
}

function getRouteMode(fromKey, toKey, token) {
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];
	if (!fromChain || !toChain || fromKey === toKey) return null;

	const hasUsdc = (k) => {
		const addr = CONFIG.tokens.USDC.addresses[k];
		return !!addr && addr !== "0x0000000000000000000000000000000000000000";
	};

	if (token === "USDC") {
		const arcInvolved = ["arc", "arcMainnet"].includes(fromKey) || ["arc", "arcMainnet"].includes(toKey);
		if (arcInvolved) {
			// Arc USDC legs ride CCTP burn-and-mint — the Arc LayerZero path is legacy.
			// Circle only crosses same tiers (testnet<->testnet, mainnet<->mainnet), so
			// cross-tier Arc routes stay unavailable until the Arc mainnet registry row
			// publishes (chains.arcMainnet fills in).
			const tierOf = (k) => CONFIG.chains[k].chainId === 5042002 ? "testnet" : "mainnet";
			const domainsReady = CONFIG.cctp.domains[fromKey] != null && CONFIG.cctp.domains[toKey] != null;
			return domainsReady && hasUsdc(fromKey) && hasUsdc(toKey) && tierOf(fromKey) === tierOf(toKey)
				? "cctp"
				: null;
		}
	}

	// Every other USDC/ABT leg keeps the LayerZero OFT path.
	return fromChain.layerZero && toChain.layerZero ? "oft" : null;
}

async function pollCctpAttestation(messageHash) {
	// Iris API: GET /v2/attestations/{messageHash} until status === "complete"
	// (interim states like pending_http_not_found just mean "not yet"). ~10s cadence,
	// hard stop after ~15 minutes so the UI never polls forever.
	const url = CONFIG.cctp.attestationApi + "/" + messageHash;
	const deadline = Date.now() + 15 * 60 * 1000;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			const data = await res.json();
			if (data && data.status === "complete" && data.attestation) return data.attestation;
		} catch { /* transient fetch/parse hiccup — keep polling */ }
		await new Promise(resolve => setTimeout(resolve, 10000));
	}
	throw new Error("attestation timed out after ~15 minutes");
}

async function ensureWalletOnChain(destChain) {
	if (state.chainId === destChain.chainId) return;
	try {
		await switchChain(destChain.chainId);
		// Re-bind provider/signer onto the destination chain for the mint tx.
		state.chainId = Number(await window.ethereum.request({ method: "eth_chainId" }));
		state.provider = new ethers.BrowserProvider(window.ethereum);
		state.signer = await state.provider.getSigner();
	} catch {
		throw new Error(`wallet switch to ${destChain.name} rejected — switch manually to finish the mint`);
	}
}

async function bridgeViaCctp(txId, amount, fromKey, toChain) {
	// CCTP V2 burn-and-mint (developers.circle.com/cctp/references/contract-interfaces):
	// approve -> depositForBurn -> MessageSent hash -> Iris attestation -> receiveMessage.
	const toKey = getChainKey(toChain.chainId);
	const tier = CONFIG.chains[fromKey].chainId === 5042002 ? "testnet" : "mainnet";
	const contracts = CONFIG.cctp.contracts[tier];
	const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
	const parsedAmount = ethers.parseUnits(amount, 6);
	const mintRecipient = "0x" + "0".repeat(24) + state.account.slice(2);

	const btn = el("bridge-btn");
	btn.disabled = true;
	btn.textContent = `Bridging ${amount} USDC...`;

	let lastHash = "";
	try {
		// Step 1 — allow this tier's TokenMessengerV2 to burn our USDC
		const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, state.signer);
		const allowance = await usdc.allowance(state.account, contracts.tokenMessengerV2);
		if (allowance < parsedAmount) {
			toast("Approving USDC...", "info");
			const approveTx = await usdc.approve(contracts.tokenMessengerV2, parsedAmount);
			await approveTx.wait();
			toast("USDC approved", "success");
		}

		addTxEntry(txId, `Bridge ${amount} USDC → ${toChain.shortName} (CCTP)`, "pending", fromKey);

		// Step 2 — burn on the source chain. Canonical V2 depositForBurn takes 7 args
		// (docs.arc.io shows a simplified legacy 4-arg form): destinationCaller =
		// bytes32(0) lets anyone permissionlessly call receiveMessage; maxFee = 0 with
		// minFinalityThreshold = 2000 (Standard/finalized) carries no fast-transfer fee.
		const messenger = new ethers.Contract(contracts.tokenMessengerV2, TOKEN_MESSENGER_V2_ABI, state.signer);
		const burnTx = await messenger.depositForBurn(
			parsedAmount,
			CONFIG.cctp.domains[toKey],
			mintRecipient,
			usdcAddr,
			ethers.ZeroHash,
			0n,
			2000
		);
		lastHash = burnTx.hash;
		updateTxEntry(txId, "pending", burnTx.hash);

		const burnReceipt = await burnTx.wait();
		if (burnReceipt.status !== 1) throw new Error("burn transaction reverted");

		// Step 3 — the MessageSent log carries the message bytes; keccak256 of them is
		// the attestation lookup key.
		const sentLog = burnReceipt.logs.find(l => l.topics[0] && l.topics[0].toLowerCase() === CONFIG.cctp.MESSAGE_SENT_TOPIC0);
		if (!sentLog) throw new Error("MessageSent event missing from burn receipt");
		const messageBytes = sentLog.data;
		const messageHash = ethers.keccak256(messageBytes);

		// Step 4 — wait for Circle to sign the message
		btn.textContent = "Waiting for attestation...";
		toast("Burned — waiting for Circle attestation...", "info");
		const attestation = await pollCctpAttestation(messageHash);

		// Step 5 — minting runs on the destination chain, so the wallet must follow
		btn.textContent = `Minting on ${toChain.shortName}...`;
		toast(`Attestation ready — switching to ${toChain.shortName} to mint`, "info");
		await ensureWalletOnChain(toChain);

		const transmitter = new ethers.Contract(contracts.messageTransmitterV2, MESSAGE_TRANSMITTER_V2_ABI, state.signer);
		const receiveTx = await transmitter.receiveMessage(messageBytes, attestation);
		lastHash = receiveTx.hash;
		updateTxEntry(txId, "pending", receiveTx.hash);

		const receiveReceipt = await receiveTx.wait();
		if (receiveReceipt.status !== 1) throw new Error("mint transaction reverted");

		updateTxEntry(txId, "success", receiveTx.hash);
		toast(`Bridge complete! ${amount} USDC → ${toChain.shortName}`, "success");
		loadBalances();
	} catch (e) {
		updateTxEntry(txId, "failed", lastHash);
		toast("CCTP bridge failed: " + (e.reason || e.shortMessage || e.message || "Unknown error"), "error");
	}

	btn.disabled = false;
	updateBridgeBtn();
}

async function bridge() {
	if (!state.signer || !state.account) {
		toast("Connect your wallet first", "error");
		return;
	}

	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const fromChain = CONFIG.chains[fromKey];
	const toChain = CONFIG.chains[toKey];

	if (fromChain.chainId !== state.chainId) {
		toast(`Switch to ${fromChain.name}`, "error");
		try { await switchChain(fromChain.chainId); } catch { return; }
	}

	const amount = el("amount").value.trim();
	if (!amount || Number(amount) <= 0) {
		toast("Enter a valid amount", "error");
		return;
	}

	const token = getSelectedToken();

	const mode = getRouteMode(fromKey, toKey, token);
	if (mode === "cctp") return bridgeViaCctp("tx-" + Date.now(), amount, fromKey, toChain);
	if (mode !== "oft") {
		toast(`No ${token} route from ${fromChain.shortName} to ${toChain.shortName}`, "error");
		return;
	}

	const contract = getBridgeContract(fromKey, state.signer);
	if (!contract) {
		toast("Bridge token not deployed on " + fromChain.shortName, "error");
		return;
	}

	const txId = "tx-" + Date.now();

	// For USDC: approve bridge contract to spend tokens
	if (token === "USDC") {
		const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
		if (usdcAddr && usdcAddr !== "0x0000000000000000000000000000000000000000") {
			try {
				const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, state.signer);
				const bridgeAddr = await contract.getAddress();
				const allowance = await usdc.allowance(state.account, bridgeAddr);
				const parsedAmount = ethers.parseUnits(amount, 6);
				if (allowance < parsedAmount) {
					toast("Approving USDC...", "info");
					const approveTx = await usdc.approve(bridgeAddr, parsedAmount);
					await approveTx.wait();
					toast("USDC approved", "success");
				}
			} catch (e) {
				toast("USDC approval failed: " + e.message, "error");
				return;
			}
		}
	}

	const btn = el("bridge-btn");
	btn.disabled = true;
	btn.textContent = `Bridging ${amount} ${token}...`;

	addTxEntry(txId, `Bridge ${amount} ${token} → ${toChain.shortName}`, "pending", fromKey);

	try {
		const dstEid = toChain.eid;
		const toBytes32 = "0x" + "0".repeat(24) + state.account.slice(2);

		const tokenDecimals = token === "USDC" ? 6 : 18;
		const amountLD = ethers.parseUnits(amount, tokenDecimals);

		const sendParam = {
			dstEid: dstEid,
			to: toBytes32,
			amountLD: amountLD,
			minAmountLD: amountLD,
			extraOptions: "0x",
			composeMsg: "0x",
			oftCmd: "0x"
		};

		const fee = await contract.quoteSend(sendParam, false);

		const tx = await contract.send(
			sendParam,
			{ nativeFee: fee.nativeFee, lzTokenFee: 0n },
			state.account,
			{ value: fee.nativeFee }
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

	btn.disabled = false;
	updateBridgeBtn();
}

function updateBridgeBtn() {
	const btn = el("bridge-btn");
	const account = state.account;
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;
	const amount = el("amount").value.trim();
	const token = getSelectedToken();

	if (!account) { btn.textContent = "Connect Wallet"; btn.disabled = true; return; }
	if (fromKey === toKey) { btn.textContent = "Same chain selected"; btn.disabled = true; return; }

	const mode = getRouteMode(fromKey, toKey, token);
	if (!mode) {
		btn.textContent = `No ${token} route ${CONFIG.chains[fromKey].shortName} → ${CONFIG.chains[toKey].shortName}`;
		btn.disabled = true;
		return;
	}
	if (token === "USDC") {
		const usdcAddr = CONFIG.tokens.USDC.addresses[fromKey];
		const adapterDeployed = CONFIG.bridgeAdapter.deployments[fromKey] !== null;
		const usdcValid = usdcAddr && usdcAddr !== "0x0000000000000000000000000000000000000000";
		// CCTP burns native USDC directly — no adapter contract involved
		if ((mode === "oft" && !adapterDeployed) || !usdcValid) {
			btn.textContent = "USDC adapter not deployed on " + CONFIG.chains[fromKey].shortName;
			btn.disabled = true;
			return;
		}
	} else {
		const bridgeDeployed = CONFIG.bridgeToken.deployments[fromKey] !== null;
		if (!bridgeDeployed) {
			btn.textContent = "Bridge not deployed on " + CONFIG.chains[fromKey].shortName;
			btn.disabled = true;
			return;
		}
	}

	if (!amount || Number(amount) <= 0) { btn.textContent = "Enter amount"; btn.disabled = true; return; }

	btn.textContent = `Bridge ${amount} to ${CONFIG.chains[toKey].shortName}${mode === "cctp" ? " (CCTP)" : ""}`;
	btn.disabled = false;
}

function isTestnetChain(chainKey) {
	const chain = CONFIG.chains[chainKey];
	return chain.chainId === 5042002;
}

function getFilteredChains() {
	// Chain with null chainId = launch-day placeholder (arcMainnet) — never render.
	return Object.keys(CONFIG.chains).filter(k => {
		const c = CONFIG.chains[k];
		if (c.chainId == null) return false;
		return state.testnetMode ? isTestnetChain(k) : !isTestnetChain(k);
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
		from.value = keys[0];
		to.value = keys.length > 1 ? keys[1] : keys[0];
	}
}

function onChainChange() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;

	if (fromKey === toKey) {
		// Auto-fix picks ONLY from the rendered option set: Object.keys(CONFIG.chains)
		// could assign a value with no matching <option> (e.g. Robinhood selected when
		// the testnet toggle flips), leaving the select empty and crashing downstream.
		const keys = getFilteredChains();
		const idx = keys.indexOf(fromKey);
		const base = idx === -1 ? 0 : idx; // selection vanished from the filtered set: snap from the top
		const next = keys[(base + 1) % keys.length];
		el("to-chain").value = next !== fromKey ? next : keys[(base + 2) % keys.length];
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
	img.src = meta.icon || "https://icons-ckg.pages.dev/lz-scan/protocols/usd-coin.svg";
	sym.textContent = meta.symbol;
	if (state.account) loadBalances();
	estimateGas();
	updateBridgeBtn();
}

function setMax() {
	const bal = el("from-balance").textContent;
	if (bal && bal !== "0.00" && bal !== "N/A") {
		el("amount").value = bal;
		updateBridgeBtn();
		estimateGas();
	}
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
		window.ethereum.on("chainChanged", (chainId) => {
			state.chainId = Number(chainId);
			onAccountChange();
		});
	}

	el("from-chain").addEventListener("change", onChainChange);
	el("to-chain").addEventListener("change", onChainChange);
	el("token-select").addEventListener("change", onTokenChange);
	el("amount").addEventListener("input", onAmountChange);

	const toggle = el("network-mode-toggle");
	if (toggle) {
		toggle.addEventListener("change", () => {
			state.testnetMode = toggle.checked;
			populateChainSelects();
			onChainChange();
		});
	}

	populateChainSelects();
	onTokenChange();
	updateContractInfo();
	updateBridgeBtn();
});
