// WarpArc Path A — Circle App Kit reference app (testnet-only).
// Bridge tab:  appKit.bridge()          — full CCTP lifecycle in one call
// Unified tab: appKit.unifiedBalance.*  — Gateway deposit / spend / getBalances
// Patterns follow Circle's official adapter guides (browser wallet via
// createViemAdapterFromProvider; switch to the SOURCE chain before signing;
// useForwarder so the user never needs gas on the destination chain — for
// Unified-Balance spends; kit.bridge submits the destination mint itself).
//
// NOTE: kit.bridge() does NOT throw for step failures — it resolves with
// BridgeResult.state 'pending' | 'success' | 'error'. The UI must branch on
// result.state and offer appKit.retryBridge() for recovery.
import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain, useConnect, useDisconnect } from "wagmi";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { AppKit } from "@circle-fin/app-kit";
import { supportedChains, CHAIN_ID_TO_KIT_NAME } from "./wagmi";

const appKit = new AppKit();

// Same shape the SDK validates internally (numeric string, > 0, ≤ 6 decimals).
const AMOUNT_RE = /^\d+(?:\.\d{1,6})?$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const styles = {
	page: { fontFamily: "'SF Pro Display', 'Helvetica Neue', 'Segoe UI', system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: "32px 24px 56px", color: "#2F3437", background: "#F7F6F3", minHeight: "100vh", lineHeight: 1.6 },
	card: { border: "1px solid #EAEAEA", borderRadius: 10, padding: 20, marginBottom: 16, background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
	row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "8px 0" },
	label: { fontSize: 12, color: "#787774", minWidth: 120, flexShrink: 0 },
	select: { background: "#F9F9F8", color: "#2F3437", border: "1px solid #EAEAEA", borderRadius: 6, padding: "8px 10px", flex: 1, minWidth: 160, fontFamily: "inherit", fontSize: 13 },
	input: { background: "#F9F9F8", color: "#2F3437", border: "1px solid #EAEAEA", borderRadius: 6, padding: "8px 10px", flex: 1, minWidth: 140, fontFamily: "'Geist Mono', 'SF Mono', 'JetBrains Mono', Consolas, monospace", fontSize: 12.5 },
	button: { background: "#1F2324", color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 },
	buttonGhost: { background: "#FFFFFF", color: "#2F3437", border: "1px solid #DCDCD6", borderRadius: 4, padding: "9px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 },
	buttonWarn: { background: "#9F2F2D", color: "#fff", border: "none", borderRadius: 4, padding: "9px 16px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 },
	status: { fontSize: 12.5, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#FBFBFA", border: "1px solid #EAEAEA", borderRadius: 6, padding: 12, marginTop: 12, color: "#2F3437", fontFamily: "'Geist Mono', 'SF Mono', 'JetBrains Mono', Consolas, monospace", lineHeight: 1.55, maxHeight: 320, overflow: "auto" },
	tab: { display: "flex", gap: 8, marginBottom: 16 },
	tabBtn: (active) => ({ background: active ? "#1F2324" : "#FFFFFF", color: active ? "#fff" : "#787774", border: "1px solid " + (active ? "#1F2324" : "#DCDCD6"), borderRadius: 4, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: 13 })
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

	// Switch to the given chain, then build a viem adapter from the browser
	// provider (createViemAdapterFromProvider is async — always await). Each
	// call returns an adapter scoped to that chain; callers that act on TWO
	// chains (bridge/retry) must build one adapter per chain, never reuse one
	// bound to a single chain for both legs.
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

function BridgeTab({ busy, setBusy }) {
	const [fromId, setFromId] = useState(chainOptions[1].id); // Ethereum Sepolia
	const [toId, setToId] = useState(chainOptions[0].id);     // Arc Testnet
	const [amount, setAmount] = useState("1.00");
	const [status, setStatus] = useState("");
	const [lastBridge, setLastBridge] = useState(null);
	const { getAdapter, connected } = useKitAdapter();

	// kit.bridge() resolves (does not throw) with state 'pending'|'success'|
	// 'error'; retryBridge(result, {from, to}) resumes from the failed step.
	const runBridge = async (isRetry) => {
		if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) {
			setStatus("Invalid amount — use a number > 0 with at most 6 decimals");
			return;
		}
		if (isRetry && !lastBridge) return;
		// Fail closed: retryBridge needs a destination-chain adapter, so an
		// unknown/missing endpoint must abort before any wallet interaction.
		if (!CHAIN_ID_TO_KIT_NAME[fromId] || !CHAIN_ID_TO_KIT_NAME[toId]) {
			setStatus("FAILED: unsupported source/destination chain selection");
			return;
		}
		setBusy(true);
		setStatus(isRetry ? "Retrying bridge…" : "Bridging via App Kit…");
		try {
			const adapterFrom = await getAdapter(fromId);
			const result = isRetry
				? await appKit.retryBridge(lastBridge, {
					from: adapterFrom,
					to: await getAdapter(toId)
				})
				: await appKit.bridge({
					from: { adapter: adapterFrom, chain: CHAIN_ID_TO_KIT_NAME[fromId] },
					to: { adapter: adapterFrom, chain: CHAIN_ID_TO_KIT_NAME[toId] },
					amount
				});
			setLastBridge(result);
			const failedSteps = (result.steps || []).filter(s => s.state === "error").map(s => s.name);
			const header = result.state === "success"
				? "SUCCESS"
				: result.state === "pending"
					? "PENDING — transfer still in progress, result below"
					: "FAILED" + (failedSteps.length ? ` at step(s): ${failedSteps.join(", ")}` : "");
			setStatus(header + "\n" + JSON.stringify(result, null, 2));
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
				<button style={styles.button} disabled={!connected || busy} onClick={() => runBridge(false)}>
					Bridge
				</button>
				{lastBridge && lastBridge.state !== "success" && (
					<button style={styles.buttonWarn} disabled={!connected || busy} onClick={() => runBridge(true)}>
						Retry bridge
					</button>
				)}
			</div>
			{status && <pre style={styles.status}>{status}</pre>}
		</div>
	);
}

function UnifiedTab({ busy, setBusy }) {
	const { address } = useAccount();
	const [depositChain, setDepositChain] = useState(chainOptions[1].id);
	const [spendFrom, setSpendFrom] = useState(chainOptions[1].id);
	const [spendTo, setSpendTo] = useState(chainOptions[0].id);
	const [depositAmount, setDepositAmount] = useState("1.00");
	const [spendAmount, setSpendAmount] = useState("1.00");
	const [recipient, setRecipient] = useState("");
	const [status, setStatus] = useState("");
	const { getAdapter, connected } = useKitAdapter();
	const { connector } = useAccount();

	const handleDeposit = async () => {
		if (!AMOUNT_RE.test(depositAmount) || Number(depositAmount) <= 0) {
			setStatus("Invalid amount — use a number > 0 with at most 6 decimals");
			return;
		}
		setBusy(true);
		setStatus("Depositing into unified balance…");
		try {
			const adapter = await getAdapter(depositChain);
			const result = await appKit.unifiedBalance.deposit({
				from: { adapter, chain: CHAIN_ID_TO_KIT_NAME[depositChain] },
				amount: depositAmount
			});
			setStatus("SUCCESS\n" + JSON.stringify(result, null, 2));
		} catch (e) {
			setStatus("FAILED: " + (e.message || String(e)));
		} finally {
			setBusy(false);
		}
	};

	const handleSpend = async () => {
		if (!AMOUNT_RE.test(spendAmount) || Number(spendAmount) <= 0) {
			setStatus("Invalid amount — use a number > 0 with at most 6 decimals");
			return;
		}
		if (!ADDRESS_RE.test(recipient)) {
			setStatus("Invalid recipient address (expected 0x…)");
			return;
		}
		setBusy(true);
		setStatus("Spending from unified balance (Forwarding Service)…");
		try {
			const adapter = await getAdapter(spendFrom);
			const result = await appKit.unifiedBalance.spend({
				from: { adapter, allocations: { amount: spendAmount, chain: CHAIN_ID_TO_KIT_NAME[spendFrom] } },
				to: { chain: CHAIN_ID_TO_KIT_NAME[spendTo], recipientAddress: recipient, useForwarder: true },
				amount: spendAmount
			});
			setStatus("SUCCESS\n" + JSON.stringify(result, null, 2));
		} catch (e) {
			setStatus("FAILED: " + (e.message || String(e)));
		} finally {
			setBusy(false);
		}
	};

	const handleBalances = async () => {
		if (!connector) { setStatus("Wallet not connected"); return; }
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
				<input style={styles.input} value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
				<button style={styles.buttonGhost} disabled={!connected || busy} onClick={handleDeposit}>Deposit</button>
			</div>

			<div style={styles.row}>
				<span style={styles.label}>Spend from</span>
				<ChainSelect value={spendFrom} onChange={setSpendFrom} exclude={spendTo} />
				<span style={styles.label}>to</span>
				<ChainSelect value={spendTo} onChange={setSpendTo} exclude={spendFrom} />
			</div>
			<div style={styles.row}>
				<span style={styles.label}>Spend amount</span>
				<input style={styles.input} value={spendAmount} onChange={e => setSpendAmount(e.target.value)} />
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
	// One global busy flag: a mid-flight SDK operation must not be interleaved
	// with a second one (both drive the same wallet through chain switches).
	const [busy, setBusy] = useState(false);
	const chainName = useMemo(() => supportedChains.find(c => c.id === chainId)?.name || `chain ${chainId}`, [chainId]);

	return (
		<div style={styles.page}>
			<h2 style={{ fontFamily: "'Newsreader', 'Georgia', serif", fontSize: "1.8rem", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.2, color: "#1F2324", margin: "4px 0 16px" }}>
				WarpArc · App Kit <small style={{ color: "#9C9A93", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 400, letterSpacing: 0, whiteSpace: "nowrap" }}>(Path A — testnet only)</small>
			</h2>

			<div style={styles.card}>
				<div style={styles.row}>
					{address ? (
						<>
							<span>{address.slice(0, 6)}…{address.slice(-4)} on {chainName}</span>
							<button style={styles.buttonGhost} disabled={busy} onClick={() => disconnect()}>Disconnect</button>
						</>
					) : (
						connectors.map(c => (
							<button key={c.uid} style={styles.button} disabled={busy} onClick={() => connect({ connector: c })}>
								Connect {c.name}
							</button>
						))
					)}
				</div>
			</div>

			<div style={styles.tab}>
				<button style={styles.tabBtn(tab === "bridge")} disabled={busy} onClick={() => setTab("bridge")}>Bridge</button>
				<button style={styles.tabBtn(tab === "unified")} disabled={busy} onClick={() => setTab("unified")}>Unified Balance</button>
			</div>

			{tab === "bridge" ? <BridgeTab busy={busy} setBusy={setBusy} /> : <UnifiedTab busy={busy} setBusy={setBusy} />}
		</div>
	);
}
