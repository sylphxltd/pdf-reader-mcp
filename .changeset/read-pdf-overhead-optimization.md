---
"@sylphx/pdf-reader-mcp": patch
---

Optimize default `read_pdf` overhead by reusing one parsed PDF per source per request, bounding balanced/fast auto-read page extraction to the inspection sample budget, and omitting redundant per-page text MCP content parts when markdown/chunks are already present in the JSON payload.