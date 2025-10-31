// PDF reading handler - orchestrates PDF processing workflow

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  buildWarnings,
  extractImages,
  extractMetadataAndPageCount,
  extractPageTexts,
} from '../pdf/extractor.js';
import { loadPdfDocument } from '../pdf/loader.js';
import { determinePagesToProcess, getTargetPages } from '../pdf/parser.js';
import type { ReadPdfArgs } from '../schemas/readPdf.js';
import { readPdfArgsSchema } from '../schemas/readPdf.js';
import type { PdfResultData, PdfSource, PdfSourceResult } from '../types/pdf.js';
import type { ToolDefinition } from './index.js';

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
  }
): Promise<PdfSourceResult> => {
  const sourceDescription = source.path ?? source.url ?? 'unknown source';
  let individualResult: PdfSourceResult = { source: sourceDescription, success: false };

  try {
    // Parse target pages
    const targetPages = getTargetPages(source.pages, sourceDescription);

    // Load PDF document
    const { pages: _pages, ...loadArgs } = source;
    const pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
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

    // Extract text if needed
    if (pagesToProcess.length > 0) {
      const extractedPageTexts = await extractPageTexts(
        pdfDocument,
        pagesToProcess,
        sourceDescription
      );

      if (targetPages) {
        // Specific pages requested
        output.page_texts = extractedPageTexts;
      } else {
        // Full text requested
        output.full_text = extractedPageTexts.map((p) => p.text).join('\n\n');
      }
    }

    // Extract images if needed
    if (options.includeImages && pagesToProcess.length > 0) {
      const extractedImages = await extractImages(pdfDocument, pagesToProcess);
      if (extractedImages.length > 0) {
        output.images = extractedImages;
      }
    }

    individualResult = { ...individualResult, data: output, success: true };
  } catch (error: unknown) {
    let errorMessage = `Failed to process PDF from ${sourceDescription}.`;

    if (error instanceof McpError) {
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage += ` Reason: ${error.message}`;
    } else {
      errorMessage += ` Unknown error: ${JSON.stringify(error)}`;
    }

    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined;
  }

  return individualResult;
};

/**
 * Main handler function for read_pdf tool
 */
export const handleReadPdfFunc = async (
  args: unknown
): Promise<{
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
}> => {
  let parsedArgs: ReadPdfArgs;

  try {
    parsedArgs = readPdfArgsSchema.parse(args);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InvalidParams, `Argument validation failed: ${message}`);
  }

  const { sources, include_full_text, include_metadata, include_page_count, include_images } =
    parsedArgs;

  // Process all sources concurrently
  const results = await Promise.all(
    sources.map((source) =>
      processSingleSource(source, {
        includeFullText: include_full_text,
        includeMetadata: include_metadata,
        includePageCount: include_page_count,
        includeImages: include_images,
      })
    )
  );

  // Build content parts - start with structured JSON for backward compatibility
  const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];

  // Strip image data from JSON to keep it manageable
  const resultsForJson = results.map((result) => {
    if (result.data?.images) {
      const { images, ...dataWithoutImages } = result.data;
      // Include image count and metadata in JSON, but not the base64 data
      const imageInfo = images.map((img) => ({
        page: img.page,
        index: img.index,
        width: img.width,
        height: img.height,
        format: img.format,
      }));
      return { ...result, data: { ...dataWithoutImages, image_info: imageInfo } };
    }
    return result;
  });

  // First content part: Structured JSON results
  content.push({
    type: 'text',
    text: JSON.stringify({ results: resultsForJson }, null, 2),
  });

  // Add page content in order: text then images for each page
  if (include_images) {
    for (const result of results) {
      if (!result.success || !result.data) continue;

      // Handle page_texts (specific pages requested)
      if (result.data.page_texts) {
        for (const pageText of result.data.page_texts) {
          // Add images for this page (if any) right after page text
          if (result.data.images) {
            const pageImages = result.data.images.filter((img) => img.page === pageText.page);
            for (const image of pageImages) {
              content.push({
                type: 'image',
                data: image.data,
                mimeType: image.format === 'rgba' ? 'image/png' : 'image/jpeg',
              });
            }
          }
        }
      }

      // Handle full_text mode - add all images by page order
      if (result.data.full_text && result.data.images) {
        // Group images by page and add in order
        const pageNumbers = [...new Set(result.data.images.map((img) => img.page))].sort(
          (a, b) => a - b
        );

        for (const pageNum of pageNumbers) {
          const pageImages = result.data.images.filter((img) => img.page === pageNum);
          for (const image of pageImages) {
            content.push({
              type: 'image',
              data: image.data,
              mimeType: image.format === 'rgba' ? 'image/png' : 'image/jpeg',
            });
          }
        }
      }
    }
  }

  return { content };
};

// Export the tool definition
export const readPdfToolDefinition: ToolDefinition = {
  name: 'read_pdf',
  description:
    'Reads content/metadata/images from one or more PDFs (local/URL). Each source can specify pages to extract.',
  schema: readPdfArgsSchema,
  handler: handleReadPdfFunc,
};
