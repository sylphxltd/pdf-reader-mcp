---
"@sylphx/pdf-reader-mcp": patch
---

Fix PdfSession acquire/destroyAll race so in-flight loads never throw "entry missing", and add auto-read OCR session handoff regression coverage.