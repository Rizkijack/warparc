# ARC Bridge — Deployment Guide

Cross-chain bridge (LayerZero V2 OFT) for **ARC Bridge Token (ABT)** and **USDC**
via an OFTAdapter. Bridges between Ethereum, Base, Arbitrum, Optimism, Robinhood
Chain, and ARC.

> ⚠️ **Status of this repo**
> - Smart contracts **compile** and the frontend `OFT_ABI` is **verified** against the
>   compiled OFT bytecode (run `npx hardhat run scripts/local-test.js --network localhost`
>   after starting `npx hardhat node`).
> - Contracts are **NOT yet deployed to any live chain**. Deployment requires a funded
>   `PRIVATE_KEY` (see below).
> - **ARC mainnet is not publicly reachable** (`rpc.arc.circle.io` / `5042.rpc.thirdweb.com`
>   do not respond). The bridge can only operate on the **5 live chains**
>   (Ethereum, Base, Arbitrum, Optimism, Robinhood). ARC is left as a placeholder.

---

## 1. Prerequisites

```bash
node >= 18
npm install --legacy-peer-deps
```

Dependencies pin **OpenZeppelin v4** (`^4.9.0`) and **ethers v5** on purpose:
the installed LayerZero OApp (`lz-evm-oapp-v2`) calls `Ownable()` with no argument,
which is an OZ v4 pattern. Do **not** upgrade to OZ v5 / ethers v6 without changing
the contract imports.

---

## 2. Environment

Copy the template and fill in your deployer key:

```bash
cp .env.example .env
```

`.env`:
```
PRIVATE_KEY=0xyour_deployer_private_key
# Optional per-chain RPC overrides (defaults are set in hardhat.config.js)
ETH_RPC=https://rpc.ankr.com/eth
BASE_RPC=https://mainnet.base.org
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC=https://mainnet.optimism.io
RHC_RPC=https://rpc.mainnet.chain.robinhood.com
# ARC not reachable yet — leave placeholder
ARC_RPC=https://5042.rpc.thirdweb.com
```

### RPC notes (verified)
| Chain     | RPC used                                  | Status |
|-----------|-------------------------------------------|--------|
| Ethereum  | `https://rpc.ankr.com/eth` (Ankr official)| ✅ reachable from user machine; sandbox blocked by network egress |
| Base      | `https://mainnet.base.org`                | ✅ |
| Arbitrum  | `https://arb1.arbitrum.io/rpc`            | ✅ |
| Optimism  | `https://mainnet.optimism.io`             | ✅ |
| Robinhood | `https://rpc.mainnet.chain.robinhood.com` | ✅ |
| ARC       | `https://5042.rpc.thirdweb.com`           | ❌ unreachable |

> `cloudflare-eth.com` is **down** (returns `-32046`). Do not use it.

---

## 3. Compile

```bash
npx hardhat compile
```

Target EVM: `paris`, Solidity `0.8.24`.

---

## 4. Local validation (no mainnet needed)

Start a node, then validate that the deployed OFT exposes exactly the functions the
frontend expects (`name/symbol/decimals/balanceOf/setPeer` + the `quoteSend`/`send`
selectors from `OFT_ABI` in `js/config.js`):

```bash
npx hardhat node                      # terminal 1
npx hardhat run scripts/local-test.js --network localhost   # terminal 2
```

This deploys `MockEndpoint` + `BridgeToken` to the local node and asserts the ABI
selectors match. Cross-chain `send` is **not** exercised (needs the full LZ stack).

---

## 5. Deploy to live chains

You need gas on each chain you deploy to. Deploy **one chain at a time**:

```bash
npx hardhat run scripts/deploy.js --network ethereum
npx hardhat run scripts/deploy.js --network base
npx hardhat run scripts/deploy.js --network arbitrum
npx hardhat run scripts/deploy.js --network optimism
npx hardhat run scripts/deploy.js --network robinhood
# npx hardhat run scripts/deploy.js --network arc   # blocked: ARC RPC unreachable
```

Or run all at once (skips ARC):

```bash
node scripts/deploy-all.js
```

Each run prints the deployed `BridgeToken` (ABT OFT) address. **Save these.**

> USDC (`BridgeAdapter`) is **not** deployed by these scripts. To bridge USDC you must
> deploy `BridgeAdapter` separately (it needs the chain's canonical USDC address as
> the locked token) and then wire its address into `js/config.js` → `bridgeAdapter.deployments`.

---

## 6. Configure peers (required)

After deployment, each OFT must know its peers on every other chain. Edit
`scripts/configure.js`:

```js
const DEPLOYMENTS = {
  ethereum: "0x...",   // ABT OFT address from step 5
  base:     "0x...",
  arbitrum: "0x...",
  optimism: "0x...",
  robinhood:"0x...",
  arc:      "0x..."    // fill once ARC is reachable
};
```

Then run for **each** chain:

```bash
npx hardhat run scripts/configure.js --network ethereum
npx hardhat run scripts/configure.js --network base
# ... etc
```

`setPeer` writes the bytes32 peer mapping so cross-chain `send` can resolve the
destination OFT. Without this, bridging fails.

---

## 7. Wire addresses into the frontend

Open `js/config.js` and fill the `null` deployment addresses so the UI can talk to the
real contracts:

```js
bridgeToken: { deployments: { ethereum: "0x...", base: "0x...", /* ... */ } },
bridgeAdapter: { deployments: { ethereum: "0x...", /* ... */ } },
tokens: {
  ABT:  { addresses: { ethereum: "0x...", /* same as bridgeToken.deployments */ } },
  USDC: { addresses: { /* canonical USDC per chain (already filled), arc: null */ } }
}
```

The frontend calls:
- `quoteSend(SendParam, bool)` → gas estimate (`js/app.js` `estimateGas`)
- `send(SendParam, MessagingFee, refundAddress, {value})` → bridge (`js/app.js` `bridge`)

These signatures match the installed `lz-evm-oapp-v2` OFT. **Do not** change them to
the legacy single-`quote` / 5-arg `send` form — that ABI belongs to a different LZ
version and will revert on-chain.

---

## 8. Gas / limits

- `quoteSend` returns `MessagingFee { nativeFee, lzTokenFee }`. The frontend sends
  `nativeFee` as the `msg.value` of `send`.
- Per-chain DVN/executor fees vary; the real `nativeFee` only resolves against a live
  LZ endpoint, which is why the local test cannot exercise it.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Expected valid bigint` on `localhost` | `PRIVATE_KEY` default is `0x0...0` (invalid) | export a real Hardhat test key, e.g. `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| `cloudflare-eth.com` errors | endpoint down | use `https://rpc.ankr.com/eth` |
| ARC deploy hangs | ARC RPC unreachable | skip ARC until mainnet is public |
| `Ownable()` constructor error | mixed OZ v4/v5 | keep OZ `^4.9.0` + `ethers@^5.7` |
| `setPeer` reverts | wrong peer address / not bytes32 | `configure.js` handles padding; re-run |
