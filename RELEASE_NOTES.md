# v0.7.0

Polish release for a stronger daily-use cockpit: better chat control, dashboard visibility, release readiness, memory review, and a refined neural UI pass.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.0.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.0.exe.blockmap`
- `latest.yml`

## Added

- Project Dashboard with readiness, storage, workspace, update, recent chat, and recent task summaries.
- Chat search, pin/unpin, visible-thread clear, and stronger preserved-session behavior.
- Workspace switcher with locally saved workspace choices.
- Task template shortcuts for bug fixing, UI polish, tests, project explanation, and release prep.
- Command Review Panel for task outputs, touched files, captured commands, and test signals.
- Release Assistant panel that checks version, installer, blockmap, `latest.yml`, and asset hashes.
- Memory graph legend and review queue for duplicate, low-confidence, and low-importance memories.

## Improved

- Memory nodes now stay on a tighter neural shell around the inner orb instead of drifting through the core.
- Recovery notice layering was refined so Dismiss and Diagnostics stay clickable even with the run cockpit controls visible.
- Dashboard, memory, diagnostics, release, and command-review panels received responsive UI polish.
- Recovery and diagnostics buttons now wire every rendered action, not just the first matching button.
- Chat clearing keeps durable history in SQLite while hiding older messages from the active thread.
- Dashboard, workspace, and release status APIs expose app readiness to the UI and smoke tests.

## Verified

- `npm run build`
- `npm run test:memory`
- `npm run test:voice-settings`
- `npm run test:artifacts`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- `npm run package:win`
- `npm run test:packaged-smoke`
- `npm run dist:win`
- `npm run test:installed-ui-smoke`

SHA256: `BA30A0E5FB851CB6D338A81805C6E6548D4BA61BCA671BF05ED71415D96915FD`

# v0.6.0

Polish release for real chat continuity, clearer memory controls, safer recovery, and a cleaner neural cockpit.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.6.0.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.6.0.exe.blockmap`
- `latest.yml`

## Added

- Persistent chat sessions backed by SQLite, with task association, sidebar selection, rename, archive, and new-chat behavior.
- Chat-aware retries so follow-up runs stay attached to the same conversation.
- Memory Center filters for memory type, recall-reason labels, ignore/archive controls, and duplicate cleanup from the detail panel.
- A task lifecycle stepper plus quick copy actions for task summaries and captured commands.
- Recovery shortcut repair for the Windows desktop build when Start Menu or desktop shortcuts disappear.

## Improved

- The memory graph now stays on a clearer shell around the inner orb, with cyan/blue colors aligned to the rest of the interface.
- Existing databases migrate safely by adding chat columns before creating chat indexes.
- Diagnostics and storage/recovery copy now better explains update, backup, logs, and repair actions.

## Verified

- `npm run build`
- `npm run test:memory`
- `npm run test:voice-settings`
- `npm run test:artifacts`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- `npm run package:win`
- `npm run test:packaged-smoke`
- `npm run dist:win`
- `npm run test:installed-ui-smoke`

SHA256: `F17FC1667BB214B76257678A94ADD94F8B208F3E6D744F032F18EDA0CB4DF9A7`

# v0.5.1

In-place updater release for the Windows build.

## Download

Attach these files to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.5.1.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.5.1.exe.blockmap`
- `latest.yml`

## Fixed

- Added Electron's native updater so packaged app updates download in the background and replace the current app on restart.
- Changed the Windows installer to one-click, per-user, fixed-location installs so updates target the existing app instead of asking for a fresh install location.
- Changed the legacy in-app installer fallback to run silently instead of opening the setup wizard.
- Updated in-app wording so the verified update action describes an in-place update.

## Preserved Data

Memories, saved model settings, model secrets, logs, backups, downloaded updates, and voice settings remain in the Electron user profile, separate from the installed app folder.

## Signing

The app is still unsigned because no trusted code-signing certificate/private key is available in the workspace.

## Verified

- `npm run build`
- `npm run test:memory`
- `npm run test:voice-settings`
- `npm run test:artifacts`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- `npm run package:win`
- `npm run test:packaged-smoke`
- `npm run test:installed-ui-smoke`
- `node --check electron/main.cjs`

SHA256: `C4D003150DDC2049387CB563854C8D6F3A4015F0C89921A744E2B9181A0A2610`
