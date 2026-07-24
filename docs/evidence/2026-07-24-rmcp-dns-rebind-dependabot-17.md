# Evidence: Dependabot alert #17 (rmcp DNS rebinding)

## Alert
- Package: `rmcp` (Rust), runtime via `crates/pdf-reader-mcp-server/Cargo.toml`
- Advisory: GHSA-89vp-x53w-74fx / CVE-2026-42559
- Severity: high
- Vulnerable range: `< 1.4.0`
- First patched: `1.4.0`

## Fix
- Bump `rmcp` from `0.16.0` → `1.8.0` (includes Host-header validation for Streamable HTTP).
- Wire `StreamableHttpServerConfig.allowed_hosts` from bind host + loopbacks, with
  `MCP_ALLOWED_HOSTS` / `PDF_READER_MCP_ALLOWED_HOSTS` override for public deploys.

## Notes
- Stdio transport is unaffected by this advisory; risk is Streamable HTTP server mode.
- Public non-loopback binds should set allowed hosts explicitly to the public hostname.
