// PDF text and metadata extraction utilities

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ExtractedPageText, PdfInfo, PdfMetadata, PdfResultData } from '../types/pdf.js';

/**
 * Extract metadata and page count from a PDF document
 */
export const extractMetadataAndPageCount = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  includeMetadata: boolean,
  includePageCount: boolean
): Promise<Pick<PdfResultData, 'info' | 'metadata' | 'num_pages'>> => {
  const output: Pick<PdfResultData, 'info' | 'metadata' | 'num_pages'> = {};

  if (includePageCount) {
    output.num_pages = pdfDocument.numPages;
  }

  if (includeMetadata) {
    try {
      const pdfMetadata = await pdfDocument.getMetadata();
      const infoData = pdfMetadata.info as PdfInfo | undefined;

      if (infoData !== undefined) {
        output.info = infoData;
      }

      const metadataObj = pdfMetadata.metadata;

      // Check if it has a getAll method (as used in tests)
      if (typeof (metadataObj as unknown as { getAll?: () => unknown }).getAll === 'function') {
        output.metadata = (metadataObj as unknown as { getAll: () => PdfMetadata }).getAll();
      } else {
        // For real PDF.js metadata, convert to plain object
        const metadataRecord: PdfMetadata = {};
        for (const key in metadataObj) {
          if (Object.hasOwn(metadataObj, key)) {
            metadataRecord[key] = (metadataObj as unknown as Record<string, unknown>)[key];
          }
        }
        output.metadata = metadataRecord;
      }
    } catch (metaError: unknown) {
      console.warn(
        `[PDF Reader MCP] Error extracting metadata: ${metaError instanceof Error ? metaError.message : String(metaError)}`
      );
    }
  }

  return output;
};

/**
 * Extract text from specified pages
 */
export const extractPageTexts = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[],
  sourceDescription: string
): Promise<ExtractedPageText[]> => {
  const extractedPageTexts: ExtractedPageText[] = [];

  for (const pageNum of pagesToProcess) {
    let pageText = '';

    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      pageText = textContent.items.map((item: unknown) => (item as { str: string }).str).join('');
    } catch (pageError: unknown) {
      const message = pageError instanceof Error ? pageError.message : String(pageError);
      console.warn(
        `[PDF Reader MCP] Error getting text content for page ${String(pageNum)} in ${sourceDescription}: ${message}`
      );
      pageText = `Error processing page: ${message}`;
    }

    extractedPageTexts.push({ page: pageNum, text: pageText });
  }

  return extractedPageTexts.sort((a, b) => a.page - b.page);
};

/**
 * Build warnings array for invalid page numbers
 */
export const buildWarnings = (invalidPages: number[], totalPages: number): string[] => {
  if (invalidPages.length === 0) {
    return [];
  }

  return [
    `Requested page numbers ${invalidPages.join(', ')} exceed total pages (${String(totalPages)}).`,
  ];
};
