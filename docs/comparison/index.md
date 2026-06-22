# Capability Overview

PDF Reader MCP is designed as a full-fidelity PDF intelligence layer for
agents. The comparison below is category-based and focuses on the agent
workflow: inspect, search, verify source evidence, enrich visual regions, and
read a linked document twin.

| Capability | PDF Reader MCP | Text/CLI tools | Cloud PDF APIs | Generic filesystem MCP |
| --- | --- | --- | --- | --- |
| MCP-native PDF tools | ✅ | ❌ | ❌ | ⚠️ raw file access only |
| Preflight inspection and routing | ✅ | ❌ | ⚠️ API-specific | ❌ |
| Literal search with evidence | ✅ snippets, offsets, boxes, provenance | ⚠️ text only | ⚠️ varies | ❌ |
| Text layer fidelity | ✅ runs, lines, words, chars, metadata coverage | ⚠️ usually text only | ⚠️ varies | ❌ |
| Agent Document Twin | ✅ document map plus AST and evidence indexes | ❌ | ⚠️ vendor-specific | ❌ |
| Page rendering evidence | ✅ bounded MCP image parts | ⚠️ external commands | ✅ | ❌ |
| Region crop evidence | ✅ PDF-coordinate crops | ⚠️ custom glue | ✅ | ❌ |
| Scanned-page OCR path | ✅ configured local provider with provenance | ⚠️ external glue | ✅ | ❌ |
| OCR-derived tables | ✅ when OCR word boxes are available | ❌ | ⚠️ varies | ❌ |
| Table quality diagnostics | ✅ cells, geometry, spans, warnings, continuation hints | ❌ | ⚠️ varies | ❌ |
| Formula/chart/figure/image enrichment | ✅ configured visual-provider adapters | ❌ | ⚠️ vendor-specific | ❌ |
| Trust report | ✅ hidden text, prompt-injection-like text, visual spoofing, unsafe links, redaction | ❌ | ⚠️ varies | ❌ |
| Accessibility report | ✅ tagged-PDF, tag-visible coverage, forms, links, images, permissions, grades | ❌ | ⚠️ varies | ❌ |
| Citation chunks | ✅ page, semantic, size, and table chunks | ❌ | ⚠️ varies | ❌ |
| Local-first default | ✅ | ✅ | ❌ | ✅ |
| No required API key | ✅ | ✅ | ❌ | ✅ |
| Reproducible release proof | ✅ quality, corpus, provider, package-smoke, and release-gate artifacts | ❌ | ❌ | ❌ |

## Why It Matters

Agents need more than extracted text. For high-value PDFs they need to know
where content came from, which page or crop proves it, whether the reading order
looks uncertain, whether a page needs OCR, whether a table has weak geometry,
and whether hidden or unsafe content should be treated as untrusted data.

PDF Reader MCP exposes that as one workflow:

1. `inspect_pdf` profiles the document and recommends the next tools.
2. `search_pdf` finds source-backed text matches before spending context.
3. `render_page` and `extract_regions` provide visual evidence.
4. `ocr_pages` recovers text from scanned or sparse pages through configured
   local OCR providers.
5. `analyze_regions` normalizes configured visual-provider output for tables,
   charts, formulas, figures, and image descriptions.
6. `read_pdf` returns text, Markdown, HTML, chunks, tables, document signals,
   trust reports, accessibility reports, and the linked Agent Document Twin.

## When PDF Reader MCP Is The Better Fit

- You want agents to inspect and route PDFs instead of blindly extracting text.
- You need stable page, element, chunk, crop, table, OCR, trust, and
  accessibility references for downstream citations.
- You need local-first execution and want OCR or visual models configured by the
  deployment, not selected by each request.
- You need source evidence for tables, charts, formulas, figures, and scanned
  pages.
- You want public benchmark artifacts and a release gate that prove the shipped
  capability surface.

## Boundaries

PDF Reader MCP does not bundle heavy OCR, vision, formula, or layout model
weights. The default package stays TypeScript-first and local-first; advanced
OCR and visual understanding are enabled through explicit local providers and
validated through provider benchmarks.
