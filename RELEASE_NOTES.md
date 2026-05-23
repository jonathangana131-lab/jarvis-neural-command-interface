# v0.8.4

Fix layout jitter, text shifts, and response truncation in the assistant chat streams.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.8.4.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.8.4.exe.blockmap`
- `latest.yml`

## Fixed

- **Assistant Streaming Stability**: Resolved severe layout shifts, text jumping, and scrolling jitter by removing slicing on active and completed task outputs in the timeline conversation stream renderer. The UI now fully retains and renders complete assistant outputs of any length, preventing text from abruptly resizing or truncating once task streaming completes.

## Verified

- `npm run build`
- `npm run test:installed-ui-smoke`
- `npm run test:packaged-smoke`
- `npm run test:live-smoke`
- `npm run install:local:fast`
- `npm run installer:win`

SHA256: `C93A01986F7B60D948E5E7B799148DB4F48551928E8F8CBF829BA501d99d8F31`

# v0.8.3

Fix command typing area positioning across all layouts and resolve the Codex CLI execution unexpected argument error.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.8.3.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.8.3.exe.blockmap`
- `latest.yml`

## Fixed

- **Layout-dependent Command Dock Positioning**: Solved command dock and workspace switcher layout issues. Cockpit and Bubbles layout modes on desktop now use fixed floating bottom panels, Split Pane/Terminal layout uses grid-template areas with relative positioning, and mobile screens use responsive stacked elements.
- **Codex Task CLI Parsing**: Fixed `clap` parsing error (`unexpected argument '-'`) when invoking `codex exec` by removing the trailing `'-'` stdin marker, ensuring standard input is read by default without argument mismatch issues on Windows.

## Verified

- `npm run build`
- `npm run test:installed-ui-smoke`
- `npm run install:local:fast`
- `npm run installer:win`

SHA256: `EBC7E09E73F2947C826E98633BF22EF29184DB840FF4CB025283AF5A74A6C67E`

# v0.8.2

Fix layout and font readability issues in the cyber HUD interface.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.8.2.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.8.2.exe.blockmap`
- `latest.yml`

## Fixed

- Corrected memory chip title font styling (`.memory-chip strong`): Switched from Orbitron (`var(--font-cyber)`) to Inter (`var(--font-sans)`) to prevent narrow lowercase letters from rendering as glitchy/broken block glyphs at small font sizes (11px).
- Refined mission card summary text headers: Standardized status elements (Phase, Memory, Artifact counts) to use Rajdhani (`var(--font-hud)`) in uppercase format to provide crisp HUD vitals telemetry and resolve mixed-case stencil anomalies.

## Verified

- `npm run build`
- `npm run installer:win`
- `npm run install:local:fast`

SHA256: `A997E5B25B42785FD6377E36C6279EE4ED3295166886ECB7F4795736D475C71E`

# v0.8.1

Premium Jarvis & Codex cybernetic HUD theme redesign.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.8.1.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.8.1.exe.blockmap`
- `latest.yml`

## Added

- Designed and integrated an immersive, premium, high-tech cybernetic HUD theme inspired by Jarvis and Codex.
- Added sci-fi corner bracket decoration markers (`::before`/`::after`) on the main command dock container (`.command-dock__main`) that dynamically expand and glow when hovered or focused.
- Upgraded the prompt input `#task-prompt` and workspace switchers/inputs to feature translucent glassmorphism (`backdrop-filter: blur(16px)`), neon cyan borders, and glowing active states.
- Replaced the simple yellow gradient Run button with a high-visibility glowing ignition pad layout (`.ignite-button`) featuring hover translation and micro-animated rocket indicators.
- Refined mission timeline cards, stepper steps, and message bubbles (in bubbles layout mode) to feature glowing border indicators, high-contrast typography, and smooth scale transitions.
- Redesigned task recovery elements (`.run-recovery-card`) as critical warning/override blocks with black-and-amber hazard stripes, warning glow highlights, and glowing control buttons.
- Integrated modern cyber fonts: `Orbitron` (for primary titles/actions), `Rajdhani` (for metadata labels and vitals), and `Share Tech Mono` (for inputs, workspaces, and system paths).
- Customized sleek, narrow neon scrollbars across the chat console.

## Verified

- `npm run build`
- `npm run test:reliability-controls`
- `npm run test:stream-parser`
- `npm run dist:win`
- `npm run test:packaged-smoke`
- `npm run test:installed-ui-smoke`

SHA256: `FA09CFF3B812AD84171A308B8747351352C381AC3DF1B39FB860C9975F62F4C8`

# v0.8.0

Markdown chat rendering and interactive copy controls.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.8.0.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.8.0.exe.blockmap`
- `latest.yml`

## Added

- Integrated a custom high-performance Markdown parser in the main UI console to render assistant prose with proper paragraphs, headings, bullet lists, numbered lists, blockquotes, and inline emphasis.
- Redesigned assistant code blocks as clean, isolated containers featuring code syntax wrappers, language badges, and direct "Copy" buttons.
- Integrated a global click event delegate to handle copy actions on dynamically streamed and history-loaded code blocks safely.

## Refined

- Transitioned the main assistant chat feed from a raw `<pre>` tag dump to a fully styled Markdown document format using the cockpit's neon design system.
- Upgraded live text streaming and recovery signals to render Markdown in real-time, safely auto-closing block formatting at stream completion.

## Verified

- `npm run build`
- `npm run test:stream-parser`
- `npm run test:memory`
- `npm run test:reliability-controls`
- Visual review of markdown styling, headers, lists, code containers, and copy buttons
- `npm run dist:win`
- `npm run test:packaged-smoke`
- `npm run test:installed-ui-smoke`

SHA256: `PENDING_BUILD`

# v0.7.9

Stability, task queue diagnostics, and timing controls.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.9.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.9.exe.blockmap`
- `latest.yml`

## Added

- Integrated task queue diagnostics, tracking task durations across all execution phases (queued, planning, first output, total).
- Added local task bus pause and resume queue controls in the main console header.
- Added quick task run profile toggle to switch between standard and lighter execution footprints.

## Verified

- `npm run build`
- `npm run test:reliability-controls`
- `npm run test:stream-parser`
- `npm run test:memory`
- `npm run test:installed-ui-smoke`

SHA256: `7F6E45E8D23AB9029CF6E87A5E9555C09B4232C0AE3E91219CE95B6082498263`

# v0.7.8

Provider health failover check and reliability controls.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.8.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.8.exe.blockmap`
- `latest.yml`

## Added

- Integrated LLM provider health check service (`server/providerHealth.mjs`) to verify provider connectivity.
- Added automatic failover and run recovery actions (retry, fallback to Codex, settings adjustments) on model failures.
- Added provider health state status checks and settings endpoints.
- Added provider failure simulation testing (`scripts/test-provider-failures.mjs`).

## Verified

- `npm run build`
- `npm run test:provider-failures`
- `npm run test:reliability-controls`
- `npm run test:memory`
- `npm run test:packaged-smoke`

SHA256: `8DE4532B4527718A9EBDCE23D87B420CBE2877B6D90C8A906F8CE2D7E95BCB5B`

# v0.7.7

Faster local updates and build pipeline improvements.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.7.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.7.exe.blockmap`
- `latest.yml`

## Added

- Added `scripts/install-local-fast.ps1` PowerShell script to deploy locally built unpackaged binaries.
- Introduced `npm run install:local:fast` to test client-server changes immediately without a full installer build.
- Updated styling for model presets and instructions grids.

## Verified

- `npm run build`
- `npm run package:win:dir`
- Local silent installer deploy via PowerShell

SHA256: `A5C8E75C418EBDCE89547B228DE890C05CE8D92AECE3B87A89DECD5298EA0CD8`

# v0.7.6

Chat reliability and desktop polish release.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.6.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.6.exe.blockmap`
- `latest.yml`

## Refined

- Redesigned the Run chat as a lighter coding-console transcript with compact message rows, calmer task lifecycle chrome, and a tighter composer/workspace stack.
- Kept the neural orb readable by reducing chat panel height, glow, and visual weight while preserving persistent chat sessions and task actions.
- Renamed the chat drawer header to plain Chat History and tightened the prompt placeholder around coding work.
- Disabled automatic spoken task summaries by default and removed the after-prompt/after-task speech calls; dictation remains available when voice input is enabled.
- Strengthened Windows shortcut icon repair so repaired and in-app-update-created shortcuts point at the packaged app icon file.

## Verified

- `npm run build`
- `npm run test:voice-settings`
- `npm run test:stream-parser`
- `npm run test:memory`
- `npm run test:live-smoke`
- `npm run test:artifacts`
- Browser UI review of the desktop Run chat layout and Chat History drawer
- `npm run test:packaged-smoke`
- `npx electron-builder --win nsis --publish never`
- Silent local install verified at `0.7.6` with Desktop and Start Menu shortcuts targeting the installed executable and packaged icon
- `npm run test:installed-ui-smoke`

SHA256: `38683D123ED553664A129DA12BBC55B60C9CDB77B3CDC48AF4341BBE4829808A`

# v0.7.5

Chat interface refinement release.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.5.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.5.exe.blockmap`
- `latest.yml`

## Refined

- Moved the desktop Run transcript and composer into a lower-left console stack so the neural orb stays visible instead of being covered by the chat surface.
- Restyled the response area as a denser coding transcript with full-width role rows, subtle rails, monospace assistant output, calmer live state glow, and compact task actions.
- Reworked the prompt composer with a focused terminal-style shell, smaller Run button, improved focus treatment, and textarea auto-growth for multi-line prompts.
- Reduced top HUD and right-side mission panel weight so chat, memory, and artifact context feel present without dominating the orb.
- Tightened the chat drawer footprint and visual density to keep session management available without turning it into the main surface.

## Verified

- `npm run build`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- `npm run test:memory`
- Browser UI review across desktop and mobile Run chat layouts
- `npm run dist:win`
- Silent local install verified at `0.7.5` with Desktop and Start Menu shortcuts targeting the installed executable
- `npm run test:installed-ui-smoke`

SHA256: `DEDD6D2357FCD8EADF933EE487DDEC620A48D00315D063D2317820FB62AC4D7D`

# v0.7.4

Reliability, stability, and UI hardening release.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.4.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.4.exe.blockmap`
- `latest.yml`

## Fixed

- Hardened browser storage reads/writes so blocked or unavailable `localStorage` no longer breaks startup, setup, saved workspaces, or selected chat restoration.
- Guarded live-event JSON parsing so malformed server-sent events are skipped with a visible status instead of taking down the UI handler.
- Made backend JSON state writes atomic to reduce the chance of corrupted config/session files after crashes or shutdowns.
- Made diagnostics log-tail reads tolerant of rotated or deleted log files.
- Locked the Windows installer target back to the existing `Jarvis Neural Command Interface` install folder so in-app updates replace the current app instead of creating a second lowercase install.

## Refined

- Added another UI hardening layer for disabled states, long text wrapping, scroll behavior, update banners, diagnostics cards, settings panels, and small-screen layouts.

## Verified

- `npm run build`
- `npm run test:memory`
- `npm run test:voice-settings`
- `node --check electron/main.cjs`
- `node --check server/index.mjs`
- `npm run test:artifacts`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- Browser UI review across Run, Memory, and Diagnostics views
- `npm run package:win`
- `npm run test:packaged-smoke`
- `npm run dist:win`
- `npm run test:installed-ui-smoke`
- Local install verified at `0.7.4` with Desktop and Start Menu shortcuts targeting the installed executable

SHA256: `31C02F4F27F74E6691D9E15CF64001EEF1DDE0BDDE4197065378D6016F800903`

# v0.7.3

Focused UI refinement release.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.3.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.3.exe.blockmap`
- `latest.yml`

## Refined

- Added another final UI review layer for Run, chat sessions, memory, diagnostics, settings, updater surfaces, and small-screen layouts.
- Tightened chat session controls with clearer button labels/tooltips and more stable icon button sizing.
- Improved neural memory surfaces with better node-style chip styling, wrapping, spacing, and scroll behavior.
- Added stronger focus states, consistent panel radii, safer text wrapping, and calmer update/diagnostics cards.
- Rebalanced desktop Run spacing so the timeline, workspace selector, prompt dock, side cards, and radial navigation do not crowd each other.

## Verified

- `npm run build`
- Browser UI review across Run, Memory, Diagnostics, Settings, and chat drawer states
- Recovery Dismiss action verified in the Run view
- Chat drawer open state verified with the bottom Chats toggle hidden and non-clickable
- `npm run test:memory`
- `npm run test:voice-settings`
- `node --check electron/main.cjs`
- `npm run test:artifacts`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- `npm run package:win`
- `npm run test:packaged-smoke`
- `npm run dist:win`
- `npm run test:installed-ui-smoke`
- Local install verified at `0.7.3` with Desktop and Start Menu shortcuts targeting the installed executable

SHA256: `B857453716ABF8DC74BA727BFA78772E9653844BEBBB85921EE50AFAACC17192`

# v0.7.2

Updater reliability and five-pass UI refinement release.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.2.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.2.exe.blockmap`
- `latest.yml`

## Fixed

- Hardened the desktop update handoff so a silent NSIS installer cannot leave Jarvis waiting forever after the EXE has already been replaced.
- The update handoff now times out stale installer processes, verifies the installed executable version, repairs Desktop and Start Menu shortcuts, and relaunches Jarvis from the installed path.
- The frontend now passes the target update version into the desktop bridge so the handoff log can compare expected and installed versions.

## Five UI Passes

- Pass 1, Run cockpit: refined mission panel spacing, prompt/workspace anchoring, transcript height, and side-card memory clipping.
- Pass 2, global chrome and updater: tightened nav active states, update banner contrast, and missing theme token fallbacks.
- Pass 3, memory surfaces: improved memory chip wrapping, memory card height, review queue readability, and action wrapping.
- Pass 4, dashboard/diagnostics/release: normalized card radius, release checklist wrapping, storage/fix grids, and long-path handling.
- Pass 5, chat/history/responsive: tightened chat drawer actions, long code/file wrapping, mobile update banner stacking, and small-screen grid behavior.

## Verified

- `npm run build`
- `npm run test:memory`
- `npm run test:voice-settings`
- `node --check electron/main.cjs`
- `npm run test:artifacts`
- `npm run test:stream-parser`
- `npm run test:live-smoke`
- Browser UI review across Run, Memory, Diagnostics, and History views
- `npm run package:win`
- `npm run test:packaged-smoke`
- `npm run dist:win`
- `npm run test:installed-ui-smoke`
- Local install verified at `0.7.2` with Desktop and Start Menu shortcuts targeting the installed executable

SHA256: `F4D1AB85A897082954B7BFB52533075BAEBD1AC8DABDC8A9BC6996E52F10FFA7`

# v0.7.1

Patch release for the Run cockpit update path.

## Download

Release assets:

- `Jarvis-Neural-Command-Interface-Setup-0.7.1.exe`
- `Jarvis-Neural-Command-Interface-Setup-0.7.1.exe.blockmap`
- `latest.yml`

## Fixed

- Removed the extra task template strip from the Run view.
- Rebalanced the mission transcript and workspace selector spacing so the UI feels cleaner around the orb.
- Kept the release metadata compatible with the in-app updater so v0.7.0 can see and install v0.7.1.

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

SHA256: `B40BDB52C1890A704CB23BA0999CD82F024907B8102BEC52523F94F4B03D9B56`

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
