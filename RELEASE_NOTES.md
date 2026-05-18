# v0.3.1

In-app updater release for the public Windows build.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.3.1.exe`

## Added

- In-app update download flow in Diagnostics when a newer GitHub release is available.
- SHA256 verification for downloaded installers using the GitHub release asset digest.
- One-click installer launch after a verified update download.
- Automatic update backup folder for memories, local model settings, and saved model secrets before installation.
- Update status now shows asset name, size, checksum availability, and whether a verified installer is already downloaded.

## Preserved Data

Memories, saved model settings, model secrets, and logs remain in the Electron user profile, separate from the installed app folder. Updating the Windows installer should not erase them.

## Verified

- Source build and all parser, memory, artifact, live stream, packaged app, and installed UI smoke tests.
- The Windows installer launches the packaged app and preserves user profile data outside the install folder.

## Still Unsigned

The installer is still unsigned. Windows may show a SmartScreen warning until the app is signed with a real code-signing certificate.

SHA256: `0391A69A2979A9E8F2965166473B6712E0F226B6DB157C098C1FD8A11CDD34F5`
