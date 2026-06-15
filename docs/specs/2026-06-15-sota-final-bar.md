# SOTA Final Bar

Date: 2026-06-15
Status: active

## Goal

PDF Reader MCP is complete only when it is a TypeScript-first full-fidelity PDF
intelligence system for agents, not merely a PDF parser with optional helpers.
The target product shape is an Agent Document Twin: every agent-facing answer
must be traceable to text, visual, semantic, safety, and evidence layers.

This document is the completion bar for future release decisions. Foundation
milestones, adapter interfaces, or roadmap wording do not satisfy this bar by
themselves.

## Required Capabilities

1. Lossless selectable-text evidence
   - Preserve text runs, font/direction metadata where exposed, line records,
     word records, character records, page offsets, and provenance.
   - Use exposed text direction for right-to-left row and same-direction column
     ordering instead of forcing all selectable text into left-to-right order.
   - Report run-level font, direction, transform, and end-of-line metadata
     coverage in text-layer and document-map summaries.
   - Provide bounding boxes at run, line, word, character, table, cell, image,
     crop, and page levels when the source exposes enough geometry.
   - Label estimated geometry explicitly; never imply glyph-perfect geometry
     unless backed by a source that proves it.

2. Robust reading order
   - Implement deterministic recursive layout segmentation for mixed
     single-column, multi-column, spanning-header, footer, sidebar, and table
     regions.
   - Expose reading-order confidence and diagnostics that route agents to
     visual verification when confidence is low.

3. Scanned-PDF pipeline
   - Render selected pages, run OCR through a validated local provider or
     separately installable preset, normalize word boxes, and fuse OCR output
     into the document map with provenance.
   - Include scanned fixtures and accuracy/latency reporting.

4. Table intelligence
   - Combine deterministic text-table clustering with visual table recognizer
     provider support.
   - Report cell boxes, header/span hints, continuation candidates, confidence,
     and failure modes against public fixtures.

5. Formula, chart, and figure enrichment
   - Support provider-backed formula recognition, chart-to-data extraction, and
     figure/image descriptions.
   - Normalize outputs into the same evidence model with crop IDs,
     confidences, warnings, caption-derived visual-region routing, and
     benchmark coverage.

6. Tagged-PDF and accessibility intelligence
   - Read structure trees when available, correlate tags with visible content,
     surface accessibility risks, and avoid claiming certification unless a
     dedicated validator proves it.

7. AI-safety trust reporting
   - Detect hidden, tiny, off-page, overlapping, visually spoofed, unsafe-link,
     and prompt-injection-like content with page evidence and routing guidance.

8. Reproducible proof
   - Public benchmark commands must measure speed and quality, not just runtime.
   - Fixtures must cover selectable text, multi-column layout, tables, scans,
     formulas, charts, figures, hidden text, annotations, forms, attachments,
     and tagged PDFs.
   - `bun run benchmark:quality` is the deterministic contract-quality gate for
     Agent Document Twin semantics, inspection tool routing, real PDF document
     signals, real PDF reading order, text-layer evidence and metadata coverage in the
     document map, accessibility tag-to-visible-content coverage,
     table cell evidence coverage, caption-to-evidence links, OCR
     normalization, a runtime-generated scanned-PDF OCR pipeline fixture,
     OCR-derived table extraction from scanned-page word boxes,
     caption-derived visual candidate routing, visual-region command/HTTP
     normalization, search evidence, and AI-safety trust-report hidden-text
     and unsafe-link routing.
   - `bun run benchmark:providers` is the installed-provider benchmark
     for optional OCR engines such as `tesseract-tsv` and configured
     visual-region providers. It reports an `ocr-text-layer` profile for OCR
     word-box fusion and a `visual-full-fidelity` profile for runtime table,
     formula, chart, figure, and image-description crop certification when
     those providers are installed; skipped providers are explicit and can be
     made blocking with `MCP_PDF_PROVIDER_BENCHMARK_REQUIRED=true`.
   - Provider-specific OCR, table, formula, chart, and image-description
     accuracy beyond the certification fixtures still requires public
     scanned/visual fixture benchmarks before any model-quality claim.

9. Public contract integrity
   - README, docs, changelog, release notes, and package metadata may describe
     only validated shipped behavior.
   - Advanced capabilities remain roadmap language until tests, evals, and
     benchmarks prove them.

## Release Gate

A new major release should not be treated as complete until:

- Every required capability above has direct test, fixture, eval, or benchmark
  evidence.
- CI runs those checks or a documented local benchmark command produces a
  reproducible artifact.
- Public docs match the verified behavior without competitor references or
  unproven superiority claims.
- The published npm package smoke test proves the released package exposes the
  expected MCP tools and contract version.
