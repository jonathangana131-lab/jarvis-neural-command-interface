# v0.3.0

First-run and reliability release for the public Windows build.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.3.0.exe`

## Added

- First-run setup wizard for provider, endpoint, API key, model scan, and a real setup test message.
- Expanded health diagnostics for backend, model router, OpenCode key, memory database, embeddings, queue, and app version.
- GitHub release update check with a latest-download link when a newer version exists.
- Local backend log file plus diagnostics log tail so users can report problems without cloud telemetry.
- Installed-app UI smoke test that drives the first-run wizard through the packaged Electron UI.

## Verified

- Source build and all parser, memory, artifact, live stream, packaged app, and installed UI smoke tests.
- The Windows installer launches an installed app, saves first-run model settings, and streams two messages through a mock model endpoint.

## Still Unsigned

The installer is still unsigned. Windows may show a SmartScreen warning until the app is signed with a real code-signing certificate.

SHA256: `E1E5BDF625DC28B892E4DBB392B462818AC948E09B7105AD3379DB8BF4FBD2B4`
