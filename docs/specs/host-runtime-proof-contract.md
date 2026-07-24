# Five-host runtime proof contract (sole-Rust 4.0.0)

## Required distinct host triples

Runtime proof means the package was **installed and executed on that host architecture**, not merely cross-compiled.

| Platform id | Required host |
|---|---|
| `linux-x64-gnu` | Linux x86_64 |
| `linux-arm64-gnu` | Linux aarch64 |
| `darwin-arm64` | macOS arm64 |
| `darwin-x64` | **macOS x86_64 (not arm64 under Rosetta job labels alone)** |
| `win32-x64-msvc` | Windows x86_64 |

## Rules

1. Build success ≠ runtime proof.
2. A job labeled `darwin-x64` that runs on `macos-14` arm64 and re-proves the arm64 package is **not** Darwin x64 host proof.
3. Proof must include: npm/local install of matching optional native package, MCP initialize, and at least one successful `read_pdf`/`tools/list` call.
4. Record `process.platform`, `process.arch` / `uname -m`, package id, binary path, and server version.
5. Artifact: `verification/pdf-reader-host-runtime-proof-<version>.json` with `distinctHostTriplesProven`.

## Commands

```bash
bun run check:registry-install-proof -- --local-pack
# multi-runner:
gh workflow run registry-install-proof.yml -f version=<candidate>
```

## Enforcement

Set `PROOF_REQUIRE_PLATFORM_ID=<platformId>` so the proof script fails closed when the runner architecture cannot provide that host triple (including Rosetta-translated x86_64 on Apple Silicon).
