// PDF text and metadata extraction utilities
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
/**
 * Extract metadata and page count from a PDF document
 */
export const extractMetadataAndPageCount = async (pdfDocument, includeMetadata, includePageCount) => {
    const output = {};
    if (includePageCount) {
        output.num_pages = pdfDocument.numPages;
    }
    if (includeMetadata) {
        try {
            const pdfMetadata = await pdfDocument.getMetadata();
            const infoData = pdfMetadata.info;
            if (infoData !== undefined) {
                output.info = infoData;
            }
            const metadataObj = pdfMetadata.metadata;
            // Check if it has a getAll method (as used in tests)
            if (typeof metadataObj.getAll === 'function') {
                output.metadata = metadataObj.getAll();
            }
            else {
                // For real PDF.js metadata, convert to plain object
                const metadataRecord = {};
                for (const key in metadataObj) {
                    if (Object.hasOwn(metadataObj, key)) {
                        metadataRecord[key] = metadataObj[key];
                    }
                }
                output.metadata = metadataRecord;
            }
        }
        catch (metaError) {
            console.warn(`[PDF Reader MCP] Error extracting metadata: ${metaError instanceof Error ? metaError.message : String(metaError)}`);
        }
    }
    return output;
};
/**
 * Extract text from a single page
 */
const extractSinglePageText = async (pdfDocument, pageNum, sourceDescription) => {
    try {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item) => item.str)
            .join('');
        return { page: pageNum, text: pageText };
    }
    catch (pageError) {
        const message = pageError instanceof Error ? pageError.message : String(pageError);
        console.warn(`[PDF Reader MCP] Error getting text content for page ${String(pageNum)} in ${sourceDescription}: ${message}`);
        return { page: pageNum, text: `Error processing page: ${message}` };
    }
};
/**
 * Extract text from specified pages (parallel processing for performance)
 */
export const extractPageTexts = async (pdfDocument, pagesToProcess, sourceDescription) => {
    // Process all pages in parallel for better performance
    const extractedPageTexts = await Promise.all(pagesToProcess.map((pageNum) => extractSinglePageText(pdfDocument, pageNum, sourceDescription)));
    return extractedPageTexts.sort((a, b) => a.page - b.page);
};
/**
 * Extract images from a single page
 */
const extractImagesFromPage = async (page, pageNum) => {
    const images = [];
    try {
        const operatorList = await page.getOperatorList();
        // Find all image painting operations
        const imageIndices = [];
        for (let i = 0; i < operatorList.fnArray.length; i++) {
            const op = operatorList.fnArray[i];
            if (op === OPS.paintImageXObject || op === OPS.paintXObject) {
                imageIndices.push(i);
            }
        }
        // Extract each image using Promise-based approach
        const imagePromises = imageIndices.map((imgIndex, arrayIndex) => new Promise((resolve) => {
            const argsArray = operatorList.argsArray[imgIndex];
            if (!argsArray || argsArray.length === 0) {
                resolve(null);
                return;
            }
            const imageName = argsArray[0];
            // Use callback-based get() as images may not be resolved yet
            page.objs.get(imageName, (imageData) => {
                if (!imageData || typeof imageData !== 'object') {
                    resolve(null);
                    return;
                }
                const img = imageData;
                if (!img.data || !img.width || !img.height) {
                    resolve(null);
                    return;
                }
                // Determine image format based on kind
                // kind === 1 = grayscale, 2 = RGB, 3 = RGBA
                const format = img.kind === 1 ? 'grayscale' : img.kind === 3 ? 'rgba' : 'rgb';
                // Convert Uint8Array to base64
                const base64 = Buffer.from(img.data).toString('base64');
                resolve({
                    page: pageNum,
                    index: arrayIndex,
                    width: img.width,
                    height: img.height,
                    format,
                    data: base64,
                });
            });
        }));
        const resolvedImages = await Promise.all(imagePromises);
        images.push(...resolvedImages.filter((img) => img !== null));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[PDF Reader MCP] Error extracting images from page ${String(pageNum)}: ${message}`);
    }
    return images;
};
/**
 * Extract images from specified pages
 */
export const extractImages = async (pdfDocument, pagesToProcess) => {
    const allImages = [];
    // Process pages sequentially to avoid overwhelming PDF.js
    for (const pageNum of pagesToProcess) {
        try {
            const page = await pdfDocument.getPage(pageNum);
            const pageImages = await extractImagesFromPage(page, pageNum);
            allImages.push(...pageImages);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[PDF Reader MCP] Error getting page ${String(pageNum)} for image extraction: ${message}`);
        }
    }
    return allImages;
};
/**
 * Build warnings array for invalid page numbers
 */
export const buildWarnings = (invalidPages, totalPages) => {
    if (invalidPages.length === 0) {
        return [];
    }
    return [
        `Requested page numbers ${invalidPages.join(', ')} exceed total pages (${String(totalPages)}).`,
    ];
};
