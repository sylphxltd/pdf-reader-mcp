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

### 1. Request Only What You Need

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

### 2. Use Page Ranges

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

### 3. Batch Sources

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

### 4. Avoid Images Unless Needed

Image extraction involves encoding to PNG and base64, which adds overhead:

```json
// Slower
{ "include_images": true }

// Faster
{ "include_images": false }
```

### 5. Use Structured Elements When You Need References

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

### 6. Add Semantic Hints Only When They Help

`include_semantic_hints` adds deterministic heading, list, and paragraph hints
to text elements. It returns elements even when `include_elements` is omitted.

```json
{
  "sources": [{ "path": "doc.pdf", "pages": "1-5" }],
  "include_semantic_hints": true,
  "include_full_text": false
}
```

### 7. Use Markdown When You Need Ready-to-Use Context

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

### 8. Use Chunks When You Need Source References

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

### 9. Use HTML Only When Needed

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

### 10. Use Document Signals For Lightweight Structure

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

### 11. Use Safety Findings When Agents Consume PDF Text

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
