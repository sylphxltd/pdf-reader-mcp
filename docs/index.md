---
layout: home

hero:
  name: PDF Reader MCP
  text: Full-Fidelity PDF Intelligence for AI Agents
  tagline: "A TypeScript-first MCP server that turns PDFs into an Agent Document Twin: text layers, semantic AST, tables, visual evidence, OCR provenance, trust reports, accessibility reports, citations, and benchmark-gated release proof."
  image:
    src: /logo.svg
    alt: PDF Reader MCP Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/SylphxAI/pdf-reader-mcp
    - theme: alt
      text: Benchmark Proof
      link: /benchmark
    - theme: alt
      text: Why Evidence-First?
      link: /articles/evidence-first
      

features:
  - icon: "\U0001F4C4"
    title: Agent Document Twin
    details: Return one linked document map with pages, elements, text-layer coverage, chunks, layout diagnostics, trust routing, accessibility routing, visual routing, OCR evidence, and page geometry.
  - icon: "\U0001F50E"
    title: Evidence-First Search
    details: Locate literal text matches with snippets, match offsets, character-derived, text-item, or opt-in OCR-word boxes, and provenance before reading, rendering, cropping, or citing.
  - icon: "\u26A1"
    title: Performance-Bounded Local Execution
    details: Built on pdfjs-dist with concurrent processing, bounded rendering, page limits, pixel budgets, package smoke checks, and reproducible benchmark artifacts.
  - icon: "\U0001F50C"
    title: V3 Smart Tool Surface
    details: Start with read_pdf for automatic Agent Document Twin extraction, use search_pdf for cheap literal evidence, and use pdf_evidence for focused inspect, render, crop, OCR, or visual-analysis operations.
  - icon: "\U0001F5BC\uFE0F"
    title: Visual Evidence and Crops
    details: Render source pages and crop PDF-coordinate regions into bounded image evidence for tables, figures, charts, formulas, annotations, and citations.
  - icon: "\U0001F9FE"
    title: Text Layer Fidelity
    details: Expose direction-aware run, line, word, and character records with page-level ranges, estimated bounding boxes, provenance, and metadata coverage diagnostics for citation and extraction workflows.
  - icon: "\U0001F5BC\uFE0F"
    title: Visual Provider Enrichment
    details: Normalize table, formula, chart, figure, diagram, and image-description evidence from configured command, HTTP, Ollama, OpenAI-compatible, LM Studio, or llama.cpp providers.
  - icon: "\U0001F50D"
    title: Table Intelligence
    details: Extract selectable-text and OCR-derived tables with rows, cells, geometry, confidence, quality metrics, inferred spans, warnings, and continuation candidates.
  - icon: "\U0001F524"
    title: Scanned PDF OCR Path
    details: Route selected rendered pages through configured OCR providers, keep OCR separate from selectable text, and link OCR words and tables back to source-render evidence.
  - icon: "\U0001F9ED"
    title: Semantic AST and Layout Confidence
    details: Traverse sections, paragraphs, lists, captions, tables, images, charts, formulas, and figures while preserving reading-order diagnostics and caption-to-evidence links.
  - icon: "\U0001F6E1\uFE0F"
    title: Trust Report
    details: Surface deterministic prompt-injection, hidden-text, tiny/off-page, overlapping, visual-spoofing, unsafe-link, layout, table-quality, redaction, and page-risk signals.
  - icon: "\u267F"
    title: Accessibility Report
    details: Summarize tagged-PDF coverage, tag-to-visible-content coverage, structure trees, headings, image alt-text verifiability, form labels, link labels, accessibility permissions, issue types, severities, page grades, and document-map routing without claiming PDF/UA certification.
  - icon: "\U0001F9EA"
    title: Benchmark-Gated Releases
    details: Release evidence includes performance, deterministic quality, corpus, installed-provider, provider-manifest crop/scoring, package-smoke, and SOTA release-gate artifacts.
---
