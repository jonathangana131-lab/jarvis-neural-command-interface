# v0.2.0 — Semantic Memory Orb

The neural orb now shows what the assistant is actually thinking. Memory
edges are no longer decorative — they are real cosine-similarity edges
computed from on-device sentence embeddings, and the orb visibly reacts
when Codex pulls memories for a task.

## What's New

- On-device sentence embeddings via `@xenova/transformers` (Xenova/all-MiniLM-L6-v2, 384-dim, runs locally — no remote calls)
- Real semantic edges between memory nodes on the orb (cosine similarity above threshold)
- Recall flash — when Codex picks memories as context, those nodes light up and pulses traverse the connecting edges
- New endpoints: `/api/memory/edges`, `/api/memory/search`, `/api/memory/duplicates`, `/api/memory/embeddings/status`
- New SSE events: `memory.recalled`, `memory.edges.updated`
- Codex task runner now uses async semantic recall with keyword fallback
- Embedding backfill runs in the background on startup for existing memories

## Compatibility

- Existing memory database is migrated in place — new `embedding` and `embedding_model` columns are added on first boot
- If the embedding model fails to load (no network on first run, ONNX runtime missing), the system silently falls back to the legacy keyword recall path and the orb uses the original decorative edges. Memory storage keeps working.

# v0.1.0

Initial Windows release of Jarvis Neural Command Interface.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.1.0.exe`

## Included

- Windows desktop app packaging with NSIS installer
- Custom Jarvis Neural Command Interface app icon
- Neutral public defaults for workspace and runtime data paths
- Local memory, chat, and Codex task interface

## Notes

The installer is unsigned. Windows may show a SmartScreen warning until the app is code signed or establishes reputation.
