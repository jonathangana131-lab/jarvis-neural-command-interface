# v0.4.0

Trust, recovery, and backup release for the public Windows build.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.4.0.exe`

## Added

- Update banner on the main app surface when a newer release is available.
- Progress-aware update download state with polling from the renderer.
- Backup manager in Diagnostics for creating and inspecting app-profile backups.
- Restore action for backed-up model settings and saved model secrets.
- Recovery controls to reset bad model settings, clear saved secrets, and export a local log bundle.
- Tray menu plus `Ctrl+Alt+J` global hotkey to show or hide Jarvis.
- Update downloads still verify SHA256 before install and create a profile backup before launch.
- Task startup now uses fast keyword memory recall so slow embedding startup cannot leave missions stuck in the queue.

## Preserved Data

Memories, saved model settings, model secrets, logs, update downloads, and backups remain in the Electron user profile, separate from the installed app folder. Updating the Windows installer should not erase them.

## Signing

The app is ready for a real code-signing certificate, but this build is still unsigned because no trusted certificate/private key is available in the workspace.

## Verified

- Source build and parser, memory, artifact, live stream, packaged app, and installed UI smoke tests.

SHA256: `8EE700AE4DB754441CD7AEB37E76616D0AC219B721AD2AB30119437EBC098F5E`
