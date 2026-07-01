---
"@sylphx/pdf-reader-mcp": patch
---

Add Docker support, fix license branding, and ship examples in npm tarball.

- New `Dockerfile` for containerized MCP server deployment with pre-installed Tesseract OCR
- New `.dockerignore` for clean build context
- Added comprehensive Docker documentation to installation guide (build, stdio run, HTTP run, Claude Desktop integration, OCR preset)
- Added Docker badge and quick start to README
- Fixed LICENSE copyright from "SylphLab" to "SylphxAI" (2024-2026)
- Added `examples/` to `package.json` files field so examples ship in the npm tarball
