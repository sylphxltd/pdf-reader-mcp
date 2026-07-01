import { image, text, tool, toolError } from '../mcp.js';
import {
  buildAutoInspections,
  buildAutoReadArgs,
  buildReadOptions,
  DEFAULT_AUTO_DETAIL,
  MAX_CONCURRENT_SOURCES,
  shouldUseAutoRead,
} from '../pdf/autoReadPolicy.js';
import { processSingleSource } from '../pdf/readCoordinator.js';
import { tablesToMarkdown } from '../pdf/tableExtractor.js';
import { type ReadPdfArgs, readPdfArgsSchema } from '../schemas/readPdf.js';
import type { ExtractedImage, ExtractedTable, PdfSourceResult } from '../types/pdf.js';

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
