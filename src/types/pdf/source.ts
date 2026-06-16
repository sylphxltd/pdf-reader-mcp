// PDF source and read option type definitions

export interface PdfSource {
  path?: string | undefined;
  url?: string | undefined;
  pages?: string | number[] | undefined;
}

export interface ReadPdfOptions {
  include_full_text: boolean;
  include_metadata: boolean;
  include_page_count: boolean;
  include_images: boolean;
  include_tables: boolean;
  include_elements: boolean;
  include_semantic_hints: boolean;
  include_markdown: boolean;
  include_html: boolean;
  include_chunks: boolean;
  include_text_layer: boolean;
  include_outline: boolean;
  include_annotations: boolean;
  include_page_labels: boolean;
  include_page_geometry: boolean;
  include_permissions: boolean;
  include_form_fields: boolean;
  include_attachments: boolean;
  include_structure_tree: boolean;
  include_safety_findings: boolean;
  include_layout_diagnostics: boolean;
  include_document_map: boolean;
  include_document_ast: boolean;
  include_trust_report: boolean;
  include_accessibility_report: boolean;
}
