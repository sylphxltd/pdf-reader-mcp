# Performance

PDF Reader MCP is optimized for speed and efficiency.

## Benchmarks

Benchmarks run on Node.js 22, measuring operations per second.

| Operation | Ops/sec | Notes |
|-----------|---------|-------|
| Metadata only | ~5,000 | Fastest extraction mode |
| Single page text | ~5,300 | Minimal parsing |
| Full text (10 pages) | ~4,500 | Depends on content |
| With images | ~2,000 | Image encoding overhead |

## Optimization Tips

### 1. Inspect Before Heavy Extraction

Use `inspect_pdf` first when an agent does not know the document shape. It
samples a bounded number of pages, counts selectable text and image paint
operations, and recommends `read_pdf` arguments without decoding image bytes.

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

### 3. Use Page Ranges

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

### 4. Batch Sources

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

### 5. Avoid Images Unless Needed

Image extraction involves encoding to PNG and base64, which adds overhead:

```json
// Slower
{ "include_images": true }

// Faster
{ "include_images": false }
```

### 6. Use The Document Map For Full Agent Navigation

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

### 7. Render Pages With Explicit Bounds

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

### 8. Crop Regions Instead Of Carrying Whole Pages

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

### 9. OCR Only The Pages That Need It

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

### 10. Use Structured Elements When You Need References

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

### 11. Add Semantic Hints Only When They Help

`include_semantic_hints` adds deterministic heading, list, and paragraph hints
to text elements. It returns elements even when `include_elements` is omitted.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_semantic_hints": true,
  "include_full_text": false
}
```

### 12. Use Markdown When You Need Ready-to-Use Context

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

### 13. Use Chunks When You Need Source References

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

### 14. Use HTML Only When Needed

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

### 15. Use Layout Diagnostics For Routing

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

### 16. Use Document Signals For Bounded Structure

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

### 17. Use Safety Findings When Agents Consume PDF Text

`include_safety_findings` scans extracted page text for deterministic risk
signals. It requires page text extraction, but it does not force `full_text`
into the JSON response.

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
