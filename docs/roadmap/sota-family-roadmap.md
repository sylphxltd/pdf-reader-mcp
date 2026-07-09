# SOTA Family Roadmap

Status: adoption plan
Owner: PDF Reader MCP
Scope: repo-local future plan and its role in the SylphxAI MCP family
Decision record: `docs/adr/ADR-389-mcp-family-sota-roadmap.md`

## Family Role

PDF Reader MCP is the document evidence engine for the MCP family. It turns PDF
files into citeable Agent Document Twins with text, layout, tables, trust
signals, search, rendering, crops, OCR routing, and page or region evidence.

It is the mature reader in the family and sets the proof bar for the rest of the
Reader line: local-first defaults, explicit provider routes, benchmark-gated
claims, and provenance that agents can verify.

## Family Fit

| Project | Relationship |
| --- | --- |
| Smart Reader MCP | Routes unknown files into `read_pdf` when the detected format is PDF and preserves PDF evidence in a normalized envelope. |
| Image Reader MCP | Shares media evidence concepts such as bbox, crop, OCR route, confidence, and privacy warnings. |
| Video Reader MCP | Shares temporal or visual evidence conventions where frames, thumbnails, subtitles, and OCR crops need citation. |
| Architecture Reader MCP | Can link repo-adjacent PDFs, ADR exports, design docs, and release reports into architecture evidence. |
| Consultant MCP | Uses PDF evidence as source material for decision review, research, and answer challenge. |

## SOTA End State

PDF Reader MCP should remain the default local PDF instrument for agents:
private by default, layout-aware, table-aware, OCR-capable, benchmarked, and
honest about degraded extraction.

The final product should make unsupported or uncertain PDF behavior visible
instead of letting agents mistake lossy text extraction for truth.

## Runtime Direction

The current TypeScript package remains the stable public surface. Rust should
enter as native acceleration for hot paths where benchmarks prove value:
hashing, search indexes, region lookup, page cache, streaming, layout indexing,
and large-file handling.

The public MCP tool surface should remain stable while internals migrate.
WASM is useful only for sandboxed extractors or portable document transforms,
not for the default high-throughput local server.

## Roadmap

### Phase 0: Contract Lock And Documentation Proof

- Keep `read_pdf`, `search_pdf`, and `pdf_evidence` as the public tool contract.
- Add minimal and rich JSON examples for every operation.
- Mark every performance and quality claim with the command or benchmark that
  proves it.
- Add a family-facing section explaining how PDF evidence flows into Smart
  Reader, Architecture Reader, and Consultant MCP.

### Phase 1: Native Acceleration Boundary

- Identify hot paths with benchmark evidence.
- Add Rust native modules for search index, hash, region lookup, streaming, and
  cache operations only when they improve measured performance.
- Preserve exact Agent Document Twin semantics through golden fixtures.
- Add install diagnostics for native acceleration being unavailable.

### Phase 2: Document Structure Depth

- Improve tables, captions, reading order, forms, annotations, formulas, and
  cross-page layout.
- Return extraction route and confidence for each structured element.
- Add degraded-mode warnings for ambiguous tables, scanned pages, hidden text,
  malformed files, encryption, and redaction-sensitive documents.

### Phase 3: Visual And OCR Evidence

- Expand crop, render, OCR, region analysis, and visual evidence operations.
- Keep provider boundaries explicit: local vs remote, cost, latency, privacy,
  confidence, and failure mode.
- Add reproducible follow-up calls for every visual or OCR-derived claim.

### Phase 4: Enterprise-Grade Distribution

- Ship optional native binary packages when acceleration becomes default.
- Add offline install guidance and artifact checksums.
- Publish release benchmark scorecards from CI artifacts.
- Keep package release proof tied to npm readback and install smoke tests.

## Star And Adoption Strategy

The public promise is proof over plain text. The README should keep showing a
single `read_pdf` call that returns citations agents can verify. Growth comes
from strong demos, repeatable benchmarks, clear privacy defaults, and a release
bar that feels safer than ad-hoc PDF extraction.

## Validation Gates

- Every extracted citation can be rendered, cropped, searched, or inspected.
- OCR output is labeled as OCR and includes route and confidence.
- Native acceleration never changes golden fixture semantics.
- Benchmarks prove any claimed speed improvement.
- Release preflight includes package smoke, docs build, tests, and benchmark
  gates.
