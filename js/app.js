const state = {
	provider: null,
	signer: null,
	account: null,
	chainId: null,
	isConnecting: false,
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
	} else {
		btn.textContent = "Connect Wallet";
		btn.className = "btn btn-primary btn-sm";
		badge.style.display = "none";
		bridgeArea.style.display = "none";
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
		} else if (token === "ETH" && CONFIG.chains[fromKey].nativeCurrency.symbol === "ETH") {
			const bal = await state.provider.getBalance(state.account);
			el("from-balance").textContent = formatUnits(bal, 18, 4);
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

	c1.innerHTML = renderContractList(fromChain);
	c2.innerHTML = renderContractList(toChain);

	el("from-chain-name").textContent = fromChain.shortName;
	el("to-chain-name").textContent = toChain.shortName;
	el("from-eid").textContent = fromChain.eid;
	el("to-eid").textContent = toChain.eid;
	el("from-cid").textContent = fromChain.chainId;
	el("to-cid").textContent = toChain.chainId;
}

function renderContractList(chain) {
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

	const contract = getBridgeContract(fromKey, state.signer);
	if (!contract) {
		toast("Bridge token not deployed on " + fromChain.shortName, "error");
		return;
	}

	const amount = el("amount").value.trim();
	if (!amount || Number(amount) <= 0) {
		toast("Enter a valid amount", "error");
		return;
	}

	const token = getSelectedToken();
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

	addTxEntry(txId, `Bridge ${amount} ${token} → ${toChain.shortName}`, "pending");

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

	if (!account) { btn.textContent = "Connect Wallet"; btn.disabled = true; return; }
	if (fromKey === toKey) { btn.textContent = "Same chain selected"; btn.disabled = true; return; }

	const bridgeDeployed = CONFIG.bridgeToken.deployments[fromKey] !== null;
	if (!bridgeDeployed) {
		btn.textContent = "Bridge not deployed on " + CONFIG.chains[fromKey].shortName;
		btn.disabled = true;
		return;
	}

	if (!amount || Number(amount) <= 0) { btn.textContent = "Enter amount"; btn.disabled = true; return; }

	btn.textContent = `Bridge ${amount} to ${CONFIG.chains[toKey].shortName}`;
	btn.disabled = false;
}

function populateChainSelects() {
	const from = el("from-chain");
	const to = el("to-chain");
	const keys = Object.keys(CONFIG.chains);
	keys.forEach(k => {
		const c = CONFIG.chains[k];
		const opt = `<option value="${k}">${c.name}</option>`;
		from.insertAdjacentHTML("beforeend", opt);
		to.insertAdjacentHTML("beforeend", opt);
	});
	from.value = "ethereum";
	to.value = "arc";
}

function onChainChange() {
	const fromKey = el("from-chain").value;
	const toKey = el("to-chain").value;

	if (fromKey === toKey) {
		const keys = Object.keys(CONFIG.chains);
		const idx = keys.indexOf(fromKey);
		const next = keys[(idx + 1) % keys.length];
		el("to-chain").value = next !== fromKey ? next : keys[(idx + 2) % keys.length];
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

	// ABT option already exists in HTML; no need to inject

	el("from-chain").addEventListener("change", onChainChange);
	el("to-chain").addEventListener("change", onChainChange);
	el("token-select").addEventListener("change", onTokenChange);
	el("amount").addEventListener("input", onAmountChange);

	populateChainSelects();
	onTokenChange();
	updateContractInfo();
	updateBridgeBtn();
});
