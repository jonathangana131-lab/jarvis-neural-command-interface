# v0.5.0

Reliability and simple Voice Mode release for the Windows build.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.5.0.exe`

## Added

- Persisted Voice Mode settings in the app profile.
- Voice settings API: `GET /api/voice-settings` and `POST /api/voice-settings`.
- Optional spoken summaries using the system text-to-speech voices.
- Voice auto-send after final transcript with a short confirmation delay.
- Active response actions for Stop, Retry, and Copy summary.
- Event-stream reconnect handling and queued-task watchdog messaging.
- Previous-session crash detection with a diagnostics recovery notice.
- Diagnostics now show voice settings and session recovery state.
- Update failure UI now points users to retry and log export actions.
- First-run setup copy now gives clearer provider-specific guidance.

## Preserved Data

Memories, saved model settings, model secrets, logs, backups, downloaded updates, and voice settings remain in the Electron user profile, separate from the installed app folder. Updating the Windows installer should not erase them.

## Signing

The app is ready for a real code-signing certificate, but this build is still unsigned because no trusted certificate/private key is available in the workspace.

## Verified

- Source build and parser, memory, voice settings, artifact, live stream, packaged app, and installed UI smoke tests.

SHA256: `E221A76FF826096E3E22AB198D0AE18FA14D7DA1CB7E8D101050203D97B02923`
