// Image extraction from PDF pages

import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ExtractedImage } from '../../types/pdf.js';
import { extractErrorMessage } from '../../utils/errorUtils.js';
import { createLogger } from '../../utils/logger.js';
import { processImageData } from './imagePngEncoder.js';

const logger = createLogger('ImageExtractor');

/**
 * Retrieve image data from PDF.js page objects
 * Tries multiple strategies: commonObjs -> sync objs.get -> async objs.get with timeout
 */
export const retrieveImageData = async (
  page: pdfjsLib.PDFPageProxy,
  imageName: string,
  pageNum: number
): Promise<unknown> => {
  // Try to get from commonObjs first if it starts with 'g_'
  if (imageName.startsWith('g_')) {
    try {
      const imageData = page.commonObjs.get(imageName);
      if (imageData) {
        return imageData;
      }
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      logger.warn('Error getting image from commonObjs', { imageName, error: message });
    }
  }

  // Try synchronous get first - if image is already loaded
  try {
    const imageData = page.objs.get(imageName);
    if (imageData !== undefined) {
      return imageData;
    }
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    logger.warn('Sync image get failed, trying async', { imageName, error: message });
  }

  // Fallback to async callback-based get with timeout
  return new Promise<unknown>((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Create a cleanup function to ensure resources are released
    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        logger.warn('Image extraction timeout', { imageName, pageNum });
        resolve(null);
      }
    }, 10000); // 10 second timeout as a safety net

    try {
      page.objs.get(imageName, (imageData: unknown) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(imageData);
        }
      });
    } catch (error: unknown) {
      // If get() throws synchronously, clean up and reject
      if (!resolved) {
        resolved = true;
        cleanup();
        const message = extractErrorMessage(error);
        logger.warn('Error in async image get', { imageName, error: message });
        resolve(null);
      }
    }
  });
};

/**
 * Extract images from a single page
 */
export const extractImagesFromPage = async (
  page: pdfjsLib.PDFPageProxy,
  pageNum: number
): Promise<ExtractedImage[]> => {
  const images: ExtractedImage[] = [];

  /* c8 ignore next */
  try {
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
      const imageData = await retrieveImageData(page, imageName, pageNum);
      return processImageData(imageData, pageNum, arrayIndex);
    });

    const resolvedImages = await Promise.all(imagePromises);
    images.push(...resolvedImages.filter((img): img is ExtractedImage => img !== null));
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    logger.warn('Error extracting images from page', { pageNum, error: message });
  }

  return images;
};

/**
 * Extract images from specified pages (sequential processing to avoid overwhelming PDF.js)
 */
export const extractImages = async (
  pdfDocument: pdfjsLib.PDFDocumentProxy,
  pagesToProcess: number[]
): Promise<ExtractedImage[]> => {
  const allImages: ExtractedImage[] = [];

  // Process pages sequentially to avoid overwhelming PDF.js
  for (const pageNum of pagesToProcess) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const pageImages = await extractImagesFromPage(page, pageNum);
      allImages.push(...pageImages);
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      logger.warn('Error getting page for image extraction', { pageNum, error: message });
    }
  }

  return allImages;
};
