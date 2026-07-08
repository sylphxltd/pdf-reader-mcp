---
"@sylphx/pdf-reader-mcp": patch
---

Harden read_pdf overhead optimizations: serialize concurrent PdfSession acquires, skip auto-read when callers only specify source pages, add default balanced auto-read benchmark coverage, and expand regression tests for page budgets and session document reuse.