# MCP Server — WarpArc Backend

Model Context Protocol untuk mengoperasikan backend WarpArc (indexer + relayer
+ API) dari MCP client (Claude, VS Code, agent lain). Mengikuti workflow resmi
https://modelcontextprotocol.io: discovery → deployment path → scaffold → test
(**MCP Inspector**) → connect → publish ke Registry.

**Spec**: versi protocol dinegosiasikan di `initialize` (server mendukung
`2026-07-28` dan `2025-06-18`; memakai versi client bila didukung).

## Status

| Bagian | Status |
|---|---|
| Transport **stdio** (lokal) | ✅ Implemented — `backend/src/mcp-server.js` |
| Tools ×7, Resources ×2, Prompts ×2 | ✅ Implemented |
| Version negotiation + JSON-RPC 2.0 | ✅ Implemented |
| Smoke test offline + E2E spawn | ✅ Implemented — `npm run backend:mcp:smoke` |
| Verifikasi manual MCP Inspector | 🚧 Lihat bawah (satu perintah) |
| Transport **Streamable HTTP** remote + auth | 📋 Rencana (P2) di bawah — belum diimplementasikan |
| Publish ke MCP Registry | 📋 Saat stabil |

## Cara pakai (stdio — lokal)

```bash
npm run backend:mcp          # jalankan server; stdout = protocol, log di stderr
npm run backend:mcp:smoke    # 30+ asersi offline (protocol/tools/resources/prompts/E2E)
```

Koneksi client (contoh `.mcp.json` di root repo — **jangan commit bila memuat
env secret**):

```json
{
  "mcpServers": {
    "warparc-backend": {
      "command": "node",
      "args": ["backend/src/mcp-server.js"],
      "env": { "BACKEND_NETWORK": "testnet" }
    }
  }
}
```

Server berjalan sebagai **sesi ops pasif**: relayer dibuat tanpa tick (tidak
akan double-submit dengan `npm run backend`); satu-satunya tool yang menulis
(`warparc_relay_submit`) hanya mencatat job ops — mengikuti guard yang sama
dengan `POST /relay`.

## Tools (7)

| Tool | Argumen | Perilaku / guard |
|---|---|---|
| `warparc_health` | — | Liveness + ringkasan indexer/relayer |
| `warparc_jobs` | `status?` | Daftar job relayer (+filter status) |
| `warparc_events` | `chain? address? kind? limit?` | Query event USDC terindeks; `kind` = erc20\|system (Arc dual-emitter — jangan dijumlahkan lintas kind); limit cap 1000 |
| `warparc_status` | `srcChain txHash` | Job + state Iris live; di-throttle (`BACKEND_STATUS_IRIS_RPS`) agar tidak memakai budget 40 req/s relayer |
| `warparc_relay_submit` | `srcChain burnTxHash` | **Enqueue saja**; submit on-chain tetap butuh relayer LIVE (`RELAYER_ENABLED=true && RELAYER_DRY_RUN=false && RELAYER_PRIVATE_KEY`) |
| `warparc_budget` | — | Budget gas harian per chain tujuan (USDC Arc / ETH EVM) + state pause |
| `warparc_config` | — | Ringkasan network/chains/CCTP domain — **tidak pernah memuat secret** |

## Resources (2)

| URI | Isi |
|---|---|
| `warparc://state` | `state.json` mentah: watermark `indexer:<chain>`, `relayer:watch:<chain>`, job relayer, budget gas |
| `warparc://events/recent` | Maks 500 event USDC terbaru (events.jsonl bisa >50MB — gunakan tool untuk query terfilter) |

## Prompts (2)

| Nama | Isi |
|---|---|
| `warparc-audit-relayer` | Snapshot mode/status-job/budget + langkah lanjutan |
| `warparc-launch-day` | Runbook fail-closed mainnet Arc (2026-09-16): isi hanya dari docs.arc.io |

## Keamanan (fail-closed)

- Default testnet + watch-only; MCP tidak pernah mengekspos private key.
- Tool deskripsi jujur (spec: "descriptions of tool behavior should be
  considered untrusted unless from a trusted server" — server ini trusted,
  deskripsi mencerminkan guard asli).
- stdio = proses lokal. Untuk remote, lihat rencana di bawah — **tanpa auth,
  jangan expose**.

## Verifikasi

```bash
# 1) Otomatis (CI-friendly):
npm run backend:mcp:smoke

# 2) Manual interaktif — MCP Inspector (alur resmi: test tools/resources/prompts):
npx @modelcontextprotocol/inspector node backend/src/mcp-server.js
# → pilih "warparc-backend", coba initialize → tools/list → tools/call warparc_health
```

## Rencana P2 — Streamable HTTP + auth (belum diimplementasikan)

Saat backend perlu diakses agent dari luar mesin yang sama:

1. **Endpoint**: mount `POST /mcp` di `backend/src/server.js` (node:http yang
   sudah ada). Header `MCP-Protocol-Version` pada initialize; respons
   `application/json` tunggal (SSE opsional untuk streaming progres).
2. **Auth**: `Authorization: Bearer <BACKEND_MCP_TOKEN>` (env, fail-closed:
   tanpa token diset → tolak koneksi remote). Nanti OAuth 2.1 (RFC 9728)
   per spec Authorization. Default bind tetap `127.0.0.1` + validasi Host.
3. **Pembatasan**: `warparc_relay_submit` tetap enqueue-only; mode LIVE relayer
   tidak pernah diaktifkan dari permintaan remote tanpa flag eksplisit.
4. **Deploy**: proses terpisah dari frontend (Vercel statis) — backend ops
   tidak pernah publik lewat `vercel.json`.

## Pemetaan spec (MCP)

| Komponen spec | Implementasi |
|---|---|
| Base protocol — JSON-RPC 2.0, stateful, capability negotiation | `handleFrame()` di `backend/src/mcp-server.js` |
| Server features: Tools / Resources / Prompts | Tabel di atas; `listChanged=false`, `subscribe=false` |
| Versioning | `PROTOCOL_VERSIONS` + pilihan versi di `initialize` |
| Transport | stdio (line-delimited) — Implemented; Streamable HTTP — Planned |
| Security & trust | Guard relay/iris sama dengan HTTP API; tanpa secret di respons |
