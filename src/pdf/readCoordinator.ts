// PDF reading pipeline coordinator.
//
// Owns the extraction stage graph: metadata → structure → geometry →
// page-content batching → OCR → tables → elements → markdown → HTML →
// chunks → text-layer → visual enrichments → safety findings → AST →
// annotations → trust report → structure trees → accessibility report →
// document map.
//
// This is domain orchestration — it consumes pdfjs parsing primitives and
// produces a typed PdfResultData, but has no knowledge of MCP transport or
// response formatting.

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  ExtractedImage,
  PdfChunk,
  PdfDocumentElement,
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
  PdfVisualEnrichment,
  PdfVisualEnrichmentCandidate,
} from '../types/pdf.js';
import { safeErrorMessage } from '../utils/errorHandling.js';
import { PdfError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { destroyLoadingTask } from '../utils/pdfjs.js';
import { buildAccessibilityReport } from './accessibilityReport.js';
import type { ReadPdfProcessingOptions } from './autoReadPolicy.js';
import { buildDocumentAst } from './documentAst.js';
import { buildDocumentMap } from './documentMap.js';
import {
  buildCitationChunks,
  buildLayoutDiagnostics,
  buildSafetyFindings,
  buildStructuredElements,
  renderHtmlFromPageContents,
  renderMarkdownFromPageContents,
} from './documentModel.js';
import {
  buildWarnings,
  extractAnnotations,
  extractDocumentStructure,
  extractMetadataAndPageCount,
  extractPageContent,
  extractPageGeometry,
  extractStructureTrees,
} from './extractor.js';
import { loadPdfDocument } from './loader.js';
import { buildOcrTextLayer, defaultOcrPagesOptions, ocrPdfSourcePages } from './ocr.js';
import { determinePagesToProcess, getTargetPages } from './parser.js';
import {
  extractTables,
  extractTablesFromOcrTextLayer,
  extractTablesFromPageContents,
  mergeTableExtractionEvidence,
} from './tableExtractor.js';
import { buildTextLayer } from './textLayer.js';
import { buildTrustReport } from './trustReport.js';
import { buildVisualEnrichmentsForSource } from './visualEnrichment.js';

const logger = createLogger('ReadCoordinator');

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
export const processSingleSource = async (
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
    const errorMessage = safeErrorMessage(
      error,
      `Failed to process PDF from ${sourceDescription}.`,
      logger,
      { sourceDescription }
    );

    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined;
  } finally {
    // Clean up PDF document resources. pdfjs v6 moved teardown off the
    // document proxy: PDFDocumentProxy.destroy() is gone, so we destroy the
    // owning loadingTask (aborts network + terminates the worker). Guarded so
    // a future API shift can't throw inside finally.
    await destroyLoadingTask(pdfDocument?.loadingTask, logger, 'PDF document', {
      sourceDescription,
    });
  }

  return individualResult;
};
