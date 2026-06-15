# Document AST V3

Date: 2026-06-15
Status: shipped

## Goal

Give agents a semantic tree over the same evidence model used by structured
elements, citation chunks, tables, and the agent document map. The AST should
make PDF traversal easier without creating a second vocabulary or forcing
callers to request every intermediate top-level output.

## Contract

`include_document_ast` returns `document_ast` with:

- `profile: "document_ast"` and version `2026-06-15`.
- A root `document` node containing page nodes.
- Page, section, paragraph, list item, caption, header, footer, table, and
  image node types.
- `element_ids`, `chunk_ids`, page ranges, bounding boxes, confidence, and
  semantic roles where available.
- `section_path` and `continued_from_section_id` metadata where page breaks
  continue the active section context without moving evidence out of the page
  node that owns it.
- Caption nodes can expose `caption_links` for nearby table, image, figure,
  chart, formula, or diagram evidence. Linked target nodes can expose
  `caption_ids` for reverse lookup.
- Table nodes with rows, confidence, quality diagnostics, and continuation
  candidates when deterministic table extraction finds tables.
- Summary counts for pages, nodes, sections, paragraphs, list items, captions,
  headers, footers, section-context nodes, cross-page section contexts, tables,
  images, caption links, and max depth.

The AST is opt-in. It can build the internal element, chunk, semantic, and
table state it needs without forcing top-level `elements`, `chunks`, or
`tables` into the public response.

## Source Of Truth

The AST does not own extraction. It is derived from:

- `PdfDocumentElement` for stable element IDs, content, semantic hints,
  provenance, and coordinates.
- `PdfChunk` for retrieval/citation chunk IDs.
- `ExtractedTable` for table rows, quality, and continuation metadata.

This keeps document map, AST, table chunks, Markdown, and JSON summaries aligned
around one extraction model.

## Boundaries

The AST uses deterministic semantic hints. Numbered/appendix headings, rich
list prefixes, captions, headers, and footers come from conservative
text-pattern and page-edge heuristics with confidence signals. Cross-page
section context preserves deterministic heading continuity as metadata. Caption
links use conservative same-page geometry, horizontal overlap, normalized
caption aliases such as equation/formula and graph/chart, target type, and
distance signals; the AST does not claim ML-grade semantic classification,
cross-page content merging, or visual layout understanding. Those can enrich
the same AST later through optional providers.

## Acceptance Criteria

- `include_document_ast` works without `include_elements` or `include_chunks`.
- AST nodes preserve evidence links through `element_ids` and `chunk_ids`.
- Heading hints create section nodes.
- Paragraph, list, caption, header, and footer hints create leaf nodes.
- Paragraphs and subsections that continue after a page break expose
  `section_path` and `continued_from_section_id`.
- Captions near matching table, image, figure, chart, formula, or diagram nodes
  expose `caption_links`; linked target nodes expose `caption_ids`.
- Table nodes carry table rows and table quality metadata.
- The quality eval covers AST sections, numbered/appendix heading variants,
  paragraphs, rich list prefixes, captions, caption aliases, headers, footers,
  cross-page section context, caption links, and tables.
