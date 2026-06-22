---
"@sylphx/pdf-reader-mcp": major
---

Release PDF Reader MCP V3 with a smart, lower-context MCP tool surface.

`read_pdf` is now the primary smart entrypoint: when no explicit `include_*`
options are supplied, it automatically inspects each PDF, chooses a high-value
extraction route, and returns routing metadata alongside the Agent Document
Twin. Callers can still force manual extraction with `auto: false` or precise
`include_*` options.

The public MCP tool list is consolidated to `read_pdf`, `search_pdf`, and
`pdf_evidence`. `pdf_evidence` replaces separate public inspect, render, crop,
OCR, and visual-analysis tools with one operation-based evidence tool:
`inspect`, `render_page`, `extract_regions`, `ocr_pages`, and
`analyze_regions`.

Public docs, API reference, guide, comparison, design notes, V3 spec, and the
weekly update now describe the V3 smart-reader workflow and focused evidence
operations.
