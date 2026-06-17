// PDF read result aggregate type definitions

import type { PdfAccessibilityReport } from './accessibility.js';
import type {
  ExtractedImage,
  ExtractedPageText,
  PageContentItem,
  PdfChunk,
  PdfDocumentElement,
} from './content.js';
import type { PdfDocumentAst } from './document-ast.js';
import type { PdfDocumentMap } from './document-map.js';
import type {
  PdfAttachment,
  PdfFormField,
  PdfInfo,
  PdfMetadata,
  PdfOutlineItem,
  PdfPageAnnotations,
  PdfPageStructureTree,
} from './document-structure.js';
import type { PdfPageGeometry } from './geometry.js';
import type { PdfPageLayoutDiagnostics } from './layout.js';
import type { PdfOcrTextLayer } from './ocr.js';
import type { PdfVisualEnrichment, PdfVisualEnrichmentCandidate } from './region-analysis.js';
import type { PdfSafetyFinding } from './safety.js';
import type { ExtractedTable } from './tables.js';
import type { PdfTextLayer } from './text-layer.js';
import type { PdfTrustReport } from './trust-report.js';

export interface PdfResultData {
  info?: PdfInfo;
  metadata?: PdfMetadata;
  num_pages?: number;
  page_labels?: string[];
  page_geometry?: PdfPageGeometry[];
  permissions?: string[];
  mark_info?: Record<string, unknown>;
  outline?: PdfOutlineItem[];
  annotations?: PdfPageAnnotations[];
  form_fields?: PdfFormField[];
  attachments?: PdfAttachment[];
  structure_trees?: PdfPageStructureTree[];
  full_text?: string;
  markdown?: string;
  html?: string;
  page_texts?: ExtractedPageText[];
  page_contents?: Array<{ page: number; items: PageContentItem[] }>;
  elements?: PdfDocumentElement[];
  chunks?: PdfChunk[];
  text_layer?: PdfTextLayer;
  ocr_text_layer?: PdfOcrTextLayer;
  safety_findings?: PdfSafetyFinding[];
  layout_diagnostics?: PdfPageLayoutDiagnostics[];
  visual_enrichment_candidates?: PdfVisualEnrichmentCandidate[];
  visual_enrichments?: PdfVisualEnrichment[];
  document_map?: PdfDocumentMap;
  document_ast?: PdfDocumentAst;
  trust_report?: PdfTrustReport;
  accessibility_report?: PdfAccessibilityReport;
  images?: ExtractedImage[];
  tables?: ExtractedTable[];
  warnings?: string[];
}

export interface PdfSourceResult {
  source: string;
  success: boolean;
  data?: PdfResultData | undefined;
  error?: string;
}
