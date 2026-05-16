# Jarvis Neural Command Interface

A local Windows desktop interface for neural chat, memory, and Codex-powered workspace tasks.

## Download

Use the Windows installer from the latest GitHub Release:

- `Jarvis-Neural-Command-Interface-Setup-0.1.0.exe`

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

## Build A Windows Installer

```powershell
npm install
npm run dist:win
```

The installer is written to `release/`.

## Privacy Notes

This repository intentionally excludes local databases, logs, screenshots, Playwright traces, `.env` files, saved model keys, and personal workspace paths. Runtime data is stored in the user's application data directory.
