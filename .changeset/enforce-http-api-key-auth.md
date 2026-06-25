---
"@sylphx/pdf-reader-mcp": patch
---

Security: enforce HTTP transport authentication (X-API-Key).

Previously the HTTP transport (`MCP_TRANSPORT=http`) read `MCP_API_KEY` and
logged "API key authentication enabled" but never checked the header, so any
client that could reach the port could call every PDF tool. The key is now
enforced — when `MCP_API_KEY` is set, every `/mcp` request must present a
matching `X-API-Key` header (constant-time comparison) or it is rejected with
`401`; `/mcp/health` stays open. (CWE-306, reported by novice-22.)

Hardening, both behavior changes for HTTP deployments:

- `MCP_HTTP_HOST` now defaults to `127.0.0.1` (loopback) instead of `0.0.0.0`.
  Set it explicitly to expose other interfaces.
- The server warns at startup when it binds a non-loopback host with no API key.

`stdio` (the default transport) is unaffected.
