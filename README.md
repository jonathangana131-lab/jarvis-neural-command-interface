# Jarvis Neural Command Interface

A local Windows desktop interface for neural chat, memory, and Codex-powered workspace tasks.

The centerpiece is a Three.js neural orb that grows a node for every memory the
assistant has captured. As of v0.2.0 the lines between those nodes are no
longer decorative — they are real cosine-similarity edges computed from
on-device sentence embeddings, and the orb visibly reacts when Codex recalls
context for a task.

## Download

Use the Windows installer from the latest GitHub Release:

- `Jarvis-Neural-Command-Interface-Setup-0.7.3.exe`

## Current Highlights

- Persistent chat sessions with New Chat, search, pin, rename, clear, archive, and task-linked history.
- A Memory Center with graph legend, review queue, recall reasons, sort/filter controls, ignore/archive controls, and duplicate cleanup.
- A Project Dashboard for readiness, recent chats, recent tasks, storage, workspace, and release status.
- Run cockpit helpers for saved workspace switching without the extra template button strip.
- A safer updater/recovery path with verified installer handoff, storage cleanup, backups, logs, release assistant, and Windows shortcut repair.
- A tighter neural memory graph that keeps memory nodes wrapped around the core orb.

## Requirements

- Windows 10 or newer
- Node.js is only required for development, not for the packaged installer
- Codex CLI on `PATH` for Codex task execution
- Optional `OPENCODE_API_KEY` or saved in-app model key for hosted model chat

## Development

```powershell
npm install
npm run dev
```

First run downloads the local embedding model (~25 MB) into
`<data-dir>/transformers-cache/`. Subsequent runs use the cache.

## Memory Orb — Semantic Edges

Every memory the assistant captures is embedded with a small on-device
sentence model (Xenova/all-MiniLM-L6-v2, 384-dim). The backend stores the
vectors in sqlite and exposes:

- `GET /api/memory/edges` — cosine-similarity edges between all live memories
- `GET /api/memory/search?q=...` — semantic search by meaning
- `GET /api/memory/duplicates` — near-duplicate candidate pairs
- `GET /api/memory/embeddings/status` — backfill / model status

The orb listens to two new server-sent events:

- `memory.recalled` — fires whenever Codex pulls context for a task; the orb
  flashes the recalled nodes and pulses the connecting edges
- `memory.edges.updated` — fires whenever the edge graph changes; the
  frontend re-fetches the edge list and redraws

Embedding is best-effort. If `@xenova/transformers` fails to load (no network
on first run, ONNX runtime trouble) the system silently falls back to the
legacy keyword-scored recall path and the orb keeps working with the original
hash-based decorative edges.

## Build A Windows Installer

```powershell
npm install
npm run dist:win
```

The installer is written to `release/`.

## Privacy Notes

This repository intentionally excludes local databases, logs, screenshots, Playwright traces, `.env` files, saved model keys, and personal workspace paths. Runtime data is stored in the user's application data directory.

The embedding model runs entirely on-device — no memory content is sent to
any remote service for embedding.
