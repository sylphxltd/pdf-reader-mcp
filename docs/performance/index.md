# Performance

PDF Reader MCP is optimized for speed and efficiency.

## Reproducible Benchmark

Run the local benchmark against the checked-in sample PDF:

```bash
bun run benchmark
```

The benchmark performs warmup iterations, then prints a table and JSON summary
with average, minimum, and maximum latency for these fixed scenarios:

| Scenario | Notes |
|----------|-------|
| `metadata_page_count` | Fast metadata and page-count path |
| `full_text` | Full selectable-text extraction |
| `selected_page_text` | Single-page extraction |
| `v3_agent_document_twin` | Document map, text layer, document AST, trust report, accessibility report, chunks, semantic hints, layout diagnostics, and tables |

Treat benchmark output as machine- and fixture-specific. Public performance
claims should cite the command, fixture, runtime, and measured output.

## Quality Benchmark

Run the deterministic quality benchmark:

```bash
bun run benchmark:quality
```

The quality benchmark prints a table and JSON report. It exits with a non-zero
status if any quality gate fails.

| Scenario | Quality gate |
|----------|--------------|
| `agent_document_twin_semantic_quality` | Semantic roles, citation chunks, table ordering, safety findings, Markdown/HTML rendering, text-layer evidence, document map, document AST, accessibility report, and inspection tool routing |
| `recursive_reading_order_quality` | Spanning header, independent column bands, and footer reading sequence |
| `ocr_text_layer_quality` | Local OCR provider normalization, word boxes, confidence, language, render evidence, and OCR text-layer summary |
| `scanned_pdf_fixture_pipeline_quality` | Runtime-generated image-only PDF fixture through `read_pdf` load, render, OCR provider, OCR text-layer fusion, document map routing, and low-confidence layout diagnostics |
| `visual_region_analysis_quality` | Local command and HTTP visual-region provider normalization for table cells/spans/boxes, formula fields, chart axes/series, confidence, warnings, and crop evidence |
| `search_evidence_quality` | Selectable text search with character-derived boxes and OCR search with word-level boxes plus render provenance |
| `ai_safety_overlap_quality` | Overlapping text detection for visual-spoofing or obscured-content risk |

This benchmark uses in-repository synthetic cases, a runtime-generated scanned
PDF fixture, and mock local providers so it is reproducible in CI and on
developer machines. It is a contract-quality gate, not a claim about a
particular OCR, table, formula, chart, or vision model's real-world accuracy.
Provider-specific accuracy and latency claims require separate public
scanned/visual fixture runs.

## Provider Benchmark

Run the optional installed-provider benchmark when the local machine has the
provider binary installed:

```bash
bun run benchmark:providers
```

The provider benchmark currently exercises the `tesseract-tsv` OCR preset over
a runtime-generated PDF rendered through `read_pdf` OCR fusion. It checks
recognized tokens, word-level bounding boxes, and document-map OCR provenance.
If `tesseract` is not available on `PATH`, the case reports `skipped` and exits
successfully by default. Release or provider-certification environments can
make skipped providers fail with:

```bash
MCP_PDF_PROVIDER_BENCHMARK_REQUIRED=true bun run benchmark:providers
```

## Optimization Tips

### 1. Inspect Before Heavy Extraction

Use `inspect_pdf` first when an agent does not know the document shape. It
samples a bounded number of pages, counts selectable text and image paint
operations, and recommends ordered `next_tools` plus `read_pdf` arguments
without decoding image bytes.

```json
{
  "sources": [{ "path": "doc.pdf" }],
  "sample_pages": 5,
  "include_metadata": true
}
```

### 2. Request Only What You Need

```json
// Fast - metadata only
{
  "sources": [{ "path": "doc.pdf" }],
  "include_metadata": true,
  "include_page_count": true,
  "include_full_text": false,
  "include_images": false
}
```

### 3. Search Before Reading Whole Sections

Use `search_pdf` when an agent needs to find relevant evidence before running
larger extraction, rendering, or crop workflows. Search is bounded by page and
match caps.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-50" }],
  "query": "risk controls",
  "max_pages": 50,
  "max_matches_per_source": 10
}
```

### 4. Use Page Ranges

Instead of full text extraction, request specific pages:

```json
{
  "sources": [{
    "path": "doc.pdf",
    "pages": [1, 2]  // Only first two pages
  }],
  "include_full_text": false,
  "include_metadata": false,
  "include_page_count": false,
  "include_images": false
}
```

### 5. Batch Sources

Process multiple PDFs in one request for better throughput:

```json
{
  "sources": [
    { "path": "doc1.pdf" },
    { "path": "doc2.pdf" },
    { "path": "doc3.pdf" }
  ],
  "include_full_text": true,
  "include_metadata": false,
  "include_page_count": false,
  "include_images": false
}
```

### 6. Avoid Images Unless Needed

Image extraction involves encoding to PNG and base64, which adds overhead:

```json
// Slower
{ "include_images": true }

// Faster
{ "include_images": false }
```

### 7. Use The Document Map For Full Agent Navigation

`include_document_map` builds the richest TypeScript-first response path. It
links pages, elements, chunks, layout diagnostics, safety findings, routing
signals, and page geometry without embedding image bytes in JSON. It does more
work than metadata-only extraction, but it prevents agents from rebuilding the
same references themselves.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_document_map": true,
  "include_full_text": false
}
```

### 8. Render Pages With Explicit Bounds

`render_page` returns PNG page evidence as MCP image parts. Rendering is more
expensive than text extraction, so select pages, keep scale practical, and rely
on the default pixel budget unless a workflow truly needs higher resolution.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-2" }],
  "scale": 2,
  "max_pages": 2,
  "max_pixels_per_page": 16000000
}
```

### 9. Crop Regions Instead Of Carrying Whole Pages

`extract_regions` reuses bounded page rendering but returns focused crops for
specific PDF-coordinate bounding boxes. It is usually cheaper for downstream
vision/OCR steps than passing a whole rendered page.

```json
{
  "sources": [{
    "path": "doc.pdf",
    "regions": [{
      "id": "table-1",
      "page": 1,
      "bounding_box": { "left": 72, "bottom": 420, "right": 540, "top": 620 }
    }]
  }],
  "scale": 2,
  "max_regions": 20
}
```

### 10. OCR Only The Pages That Need It

`ocr_pages` renders selected pages and sends temporary PNGs to the configured
local OCR provider. OCR cost depends on render scale, page count, provider
runtime, and output size, so use `inspect_pdf` first and keep page selections
tight.

```json
{
  "sources": [{ "path": "scan.pdf", "pages": "1-3" }],
  "scale": 2,
  "max_pages": 3,
  "timeout_ms": 60000,
  "max_output_chars": 200000,
  "languages": ["eng"]
}
```

### 11. Use Structured Elements When You Need References

`include_elements` adds page-level element metadata for agent workflows. It is
worth enabling when you need stable IDs, provenance, or best-effort coordinates,
but plain text remains the leanest response shape.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_elements": true,
  "include_full_text": false
}
```

### 12. Add Semantic Hints Only When They Help

`include_semantic_hints` adds deterministic heading, list, and paragraph hints
to text elements. It returns elements even when `include_elements` is omitted.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_semantic_hints": true,
  "include_full_text": false
}
```

### 13. Use Markdown When You Need Ready-to-Use Context

`include_markdown` creates page-aware Markdown in the JSON response. It is
more convenient than rebuilding sections from `page_texts`, but it still
requires page extraction.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_markdown": true,
  "include_full_text": false
}
```

### 14. Use Chunks When You Need Source References

`include_chunks` creates citation-ready chunks with element IDs, strategy
labels, and best-effort bounding boxes. It can split on semantic heading
boundaries when `include_semantic_hints` is enabled, and it can emit table
chunks when `include_tables` is enabled. It is useful for retrieval and
citations, but it does more work than metadata-only or page-count requests.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_chunks": true,
  "include_semantic_hints": true,
  "include_full_text": false
}
```

### 15. Use HTML Only When Needed

`include_html` creates escaped page-aware HTML. It is useful for preview and
export workflows, but plain text or Markdown are usually leaner for agent-only
context.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_html": true,
  "include_full_text": false
}
```

### 16. Use Layout Diagnostics For Routing

`include_layout_diagnostics` returns page layout profiles, reading-order
confidence, column signals, and warnings. It uses already extracted content
geometry and does not add OCR, vision, or parser dependencies. It is useful
before unattended RAG indexing or citation-critical summarization.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_layout_diagnostics": true,
  "include_chunks": true,
  "include_full_text": false
}
```

### 17. Use Document Signals For Bounded Structure

Outline, page labels, permissions, structure trees, form fields, attachment
metadata, and page geometry can be requested without extracting full page text.
Annotations, structure trees, and page geometry respect selected page ranges.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_outline": true,
  "include_structure_tree": true,
  "include_page_geometry": true,
  "include_full_text": false
}
```

### 18. Use Accessibility Reports Instead Of Raw Structure Dumps

`include_accessibility_report` summarizes tagged-PDF coverage, structure tree
availability, headings, images, links, forms, and accessibility permissions in
one compact report. Prefer it when an agent needs routing guidance instead of
the full raw structure tree or annotation payload.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_accessibility_report": true,
  "include_full_text": false
}
```

### 19. Use Text Layers For Run, Line, Word, And Character Evidence

`include_text_layer` keeps run, line, word, and character references in
structured JSON with page-level ranges and estimated bounding boxes. Prefer it
when an agent needs text evidence anchors but does not need full raw page
content.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_text_layer": true,
  "include_full_text": false
}
```

### 20. Use Safety Findings When Agents Consume PDF Text

`include_safety_findings` scans extracted page text for deterministic risk
signals, including prompt-injection-like text, tiny text, off-page text, and
overlapping text that may visually spoof or obscure content. It requires page
text extraction, but it does not force `full_text` into the JSON response.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_safety_findings": true,
  "include_full_text": false
}
```

## Concurrency

The server processes multiple sources concurrently with a default limit of 3 simultaneous operations to prevent memory exhaustion.

## File Size Limits

- Maximum file size: 100MB
- Files exceeding this limit will return an error

## Memory Usage

Memory usage scales with:
- Number of concurrent sources
- PDF complexity
- Image extraction enabled

For large PDFs or many concurrent requests, ensure adequate system memory.
