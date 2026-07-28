---
"@sylphx/pdf-reader-mcp": patch
---

Fix Gemini Antigravity / dual-era MCP clients that send `server/discover` before `initialize`: answer SEP-2575 discovery without closing stdio, then complete the legacy handshake (fixes #598).
