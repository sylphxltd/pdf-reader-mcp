---
layout: home

hero:
  name: PDF Reader MCP
  text: Inspect and Extract PDFs for AI Agents
  tagline: A high-performance MCP server for local-first PDF inspection, PDF search, visual evidence, region crops, configured OCR text layers, agent document maps, accessibility reports, citations, and safety signals.
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

features:
  - icon: "\U0001F4C4"
    title: Inspect Before Extraction
    details: Profile unfamiliar PDFs, detect low-text or scanned pages, and get recommended extraction options for agent workflows.
  - icon: "\U0001F50E"
    title: Search Evidence
    details: Locate literal text matches with snippets, match offsets, character-derived or text-item bounding boxes, and provenance before reading, rendering, cropping, or citing.
  - icon: "\u26A1"
    title: High Performance
    details: Built with pdfjs-dist and optimized for speed. Supports concurrent processing, batch operations, and recursive band/column ordering.
  - icon: "\U0001F50C"
    title: Easy Integration
    details: Works with Claude Desktop, Claude Code, Cursor, and any MCP-compatible client. One command to install.
  - icon: "\U0001F5BC\uFE0F"
    title: Agent-Ready Context
    details: Return an agent document map, text layer, semantic document AST, trust report, and accessibility report with stable element IDs, citation chunks, table quality diagnostics, layout confidence, safety signals, page geometry, provenance, and best-effort coordinates.
  - icon: "\U0001F9FE"
    title: Text Layer Fidelity
    details: Expose run, line, word, and character records with page-level ranges, estimated bounding boxes, and provenance for citation and extraction workflows.
  - icon: "\U0001F5BC\uFE0F"
    title: Visual Evidence
    details: Render selected pages as bounded PNG MCP image parts with JSON provenance, evidence IDs, and pixel budgets for OCR routing and page inspection.
  - icon: "\U0001F50D"
    title: Region Crops
    details: Crop PDF-coordinate bounding boxes into focused visual evidence for tables, figures, charts, formulas, and citation verification.
  - icon: "\U0001F524"
    title: Configured OCR
    details: Route selected rendered pages through an environment-configured local OCR provider and optionally fuse OCR text layers into read_pdf document maps with provenance.
  - icon: "\U0001F9ED"
    title: Layout Confidence
    details: Surface page layout profiles, reading-order confidence, column signals, and warnings so agents can route uncertain pages safely.
  - icon: "\U0001F6E1\uFE0F"
    title: Content Safety Signals
    details: Surface deterministic findings for prompt-injection patterns, tiny text, and off-page text before agents use PDF content.
  - icon: "\u267F"
    title: Accessibility Report
    details: Summarize tagged-PDF coverage, structure trees, headings, image alt-text verifiability, form labels, link labels, and accessibility permissions without claiming PDF/UA certification.
---
