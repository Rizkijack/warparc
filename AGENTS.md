# AGENTS.md — cmdc (CommandCode / cmdc)

## KONTEKS PROYEK
- Kamu bekerja di branch: **cmdc/tugas-1**
- Working directory ini adalah **git worktree TERPISAH** dari root repo.
- **JANGAN** pernah menjalankan `git checkout <branch lain>` di sini — kamu akan **merusak worktree**.
- **JANGAN** pernah menjalankan `git push --force` ke branch utama.
- Base branch kamu adalah **preview**.
- Semua perubahan akan di-review lewat Pull Request.
- Base branch kamu adalah **preview**. Sinkronkan dengan
  `git fetch origin && git merge origin/preview` (fast-forward) — jangan checkout.

## DOKUMEN
- `README.md` — gambaran proyek + quickstart (tracked, baca dulu).
- `backend/README.md` — backend indexer/relayer/API + tabel env (tracked).
- `appkit/README.md` — App Kit Path A (tracked).
- `mcp/README.md` — MCP server backend: tools/resources/prompts (tracked).
- `ARC-REFERENCE.md`, `DEPLOY.md`, `MAINNET-CHECKLIST.md`, `ARC-SOURCES.md` —
  runbook operasional **local-only** (sengaja tidak di-commit). Bila hilang,
  regenerasi dari https://docs.arc.io — jangan pernah mengisi nilai dari ingatan.
