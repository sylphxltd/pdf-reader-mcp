#!/usr/bin/env bash
# Changesets version wrapper for Release workflow.
# Must be a single executable command for changesets/action `version` input.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

echo "[release-version] bump package versions from changesets"
node node_modules/@changesets/cli/bin.js version

# Version bumps drift bun.lock's bundled optional-package versions/optionalDependencies
# (the bot's version PR otherwise fails CI's `bun install --frozen-lockfile`). Refresh
# the lockfile here so the version PR ships a consistent lock (mirrors the manual
# "refresh bun.lock" commits that were previously pushed to each release PR).
bun install

echo "[release-version] sync native optional package manifests to root version"
bun run native:sync-manifests

echo "[release-version] sync server.json + Rust SERVER_VERSION"
bun run sync:server-json

# Tracked dist/*.js are rebuilt earlier in Release and may gain +x from bun build.
# changesets/action commitMode=github-api rejects executable files.
if [[ -d dist ]]; then
  echo "[release-version] clear executable bits on tracked dist artifacts"
  find dist -type f \( -name '*.js' -o -name '*.mjs' \) -exec chmod a-x {} +
fi

echo "[release-version] PASS"
