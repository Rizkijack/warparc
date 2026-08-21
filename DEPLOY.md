# WarpArc — Deployment Guide

**WarpArc** is a **website** — a cross-chain bridge for stablecoins (USDC, USDT)
that moves value **from ARC mainnet across all EVM networks**: Ethereum, Base,
Arbitrum, Optimism, Robinhood Chain, and other EVM chains.

**Stack (current): Circle CCTP V2 + Circle App Kit**, replacing the original
LayerZero V2 OFT design. Reason: Arc's official documentation mandates CCTP
burn-and-mint as the *canonical* USDC route to/from Arc and **prohibits wrapped
USDC variants** (`wUSDC`, `USDC.e`, lock-and-mint OFTs) on Arc — they fragment
liquidity. See [Bridges](https://docs.arc.io/integrate/infrastructure/bridges)
and [Contract addresses](https://docs.arc.io/arc/references/contract-addresses).

> ⚠️ **Status of this repo**
> - The legacy LayerZero contracts (`BridgeToken.sol`, `BridgeAdapter.sol`)
>   still compile but are **DEPRECATED** (Appendix A). New work targets CCTP/App Kit.
> - Nothing is deployed live yet. Deployment requires a funded `PRIVATE_KEY`.
> - Per official docs, **Arc is on Testnet** (chain ID `5042002`). Mainnet
>   addresses are not yet published. The old unofficial endpoint
>   (`https://5042.rpc.thirdweb.com`, chain ID 5042) is stale — do not use it.

### Mainnet timeline (official)
Arc is currently in **private mainnet** (100+ institutional builders). Public
mainnet launches **September 16, 2026** — source:
[Arc House announcement](https://community.arc.io/public/blogs/arc-public-mainnet-launches-september-16-2026-2026-08-06).
Until then, everything in this repo targets **Arc Testnet**. On launch day:
watch for the mainnet chain ID, mainnet RPC, mainnet contract addresses
(https://docs.arc.io/arc/references/contract-addresses), and confirm the mainnet
CCTP domain — do not assume testnet values carry over.

> **Launch-day runbook: see [MAINNET-CHECKLIST.md](./MAINNET-CHECKLIST.md).**

Official doc sources (all read & verified):
- https://docs.arc.io/llms.txt (index)
- https://docs.arc.io/arc-chain.md (network overview)
- https://docs.arc.io/arc/references/connect-to-arc.md (RPC/wallet)
- https://docs.arc.io/arc/references/contract-addresses.md (addresses)
- https://docs.arc.io/arc/references/gas-and-fees.md (fees)
- https://docs.arc.io/arc/references/evm-differences.md (protocol divergences)
- https://docs.arc.io/integrate/infrastructure/bridges.md (bridge integration)
- https://docs.arc.io/app-kit/bridge.md + /app-kit/unified-balance.md (SDK)

---

## 1. Arc network facts (Testnet, from official docs)

| Property | Value |
|----------|-------|
| Chain ID | `5042002` |
| RPC (HTTPS) | `https://rpc.testnet.arc.io` |
| RPC alternates | `https://rpc.blockdaemon.testnet.arc.io`, `https://rpc.drpc.testnet.arc.io`, `https://rpc.quicknode.testnet.arc.io` |
| WebSocket | `wss://rpc.testnet.arc.io` |
| Explorer | `https://testnet.arcscan.app` (Blockscout — supports source verification) |
| Faucet | `https://faucet.circle.com` (testnet USDC/EURC) |
| Native gas token | **USDC** (no ETH on Arc — ETH has no function there) |
| Native decimals | 18 (native) / ERC-20 interface = 6 (same underlying balance!) |
| Consensus | Malachite BFT (Tendermint), permissioned PoA |
| Execution | Reth, EVM **Osaka** hard fork baseline |
| Finality | Deterministic, < 1 s. Required confirmations: **1**. No reorgs. |
| Block time | ~0.48 s |
| CCTP domain | **26** |

### USDC on Arc — critical model
- Native USDC and ERC-20 USDC are **the same asset**: native view = 18 decimals,
  ERC-20 interface (at `0x3600000000000000000000000000000000000000`) = 6 decimals.
- `balanceOf()` truncates below 1e-6 — a zero ERC-20 balance does NOT mean zero native balance.
- **Never deploy wrapped USDC on Arc.** Route all USDC through CCTP (burn-and-mint).
- Native transfers can revert even with sufficient balance: zero-address sends,
  runtime blocklist, forbidden burns. Handle reverts in every value-forwarding path.

---

## 2. Architecture — two implementation paths

### Path A — Circle App Kit (recommended, no custom bridge contracts)
App Kit wraps the entire CCTP flow (burn → attestation → mint) behind one call.

```bash
npm install @circle-fin/app-kit @circle-fin/adapter-viem-v2 viem
# standalone kits instead: @circle-fin/bridge-kit, @circle-fin/unified-balance-kit
```

```ts
import { AppKit } from "@circle-fin/app-kit";

const kit = new AppKit();

// USDC from an EVM chain into Arc Testnet (and back):
const result = await kit.bridge({
  from: { adapter: viemAdapter, chain: "Base_Sepolia" },
  to:   { adapter: viemAdapter, chain: "Arc_Testnet" },
  amount: "1.00",
});

// Unified Balance (Circle Gateway): pool USDC from many chains,
// spend instantly anywhere — e.g. deposit from Base, spend on Arc:
await kit.unifiedBalance.deposit({ from: { adapter: viemAdapter, chain: "Base_Sepolia" }, amount: "1.00", token: "USDC" });
await kit.unifiedBalance.spend({ amountIn: "0.50", from: { adapter: viemAdapter },
  to: { adapter: viemAdapter, chain: "Arc_Testnet", recipientAddress: "0x..." } });
```

Notes:
- Bridge and Unified Balance are **USDC only**. Swap on Arc Testnet supports USDC/EURC/cirBTC.
- Chain identifiers are case-sensitive (`Arc_Testnet`, `Optimism` for OP Mainnet — see
  [supported blockchains](https://docs.arc.io/app-kit/references/supported-blockchains)).
- No `setPeer`, no OFT deployments, no messaging fees to wire up.

### Path B — Direct CCTP V2 contracts (custom flows / backend relayers)
Flow: `TokenMessengerV2.depositForBurn()` on source chain → fetch attestation from
Circle API → `MessageTransmitterV2.receiveMessage()` on destination chain.

Arc-side contracts (Testnet):

| Contract | Address |
|----------|---------|
| USDC (ERC-20 interface) | `0x3600000000000000000000000000000000000000` |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| TokenMinterV2 | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` |
| MessageV2 | `0xbaC0179bB358A8936169a63408C8481D582390C4` |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |

Other chains: use each chain's canonical TokenMessengerV2 / MessageTransmitterV2
from https://developers.circle.com/cctp — well-known CCTP domains: Ethereum `0`,
Optimism `2`, Arbitrum `3`, Base `6`, Arc `26`. Verify against Circle's table
before shipping; Robinhood Chain is not in Circle's published domain list — treat as unsupported until confirmed.

Utility contracts available on Arc (standard addresses):
Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`,
Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`,
CREATE2 factory `0x4e59b44847b379578588920cA78FbF26c0B4956C`.

---

## 3. Environment

```bash
cp .env.example .env
```

`.env`:
```
PRIVATE_KEY=0xyour_deployer_private_key
# Optional per-chain RPC overrides (defaults in hardhat.config.js)
ETHEREUM_RPC=https://rpc.ankr.com/eth
BASE_RPC=https://mainnet.base.org
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC=https://mainnet.optimism.io
ROBINHOOD_RPC=https://rpc.mainnet.chain.robinhood.com
ARC_RPC=https://rpc.testnet.arc.io
```

> `cloudflare-eth.com` returns `-32046` (down). Use Ankr for Ethereum.

Fund the deployer/relayer with **USDC from https://faucet.circle.com**
(select Arc Testnet). Never send ETH to Arc wallets — it does nothing.

### Gas rules on Arc (enforced)
- Minimum base fee (testnet): **20 Gwei**. Transactions priced below are rejected
  (`transaction underpriced`). Set `maxFeePerGas >= 20 Gwei`.
- `maxPriorityFeePerGas = 0` is accepted; tip 1 Gwei only during congestion.
- Target cost ≈ $0.01/tx; ceiling 20,000 Gwei; EWMA-smoothed (stable pricing).
- Blob transactions (EIP-4844, type 3) are **rejected by the mempool** — send type-2.

---

## 4. Build & verify

Legacy contracts (Appendix A) still compile:

```bash
npx hardhat compile          # Solidity 0.8.24, evmVersion paris
```

New Path A/B code lives in the frontend/backend SDK usage above; nothing to compile.
When deploying any custom Solidity to Arc, verify on the explorer:

```bash
forge verify-contract $ADDR src/MyContract.sol:MyContract \
  --chain-id 5042002 --verifier blockscout --verifier-url https://testnet.arcscan.app/api/
```

Local ABI validation (legacy harness, unchanged):

```bash
npx hardhat node                                            # terminal 1
npx hardhat run scripts/local-test.js --network localhost    # terminal 2
```

---

## 5. Porting checklist for anything deployed ON Arc

From https://docs.arc.io/arc/tutorials/porting-contracts-to-arc :

- [ ] No comparison of raw `balanceOf` (6 dec) vs `address.balance` (18 dec) without conversion
- [ ] Every native-send path handles revert (zero address, blocklist, burn rules)
- [ ] No sweep of native balance unless intended — native USDC == ERC-20 USDC
- [ ] No liquidity pool pairing "native" against ERC-20 USDC (same asset)
- [ ] `PREVRANDAO` always returns 0 — use oracle/VRF for randomness
- [ ] SELFDESTRUCT: moves contract's USDC to beneficiary; calls into destructed accounts with value revert
- [ ] Tested against a live Arc RPC (anvil cannot reproduce Arc precompiles/blocklist)

---

## 6. Wire the frontend

Update `js/config.js` (already applied in this repo):

```js
arc: {
  chainId: 5042002,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.io",
  explorer: "https://testnet.arcscan.app",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 } // native view
}
// tokens.USDC.addresses.arc = "0x3600000000000000000000000000000000000000" (ERC-20 iface, 6 dec)
```

Wallet add-network fields (MetaMask/Rabby/Coinbase/Rainbow):
name `Arc Testnet`, RPC `https://rpc.testnet.arc.io`, chain ID `5042002`,
symbol `USDC`, explorer `https://testnet.arcscan.app`.

Frontend bridge calls migrate from OFT `quoteSend`/`send` to App Kit `kit.bridge()`
(or direct CCTP V2 in Path B). The old single-arg ABI forms must NOT be reused.

### Event indexing (backend/listener)
Every USDC movement emits TWO Transfer logs: the ERC-20 contract's own (6 dec,
from `0x3600…`) and the EIP-7708 system emitter (18 dec, from
`0xfffffffffffffffffffffffffffffffffffffffe`). Match on emitter address to avoid
double counting. One block confirmation is enough — finality is deterministic.

---

## 7. Deployment order (recommended)

1. Fund wallets (USDC via faucet) on Arc Testnet + each destination chain used.
2. Ship Path A end-to-end on testnets (Base Sepolia ⇄ Arc Testnet) with App Kit.
3. If custom logic needed, deploy adapter contracts to destination chains (Path B),
   pointing at canonical CCTP addresses; nothing custom required on Arc itself.
4. Verify all deployed contracts (Blockscout verifier command above).
5. Fill `js/config.js` deployments, smoke-test small amounts both directions,
   then scale.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `transaction underpriced` | `maxFeePerGas` < 20 Gwei floor | Set ≥ 20 Gwei (repo hardhat config pins 30 Gwei on `arc`) |
| `insufficient funds for gas * price + value` | USDC balance can't cover value+gas | Top up USDC (gas token) via faucet |
| Mempool rejects type-3 tx | EIP-4844 blobs unsupported | Send EIP-1559 (type-2) transactions |
| `"Zero address not allowed"` | Value transfer to `0x0` | Guard recipients; mint/burn only via precompile paths |
| Randomness always same | `PREVRANDAO` = 0 on Arc | Oracle/VRF instead |
| `cloudflare-eth.com` errors `-32046` | Endpoint down | `https://rpc.ankr.com/eth` |
| Arc RPC timeout on old URL | `5042.rpc.thirdweb.com` stale/unofficial | `https://rpc.testnet.arc.io` |
| Double-counted balances in indexer | Dual emitters (6 vs 18 dec logs) | Filter by emitter address |
| `Expected valid bigint` (legacy local tests) | Placeholder `PRIVATE_KEY` | Real Hardhat test key |
| `Ownable()` constructor error (legacy) | Mixed OZ v4/v5 | Keep OZ `^4.9.0` + ethers `^5.7` for Appendix A builds |

---

## Appendix A — Legacy LayerZero OFT path (DEPRECATED)

Kept for reference. Superseded by CCTP/App Kit because Arc prohibits wrapped-USDC
OFT designs. Contracts still compile; do not deploy to production.

```bash
npx hardhat run scripts/deploy.js --network ethereum     # ...then configure peers
npx hardhat run scripts/configure.js --network ethereum  # setPeer wiring
```

Peers/DVN/executor tables in `js/config.js` under `chains.*.layerZero` remain as
historical data only.
