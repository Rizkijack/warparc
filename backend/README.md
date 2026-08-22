# WarpArc Backend

Ops backend untuk WarpArc: **indexer** USDC (Arc dual-emitter), **relayer** CCTP V2
(burn→mint), dan **HTTP API**. Zero-dependency tambahan — hanya Node 18+ dan
`ethers@5` (devDependency yang sudah ada).

Sumber desain (semua nilai terverifikasi, tidak ada tebakan):

| Komponen | Referensi |
|----------|-----------|
| Indexer dual-emitter + 1 konfirmasi | docs.arc.io/integrate/infrastructure/indexing-events · DEPLOY.md §6 |
| Relayer (attestation → receiveMessage) | docs.arc.io/integrate/exchanges/cctp-bridging · DEPLOY.md Path B |
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
- Operasional: `events.jsonl` append-only tanpa rotasi otomatis (warning di
  log saat >50 MB); `/events` dibatasi `limit` ≤ 1000 tanpa pagination cursor;
  histori pre-Zero5 (event `NativeCoin*`) tidak di-backfill — hanya era
  EIP-7708 Transfer. Semua itu disengaja untuk skala ops testnet.
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
| `BACKEND_INDEX_CHAINS` | `arc` | CSV; mis. `arc,baseSepolia` (Arc = dual-emitter) |
| `BACKEND_DATA_DIR` | `backend/data` | events.jsonl + state.json (gitignored) |
| `BACKEND_HOST` / `BACKEND_PORT` | `127.0.0.1` / `8932` | bind API |
| `BACKEND_CORS_ORIGIN` | — (tidak diset) | origin yang diizinkan; **tanpa env ini CORS nonaktif** (API same-origin/localhost saja) |
| `RELAYER_ENABLED` | `false` | master switch pengiriman |
| `RELAYER_DRY_RUN` | `true` | `false` + enabled → benar-benar kirim |
| `RELAYER_PRIVATE_KEY` | — | env saja; key relayer (gas), bukan key user |
| `BACKEND_AUTO_RELAY` | `false` | watch MessageSent jaringan → enqueue otomatis (subjek kebijakan) |
| `RELAYER_MAX_USDC_PER_TX` | `1000` | cap amount utk auto-relay |
| `RELAYER_DAILY_USDC_BUDGET` | `50` | budget gas harian (USDC) utk tujuan Arc — submit pause saat terlampaui |
| `RELAYER_DAILY_ETH_BUDGET` | `0.5` | budget gas harian (ETH) utk tujuan EVM |
| `RELAYER_IRIS_CHECKS_PER_TICK` | `20` | max cek attestation per tick (jaga limit Iris 40 req/s) |
| `RELAYER_ALLOW_HOOKS` | `false` | izinkan relay burn ber-hook |
| `RELAYER_POLL_MS` | `5000` | interval tick relayer |
| `RELAYER_MAX_JOBS` | `500` | cap store job (terminal terlama dipangkas) |
| `RELAYER_ATTESTATION_TIMEOUT_MS` | `600000` | batas tunggu attestation per job |

## API

```bash
curl http://127.0.0.1:8932/health
curl "http://127.0.0.1:8932/events?chain=arc&address=0x…&limit=10"
curl -X POST http://127.0.0.1:8932/relay \
  -H 'Content-Type: application/json' \
  -d '{"srcChain":"baseSepolia","burnTxHash":"0x…"}'
curl "http://127.0.0.1:8932/status?srcChain=baseSepolia&txHash=0x…"
curl http://127.0.0.1:8932/jobs
```

Job lifecycle: `queued → attestation_wait → ready → submitting → relayed`
(`skipped`/`failed` terminal; `ready` menunggu di mode watch-only).

## Membidik live (setelah review manual)

1. Isi `.env` (tidak pernah di-commit): `RELAYER_PRIVATE_KEY=0x…` — dompet
   relayer khusus, didanai USDC testnet via https://faucet.circle.com
   (gas Arc = USDC, bukan ETH).
2. `RELAYER_ENABLED=true RELAYER_DRY_RUN=false npm run backend`
3. Uji: burn kecil dari frontend (jalur manual/forwarding-off), lalu
   `POST /relay` dengan txHash burn — pantau `/jobs` sampai `relayed`.

## Test

```bash
npm run backend:smoke         # 42 asersi offline — store, indexer, parser V2, lock, guard relayer
npm run backend:integration   # 21 asersi NETWORKED (Arc testnet + Iris, read-only):
                              # parity config↔CSP, latensi chain→API real-time,
                              # dual-emitter pairing, konsistensi /health-/events,
                              # lifecycle /relay pada burn testnet nyata (watch-only)
```
