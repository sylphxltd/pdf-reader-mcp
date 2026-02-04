// PDF reading handler - orchestrates PDF processing workflow

import { image, text, tool, toolError } from '@sylphx/mcp-server-sdk';
import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  buildWarnings,
  extractMetadataAndPageCount,
  extractPageContent,
} from '../pdf/extractor.js';
import { loadPdfDocument } from '../pdf/loader.js';
import { determinePagesToProcess, getTargetPages } from '../pdf/parser.js';
import { extractTables, tablesToMarkdown } from '../pdf/tableExtractor.js';
import { readPdfArgsSchema } from '../schemas/readPdf.js';
import type {
  ExtractedImage,
  ExtractedTable,
  PdfResultData,
  PdfSource,
  PdfSourceResult,
} from '../types/pdf.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ReadPdf');

/**
 * Process a single PDF source
 */
const processSingleSource = async (
  source: PdfSource,
  options: {
    includeFullText: boolean;
    includeMetadata: boolean;
    includePageCount: boolean;
    includeImages: boolean;
    includeTables: boolean;
  }
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

    // Determine pages to process
    const { pagesToProcess, invalidPages } = determinePagesToProcess(
      targetPages,
      totalPages,
      options.includeFullText
    );

    // Add warnings for invalid pages
    const warnings = buildWarnings(invalidPages, totalPages);
    if (warnings.length > 0) {
      output.warnings = warnings;
    }

    // Extract content with ordering preserved
    if (pagesToProcess.length > 0) {
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
              options.includeImages,
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
      } else {
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

      // Extract tables if requested
      if (options.includeTables) {
        const extractedTables = await extractTables(
          pdfDocument as pdfjsLib.PDFDocumentProxy,
          pagesToProcess
        );

        if (extractedTables.length > 0) {
          output.tables = extractedTables;
        }
      }
    }

    individualResult = { ...individualResult, data: output, success: true };
  } catch (error: unknown) {
    let errorMessage = `Failed to process PDF from ${sourceDescription}.`;

    if (error instanceof Error) {
      errorMessage += ` Reason: ${error.message}`;
    } else {
      errorMessage += ` Unknown error: ${JSON.stringify(error)}`;
    }

    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined;
  } finally {
    // Clean up PDF document resources
    if (pdfDocument && typeof pdfDocument.destroy === 'function') {
      try {
        await pdfDocument.destroy();
      } catch (destroyError: unknown) {
        // Log cleanup errors but don't fail the operation
        const message = destroyError instanceof Error ? destroyError.message : String(destroyError);
        logger.warn('Error destroying PDF document', { sourceDescription, error: message });
      }
    }
  }

  return individualResult;
};

// Export the tool definition using builder pattern
export const readPdf = tool()
  .description(
    'Reads content/metadata/images from one or more PDFs (local/URL). Each source can specify pages to extract.'
  )
  .input(readPdfArgsSchema)
  .handler(async ({ input }) => {
    const {
      sources,
      include_full_text,
      include_metadata,
      include_page_count,
      include_images,
      include_tables,
    } = input;

    // Process sources with concurrency limit to prevent memory exhaustion
    // Processing large PDFs concurrently can consume significant memory
    const MAX_CONCURRENT_SOURCES = 3;
    const results: PdfSourceResult[] = [];
    const options = {
      includeFullText: include_full_text ?? false,
      includeMetadata: include_metadata ?? true,
      includePageCount: include_page_count ?? true,
      includeImages: include_images ?? false,
      includeTables: include_tables ?? false,
    };

    for (let i = 0; i < sources.length; i += MAX_CONCURRENT_SOURCES) {
      const batch = sources.slice(i, i + MAX_CONCURRENT_SOURCES);
      const batchResults = await Promise.all(
        batch.map((source) => processSingleSource(source, options))
      );
      results.push(...batchResults);
    }

    // Check if all sources failed
    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      const errorMessages = results.map((r) => r.error).join('; ');
      return toolError(`All PDF sources failed to process: ${errorMessages}`);
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
        if (tables && tables.length > 0) {
          processedData['table_info'] = tables.map((tbl) => ({
            page: tbl.page,
            tableIndex: tbl.tableIndex,
            rowCount: tbl.rowCount,
            colCount: tbl.colCount,
            confidence: tbl.confidence,
          }));
        }

        return { ...result, data: processedData };
      }
      return result;
    });

    // First content part: Structured JSON results
    content.push(text(JSON.stringify({ results: resultsForJson }, null, 2)));

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
        for (const img of pageImages) {
          content.push(image(img.data, 'image/png'));
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
