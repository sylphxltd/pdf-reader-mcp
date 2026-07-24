# Host runtime proof contract

## Rule

A platform is **runtime-proven** only when:

1. the native binary for that platform is installed, and
2. MCP `initialize` succeeds on a **matching host architecture**, and
3. the proof artifact records `runtimeProofValid=true` with host identity.

## Not accepted as host runtime proof

- Cross-compilation alone
- Installing/running an arm64 package on x64 (or vice versa)
- Rosetta-translated execution claimed as native darwin-x64
- Deferred / soft-skip legs that set `pass=true` without execute proof
- Aggregate pass while any required platform is missing

## Required platforms

- `linux-x64-gnu`
- `linux-arm64-gnu`
- `darwin-arm64` (real Apple Silicon host; GitHub `macos-14` is acceptable)
- `darwin-x64` (real x86_64 macOS host; Sylphx self-hosted)
- `win32-x64-msvc`

## Workflows

- Candidate (unpublished): `.github/workflows/candidate-host-runtime-proof.yml`
- Published registry: `.github/workflows/registry-install-proof.yml`
