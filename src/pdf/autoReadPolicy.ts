// Auto-read decision policy for read_pdf.
//
// Encapsulates: which include_* flags are explicit, whether auto-read should
// trigger, what fast/balanced/full detail presets mean, and how to build the
// final ReadPdfProcessingOptions from schema input.
//
// This is domain logic — it does not touch pdfjs or produce MCP content.

import type { ReadPdfArgs, ReadPdfAutoDetail } from '../schemas/readPdf.js';
import type {
  PdfInspectionSourceResult,
  PdfSource,
  PdfTrustRedactionPolicy,
} from '../types/pdf.js';
import { defaultInspectPdfOptions, inspectPdfSource } from './inspector.js';
import { DEFAULT_VISUAL_ENRICHMENT_MAX_REGIONS } from './visualEnrichment.js';

/** Maximum number of sources to process concurrently. */
export const MAX_CONCURRENT_SOURCES = 3;

export const DEFAULT_AUTO_DETAIL: ReadPdfAutoDetail = 'balanced';

/** Internal processing options in camelCase, derived from the snake_case schema. */
export interface ReadPdfProcessingOptions {
  includeFullText: boolean;
  includeMetadata: boolean;
  includePageCount: boolean;
  includeImages: boolean;
  includeTables: boolean;
  includeElements: boolean;
  includeSemanticHints: boolean;
  includeMarkdown: boolean;
  includeHtml: boolean;
  includeChunks: boolean;
  includeTextLayer: boolean;
  includeOcrTextLayer: boolean;
  includeOutline: boolean;
  includeAnnotations: boolean;
  includePageLabels: boolean;
  includePageGeometry: boolean;
  includePermissions: boolean;
  includeFormFields: boolean;
  includeAttachments: boolean;
  includeStructureTree: boolean;
  includeSafetyFindings: boolean;
  includeLayoutDiagnostics: boolean;
  includeDocumentMap: boolean;
  includeDocumentAst: boolean;
  includeVisualEnrichments: boolean;
  maxVisualEnrichments: number;
  includeTrustReport: boolean;
  trustReportRedaction: PdfTrustRedactionPolicy;
  includeAccessibilityReport: boolean;
}

/** Keys in ReadPdfArgs that count as explicit manual read options. */
const explicitReadOptionKeys = [
  'include_full_text',
  'include_metadata',
  'include_page_count',
  'include_images',
  'include_tables',
  'include_elements',
  'include_semantic_hints',
  'include_markdown',
  'include_html',
  'include_chunks',
  'include_text_layer',
  'include_ocr_text_layer',
  'include_outline',
  'include_annotations',
  'include_page_labels',
  'include_page_geometry',
  'include_permissions',
  'include_form_fields',
  'include_attachments',
  'include_structure_tree',
  'include_safety_findings',
  'include_layout_diagnostics',
  'include_document_map',
  'include_document_ast',
  'include_visual_enrichments',
  'max_visual_enrichments',
  'include_trust_report',
  'trust_report_redaction',
  'include_accessibility_report',
] as const satisfies readonly (keyof ReadPdfArgs)[];

const pickExplicitReadOptions = (input: ReadPdfArgs): Partial<ReadPdfArgs> => {
  const options: Partial<ReadPdfArgs> = {};
  for (const key of explicitReadOptionKeys) {
    const value = input[key];
    if (value !== undefined) {
      (options as Record<string, unknown>)[key] = value;
    }
  }
  return options;
};

export const hasExplicitReadOptions = (input: ReadPdfArgs): boolean =>
  explicitReadOptionKeys.some((key) => input[key] !== undefined);

export const shouldUseAutoRead = (input: ReadPdfArgs): boolean =>
  input.auto ?? !hasExplicitReadOptions(input);

/** Preset include_* options for each auto_detail level. */
export const buildAutoDetailOptions = (detail: ReadPdfAutoDetail): Partial<ReadPdfArgs> => {
  const fast = {
    include_metadata: true,
    include_page_count: true,
    include_page_geometry: true,
    include_document_map: true,
    include_chunks: true,
    include_markdown: true,
    include_tables: true,
    include_semantic_hints: true,
    include_layout_diagnostics: true,
  } satisfies Partial<ReadPdfArgs>;

  if (detail === 'fast') return fast;

  const balanced = {
    ...fast,
    include_safety_findings: true,
    include_trust_report: true,
    include_accessibility_report: true,
  } satisfies Partial<ReadPdfArgs>;

  if (detail === 'balanced') return balanced;

  return {
    ...balanced,
    include_full_text: true,
    include_html: true,
    include_elements: true,
    include_text_layer: true,
    include_document_ast: true,
    include_outline: true,
    include_annotations: true,
    include_page_labels: true,
    include_permissions: true,
    include_form_fields: true,
    include_attachments: true,
    include_structure_tree: true,
  } satisfies Partial<ReadPdfArgs>;
};

export const buildReadOptions = (input: ReadPdfArgs): ReadPdfProcessingOptions => ({
  includeFullText: input.include_full_text ?? false,
  includeMetadata: input.include_metadata ?? true,
  includePageCount: input.include_page_count ?? true,
  includeImages: input.include_images ?? false,
  includeTables: input.include_tables ?? false,
  includeElements: input.include_elements ?? false,
  includeSemanticHints: input.include_semantic_hints ?? false,
  includeMarkdown: input.include_markdown ?? false,
  includeHtml: input.include_html ?? false,
  includeChunks: input.include_chunks ?? false,
  includeTextLayer: input.include_text_layer ?? false,
  includeOcrTextLayer: input.include_ocr_text_layer ?? false,
  includeOutline: input.include_outline ?? false,
  includeAnnotations: input.include_annotations ?? false,
  includePageLabels: input.include_page_labels ?? false,
  includePageGeometry: input.include_page_geometry ?? false,
  includePermissions: input.include_permissions ?? false,
  includeFormFields: input.include_form_fields ?? false,
  includeAttachments: input.include_attachments ?? false,
  includeStructureTree: input.include_structure_tree ?? false,
  includeSafetyFindings: input.include_safety_findings ?? false,
  includeLayoutDiagnostics: input.include_layout_diagnostics ?? false,
  includeDocumentMap: input.include_document_map ?? false,
  includeDocumentAst: input.include_document_ast ?? false,
  includeVisualEnrichments: input.include_visual_enrichments ?? false,
  maxVisualEnrichments: input.max_visual_enrichments ?? DEFAULT_VISUAL_ENRICHMENT_MAX_REGIONS,
  includeTrustReport: input.include_trust_report ?? false,
  trustReportRedaction: input.trust_report_redaction ?? 'standard',
  includeAccessibilityReport: input.include_accessibility_report ?? false,
});

export const buildAutoReadArgs = (
  source: PdfSource,
  inspection: PdfInspectionSourceResult,
  input: ReadPdfArgs,
  detail: ReadPdfAutoDetail
): ReadPdfArgs => {
  const recommendationArgs = inspection.data?.recommendation.read_pdf_arguments ?? {};
  return {
    ...recommendationArgs,
    ...buildAutoDetailOptions(detail),
    ...pickExplicitReadOptions(input),
    sources: [source],
  } as ReadPdfArgs;
};

export const buildAutoInspections = async (
  input: ReadPdfArgs
): Promise<PdfInspectionSourceResult[]> => {
  const inspectOptions = {
    ...defaultInspectPdfOptions(),
    ...(input.sample_pages !== undefined ? { sample_pages: input.sample_pages } : {}),
    ...(input.include_metadata !== undefined ? { include_metadata: input.include_metadata } : {}),
  };
  const inspections: PdfInspectionSourceResult[] = [];

  for (let i = 0; i < input.sources.length; i += MAX_CONCURRENT_SOURCES) {
    const batch = input.sources.slice(i, i + MAX_CONCURRENT_SOURCES);
    const batchResults = await Promise.all(
      batch.map((source) => inspectPdfSource(source, inspectOptions))
    );
    inspections.push(...batchResults);
  }

  return inspections;
};
