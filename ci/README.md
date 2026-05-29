# CI / Release workflow definitions

These two files are the project's GitHub Actions workflows. They live here
because the automated GitHub connection that opened this PR is not permitted to
write into `.github/workflows/` (GitHub gates that path behind a dedicated
"Workflows" permission the connection does not hold). Every other change in the
PR was applied directly.

To activate them, place both files under `.github/workflows/` on this branch or
on `main`:

- `ci/ci.yml`            -> `.github/workflows/ci.yml`
- `ci/release-macos.yml` -> `.github/workflows/release-macos.yml`

Three ways to do it:

1. **One-click links** (pre-fill GitHub's "create file" editor with the exact
   contents) — provided alongside this PR.
2. **Rename in the GitHub web editor** — open each file here, click the pencil,
   and change the path to `.github/workflows/<name>.yml`.
3. **Grant the connection the "Workflows" permission**, after which the files
   can be pushed into place automatically.

## What they do

- `ci.yml` — builds the renderer and runs the Node test suite on Windows,
  macOS, and Linux for every push and pull request.
- `release-macos.yml` — runs on a macOS runner, packages the app (`.dmg` +
  `.zip`, arm64 + x64), and publishes a GitHub Release including
  `latest-mac.yml` for the in-app auto-updater. It triggers automatically when a
  `package.json` version bump lands on `main`, or on demand from the Actions
  tab. It needs no extra secrets — the built-in `GITHUB_TOKEN` is enough.

Once `release-macos.yml` is in `.github/workflows/` on `main`, merging this PR
(which bumps the version to 0.9.0) builds and publishes the first macOS release
automatically.
