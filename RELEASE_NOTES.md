# v0.2.1

Bugfix release for live chat streaming and second-message responsiveness, built on top of the v0.2.0 semantic memory orb update.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.2.1.exe`

## Fixed

- Broadened chat stream parsing for OpenAI-compatible SSE, JSONL, reasoning deltas, Responses-style output deltas, and array content chunks.
- Batched live token rendering on animation frames so the UI does not re-render heavy panels on every token.
- Moved task memory extraction to the background after completion so a second message can start without waiting for memory extraction.
- Added SSE header flushing and heartbeat events to keep the live event connection responsive.

## Included From v0.2.0

- On-device sentence embeddings via `@xenova/transformers`.
- Real semantic edges between memory nodes on the orb.
- Recall flash when Codex pulls memories for a task.
- New memory endpoints and SSE events for semantic recall and edge updates.
- Embedding backfill on startup with keyword fallback if the embedding model cannot load.

## Notes

The installer is unsigned. Windows may show a SmartScreen warning until the app is code signed or establishes reputation.

SHA256: `DE88F87E28A54E892735B4DC909F7FD5AE6BF852450926E457026F029F3A158D`
