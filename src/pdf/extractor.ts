// PDF text and metadata extraction utilities

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type {
  ExtractedImage,
  ExtractedPageText,
  PageContentItem,
  PdfInfo,
  PdfMetadata,
  PdfResultData,
} from '../types/pdf.js';
import { extractErrorMessage } from '../utils/errorUtils.js';
import { createLogger } from '../utils/logger.js';
import { processImageData } from './images/imagePngEncoder.js';
import { retrieveImageData } from './images/imageExtractor.js';

const logger = createLogger('Extractor');

// Re-export image extraction functions for backward compatibility
export { extractImages } from './images/imageExtractor.js';

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
      const message = metaError instanceof Error ? metaError.message : String(metaError);
      logger.warn('Error extracting metadata', { error: message });
    }
  }

  return output;
};

/**
 * Extract text from a single page
 */
const extractSinglePageText = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  sourceDescription: string
): Promise<ExtractedPageText> => {
  try {
    const page = await pdfDocument.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => (item as { str: string }).str)
      .join('');

    return { page: pageNum, text: pageText };
  } catch (pageError: unknown) {
    const message = extractErrorMessage(pageError);
    logger.warn('Error getting text content for page', {
      pageNum,
      sourceDescription,
      error: message,
    });

    return { page: pageNum, text: `Error processing page: ${message}` };
  }
};

/**
 * Extract text from specified pages (parallel processing for performance)
 */
export const extractPageTexts = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[],
  sourceDescription: string
): Promise<ExtractedPageText[]> => {
  // Process all pages in parallel for better performance
  const extractedPageTexts = await Promise.all(
    pagesToProcess.map((pageNum) => extractSinglePageText(pdfDocument, pageNum, sourceDescription))
  );

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

/**
 * Extract all content (text and images) from a single page with Y-coordinate ordering
 */
export const extractPageContent = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  includeImages: boolean,
  sourceDescription: string
): Promise<PageContentItem[]> => {
  const contentItems: PageContentItem[] = [];

  try {
    const page = await pdfDocument.getPage(pageNum);

    // Extract text content with Y-coordinates
    const textContent = await page.getTextContent();

    // Group text items by Y-coordinate (items on same line have similar Y values)
    const textByY = new Map<number, string[]>();

    for (const item of textContent.items) {
      const textItem = item as { str: string; transform: number[] };
      // transform[5] is the Y coordinate
      const yCoord = textItem.transform[5];
      if (yCoord === undefined) continue;
      const y = Math.round(yCoord);

      if (!textByY.has(y)) {
        textByY.set(y, []);
      }
      textByY.get(y)?.push(textItem.str);
    }

    // Convert grouped text to content items
    for (const [y, textParts] of textByY.entries()) {
      const textContent = textParts.join('');
      if (textContent.trim()) {
        contentItems.push({
          type: 'text',
          yPosition: y,
          textContent,
        });
      }
    }

    // Extract images with Y-coordinates if requested
    if (includeImages) {
      const operatorList = await page.getOperatorList();

      // Find all image painting operations
      const imageIndices: number[] = [];
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const op = operatorList.fnArray[i];
        if (op === OPS.paintImageXObject || op === OPS.paintXObject) {
          imageIndices.push(i);
        }
      }

      // Extract each image using shared helper functions
      const imagePromises = imageIndices.map(async (imgIndex, arrayIndex) => {
        const argsArray = operatorList.argsArray[imgIndex];
        if (!argsArray || argsArray.length === 0) {
          return null;
        }

        const imageName = argsArray[0] as string;

        // Get transform matrix from the args (if available)
        let yPosition = 0;
        if (argsArray.length > 1 && Array.isArray(argsArray[1])) {
          const transform = argsArray[1] as number[];
          const yCoord = transform[5];
          if (yCoord !== undefined) {
            yPosition = Math.round(yCoord);
          }
        }

        // Use shared helper to retrieve and process image data
        const imageData = await retrieveImageData(page, imageName, pageNum);
        const extractedImage = processImageData(imageData, pageNum, arrayIndex);

        // Wrap in PageContentItem with yPosition
        if (extractedImage) {
          return {
            type: 'image' as const,
            yPosition,
            imageData: extractedImage,
          };
        }
        return null;
      });

      const resolvedImages = await Promise.all(imagePromises);
      const validImages = resolvedImages.filter((item) => item !== null);
      contentItems.push(...validImages);
    }
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    logger.warn('Error extracting page content', {
      pageNum,
      sourceDescription,
      error: message,
    });
    // Return error message as text content
    return [
      {
        type: 'text',
        yPosition: 0,
        textContent: `Error processing page: ${message}`,
      },
    ];
  }

  // Sort by Y-position (descending = top to bottom in PDF coordinates)
  return contentItems.sort((a, b) => b.yPosition - a.yPosition);
};
