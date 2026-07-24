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
- Deferred / soft-skip legs that set `pass=true` without execute proof, **except** the explicit QEMU x64 → `darwin-arm64` fleet gap recorded as `crossBuiltOnly`/`deferred` (never claimed as host-proven)
- Aggregate pass while any currently required host-proven platform is missing
- **GitHub-hosted `macos-*` runners for any product Darwin build or host proof**

## Required platforms

| Platform id | Host requirement | Current fleet status |
|---|---|---|
| `linux-x64-gnu` | Linux x86_64 | Host-proven on `ubuntu-22.04` |
| `linux-arm64-gnu` | Linux aarch64 | Host-proven on `ubuntu-22.04-arm` |
| `darwin-x64` | macOS x86_64 (not Rosetta-only labels) | Host-proven on Sylphx self-hosted `[self-hosted, sylphx, macos, standard]` (QEMU amd64) |
| `darwin-arm64` | macOS arm64 | Host proof deferred until Apple Silicon **self-hosted** capacity exists; cross-build only on the x64 fleet. **Never GitHub-hosted `macos-*`.** |
| `win32-x64-msvc` | Windows x86_64 | Host-proven on `windows-latest` until a self-hosted Windows pool exists |

## Self-hosted macOS policy

- Product Darwin CI must use Sylphx self-hosted labels `[self-hosted, sylphx, macos, standard]` only.
- GitHub-hosted `macos-*` runners are forbidden for product Darwin build and host proof (`PROJECT.md`).
- Current Sylphx macOS fleet is QEMU x86_64 (`darwin-x64`). That host proves `darwin-x64` only.
- `darwin-arm64` host runtime proof requires Apple Silicon self-hosted capacity. Until then, cross-build on the x64 fleet is allowed as **build evidence only** and must not be claimed as host runtime proof.

## Workflows

- Candidate (unpublished): `.github/workflows/candidate-host-runtime-proof.yml`
- Published registry: `.github/workflows/registry-install-proof.yml`
- Regression guard: `bun run check:no-github-hosted-macos`
