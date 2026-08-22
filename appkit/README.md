# WarpArc · App Kit (Path A)

Reference implementation of the **recommended** integration path from DEPLOY.md §2:
Circle **App Kit** (`@circle-fin/app-kit`) wrapping the full CCTP V2 lifecycle
(`kit.bridge()`) plus **Unified Balance** (Gateway deposit / spend / getBalances)
behind SDK calls — no custom bridge contracts, no manual attestation handling.

- **Testnet only.** Arc public mainnet launches September 16, 2026
  (MAINNET-CHECKLIST.md). Chain identifiers are the case-sensitive SDK names
  (`Arc_Testnet`, `Base_Sepolia`, …).
- Browser-wallet adapter pattern (`createViemAdapterFromProvider`) per Circle's
  official adapter guide: switch the wallet to the **source** chain before
  signing; spends use the Forwarding Service (`useForwarder: true`) so the user
  never needs gas on the destination chain.
- USDC only — bridge and Unified Balance are USDC-scoped by design.

## Run

```bash
cd appkit
npm install
npm run dev        # http://localhost:5174
npm run build      # static bundle in dist/
```

Fund the wallet with testnet USDC at https://faucet.circle.com first
(pick Arc Testnet or the partner testnet you start from).

## Layout

- `src/wagmi.js` — wagmi config (arcTestnet + Sepolia chains from `viem/chains`)
  and the chainId → App Kit identifier map
- `src/App.jsx` — Bridge tab (`appKit.bridge`) and Unified Balance tab
  (`appKit.unifiedBalance.deposit/spend/getBalances`)

The Path B static site (no build step, direct CCTP V2 contracts, manual mint +
Forwarding Service toggle) lives in the repo root — see DEPLOY.md §2.
