# Jarvis Neural Command Interface

A local desktop interface for neural chat, memory, and Codex-powered workspace tasks, for **Windows and macOS**.

The centerpiece is a Three.js neural orb that grows a node for every memory the
assistant has captured. As of v0.2.0 the lines between those nodes are no
longer decorative — they are real cosine-similarity edges computed from
on-device sentence embeddings, and the orb visibly reacts when Codex recalls
context for a task.

## Download

Grab the latest build from the
[GitHub Releases](https://github.com/jonathangana131-lab/jarvis-neural-command-interface/releases)
page.

**Windows** — run the installer:

- `Jarvis-Neural-Command-Interface-Setup-<version>.exe`

**macOS** — open the disk image and drag the app to Applications:

- `Jarvis-Neural-Command-Interface-<version>-arm64.dmg` (Apple Silicon)
- `Jarvis-Neural-Command-Interface-<version>-x64.dmg` (Intel)

The macOS build is currently unsigned (no Apple Developer certificate), so the
first launch is gated by Gatekeeper. Open it once with **right‑click → Open**
and confirm, or clear the quarantine flag from Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/Jarvis Neural Command Interface.app"
```

## Current Highlights

- Persistent chat sessions with New Chat, search, pin, rename, clear, archive, and task-linked history.
- A lighter Run chat console with a compact coding transcript and cleaner composer that keeps the neural orb visible.
- A Memory Center with graph legend, review queue, recall reasons, sort/filter controls, ignore/archive controls, and duplicate cleanup.
- A Project Dashboard for readiness, recent chats, recent tasks, storage, workspace, and release status.
- Run cockpit helpers for saved workspace switching without the extra template button strip.
- A safer updater/recovery path with verified installer handoff, storage cleanup, backups, logs, release assistant, and Windows shortcut repair.
- v0.7.9 adds quick task mode, richer queue diagnostics, task timing, repair install, diagnostic bundle export, and old-installer cleanup.
- A tighter neural memory graph that keeps memory nodes wrapped around the core orb.

## Requirements

- Windows 10 or newer, or macOS 12 (Monterey) or newer (Apple Silicon or Intel)
- Node.js is only required for development, not for the packaged app
- Codex CLI on `PATH` for Codex task execution. On macOS the app also searches
  the usual install locations (Homebrew, npm global, Volta, `~/.codex/bin`, …),
  so a normally‑installed Codex is found even when the app is launched from
  Finder (which does not inherit your shell `PATH`)
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

For fast local polish passes, update the installed EXE without launching the
installer:

```powershell
npm run install:local:fast
```

That command builds `release/win-unpacked`, mirrors it into
`%LOCALAPPDATA%\Programs\Jarvis Neural Command Interface`, and repairs the
desktop and Start Menu shortcuts. It avoids the slow NSIS extraction step, so
use it while testing UI and reliability changes. Build the installer only for a
real release:

```powershell
npm run dist:win
```

If `release/win-unpacked` is already fresh and you only need to make an
installer from it, use:

```powershell
npm run installer:win:from-dir
```

The NSIS step is still the slow part because it compresses a roughly 200 MB
Electron bundle. For a local-only installer smoke test where file size does not
matter, this skips compression work:

```powershell
npm run installer:win:quick
```

## Build A macOS App

On a Mac (Apple Silicon or Intel) with Node.js installed:

```bash
npm install
npm run dist:mac
```

This generates the app icon (`build/icon.icns`), builds the renderer, and
produces ad‑hoc‑signed `.dmg` and `.zip` artifacts in `release/` for both
`arm64` and `x64`. For a quick unpacked `.app` while iterating, use
`npm run package:mac`.

The icon generator (`scripts/prepare-mac-icon.mjs`) uses native `sips` /
`iconutil`, and renders the crisp vector source when `rsvg-convert` (librsvg)
is installed — otherwise it upsizes `build/icon.png`.

## Releases (CI)

Because the macOS toolchain (`hdiutil`, `iconutil`, ad‑hoc signing) only runs on
macOS, releases are built in GitHub Actions:

- **CI** (`.github/workflows/ci.yml`) — builds the renderer and runs the Node
  test suite on Windows, macOS, and Linux for every push and pull request.
- **Release (macOS)** (`.github/workflows/release-macos.yml`) — runs on a macOS
  runner and publishes a GitHub Release with the `.dmg`, `.zip`, and
  `latest-mac.yml` (consumed by the in‑app auto‑updater). It runs automatically
  when a `package.json` version bump lands on `main`, or on demand from the
  Actions tab. It needs no extra secrets — the built‑in `GITHUB_TOKEN` is enough.

## Privacy Notes

This repository intentionally excludes local databases, logs, screenshots, Playwright traces, `.env` files, saved model keys, and personal workspace paths. Runtime data is stored in the user's application data directory.

The embedding model runs entirely on-device — no memory content is sent to
any remote service for embedding.
