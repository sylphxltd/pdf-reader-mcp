// Validation schemas for PDF reading

import {
  array,
  bool,
  description,
  gte,
  type InferOutput,
  int,
  min,
  num,
  object,
  optional,
  str,
  union,
} from '../schema.js';

// Schema for page specification (array of numbers or range string)
export const pageSpecifierSchema = union(array(num(int, gte(1))), str(min(1)));

// Schema for a single PDF source. Every PDF tool shares this source contract:
// callers must provide exactly one locator so local and remote security policy
// cannot be bypassed by ambiguous path+URL payloads.
export const pdfSourceSchema = object({
  path: optional(
    str(min(1), description('Path to the local PDF file (absolute or relative to cwd).'))
  ),
  url: optional(str(min(1), description('URL of the PDF file.'))),
  pages: optional(pageSpecifierSchema),
}).refine((source) => Boolean(source.path) !== Boolean(source.url), {
  message: 'Provide exactly one of path or url for each PDF source.',
});

// Schema for the read_pdf tool arguments
export const readPdfArgsSchema = object({
  sources: array(pdfSourceSchema),
  include_full_text: optional(
    bool(
      description(
        "Include the full text content of each PDF (only if 'pages' is not specified for that source)."
      )
    )
  ),
  include_metadata: optional(bool(description('Include metadata and info objects for each PDF.'))),
  include_page_count: optional(
    bool(description('Include the total number of pages for each PDF.'))
  ),
  include_images: optional(
    bool(
      description('Extract and include embedded images from the PDF pages as base64-encoded data.')
    )
  ),
  include_tables: optional(
    bool(
      description(
        'Detect and extract tables from PDF pages. Uses spatial clustering of text coordinates to identify tabular structures.'
      )
    )
  ),
  include_elements: optional(
    bool(
      description(
        'Include agent-ready structured document elements with page numbers, stable IDs, provenance, and best-effort bounding boxes.'
      )
    )
  ),
  include_semantic_hints: optional(
    bool(
      description(
        'Include deterministic semantic hints on text elements, such as heading, list item, or paragraph.'
      )
    )
  ),
  include_markdown: optional(
    bool(
      description(
        'Include a Markdown rendering of extracted pages for RAG, summarization, and agent context.'
      )
    )
  ),
  include_html: optional(
    bool(
      description(
        'Include a simple HTML rendering of extracted pages for preview, export, and downstream conversion.'
      )
    )
  ),
  include_chunks: optional(
    bool(
      description(
        'Include page-level citation-ready chunks with text, element IDs, page ranges, and best-effort bounding boxes.'
      )
    )
  ),
  include_text_layer: optional(
    bool(
      description(
        'Include a page text layer with run, line, word, and character records, page-level ranges, estimated bounding boxes, and provenance.'
      )
    )
  ),
  include_ocr_text_layer: optional(
    bool(
      description(
        'Run the configured local OCR provider for selected sparse/scanned pages and include a normalized OCR text layer with render provenance.'
      )
    )
  ),
  include_outline: optional(
    bool(description('Include document outline/bookmark entries when the PDF exposes them.'))
  ),
  include_annotations: optional(
    bool(
      description(
        'Include page annotations such as links, notes, and form-related annotations with safe summary fields.'
      )
    )
  ),
  include_page_labels: optional(
    bool(
      description(
        'Include PDF page labels when available, such as roman numerals or section labels.'
      )
    )
  ),
  include_page_geometry: optional(
    bool(
      description(
        'Include page viewport geometry such as width, height, rotation, user unit, and view box.'
      )
    )
  ),
  include_permissions: optional(
    bool(description('Include PDF permission and marking signals when exposed by the parser.'))
  ),
  include_form_fields: optional(
    bool(description('Include PDF form field summaries when AcroForm fields are exposed.'))
  ),
  include_attachments: optional(
    bool(
      description(
        'Include embedded attachment metadata such as filename and size. Attachment bytes are not returned.'
      )
    )
  ),
  include_structure_tree: optional(
    bool(
      description(
        'Include best-effort tagged PDF structure trees for selected pages when the PDF exposes them.'
      )
    )
  ),
  include_safety_findings: optional(
    bool(
      description(
        'Include deterministic content safety findings for prompt-injection patterns, tiny text, and off-page text.'
      )
    )
  ),
  include_layout_diagnostics: optional(
    bool(
      description(
        'Include deterministic page layout profiles, reading-order confidence, column signals, and warnings for agent routing.'
      )
    )
  ),
  include_document_map: optional(
    bool(
      description(
        'Include an agent-ready document map that links pages, elements, chunks, layout diagnostics, safety findings, routing signals, and page geometry without embedding image bytes in JSON.'
      )
    )
  ),
  include_document_ast: optional(
    bool(
      description(
        'Include an agent-ready semantic document AST with page, section, paragraph, list item, table, and image nodes linked back to element and chunk evidence.'
      )
    )
  ),
  include_visual_enrichments: optional(
    bool(
      description(
        'Run the configured visual-region provider over table/image regions and fuse normalized table, formula, chart, figure, or image descriptions into the PDF document twin with crop evidence.'
      )
    )
  ),
  max_visual_enrichments: optional(
    num(
      int,
      gte(1),
      description(
        'Maximum table/image regions per source to send to the configured visual-region provider when include_visual_enrichments is enabled.'
      )
    )
  ),
  include_trust_report: optional(
    bool(
      description(
        'Include a PDF trust report that consolidates content safety, layout uncertainty, sparse/scanned-page, table-quality, and external-link signals for agent routing.'
      )
    )
  ),
  include_accessibility_report: optional(
    bool(
      description(
        'Include a deterministic accessibility report for tagged-PDF coverage, structure tree availability, heading roles, image alt-text verifiability, form labels, link labels, and accessibility permissions.'
      )
    )
  ),
});

export type ReadPdfArgs = InferOutput<typeof readPdfArgsSchema>;
export type PdfSource = InferOutput<typeof pdfSourceSchema>;
