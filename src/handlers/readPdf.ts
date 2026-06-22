// PDF reading handler - orchestrates PDF processing workflow

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { image, text, tool, toolError } from '../mcp.js';
import { buildAccessibilityReport } from '../pdf/accessibilityReport.js';
import { buildDocumentAst } from '../pdf/documentAst.js';
import { buildDocumentMap } from '../pdf/documentMap.js';
import {
  buildCitationChunks,
  buildLayoutDiagnostics,
  buildSafetyFindings,
  buildStructuredElements,
  renderHtmlFromPageContents,
  renderMarkdownFromPageContents,
} from '../pdf/documentModel.js';
import {
  buildWarnings,
  extractAnnotations,
  extractDocumentStructure,
  extractMetadataAndPageCount,
  extractPageContent,
  extractPageGeometry,
  extractStructureTrees,
} from '../pdf/extractor.js';
import { defaultInspectPdfOptions, inspectPdfSource } from '../pdf/inspector.js';
import { loadPdfDocument } from '../pdf/loader.js';
import { buildOcrTextLayer, defaultOcrPagesOptions, ocrPdfSourcePages } from '../pdf/ocr.js';
import { determinePagesToProcess, getTargetPages } from '../pdf/parser.js';
import {
  extractTables,
  extractTablesFromOcrTextLayer,
  extractTablesFromPageContents,
  mergeTableExtractionEvidence,
  tablesToMarkdown,
} from '../pdf/tableExtractor.js';
import { buildTextLayer } from '../pdf/textLayer.js';
import { buildTrustReport } from '../pdf/trustReport.js';
import {
  buildVisualEnrichmentsForSource,
  DEFAULT_VISUAL_ENRICHMENT_MAX_REGIONS,
} from '../pdf/visualEnrichment.js';
import { type ReadPdfArgs, type ReadPdfAutoDetail, readPdfArgsSchema } from '../schemas/readPdf.js';
import type {
  ExtractedImage,
  ExtractedTable,
  PdfChunk,
  PdfDocumentElement,
  PdfInspectionSourceResult,
  PdfOcrTextLayer,
  PdfPageAnnotations,
  PdfPageGeometry,
  PdfPageLayoutDiagnostics,
  PdfPageStructureTree,
  PdfResultData,
  PdfSafetyFinding,
  PdfSource,
  PdfSourceResult,
  PdfTextLayer,
  PdfTrustRedactionPolicy,
  PdfVisualEnrichment,
  PdfVisualEnrichmentCandidate,
} from '../types/pdf.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ReadPdf');

const MAX_CONCURRENT_SOURCES = 3;
const DEFAULT_AUTO_DETAIL: ReadPdfAutoDetail = 'balanced';

interface ReadPdfProcessingOptions {
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

type AutoReadSummary = {
  source: string;
  success: boolean;
  profile?: string;
  workflow?: string;
  reason?: string;
  needs_ocr?: boolean;
  provider_status?: unknown;
  read_pdf_arguments?: ReadPdfArgs;
  inspection_error?: string;
};

const appendOutputWarnings = (output: PdfResultData, warnings: string[]) => {
  if (warnings.length === 0) return;
  output.warnings = [...(output.warnings ?? []), ...warnings];
};

const selectOcrTextLayerPages = (
  pagesToProcess: number[],
  layoutDiagnostics: PdfPageLayoutDiagnostics[]
): number[] => {
  const zeroSelectableTextPages = layoutDiagnostics
    .filter((layout) => layout.text_item_count === 0)
    .map((layout) => layout.page);

  return zeroSelectableTextPages.length > 0 ? zeroSelectableTextPages : pagesToProcess;
};

/**
 * Process a single PDF source
 */
const processSingleSource = async (
  source: PdfSource,
  options: ReadPdfProcessingOptions
): Promise<PdfSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';
  let individualResult: PdfSourceResult = { source: sourceDescription, success: false };
  let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;

  try {
    // Parse target pages
    const targetPages = getTargetPages(source.pages, sourceDescription);

    // Load PDF document
    const { pages: _pages, ...loadArgs } = source;
    pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;

    // Extract metadata and page count
    const metadataOutput = await extractMetadataAndPageCount(
      pdfDocument,
      options.includeMetadata,
      options.includePageCount
    );

    const output: PdfResultData = { ...metadataOutput };

    const structureOutput = await extractDocumentStructure(pdfDocument, {
      includeOutline: options.includeOutline || options.includeAccessibilityReport,
      includePageLabels: options.includePageLabels,
      includePermissions: options.includePermissions || options.includeAccessibilityReport,
      includeFormFields: options.includeFormFields || options.includeAccessibilityReport,
      includeAttachments: options.includeAttachments,
    });
    if (options.includeOutline && structureOutput.outline) {
      output.outline = structureOutput.outline;
    }
    if (options.includePageLabels && structureOutput.page_labels) {
      output.page_labels = structureOutput.page_labels;
    }
    if (options.includePermissions) {
      if (structureOutput.permissions) output.permissions = structureOutput.permissions;
      if (structureOutput.mark_info) output.mark_info = structureOutput.mark_info;
    }
    if (options.includeFormFields && structureOutput.form_fields) {
      output.form_fields = structureOutput.form_fields;
    }
    if (options.includeAttachments && structureOutput.attachments) {
      output.attachments = structureOutput.attachments;
    }

    // Determine pages to process
    const explicitPageContent =
      options.includeFullText ||
      options.includeElements ||
      options.includeSemanticHints ||
      options.includeMarkdown ||
      options.includeHtml ||
      options.includeChunks ||
      options.includeTextLayer ||
      options.includeOcrTextLayer ||
      options.includeImages ||
      options.includeSafetyFindings ||
      options.includeLayoutDiagnostics ||
      options.includeDocumentMap ||
      options.includeDocumentAst ||
      options.includeVisualEnrichments ||
      options.includeTrustReport ||
      options.includeAccessibilityReport;
    const pageScopedMetadata =
      options.includeTables ||
      options.includeDocumentMap ||
      options.includeDocumentAst ||
      options.includeVisualEnrichments ||
      options.includeTrustReport ||
      options.includeAccessibilityReport ||
      options.includeAnnotations ||
      options.includePageGeometry ||
      options.includeStructureTree;
    const includeSelectedPageText =
      targetPages !== undefined && !explicitPageContent && !pageScopedMetadata;
    const shouldSelectPages = explicitPageContent || includeSelectedPageText || pageScopedMetadata;
    const { pagesToProcess, invalidPages } = determinePagesToProcess(
      targetPages,
      totalPages,
      shouldSelectPages
    );

    // Add warnings for invalid pages
    const warnings = buildWarnings(invalidPages, totalPages);
    if (warnings.length > 0) {
      output.warnings = warnings;
    }

    // Extract content with ordering preserved
    if (pagesToProcess.length > 0) {
      const needsPageContent = explicitPageContent || includeSelectedPageText;

      let pageGeometry: PdfPageGeometry[] | undefined;
      if (
        options.includePageGeometry ||
        options.includeSemanticHints ||
        options.includeSafetyFindings ||
        options.includeDocumentMap ||
        options.includeDocumentAst ||
        options.includeVisualEnrichments ||
        options.includeTrustReport
      ) {
        pageGeometry = await extractPageGeometry(
          pdfDocument as pdfjsLib.PDFDocumentProxy,
          pagesToProcess
        );
        if (pageGeometry.length > 0 && options.includePageGeometry) {
          output.page_geometry = pageGeometry;
        }
      }

      if (needsPageContent) {
        // Process pages in batches to prevent memory exhaustion on large PDFs
        // This prevents the event loop from being blocked and keeps memory usage reasonable
        const MAX_CONCURRENT_PAGES = 5;
        const pageContents: Awaited<ReturnType<typeof extractPageContent>>[] = [];

        for (let i = 0; i < pagesToProcess.length; i += MAX_CONCURRENT_PAGES) {
          const batch = pagesToProcess.slice(i, i + MAX_CONCURRENT_PAGES);
          const batchResults = await Promise.all(
            batch.map((pageNum) =>
              extractPageContent(
                pdfDocument as pdfjsLib.PDFDocumentProxy,
                pageNum,
                options.includeImages || options.includeVisualEnrichments,
                sourceDescription
              )
            )
          );
          pageContents.push(...batchResults);

          // Yield to the event loop between batches to prevent UI blocking
          if (i + MAX_CONCURRENT_PAGES < pagesToProcess.length) {
            await new Promise((resolve) => setImmediate(resolve));
          }
        }

        // Store page contents for ordered retrieval
        output.page_contents = pageContents.map((items, idx) => ({
          page: pagesToProcess[idx] as number,
          items,
        }));

        // For backward compatibility, also provide text-only outputs
        const extractedPageTexts = pageContents.map((items, idx) => ({
          page: pagesToProcess[idx] as number,
          text: items
            .filter((item) => item.type === 'text')
            .map((item) => item.textContent)
            .join(''),
        }));

        if (targetPages) {
          // Specific pages requested
          output.page_texts = extractedPageTexts;
        } else if (options.includeFullText) {
          // Full text requested
          output.full_text = extractedPageTexts.map((p) => p.text).join('\n\n');
        }

        // Extract image metadata for JSON response
        if (options.includeImages) {
          const extractedImages = pageContents
            .flatMap((items) => items.filter((item) => item.type === 'image' && item.imageData))
            .map((item) => item.imageData)
            .filter((img): img is ExtractedImage => img !== undefined);

          if (extractedImages.length > 0) {
            output.images = extractedImages;
          }
        }
      }

      let layoutDiagnostics: PdfPageLayoutDiagnostics[] | undefined;
      if (options.includeLayoutDiagnostics && output.page_contents) {
        layoutDiagnostics = buildLayoutDiagnostics(output.page_contents);
        output.layout_diagnostics = layoutDiagnostics;
      }

      let ocrTextLayer: PdfOcrTextLayer | undefined;
      if (options.includeOcrTextLayer && output.page_contents) {
        layoutDiagnostics ??= buildLayoutDiagnostics(output.page_contents);
        const ocrPages = selectOcrTextLayerPages(pagesToProcess, layoutDiagnostics);

        if (ocrPages.length > 0) {
          try {
            const ocr = await ocrPdfSourcePages(
              { ...source, pages: ocrPages },
              defaultOcrPagesOptions()
            );
            ocrTextLayer = buildOcrTextLayer(ocr.pages, ocr.warnings);
            output.ocr_text_layer = ocrTextLayer;
            appendOutputWarnings(output, ocr.warnings);
          } catch (error: unknown) {
            const message =
              error instanceof PdfError
                ? error.message
                : 'OCR provider failed before returning a normalized text layer.';
            if (!(error instanceof PdfError)) {
              logger.warn('Unexpected error building OCR text layer', {
                sourceDescription,
                error: error instanceof Error ? error.message : String(error),
              });
            }
            appendOutputWarnings(output, [`OCR text layer unavailable: ${message}`]);
          }
        }
      }

      // Extract tables if requested
      if (
        options.includeTables ||
        options.includeDocumentMap ||
        options.includeDocumentAst ||
        options.includeVisualEnrichments ||
        options.includeTrustReport
      ) {
        const extractedTables = output.page_contents
          ? extractTablesFromPageContents(output.page_contents)
          : await extractTables(pdfDocument as pdfjsLib.PDFDocumentProxy, pagesToProcess);
        const ocrTables = ocrTextLayer ? extractTablesFromOcrTextLayer(ocrTextLayer) : [];

        if (extractedTables.length > 0 || ocrTables.length > 0) {
          output.tables = mergeTableExtractionEvidence(extractedTables, ocrTables);
        }
      }

      let plainElements: PdfDocumentElement[] | undefined;
      let semanticElements: PdfDocumentElement[] | undefined;
      const buildElementsForOutput = (includeSemanticHints: boolean) => {
        if (includeSemanticHints) {
          semanticElements ??= buildStructuredElements(
            output.page_contents ?? [],
            output.tables,
            true,
            pageGeometry
          );
          return semanticElements;
        }

        plainElements ??= buildStructuredElements(
          output.page_contents ?? [],
          output.tables,
          false,
          pageGeometry
        );
        return plainElements;
      };

      if ((options.includeElements || options.includeSemanticHints) && output.page_contents) {
        output.elements = buildElementsForOutput(options.includeSemanticHints);
      }

      if (options.includeMarkdown && output.page_contents) {
        output.markdown = renderMarkdownFromPageContents(output.page_contents, output.tables);
      }

      if (options.includeHtml && output.page_contents) {
        output.html = renderHtmlFromPageContents(output.page_contents, output.tables);
      }

      let chunks: PdfChunk[] | undefined;
      if (options.includeChunks && output.page_contents) {
        const chunkElements =
          output.elements ?? buildElementsForOutput(options.includeSemanticHints);
        chunks = buildCitationChunks(chunkElements, {
          useSemanticBoundaries: options.includeSemanticHints,
        });
        output.chunks = chunks;
      }

      let textLayer: PdfTextLayer | undefined;
      if ((options.includeTextLayer || options.includeDocumentMap) && output.page_contents) {
        textLayer = buildTextLayer({
          selectedPages: pagesToProcess,
          pageContents: output.page_contents,
        });
        if (options.includeTextLayer) {
          output.text_layer = textLayer;
        }
      }

      let visualEnrichmentCandidates: PdfVisualEnrichmentCandidate[] | undefined;
      let visualEnrichments: PdfVisualEnrichment[] | undefined;
      if (options.includeVisualEnrichments && output.page_contents) {
        const visualElements = buildElementsForOutput(true);
        const enriched = await buildVisualEnrichmentsForSource({
          source,
          sourceDescription,
          elements: visualElements,
          pageGeometry,
          maxVisualEnrichments: options.maxVisualEnrichments,
        });
        visualEnrichmentCandidates = enriched.visualEnrichmentCandidates;
        if (visualEnrichmentCandidates.length > 0) {
          output.visual_enrichment_candidates = visualEnrichmentCandidates;
        }
        visualEnrichments = enriched.visualEnrichments;
        if (visualEnrichments.length > 0) {
          output.visual_enrichments = visualEnrichments;
        }
        appendOutputWarnings(output, enriched.warnings);
      }

      let safetyFindings: PdfSafetyFinding[] | undefined;
      if (options.includeSafetyFindings && output.page_contents) {
        safetyFindings = buildSafetyFindings(output.page_contents, pageGeometry);
        if (safetyFindings.length > 0) {
          output.safety_findings = safetyFindings;
        }
      }

      if (options.includeDocumentAst && output.page_contents) {
        const astElements = buildElementsForOutput(true);
        chunks ??= buildCitationChunks(astElements, { useSemanticBoundaries: true });
        output.document_ast = buildDocumentAst({
          selectedPages: pagesToProcess,
          elements: astElements,
          chunks,
          visualEnrichments,
          warnings: output.warnings,
        });
      }

      let annotations: PdfPageAnnotations[] | undefined;
      if (
        options.includeAnnotations ||
        options.includeTrustReport ||
        options.includeAccessibilityReport
      ) {
        annotations = await extractAnnotations(
          pdfDocument as pdfjsLib.PDFDocumentProxy,
          pagesToProcess
        );
        if (options.includeAnnotations && annotations.length > 0) {
          output.annotations = annotations;
        }
      }

      let trustReport: PdfResultData['trust_report'] | undefined;
      if (options.includeTrustReport && output.page_contents) {
        const trustElements = buildElementsForOutput(true);
        safetyFindings ??= buildSafetyFindings(output.page_contents, pageGeometry);
        layoutDiagnostics ??= buildLayoutDiagnostics(output.page_contents);
        trustReport = buildTrustReport({
          selectedPages: pagesToProcess,
          safetyFindings,
          layoutDiagnostics,
          elements: trustElements,
          annotations,
          redactionPolicy: options.trustReportRedaction,
        });
        output.trust_report = trustReport;
      }

      let structureTrees: PdfPageStructureTree[] | undefined;
      if (options.includeStructureTree || options.includeAccessibilityReport) {
        structureTrees = await extractStructureTrees(
          pdfDocument as pdfjsLib.PDFDocumentProxy,
          pagesToProcess
        );
        if (options.includeStructureTree && structureTrees.length > 0) {
          output.structure_trees = structureTrees;
        }
      }

      let accessibilityReport: PdfResultData['accessibility_report'] | undefined;
      if (options.includeAccessibilityReport && output.page_contents) {
        const accessibilityElements = buildElementsForOutput(true);
        accessibilityReport = buildAccessibilityReport({
          selectedPages: pagesToProcess,
          elements: accessibilityElements,
          structureTrees,
          annotations,
          formFields: structureOutput.form_fields,
          permissions: structureOutput.permissions,
          markInfo: structureOutput.mark_info,
          outline: structureOutput.outline,
        });
        output.accessibility_report = accessibilityReport;
      }

      if (options.includeDocumentMap && output.page_contents) {
        const mapElements = buildElementsForOutput(true);
        chunks ??= buildCitationChunks(mapElements, { useSemanticBoundaries: true });
        safetyFindings ??= buildSafetyFindings(output.page_contents, pageGeometry);
        layoutDiagnostics ??= buildLayoutDiagnostics(output.page_contents);
        output.document_map = buildDocumentMap({
          totalPages,
          selectedPages: pagesToProcess,
          pageContents: output.page_contents,
          elements: mapElements,
          chunks,
          layoutDiagnostics,
          safetyFindings,
          visualEnrichmentCandidates,
          visualEnrichments,
          textLayer,
          ocrTextLayer,
          trustReport,
          accessibilityReport,
          pageGeometry,
          warnings: output.warnings,
        });
      }
    }

    individualResult = { ...individualResult, data: output, success: true };
  } catch (error: unknown) {
    // SSS-02: PdfError messages are curated and safe to surface; anything
    // else gets logged with full detail but returned as a generic string so
    // raw PDF.js / Node messages cannot leak filesystem or module paths back
    // through the response to the LLM.
    let errorMessage: string;
    if (error instanceof PdfError) {
      errorMessage = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error processing PDF source', {
        sourceDescription,
        error: detail,
      });
      errorMessage = `Failed to process PDF from ${sourceDescription}.`;
    }

    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined;
  } finally {
    // Clean up PDF document resources. pdfjs v6 moved teardown off the
    // document proxy: PDFDocumentProxy.destroy() is gone, so we destroy the
    // owning loadingTask (aborts network + terminates the worker). Guarded so
    // a future API shift can't throw inside finally.
    const loadingTask = pdfDocument?.loadingTask;
    if (loadingTask && typeof loadingTask.destroy === 'function') {
      try {
        await loadingTask.destroy();
      } catch (destroyError: unknown) {
        // Log cleanup errors but don't fail the operation
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger.warn('Error destroying PDF document', { sourceDescription, error: message });
      }
    }
  }

  return individualResult;
};

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

const hasExplicitReadOptions = (input: ReadPdfArgs): boolean =>
  explicitReadOptionKeys.some((key) => input[key] !== undefined);

const shouldUseAutoRead = (input: ReadPdfArgs): boolean =>
  input.auto ?? !hasExplicitReadOptions(input);

const buildAutoDetailOptions = (detail: ReadPdfAutoDetail): Partial<ReadPdfArgs> => {
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

const buildReadOptions = (input: ReadPdfArgs): ReadPdfProcessingOptions => ({
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

const buildAutoReadArgs = (
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

const buildAutoInspections = async (input: ReadPdfArgs): Promise<PdfInspectionSourceResult[]> => {
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

// Export the tool definition using builder pattern
export const readPdf = tool()
  .description(
    'Primary V3 PDF reader. With only sources, it auto-inspects and returns a routed Agent Document Twin; use auto_detail or explicit include_* options for precise control.'
  )
  .input(readPdfArgsSchema)
  .handler(async ({ input }) => {
    const results: PdfSourceResult[] = [];
    const autoRead = shouldUseAutoRead(input);
    const autoDetail = input.auto_detail ?? DEFAULT_AUTO_DETAIL;
    const autoReadSummaries: AutoReadSummary[] = [];
    let options = buildReadOptions(input);

    if (autoRead) {
      const inspections = await buildAutoInspections(input);

      for (let i = 0; i < inspections.length; i += MAX_CONCURRENT_SOURCES) {
        const inspectionBatch = inspections.slice(i, i + MAX_CONCURRENT_SOURCES);
        const sourceBatch = input.sources.slice(i, i + MAX_CONCURRENT_SOURCES);
        const batchResults = await Promise.all(
          inspectionBatch.map((inspection, batchIndex) => {
            const source = sourceBatch[batchIndex];
            if (!source) {
              return Promise.resolve({
                source: inspection.source,
                success: false,
                error: 'Auto read failed because the source index was missing.',
              } satisfies PdfSourceResult);
            }

            if (!inspection.success || !inspection.data) {
              autoReadSummaries.push({
                source: inspection.source,
                success: false,
                ...(inspection.error !== undefined ? { inspection_error: inspection.error } : {}),
              });
              return Promise.resolve({
                source: inspection.source,
                success: false,
                error: `Auto inspection failed: ${inspection.error ?? 'unknown error'}`,
              } satisfies PdfSourceResult);
            }

            const autoReadArgs = buildAutoReadArgs(source, inspection, input, autoDetail);
            const autoOptions = buildReadOptions(autoReadArgs);
            autoReadSummaries.push({
              source: inspection.source,
              success: true,
              profile: inspection.data.profile,
              workflow: inspection.data.recommendation.workflow,
              reason: inspection.data.recommendation.reason,
              needs_ocr: inspection.data.recommendation.needs_ocr,
              provider_status: inspection.data.provider_status,
              read_pdf_arguments: autoReadArgs,
            });
            return processSingleSource(source, autoOptions);
          })
        );
        results.push(...batchResults);
      }
    } else {
      // Process sources with concurrency limit to prevent memory exhaustion.
      // Processing large PDFs concurrently can consume significant memory.
      for (let i = 0; i < input.sources.length; i += MAX_CONCURRENT_SOURCES) {
        const batch = input.sources.slice(i, i + MAX_CONCURRENT_SOURCES);
        const batchResults = await Promise.all(
          batch.map((source) => processSingleSource(source, options))
        );
        results.push(...batchResults);
      }
    }

    // Check if all sources failed
    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      const errorMessages = results.map((r) => r.error).join('; ');
      return toolError(`All PDF sources failed to process: ${errorMessages}`);
    }

    if (autoRead) {
      const firstSuccessfulAutoArgs = autoReadSummaries.find(
        (summary) => summary.success && summary.read_pdf_arguments
      )?.read_pdf_arguments;
      if (firstSuccessfulAutoArgs) {
        options = buildReadOptions(firstSuccessfulAutoArgs);
      }
    }

    // Build content parts - start with structured JSON for backward compatibility
    const content: Array<ReturnType<typeof text> | ReturnType<typeof image>> = [];

    // Strip image data, page_contents, and full table rows from JSON to keep it manageable
    const resultsForJson = results.map((result) => {
      if (result.data) {
        const { images, page_contents, tables, ...dataWithoutBinaryContent } = result.data;

        // Use Record type to allow adding image_info and table_info properties
        const processedData: Record<string, unknown> = { ...dataWithoutBinaryContent };

        // Include image count and metadata in JSON, but not the base64 data
        if (images) {
          processedData['image_info'] = images.map((img) => ({
            page: img.page,
            index: img.index,
            width: img.width,
            height: img.height,
            format: img.format,
          }));
        }

        // Include table metadata in JSON, but not the full row data (that goes to markdown)
        if (options.includeTables && tables && tables.length > 0) {
          processedData['table_info'] = tables.map((tbl) => ({
            page: tbl.page,
            tableIndex: tbl.tableIndex,
            rowCount: tbl.rowCount,
            colCount: tbl.colCount,
            cellCount: tbl.cells?.length ?? tbl.rowCount * tbl.colCount,
            bounding_box: tbl.bounding_box,
            confidence: tbl.confidence,
            quality: tbl.quality,
            continuation: tbl.continuation,
            provenance: tbl.provenance,
          }));
        }

        return { ...result, data: processedData };
      }
      return result;
    });

    // First content part: Structured JSON results
    content.push(
      text(
        JSON.stringify(
          {
            ...(autoRead
              ? {
                  auto_read: {
                    enabled: true,
                    detail: autoDetail,
                    results: autoReadSummaries,
                  },
                }
              : {}),
            results: resultsForJson,
          },
          null,
          2
        )
      )
    );

    // Add page content - consolidate text per page to reduce content part count
    // This prevents overwhelming the MCP client with thousands of small text fragments
    for (const result of results) {
      if (!result.success || !result.data?.page_contents) continue;

      // Process each page's content items in order
      for (const pageContent of result.data.page_contents) {
        // Consolidate all text items for this page into a single content part
        const pageTextParts: string[] = [];
        const pageImages: ExtractedImage[] = [];

        for (const item of pageContent.items) {
          if (item.type === 'text' && item.textContent) {
            pageTextParts.push(item.textContent);
          } else if (item.type === 'image' && item.imageData) {
            pageImages.push(item.imageData);
          }
        }

        // Add consolidated text for the page (preserves Y-coordinate order from sorting)
        if (pageTextParts.length > 0) {
          content.push(text(`[Page ${pageContent.page}]\n${pageTextParts.join('\n')}`));
        }

        // Add images for the page
        if (options.includeImages) {
          for (const img of pageImages) {
            content.push(image(img.data, 'image/png'));
          }
        }
      }
    }

    for (const result of results) {
      if (!result.success || !result.data?.ocr_text_layer) continue;

      for (const page of result.data.ocr_text_layer.pages) {
        if (page.text.trim().length > 0) {
          content.push(text(`[Page ${String(page.page)} OCR]\n${page.text}`));
        }
      }
    }

    // Add markdown tables at the end if tables were extracted
    if (options.includeTables) {
      const allTables: ExtractedTable[] = [];
      for (const result of results) {
        if (result.success && result.data?.tables) {
          allTables.push(...result.data.tables);
        }
      }

      if (allTables.length > 0) {
        const markdownTables = tablesToMarkdown(allTables);
        content.push(text(markdownTables));
      }
    }

    return content;
  });
