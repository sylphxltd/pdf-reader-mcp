---
"@sylphx/pdf-reader-mcp": patch
---

Fix a whole-process crash when reading PDFs whose ToUnicode CMaps contain malformed destinations (pdfTeX 1-byte `beginbfrange` like `<C5> <D6> <C5>`). Vendor a patched `adobe-cmap-parser` that skips destinations that are not valid UTF-16BE instead of panicking, keep multi-code (6/8-byte) ligature destinations working, and build with panic-unwind so no malformed document can abort the MCP server from a worker-thread panic (fixes #608).
