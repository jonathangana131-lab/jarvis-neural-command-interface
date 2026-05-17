# v0.2.2

Hardening release for the public Windows build.

## Download

Attach this file to the GitHub release:

- `Jarvis-Neural-Command-Interface-Setup-0.2.2.exe`

## Fixed And Improved

- Replaced deprecated `@xenova/transformers` with maintained `@huggingface/transformers`, clearing the npm audit report.
- Added a desktop startup issue window so the app shows backend startup errors instead of silently quitting.
- Added renderer boot failure recovery so the UI gives a useful service-offline state if `/api/config` cannot load.
- Added a live stream smoke test that sends two messages through a mock streaming model endpoint.
- Added a packaged app smoke test that launches the built Windows app with a clean profile and verifies two streamed messages.
- Split large frontend vendor bundles so the production build no longer emits the oversized chunk warning.

## Still Unsigned

The installer is still unsigned. Windows may show a SmartScreen warning until the app is signed with a real code-signing certificate.

SHA256: `CDF649F3246A10DF8079773BE22F63EB858DDFD86B75E09813871ECF2F530C3D`
