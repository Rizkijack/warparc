# WarpArc Backend

Ops backend untuk WarpArc: **indexer** USDC (Arc dual-emitter), **relayer** CCTP V2
(burn→mint), dan **HTTP API**. Zero-dependency tambahan — hanya Node 18+ dan
`ethers@5` (devDependency yang sudah ada).

Sumber desain (semua nilai terverifikasi, tidak ada tebakan):

| Komponen | Referensi |
|----------|-----------|
| Indexer dual-emitter + 1 konfirmasi | docs.arc.io/integrate/infrastructure/indexing-events |
| Relayer (attestation → receiveMessage) | docs.arc.io/integrate/exchanges/cctp-bridging |
| Checklist bridge (USDC gas, WSS, confirmations=1) | docs.arc.io/integrate/infrastructure/bridges |
| Layout pesan CCTP V2 (offset 8 = dstDomain, dstCaller 108) | circlefin/evm-cctp-contracts `src/messages/v2/` |
| Gas Arc (≥20 Gwei floor, tip 0, type-2) | ARC-REFERENCE.md §9 |

## Menjalankan

```bash
# semua role (indexer + relayer + API), testnet, watch-only
npm run backend

# satu per satu
npm run backend:indexer
npm run backend:relayer
npm run backend:server
```

## Keamanan (fail-closed)

- **Default = testnet + watch-only.** Relayer baru MENANDATANGANI tx bila
  `RELAYER_ENABLED=true` **dan** `RELAYER_DRY_RUN=false` **dan**
  `RELAYER_PRIVATE_KEY` tersedia via env (tidak pernah di-log/di-commit).
- **Relayer tidak pernah memindahkan dana user** — `receiveMessage` mint ke
  `mintRecipient` asli dari burn; relayer hanya membayar gas sendiri (USDC di
  Arc, lihat bridges checklist).
- `BACKEND_NETWORK=mainnet` menolak boot selama `chains.arcMainnet` di
  `frontend/js/config.js` masih TBD (launch 2026-09-16).
- `destinationCaller ≠ 0` → job di-skip (hanya pemegang alamat itu yang boleh
  menyelesaikan). Error "already relayed / nonce used" diverifikasi via
  `usedNonces()` on-chain sebelum dianggap sukses.
- **Burn ber-hook di-skip** (`RELAYER_ALLOW_HOOKS=true` untuk mengizinkan) —
  hook mengeksekusi logika arbitrer di tujuan; bukan tugas relayer ini.
  Auto-relay hanya memproses burn tujuan **Arc**, burnToken USDC yang diketahui,
  dan `amount ≤ RELAYER_MAX_USDC_PER_TX`.
- API bind `127.0.0.1` + validasi Host (anti DNS-rebinding); CORS hanya aktif
  bila `BACKEND_CORS_ORIGIN` diset eksplisit.
- Limitasi diketahui: tx dengan beberapa burn (batch) hanya me-relay pesan
  pertama (di-log warning); jalur manual frontend tetap bisa menyelesaikan sisanya.
- Operasional: `events.jsonl` append-only dengan rotasi otomatis saat >50 MB
  (dikonfigurasi via `BACKEND_EVENTS_MAX_MB`); `/events` mendukung pagination
  via `offset` + `limit` (max 1000); histori pre-Zero5 (event `NativeCoin*`)
  tidak di-backfill — hanya era EIP-7708 Transfer. Semua itu disengaja untuk
  skala ops testnet.
- `blockTimestamp` diisi eksak hanya saat chunk mengandung ≤100 blok ber-event
  (Arc testnet yang padat melewatinya — peringatan sekali di log; `ts` waktu
  ingest selalu ada). RPC di-wrapper retry sekali saat 429/503 + jeda
  antar-chunk 150 ms.

## Skema data

- **Event** (`events.jsonl`): `{chain, block, blockTimestamp?, txHash, logIndex,
  emitter, kind:"erc20"|"system", direction:"mint"|"burn"|"transfer", from, to,
  amountRaw, amount6, ts}` — `kind` membedakan emitter ganda Arc (sama-sama
  satu pergerakan; jangan dijumlahkan lintas kind), `direction` mengikuti
  pemetaan mint/burn dari dokumen USDC system events (`0x0` ↔ dunia).
- **Job relayer** (`state.json` key `relayer`): `queued → attestation_wait →
  ready → submitting → relayed` (+ terminal `skipped`/`failed`), membawa
  `message`+`attestation` (untuk resume) dan `parsed{recipient, burnToken,
  amount, maxFee, minFinalityThreshold, hasHook}`.
- **Watermark**: `indexer:<chain>` (blok berikutnya) dan `relayer:watch:<chain>`;
  **budget gas**: `relayer:budget` (per hari UTC, per chain tujuan).
- Satu instance per role dijaga lockfile `backend/data/lock-<role>.json`
  (PID; boot menolak jika pemilik masih hidup, mengambil alih jika stale).

## Environment

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `BACKEND_NETWORK` | `testnet` | `mainnet` gagal boot selama Arc mainnet TBD |
| `BACKEND_INDEX_CHAINS` | `arc` (testnet) / `arcMainnet` (mainnet) | CSV; mis. `arc,baseSepolia` (Arc = dual-emitter) |
| `BACKEND_DATA_DIR` | `backend/data` | events.jsonl + state.json (gitignored) |
| `BACKEND_HOST` / `BACKEND_PORT` | `127.0.0.1` / `8932` | bind API |
| `BACKEND_CORS_ORIGIN` | — (tidak diset) | origin yang diizinkan; **tanpa env ini CORS nonaktif** (API same-origin/localhost saja) |
| `BACKEND_API_TOKEN` | — (tidak diset) | bila diset, `POST /relay` wajib header `Authorization: Bearer <token>` yang cocok (401 jika tidak) |
| `BACKEND_STATUS_IRIS_RPS` | `2` | throttle lookup Iris live via `/status` & MCP (req/s); jangan makan budget global Iris 40 req/s milik relayer |
| `BACKEND_NO_SIGINT` | — (tidak diset) | internal: `1` mematikan handler SIGINT indexer — diset otomatis oleh `npm run backend` & harness test yang mengelola shutdown sendiri |
| `RELAYER_ENABLED` | `false` | master switch pengiriman |
| `RELAYER_DRY_RUN` | `true` | `false` + enabled → benar-benar kirim |
| `RELAYER_PRIVATE_KEY` | — | env saja; key relayer (gas), bukan key user |
| `BACKEND_AUTO_RELAY` | `false` | watch MessageSent jaringan → enqueue otomatis (subjek kebijakan) |
| `RELAYER_MAX_USDC_PER_TX` | `1000` | cap amount utk auto-relay |
| `RELAYER_DAILY_USDC_BUDGET` | `50` | budget gas harian (USDC) utk tujuan Arc — submit pause saat terlampaui |
| `RELAYER_DAILY_ETH_BUDGET` | `0.5` | budget gas harian (ETH) utk tujuan EVM |
| `RELAYER_IRIS_CHECKS_PER_TICK` | `20` | max cek attestation per tick (jaga limit Iris 40 req/s) |
| `RELAYER_IRIS_TIMEOUT_MS` | `10000` | timeout per request HTTP ke Iris — anti freeze tick loop; loop attestation_wait retry tiap tick |
| `RELAYER_ARC_MAX_FEE_GAS_GWEI` | `30` | maxFeePerGas tx Arc (Gwei, type-2 tip 0); di bawah floor jaringan 20 Gwei tx ditolak |
| `RELAYER_ALLOW_HOOKS` | `false` | izinkan relay burn ber-hook |
| `RELAYER_POLL_MS` | `5000` | interval tick relayer |
| `RELAYER_MAX_JOBS` | `500` | cap store job (terminal terlama dipangkas) |
| `RELAYER_ATTESTATION_TIMEOUT_MS` | `600000` | batas tunggu attestation per job |
| `RELAYER_MAX_ATTEMPTS` | `5` | max percobaan submit per job sebelum `failed` |
| `RELAYER_MCP_SUBMIT` | `false` | opt-in ketat (fail-closed): tanpa ini tool submit via MCP hanya mengantri job ops, tidak mendorong ke jalur kirim |
| `MCP_IRIS_TIMEOUT_MS` | `15000` | deadline lookup Iris di `warparc_status` + fetch klien Iris standalone (mcp-server.js:81) — upstream menggantung → frame error JSON-RPC, bukan diam |
| `MCP_RPC_TIMEOUT_MS` | `15000` | deadline `validateBurnTx` (lookup receipt RPC) saat submit via MCP (mcp-server.js:84) |
| `ARC_MAINNET_RPC` / `ARC_MAINNET_CHAIN_ID` | — (kosong) | Arc mainnet RPC/chainId — kosong = fail-closed, isi hanya dari https://docs.arc.io/arc/references/connect-to-arc (Verified 2026-08-26 "Mainnet addresses are not yet available", testnet 5042002); aktivasi `arcMainnet` di `frontend/js/config.js:342-372` + `hardhat.config.js:59-103` + `.env.example:33-39` |
| `LOG_JSON` | `false` | `true` → log terstruktur JSON ke stderr `{ts,level,msg,...}`, `false` (default) → plain `[server]/[indexer]/[relayer]` — backward compat |

## API

```bash
curl http://127.0.0.1:8932/health
curl "http://127.0.0.1:8932/events?chain=arc&address=0x…&limit=10"
curl -X POST http://127.0.0.1:8932/relay \
  -H 'Content-Type: application/json' \
  -d '{"srcChain":"baseSepolia","burnTxHash":"0x…"}'
curl "http://127.0.0.1:8932/status?srcChain=baseSepolia&txHash=0x…"
curl http://127.0.0.1:8932/jobs
curl http://127.0.0.1:8932/metrics  # Prometheus text/plain; version=0.0.4 — no auth, same Host guard + CORS as GET lain
```

Job lifecycle: `queued → attestation_wait → ready → submitting → relayed`
(`skipped`/`failed` terminal; `ready` menunggu di mode watch-only).

## Observability — metrics, log terstruktur, dashboard (zero-dep, minimal)

- **GET /metrics** — Prometheus text exposition (`Content-Type: text/plain; version=0.0.4`, no auth, same Host guard + CORS as other GETs). Helper `renderMetrics({store, relayer, indexerChains, startTime})` (<50 baris, zero-dep) membaca `store.getState` + `countEvents`/`getMetrics` (reuse cache, TODO double-scan untuk testnet sederhana) dan:
  - `warparc_uptime_seconds` (gauge)
  - `warparc_events_total{chain="arc"}` via `store.countEvents`
  - `warparc_indexer_last_indexed_block_plus_one{chain="arc"}` via `state.json` `indexer:<chain>`
  - `warparc_relayer_jobs_total{status="queued|ready|..."}` via `relayer.stats().byStatus`
  - `warparc_relayer_budget_spent{chain="arc",unit="USDC"}` via `relayer.stats().budgets`
  - `warparc_api_requests_total{route="GET /health"}` (optional, in-memory counter per route)
- **Structured JSON logging** — tiap file `backend/src/{server,indexer,relayer,store}.js` punya helper `createLogger()`; `LOG_JSON=true` → `JSON.stringify({ts,level,msg,...})` ke stderr, default `false` → plain `console.error("[...]")` (backward compat). `server.js` log setiap request `{method,path,status,durationMs}`.
- **Store helper** — `store.getMetrics()` → `{totalEvents, perChainCounts}` single-scan (reuse `queryEvents` cache), untuk dashboard/metrics tanpa double full-scan.
- **Dashboard minimal** — scrape `/metrics` langsung dengan Prometheus/Grafana; zero dependency tambahan.

## Membidik live (setelah review manual)

1. Isi `.env` (tidak pernah di-commit): `RELAYER_PRIVATE_KEY=0x…` — dompet
   relayer khusus, didanai USDC testnet via https://faucet.circle.com
   (gas Arc = USDC, bukan ETH).
2. `RELAYER_ENABLED=true RELAYER_DRY_RUN=false npm run backend`
3. Uji: burn kecil dari frontend (jalur manual/forwarding-off), lalu
   `POST /relay` dengan txHash burn — pantau `/jobs` sampai `relayed`.

## MCP server (ops via agent)

```bash
npm run backend:mcp          # MCP stdio server — tools/resources/prompts ops backend
npm run backend:mcp:smoke    # 30+ asersi offline (protocol, tools, resources, prompts, E2E spawn)
```

Melayani MCP client (Claude/VS Code/agent lain) lewat JSON-RPC 2.0
line-delimited di stdio sebagai **sesi ops pasif**: relayer TIDAK di-tick di
sini (tidak ada double-submit dengan `npm run backend`), dan satu-satunya tool
yang menulis (`warparc_relay_submit`) memakai guard yang sama dengan
`POST /relay` — hanya mencatat job; pengiriman on-chain tetap butuh backend
relayer yang LIVE. Detail tools/resources/prompts dan rencana remote
(Streamable HTTP + auth): `mcp/README.md`.

## Test

```bash
npm run backend:smoke         # 42 asersi offline — store, indexer, parser V2, lock, guard relayer
npm run backend:integration   # 21 asersi NETWORKED (Arc testnet + Iris, read-only):
                              # parity config↔CSP, latensi chain→API real-time,
                              # dual-emitter pairing, konsistensi /health-/events,
                              # lifecycle /relay pada burn testnet nyata (watch-only)
```
