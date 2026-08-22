// WarpArc Path A — Circle App Kit reference app (testnet-only).
// Bridge tab:  appKit.bridge()          — full CCTP lifecycle in one call
// Unified tab: appKit.unifiedBalance.*  — Gateway deposit / spend / getBalances
// Patterns follow Circle's official adapter guides (browser wallet via
// createViemAdapterFromProvider; switch to the SOURCE chain before signing;
// useForwarder so the user never needs gas on the destination chain).
import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain, useConnect, useDisconnect } from "wagmi";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { AppKit } from "@circle-fin/app-kit";
import { supportedChains, CHAIN_ID_TO_KIT_NAME } from "./wagmi";

const appKit = new AppKit();

const styles = {
	page: { fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto", padding: 24, color: "#e6e8ef", background: "#0d1017", minHeight: "100vh" },
	card: { border: "1px solid #2a2f3a", borderRadius: 12, padding: 20, marginBottom: 16, background: "#141822" },
	row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "8px 0" },
	label: { fontSize: 12, color: "#8b93a7", minWidth: 110 },
	select: { background: "#1c212d", color: "#e6e8ef", border: "1px solid #2a2f3a", borderRadius: 8, padding: 8, flex: 1, minWidth: 160 },
	input: { background: "#1c212d", color: "#e6e8ef", border: "1px solid #2a2f3a", borderRadius: 8, padding: 8, flex: 1, minWidth: 120 },
	button: { background: "#9b6ef0", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" },
	buttonGhost: { background: "#1c212d", color: "#e6e8ef", border: "1px solid #2a2f3a", borderRadius: 8, padding: "10px 18px", cursor: "pointer" },
	status: { fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#10131b", borderRadius: 8, padding: 12, marginTop: 12, color: "#9fb0c8" },
	tab: { display: "flex", gap: 8, marginBottom: 16 },
	tabBtn: (active) => ({ background: active ? "#9b6ef0" : "#1c212d", color: active ? "#fff" : "#8b93a7", border: "1px solid #2a2f3a", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600 })
};

const chainOptions = supportedChains.map(c => ({ id: c.id, name: c.name }));

function ChainSelect({ value, onChange, exclude }) {
	return (
		<select style={styles.select} value={value} onChange={e => onChange(Number(e.target.value))}>
			{chainOptions.filter(c => c.id !== exclude).map(c => (
				<option key={c.id} value={c.id}>{c.name}</option>
			))}
		</select>
	);
}

function useKitAdapter() {
	const { connector } = useAccount();
	const chainId = useChainId();
	const { switchChainAsync } = useSwitchChain();

	// Switch to the chain that must SIGN, then build a viem adapter from the
	// browser provider (createViemAdapterFromProvider is async — always await).
	const getAdapter = async (requiredChainId) => {
		if (!connector) throw new Error("Wallet not connected");
		if (chainId !== requiredChainId) {
			await switchChainAsync({ chainId: requiredChainId });
		}
		const provider = await connector.getProvider();
		return await createViemAdapterFromProvider({ provider });
	};
	return { getAdapter, connected: !!connector };
}

function BridgeTab() {
	const [fromId, setFromId] = useState(chainOptions[1].id); // Ethereum Sepolia
	const [toId, setToId] = useState(chainOptions[0].id);     // Arc Testnet
	const [amount, setAmount] = useState("1.00");
	const [status, setStatus] = useState("");
	const [busy, setBusy] = useState(false);
	const { getAdapter, connected } = useKitAdapter();

	const handleBridge = async () => {
		setBusy(true);
		setStatus("Bridging via App Kit…");
		try {
			const adapter = await getAdapter(fromId);
			const result = await appKit.bridge({
				from: { adapter, chain: CHAIN_ID_TO_KIT_NAME[fromId] },
				to: { adapter, chain: CHAIN_ID_TO_KIT_NAME[toId] },
				amount
			});
			setStatus("SUCCESS\n" + JSON.stringify(result, null, 2));
		} catch (e) {
			setStatus("FAILED: " + (e.message || String(e)));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div style={styles.card}>
			<h3>Bridge USDC (CCTP V2 via App Kit)</h3>
			<div style={styles.row}>
				<span style={styles.label}>From</span>
				<ChainSelect value={fromId} onChange={setFromId} exclude={toId} />
			</div>
			<div style={styles.row}>
				<span style={styles.label}>To</span>
				<ChainSelect value={toId} onChange={setToId} exclude={fromId} />
			</div>
			<div style={styles.row}>
				<span style={styles.label}>Amount (USDC)</span>
				<input style={styles.input} value={amount} onChange={e => setAmount(e.target.value)} />
			</div>
			<div style={styles.row}>
				<button style={styles.button} disabled={!connected || busy} onClick={handleBridge}>
					{busy ? "Working…" : "Bridge"}
				</button>
			</div>
			{status && <pre style={styles.status}>{status}</pre>}
		</div>
	);
}

function UnifiedTab() {
	const { address } = useAccount();
	const [depositChain, setDepositChain] = useState(chainOptions[1].id);
	const [spendFrom, setSpendFrom] = useState(chainOptions[1].id);
	const [spendTo, setSpendTo] = useState(chainOptions[0].id);
	const [amount, setAmount] = useState("1.00");
	const [recipient, setRecipient] = useState("");
	const [status, setStatus] = useState("");
	const [busy, setBusy] = useState(false);
	const { getAdapter, connected } = useKitAdapter();
	const { connector } = useAccount();

	const handleDeposit = async () => {
		setBusy(true);
		setStatus("Depositing into unified balance…");
		try {
			const adapter = await getAdapter(depositChain);
			const result = await appKit.unifiedBalance.deposit({
				from: { adapter, chain: CHAIN_ID_TO_KIT_NAME[depositChain] },
				amount
			});
			setStatus("SUCCESS\n" + JSON.stringify(result, null, 2));
		} catch (e) {
			setStatus("FAILED: " + (e.message || String(e)));
		} finally {
			setBusy(false);
		}
	};

	const handleSpend = async () => {
		if (!recipient) { setStatus("Enter a recipient address"); return; }
		setBusy(true);
		setStatus("Spending from unified balance (Forwarding Service)…");
		try {
			const adapter = await getAdapter(spendFrom);
			const result = await appKit.unifiedBalance.spend({
				from: { adapter, allocations: { amount, chain: CHAIN_ID_TO_KIT_NAME[spendFrom] } },
				to: { chain: CHAIN_ID_TO_KIT_NAME[spendTo], recipientAddress: recipient, useForwarder: true },
				amount
			});
			setStatus("SUCCESS\n" + JSON.stringify(result, null, 2));
		} catch (e) {
			setStatus("FAILED: " + (e.message || String(e)));
		} finally {
			setBusy(false);
		}
	};

	const handleBalances = async () => {
		setBusy(true);
		setStatus("Fetching unified balances…");
		try {
			const provider = await connector.getProvider();
			const adapter = await createViemAdapterFromProvider({ provider });
			const balances = await appKit.unifiedBalance.getBalances({
				sources: { adapter },
				networkType: "testnet"
			});
			setStatus("SUCCESS\n" + JSON.stringify(balances, null, 2));
		} catch (e) {
			setStatus("FAILED: " + (e.message || String(e)));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div style={styles.card}>
			<h3>Unified Balance (Circle Gateway)</h3>

			<div style={styles.row}>
				<span style={styles.label}>Deposit from</span>
				<ChainSelect value={depositChain} onChange={setDepositChain} />
				<input style={styles.input} value={amount} onChange={e => setAmount(e.target.value)} />
				<button style={styles.buttonGhost} disabled={!connected || busy} onClick={handleDeposit}>Deposit</button>
			</div>

			<div style={styles.row}>
				<span style={styles.label}>Spend from</span>
				<ChainSelect value={spendFrom} onChange={setSpendFrom} exclude={spendTo} />
				<span style={styles.label}>to</span>
				<ChainSelect value={spendTo} onChange={setSpendTo} exclude={spendFrom} />
			</div>
			<div style={styles.row}>
				<span style={styles.label}>Recipient</span>
				<input style={styles.input} placeholder={address || "0x…"} value={recipient} onChange={e => setRecipient(e.target.value)} />
				<button style={styles.buttonGhost} disabled={!connected || busy} onClick={handleSpend}>Spend (forward)</button>
			</div>

			<div style={styles.row}>
				<button style={styles.button} disabled={!connected || busy} onClick={handleBalances}>Get balances</button>
			</div>
			{status && <pre style={styles.status}>{status}</pre>}
		</div>
	);
}

export default function App() {
	const { address, chainId } = useAccount();
	const { connect, connectors } = useConnect();
	const { disconnect } = useDisconnect();
	const [tab, setTab] = useState("bridge");
	const chainName = useMemo(() => supportedChains.find(c => c.id === chainId)?.name || `chain ${chainId}`, [chainId]);

	return (
		<div style={styles.page}>
			<h2>WarpArc · App Kit <small style={{ color: "#8b93a7" }}>(Path A — testnet only)</small></h2>

			<div style={styles.card}>
				<div style={styles.row}>
					{address ? (
						<>
							<span>{address.slice(0, 6)}…{address.slice(-4)} on {chainName}</span>
							<button style={styles.buttonGhost} onClick={() => disconnect()}>Disconnect</button>
						</>
					) : (
						connectors.map(c => (
							<button key={c.uid} style={styles.button} onClick={() => connect({ connector: c })}>
								Connect {c.name}
							</button>
						))
					)}
				</div>
			</div>

			<div style={styles.tab}>
				<button style={styles.tabBtn(tab === "bridge")} onClick={() => setTab("bridge")}>Bridge</button>
				<button style={styles.tabBtn(tab === "unified")} onClick={() => setTab("unified")}>Unified Balance</button>
			</div>

			{tab === "bridge" ? <BridgeTab /> : <UnifiedTab />}
		</div>
	);
}
