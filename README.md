# Jarvis 2 — Cognitive Atlas

A local-first desktop cognitive interface for memory, conversation, and Codex-powered workspace missions.

Jarvis 2 is organized around one living Three.js memory atlas. The large luminous core is wrapped in deterministic dendritic branches, while real memories appear as colored engrams and real cosine-similarity edges. Recall, speech, learning, and task execution visibly travel through that same graph.

## Download

Use the Windows installer from the latest GitHub Release:

- `Jarvis-Neural-Command-Interface-Setup-0.10.0.exe`

The `2.0.0` source is the next major desktop release. The stable installer remains `0.10.0` until the verified v2 installer is published.

## Current Highlights

- **Living Cognitive Atlas:** the old wire-cage orb is replaced by a layered luminous core, close dendritic branches, colored engrams, semantic edges, and travelling recall pulses.
- **One coherent v2 shell:** Command, Intelligence Map, Mission Archive, Creation Vault, Memory Atlas, Jarvis Settings, and System Health now feel like seven spaces inside the same brain.
- **Dedicated Memory Atlas composition:** records remain readable on the left while the live 3D cognitive topology shifts into view on the right for direct orbiting and selection.
- **Rewritten design system:** the previous stylesheet was replaced by an intentional layered cascade for foundation, shell, components, command, surfaces, overlays, and responsive behavior.
- **Shared atlas registry:** navigation, titles, shortcuts, and neural search are driven by one typed seven-space definition instead of duplicated labels.
- **Workspace Intelligence:** a bounded, local-only scanner maps languages, framework/runtime signals, scripts, tests, Git state, recent files, code markers, and mission readiness.
- **Neural Mission Preflight:** Jarvis turns a draft into intent, complexity, recommended execution depth, a phased plan, workspace signals, and guardrails before execution.
- **Quick / Standard / Deep execution:** persistent profiles change model instructions, Codex reasoning effort, verification expectations, history, and queue telemetry.
- **Persistent operations:** chat sessions, mission history, artifacts, semantic memory, queue controls, voice, recovery, updates, and diagnostics remain local and fully connected.
- **Fast navigation:** use `Ctrl/Cmd + K` for neural search or `Alt + 1…7` to move directly between operating spaces.

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

Useful verification commands:

```powershell
npm run build
npm run test:ui-contract
npm run test:v2-architecture
npm run test:memory
npm run test:voice-settings
npm run test:workspace-intelligence
npm run test:mission-planner
```

The GitHub macOS visual workflow captures all seven v1.2 and v2 pages at the same 1440×900 viewport, uploads the comparisons, runs the full reliability suite, and builds the unsigned macOS application bundle.

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

## Privacy Notes

This repository intentionally excludes local databases, logs, screenshots, Playwright traces, `.env` files, saved model keys, and personal workspace paths. Runtime data is stored in the user's application data directory.

The embedding model runs entirely on-device — no memory content is sent to
any remote service for embedding.
