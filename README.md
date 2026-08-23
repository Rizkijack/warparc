# WarpArc — Cross-Chain USDC Bridge (Arc ⇄ EVM)

**WarpArc** adalah website + ops backend untuk memindahkan stablecoin (USDC) dari
**Arc** ke jaringan EVM lain (Ethereum, Base, Arbitrum, Optimism, Robinhood Chain)
— dan sebaliknya — lewat **Circle CCTP V2** (burn-and-mint, kanonik untuk Arc)
atau **Circle App Kit** (Path A). LayerZero OFT legacy = DEPRECATED (lihat
`contracts/`, Appendix A di runbook lokal).

> ⚠️ **Testnet-first & fail-closed**: semua nilai chain diambil dari
> https://docs.arc.io (tidak pernah ditebak dari ingatan). Mainnet Arc publik
> **2026-09-16** — ikuti runbook lokal (lihat bawah).

## Struktur

| Path | Isi |
|---|---|
| `frontend/` | Situs statis **Path B** (CCTP V2 langsung, tanpa build) — `js/config.js` adalah single source of truth chains/RPC/address |
| `appkit/` | **Path A** — React + Circle App Kit `kit.bridge()` + Unified Balance — [appkit/README.md](appkit/README.md) |
| `backend/` | Ops: **indexer** USDC (dual-emitter Arc), **relayer** CCTP V2 (watch-only default), **API** 127.0.0.1:8932 — zero-dependency — [backend/README.md](backend/README.md) |
| `backend/src/mcp-server.js` | **MCP server** (stdio): tools/resources/prompts untuk mengoperasikan backend lewat AI agent — [mcp/README.md](mcp/README.md) |
| `scripts/` | Deploy, konfigurasi, CCTP test, phase-0 monitor, mint-arc helper, watch-usdc |
| `contracts/` | LEGACY LayerZero (`BridgeAdapter.sol`, `BridgeToken.sol`) — di-disable, jangan deploy |

## Quickstart

```bash
npm install              # ethers@5 + hardhat (devDependencies)
npm run dev              # frontend statis di http://localhost:8931
npm run backend          # indexer + relayer + API — testnet, watch-only, :8932
npm run backend:mcp      # MCP server stdio (tools ops backend untuk agent)
npm run backend:smoke    # 42+ asersi offline (core backend)
npm run backend:mcp:smoke # asersi offline untuk MCP server
```

Fund USDC testnet di https://faucet.circle.com sebelum memindahkan dana.
Chain Arc testnet: chain ID `5042002`, RPC `https://rpc.testnet.arc.io`,
gas = **USDC** (bukan ETH), finality < 1 s (1 konfirmasi cukup).

## Keamanan singkat

- Default **testnet + watch-only**. Relayer benar-benar mengirim hanya bila
  `RELAYER_ENABLED=true` **dan** `RELAYER_DRY_RUN=false` **dan**
  `RELAYER_PRIVATE_KEY` tersedia (env, tidak pernah di-log/di-commit).
- API bind `127.0.0.1` + validasi Host; CORS opt-in; MCP default stdio (lokal).
- Secret tidak pernah di-commit (lihat `.env.example` + `.gitignore`).

## Dokumentasi

- [backend/README.md](backend/README.md) — env, skema data, API, test.
- [mcp/README.md](mcp/README.md) — MCP server: tools, resources, prompts, rencana remote (Streamable HTTP + auth).
- [AGENTS.md](AGENTS.md) — aturan worktree & dokumen untuk agent.
- **Local-only (sengaja tidak di-commit)**: `ARC-REFERENCE.md` (handbook sumber
  Arc), `DEPLOY.md` (panduan deploy), `MAINNET-CHECKLIST.md` (runbook launch-day),
  `ARC-SOURCES.md` (daftar sumber resmi). Bila hilang, regenerasi dari
  https://docs.arc.io — jangan pernah mengisi nilai dari ingatan.
