---
"@sylphx/pdf-reader-mcp": minor
---

Add table cell evidence coverage metrics, inferred-cell ratios, and incomplete
geometry warnings so agents can route weak table evidence to visual
verification. Add OCR-derived table extraction from normalized OCR word boxes
for scanned pages. Add caption-derived visual enrichment candidates so
`read_pdf` can route vector-drawn formulas, charts, figures, and diagrams to
the configured visual-region provider even when the PDF does not expose image
objects, and preserve those candidate regions in `read_pdf` and
`document_map` when the optional provider is unavailable so agents can still
crop or retry the same evidence regions. Add dedicated hidden-text trust
routing for selectable text with zero
or near-zero geometry. Replace the empty generated API reference with a
maintained MCP API reference and remove unused TypeDoc docs tooling. Add
direction-aware selectable-text ordering for right-to-left text runs and expose
text-layer font, direction, transform, and end-of-line metadata coverage in the
text layer and agent document map summaries.
