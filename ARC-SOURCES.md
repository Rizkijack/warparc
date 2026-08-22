# WarpArc — Official Arc Data Sources

Single source of truth for every Arc value used in this repo. All facts in
`DEPLOY.md`, `MAINNET-CHECKLIST.md`, `frontend/js/config.js`, and `hardhat.config.js`
trace back to the URLs below.

**Rule:** never fill an unknown Arc value from memory or assumption — always
re-fetch from these pages. If docs.arc.io is unreachable, mark the value
UNVERIFIED instead of guessing.

---

## Primary documentation

| Resource | URL | What it holds |
|----------|-----|---------------|
| Docs index (AI-friendly) | https://docs.arc.io/llms.txt | Complete page list; check first, re-check before mainnet |
| Landing | https://docs.arc.io/ | Use cases, product suite |
| Network overview | https://docs.arc.io/arc-chain.md | Chain properties table (chain ID, block time, finality) |
| System overview | https://docs.arc.io/arc/concepts/system-overview.md | Two-layer architecture (Malachite + Reth) |
| Consensus layer | https://docs.arc.io/arc/concepts/consensus-layer.md | BFT pipeline, PoA validators |
| Execution layer | https://docs.arc.io/arc/concepts/execution-layer.md | Reth, precompiles 0x1800.. range |
| Stablecoin native model | https://docs.arc.io/arc/concepts/stablecoin-native-model.md | Dual-interface USDC (18 vs 6 decimals) |
| Stable fee design | https://docs.arc.io/arc/concepts/stable-fee-design.md | EWMA fee curve, floor/ceiling rationale |

## Reference pages (values we hardcode)

| Resource | URL | Values sourced from here |
|----------|-----|--------------------------|
| **Connect to Arc** | https://docs.arc.io/arc/references/connect-to-arc.md | RPC `https://rpc.testnet.arc.io`, chain ID `5042002`, WSS endpoints, wallet add-network fields, wagmi/viem config |
| **Contract addresses** | https://docs.arc.io/arc/references/contract-addresses.md | USDC `0x3600…0000`, EURC, TokenMessengerV2, MessageTransmitterV2, GatewayWallet/Minter, Permit2, Multicall3 |
| **Gas and fees** | https://docs.arc.io/arc/references/gas-and-fees.md | 20 Gwei testnet floor, maxFeePerGas rules, error catalog (`transaction underpriced`) |
| **EVM differences** | https://docs.arc.io/arc/references/evm-differences.md | PREVRANDAO=0, blob-tx rejection, SELFDESTRUCT rules, value-transfer revert rules |
| **USDC system events** | https://docs.arc.io/arc/references/usdc-system-events.md | Dual emitters (`0x3600…0000` 6-dec + `0xffff…fffe` 18-dec EIP-7708), topic0 hashes |
| **Supported blockchains** | https://docs.arc.io/app-kit/references/supported-blockchains.md | App Kit mainnet/testnet tables, `Arc_Testnet` identifier, USDC-only bridge scope |
| **CCTP V2 contracts (Circle)** | https://developers.circle.com/cctp/evm-smart-contracts | Canonical TokenMessengerV2/MessageTransmitterV2 per network (mainnet `0x28b5…cf5d` / `0x81D4…4B64`, testnets `0x8FE6…2DAA` / `0xE737…e275`) |
| **CCTP V2 quickstart (ETH→Arc)** | https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc | `depositForBurn` args (`maxFee` 500 subunits, `minFinalityThreshold` 1000 = fast), Iris polling, `receiveMessage`, Forwarding Service (`depositForBurnWithHook` + `cctp-forward` hook, fee quote `?forward=true`) |
| **CCTP technical guide** | https://developers.circle.com/cctp/references/technical-guide | Iris base URLs (`iris-api.circle.com` mainnet, `iris-api-sandbox.circle.com` testnet), finality thresholds, fee units |
| **USDC contract addresses (Circle)** | https://developers.circle.com/stablecoins/usdc-contract-addresses | Testnet USDC per chain (Sepolia/Base/Arb/OP) used in `js/config.js` |
| **CCTP V2 interfaces (GitHub)** | https://github.com/circlefin/evm-cctp-contracts | Exact `depositForBurn` / `receiveMessage` signatures verified against source |

## Build & integration guides

| Resource | URL | Used for |
|----------|-----|----------|
| Bridges integration guide | https://docs.arc.io/integrate/infrastructure/bridges.md | CCTP domain `26`, confirmations=1 rule, relayer funding, no-wrapped-USDC mandate |
| Deploy on Arc tutorial | https://docs.arc.io/arc/tutorials/deploy-on-arc.md | Foundry flow, Blockscout verification flags |
| Porting checklist | https://docs.arc.io/arc/tutorials/porting-contracts-to-arc.md | Porting checklist mirrored in `ARC-REFERENCE.md` §15 |
| App Kit overview | https://docs.arc.io/app-kit.md | Path A SDK design |
| App Kit Bridge | https://docs.arc.io/app-kit/bridge.md | `kit.bridge()` usage, CCTP abstraction |
| Unified Balance | https://docs.arc.io/app-kit/unified-balance.md | Gateway deposits/spends |

## Announcements & status

| Resource | URL | Why |
|----------|-----|-----|
| Mainnet launch announcement | https://community.arc.io/public/blogs/arc-public-mainnet-launches-september-16-2026-2026-08-06 | Public mainnet = September 16, 2026; private mainnet until then |
| Circle press room | https://www.circle.com/pressroom | Validator cohort / integration news pre-launch |
| Circle developer docs (CCTP/Gateway) | https://developers.circle.com/cctp | Canonical CCTP contract addresses per chain, domain registry, attestation API |
| Circle Gateway | https://developers.circle.com/gateway | Gateway implementation considerations behind Unified Balance |
| Testnet explorer | https://testnet.arcscan.app | On-chain verification of every address/value above |
| Faucet | https://faucet.circle.com | Testnet USDC/EURC for gas and testing |
| Gas tracker | https://testnet.arcscan.app/gas-tracker | Live base fee monitoring |

## Installed skills (local mirror of official guidance)

Circle's official skill pack (repo: https://github.com/circlefin/skills) is
installed both globally (`~/.agents/skills/`) and in this repo (`.agents/skills/`,
locked via `skills-lock.json`). Key skills:

- `use-arc` — chain config, RPC setup, deployment, USDC bridging on Arc
- `bridge-stablecoin` — App Kit / Bridge Kit bridging flows (CCTP)
- `unify-balance` — Unified Balance / Gateway deposit-spend flows
- `swap-tokens` — same-chain swap (Arc Testnet: USDC/EURC/cirBTC only)
- `use-usdc`, `use-gateway`, wallet skills — payments infrastructure

Update them with: `npx skills update -p -y` (project) / `-g` (global).

---

*Last verified against sources: 2026-08-22 (Arc pages 2026-08-21; Circle CCTP V2
addresses/ABI/quickstart/Iris endpoints 2026-08-22).*
