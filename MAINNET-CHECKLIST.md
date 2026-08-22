# WarpArc — Arc Mainnet Launch Checklist

**Target date: September 16, 2026** (official:
https://community.arc.io/public/blogs/arc-public-mainnet-launches-september-16-2026-2026-08-06)

Purpose: turn this repo from Testnet-only to dual-network (Testnet + Public
Mainnet) on launch day without guessing any value. Every value below marked
`?TBD?` MUST come from an official source before use — never carry over testnet
values by assumption.

---

## Phase 0 — Pre-launch monitoring (now → Sep 15)

Re-check these sources every few days. Circle said launch partners, ecosystem
apps, and developer tooling will be announced *ahead* of mainnet:

- [ ] https://docs.arc.io/llms.txt — new pages appearing (look for "mainnet")
- [ ] https://docs.arc.io/arc/references/connect-to-arc — mainnet RPC section added?
- [ ] https://docs.arc.io/arc/references/contract-addresses — "Mainnet addresses" section added?
- [ ] https://docs.arc.io/integrate/infrastructure/bridges — mainnet CCTP domain published?
- [ ] https://docs.arc.io/app-kit/references/supported-blockchains — Arc moved/added to MAINNET table?
- [ ] Circle X account (@circle) + community.arc.io announcements
- [ ] Robinhood Chain: does it appear in Circle's CCTP domain list or App Kit tables?
      If YES → record its CCTP domain `?TBD?` and App Kit identifier `?TBD?`
- [ ] Note any change to fee parameters ("may be adjusted before mainnet launch")

---

## Phase 1 — Launch day: collect official values

Fill this table ONLY from docs.arc.io / official Circle channels:

| Value | Testnet (current) | Mainnet (fill on launch day) |
|-------|-------------------|------------------------------|
| Chain ID | `5042002` | `?TBD?` |
| RPC HTTPS | `https://rpc.testnet.arc.io` | `?TBD?` |
| RPC WSS | `wss://rpc.testnet.arc.io` | `?TBD?` |
| Explorer | `https://testnet.arcscan.app` | `?TBD?` |
| Funding source | faucet.circle.com | real USDC — source/exchange `?TBD?` |
| CCTP domain | `26` | `?TBD?` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | `?TBD?` |
| TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | `?TBD?` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | `?TBD?` |
| TokenMinterV2 | `0xb43db544E2c27092c107639Ad201b3dEfAbcF192` | `?TBD?` |
| MessageV2 | `0xbaC0179bB358A8936169a63408C8481D582390C4` | `?TBD?` |
| GatewayWallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | `?TBD?` |
| GatewayMinter | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` | `?TBD?` |
| Min base fee | 20 Gwei (testnet floor) | `?TBD?` (verify!) |
| App Kit identifier | `Arc_Testnet` | `?TBD?` (check BridgeChain enum) |

Verify RPC liveness immediately (expect hex of the new chain ID):

```bash
curl -s -X POST <MAINNET_RPC> -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

Also verify gas floor once funded:

```bash
cast block latest --rpc-url <MAINNET_RPC>   # check baseFeePerGas vs docs
```

---

## Phase 2 — Config update

Add mainnet as a NEW entry alongside testnet (do not overwrite testnet):

**frontend/js/config.js**
- [x] New `chains.arcMainnet` skeleton exists (structure done 2026-08-22) — values
      stay `null`/`disabled: true` until filled from Phase 1; removing `disabled`
      and filling `cctp{}` flips it live
- [x] `tokens.USDC.addresses.arcMainnet` slot exists (null until Phase 1)
- [x] `chains.arc` (testnet) kept intact for regression testing

**hardhat.config.js**
- [x] Network entry `arcMainnet` exists, gated on `ARC_MAINNET_RPC` +
      `ARC_MAINNET_CHAIN_ID` env vars (activates without code changes on launch day)
- [ ] `gasPrice`: set ≥ mainnet min base fee + margin (testnet used 30 Gwei vs 20
      floor) — intentionally UNSET until the official mainnet floor is known

**.env.example**
- [x] `ARC_MAINNET_RPC` / `ARC_MAINNET_CHAIN_ID` placeholders added

**Frontend wallet config**
- [x] Wallet add-network fields derive from `chains.*` config (mainnet works once
      the skeleton is filled)
- [x] "Testnet mode" toggle exists and is the DEFAULT (flips default on go-live)

---

## Phase 3 — Deploy & verify

Order (small first):

1. [ ] Fund deployer wallet with REAL USDC on Arc mainnet (gas token). Amount:
       cover N deployments × ~$0.01–0.05 each + buffer. Never send ETH.
2. [ ] Path A (App Kit): no contracts needed — skip to Phase 4 after upgrading
       `@circle-fin/app-kit` to the version supporting Arc mainnet (`npm outdated @circle-fin/app-kit`)
3. [ ] Path B custom adapters (if used): deploy to destination chains only;
       nothing custom required ON Arc itself
4. [ ] Verify every deployed contract on the mainnet explorer (Blockscout verifier):
       ```bash
       forge verify-contract $ADDR src/X.sol:X --chain-id <MAINNET_CHAIN_ID> \
         --verifier blockscout --verifier-url <MAINNET_EXPLORER>/api/
       ```

---

## Phase 4 — End-to-end testing (real funds, small amounts)

- [ ] Upgrade path: Base mainnet USDC → Arc mainnet (1–10 USDC). Confirm mint on ArcScan
- [ ] Downgrade path: Arc mainnet USDC → Base mainnet. Confirm receipt
- [ ] Ethereum mainnet round-trip (1 USDC) — highest-fee route, do last
- [ ] Confirm finality behavior: destination usable after 1 Arc block (< 1 s)
- [ ] Indexer sanity: exactly one system-emitter Transfer log per native movement
      (emitter `?TBD?` — likely same as testnet's `0xffff…fffe`, CONFIRM in docs)
- [ ] Failure drill: send-to-zero guard, insufficient-USDC-gas case, wrong-chain tx
- [ ] Record all tx hashes here for audit trail:
      | Route | Amount | TX hash | Result |

ABORT criteria — stop and investigate if ANY occur:
- Destination mint delayed > 30 min without attestation error message
- Explorer shows conflicting state vs SDK result
- Any value mismatch > dust between sent and received amounts

---

## Phase 5 — Frontend go-live

- [ ] `vercel.json` / env vars updated for production network
- [ ] Chain selector defaults: Arc mainnet ⇄ {Ethereum, Base, Arbitrum, Optimism}
      (add chains ONLY after confirming their mainnet CCTP support in App Kit tables)
- [ ] Token list: USDC only (CCTP scope). No USDT claims in UI
- [ ] Fee display: show USDC-denominated gas estimate (~$0.01/tx target)
- [ ] Footer/status link to https://status.circle.com or equivalent incident page
- [ ] Deploy to Vercel production, smoke-test from clean browser profile

---

## Phase 6 — Post-launch watch (first 72 h)

- [ ] Monitor ArcScan gas tracker: base fee stability vs 20 Gwei assumption
- [ ] Watch Circle status pages + community.arc.io for hotfix announcements
- [ ] Re-check App Kit changelog (`npm view @circle-fin/app-kit versions`) daily for first week
- [ ] Re-check Robinhood Chain CCTP inclusion weekly — add when confirmed
- [ ] Keep testnet pipeline alive as staging environment

---

## Standing rules (sources: docs.arc.io — bridges, evm-differences, gas-and-fees; still apply on mainnet)

- USDC is gas. ETH has no function on Arc.
- No wrapped USDC variants, ever — CCTP burn-and-mint only.
- Native transfers can revert despite balance (zero-address, blocklist, burn rules).
- 18 dec native vs 6 dec ERC-20 — never mix raw values.
- maxFeePerGas ≥ min base fee; priority tip 0 OK; no blob (type-3) transactions.
- PREVRANDAO = 0; no randomness from it.
