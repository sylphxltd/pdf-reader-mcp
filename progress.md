# Progress

## Status: In Development

## Completed
- [x] Core MCP `read_pdf` tool
- [x] Local path and URL sources
- [x] Metadata, page count, text, image, and table extraction
- [x] Filesystem and HTTP access restrictions
- [x] Structured element output via `include_elements`
- [x] Deterministic semantic hints via `include_semantic_hints`
- [x] Page-aware Markdown rendering via `include_markdown`
- [x] Escaped page-aware HTML rendering via `include_html`
- [x] Citation-ready page, semantic, size, and table chunks via `include_chunks`
- [x] Table and table-cell geometry for structured table output
- [x] Column-aware ordering for common multi-column layouts
- [x] Outline, annotation, structure tree, page label, permission, form field, attachment metadata, and page geometry outputs
- [x] Deterministic content safety findings via `include_safety_findings`
- [x] Quality evals for semantic chunks, table ordering, renderers, and safety findings
- [x] Release workflow migrated from the internal BUMP workflow to Changesets release PRs

## In Progress
- [ ] Publish the PDF Intelligence vNext release through the Changesets version PR flow
- [ ] Expand fixture coverage for layout, chunking, document signals, and structured output

## Planned
- [ ] Richer semantic layout detection with broader fixtures and evals
- [ ] OCR for scanned PDFs
- [ ] Optional redaction and safety policy controls
- [ ] Optional advanced parser engine adapters
- [ ] Large-file streaming beyond the current 100MB cap
