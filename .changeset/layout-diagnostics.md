---
"@sylphx/pdf-reader-mcp": minor
---

Add the v3 agent document map and visual evidence path for PDF intelligence workflows. `include_document_map` now returns linked pages, structured elements, citation chunks, layout diagnostics, safety findings, routing signals, page geometry, and summary counts while keeping image bytes out of JSON. This release batch also adds `render_page`, which renders selected PDF pages as bounded PNG MCP image parts with JSON provenance, evidence IDs, pixel budgets, and page-level metadata for visual inspection and OCR routing. It adds `extract_regions` for PDF-coordinate bbox crops as focused PNG MCP image parts with crop metadata and provenance. It also includes optional `include_layout_diagnostics` output with page layout profiles, reading-order confidence, column signals, and warnings for agent routing.
