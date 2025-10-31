// PDF text and metadata extraction utilities
import { PNG } from 'pngjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
/**
 * Encode raw pixel data to PNG format
 */
const encodePixelsToPNG = (pixelData, width, height, channels) => {
    const png = new PNG({ width, height });
    // Convert pixel data to RGBA format expected by pngjs
    if (channels === 4) {
        // Already RGBA
        png.data = Buffer.from(pixelData);
    }
    else if (channels === 3) {
        // RGB -> RGBA (add alpha channel)
        for (let i = 0; i < width * height; i++) {
            const srcIdx = i * 3;
            const dstIdx = i * 4;
            png.data[dstIdx] = pixelData[srcIdx] ?? 0; // R
            png.data[dstIdx + 1] = pixelData[srcIdx + 1] ?? 0; // G
            png.data[dstIdx + 2] = pixelData[srcIdx + 2] ?? 0; // B
            png.data[dstIdx + 3] = 255; // A (fully opaque)
        }
    }
    else if (channels === 1) {
        // Grayscale -> RGBA
        for (let i = 0; i < width * height; i++) {
            const gray = pixelData[i] ?? 0;
            const dstIdx = i * 4;
            png.data[dstIdx] = gray; // R
            png.data[dstIdx + 1] = gray; // G
            png.data[dstIdx + 2] = gray; // B
            png.data[dstIdx + 3] = 255; // A
        }
    }
    // Encode to PNG and convert to base64
    const pngBuffer = PNG.sync.write(png);
    return pngBuffer.toString('base64');
};
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
        // Extract each image - try sync first, then async if needed
        const imagePromises = imageIndices.map((imgIndex, arrayIndex) => new Promise((resolve) => {
            const argsArray = operatorList.argsArray[imgIndex];
            if (!argsArray || argsArray.length === 0) {
                resolve(null);
                return;
            }
            const imageName = argsArray[0];
            // Helper to process image data
            const processImageData = (imageData) => {
                if (!imageData || typeof imageData !== 'object') {
                    return null;
                }
                const img = imageData;
                if (!img.data || !img.width || !img.height) {
                    return null;
                }
                // Determine number of channels based on kind
                // kind === 1 = grayscale (1 channel), 2 = RGB (3 channels), 3 = RGBA (4 channels)
                const channels = img.kind === 1 ? 1 : img.kind === 3 ? 4 : 3;
                const format = img.kind === 1 ? 'grayscale' : img.kind === 3 ? 'rgba' : 'rgb';
                // Encode raw pixel data to PNG format
                const pngBase64 = encodePixelsToPNG(img.data, img.width, img.height, channels);
                return {
                    page: pageNum,
                    index: arrayIndex,
                    width: img.width,
                    height: img.height,
                    format,
                    data: pngBase64,
                };
            };
            // Try to get from commonObjs first if it starts with 'g_'
            if (imageName.startsWith('g_')) {
                try {
                    const imageData = page.commonObjs.get(imageName);
                    if (imageData) {
                        const result = processImageData(imageData);
                        resolve(result);
                        return;
                    }
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`[PDF Reader MCP] Error getting image from commonObjs ${imageName}: ${message}`);
                }
            }
            // Try synchronous get first - if image is already loaded
            try {
                const imageData = page.objs.get(imageName);
                if (imageData !== undefined) {
                    const result = processImageData(imageData);
                    resolve(result);
                    return;
                }
            }
            catch (error) {
                // Synchronous get failed or not supported, fall through to async
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`[PDF Reader MCP] Sync image get failed for ${imageName}, trying async: ${message}`);
            }
            // Fallback to async callback-based get with timeout
            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.warn(`[PDF Reader MCP] Image extraction timeout for ${imageName} on page ${String(pageNum)}`);
                    resolve(null);
                }
            }, 10000); // 10 second timeout as a safety net
            page.objs.get(imageName, (imageData) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    const result = processImageData(imageData);
                    resolve(result);
                }
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
/**
 * Extract all content (text and images) from a single page with Y-coordinate ordering
 */
export const extractPageContent = async (pdfDocument, pageNum, includeImages, sourceDescription) => {
    const contentItems = [];
    try {
        const page = await pdfDocument.getPage(pageNum);
        // Extract text content with Y-coordinates
        const textContent = await page.getTextContent();
        // Group text items by Y-coordinate (items on same line have similar Y values)
        const textByY = new Map();
        for (const item of textContent.items) {
            const textItem = item;
            // transform[5] is the Y coordinate
            const yCoord = textItem.transform[5];
            if (yCoord === undefined)
                continue;
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
            const imageIndices = [];
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const op = operatorList.fnArray[i];
                if (op === OPS.paintImageXObject || op === OPS.paintXObject) {
                    imageIndices.push(i);
                }
            }
            // Extract each image with its Y-coordinate - try sync first, then async if needed
            const imagePromises = imageIndices.map((imgIndex, arrayIndex) => new Promise((resolve) => {
                const argsArray = operatorList.argsArray[imgIndex];
                if (!argsArray || argsArray.length === 0) {
                    resolve(null);
                    return;
                }
                const imageName = argsArray[0];
                // Get transform matrix from the args (if available)
                let yPosition = 0;
                if (argsArray.length > 1 && Array.isArray(argsArray[1])) {
                    const transform = argsArray[1];
                    const yCoord = transform[5];
                    if (yCoord !== undefined) {
                        yPosition = Math.round(yCoord);
                    }
                }
                // Helper to process image data
                const processImageData = (imageData) => {
                    if (!imageData || typeof imageData !== 'object') {
                        return null;
                    }
                    const img = imageData;
                    if (!img.data || !img.width || !img.height) {
                        return null;
                    }
                    // Determine number of channels based on kind
                    const channels = img.kind === 1 ? 1 : img.kind === 3 ? 4 : 3;
                    const format = img.kind === 1 ? 'grayscale' : img.kind === 3 ? 'rgba' : 'rgb';
                    // Encode raw pixel data to PNG format
                    const pngBase64 = encodePixelsToPNG(img.data, img.width, img.height, channels);
                    return {
                        type: 'image',
                        yPosition,
                        imageData: {
                            page: pageNum,
                            index: arrayIndex,
                            width: img.width,
                            height: img.height,
                            format,
                            data: pngBase64,
                        },
                    };
                };
                // Try to get from commonObjs first if it starts with 'g_'
                if (imageName.startsWith('g_')) {
                    try {
                        const imageData = page.commonObjs.get(imageName);
                        if (imageData) {
                            const result = processImageData(imageData);
                            resolve(result);
                            return;
                        }
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        console.warn(`[PDF Reader MCP] Error getting image from commonObjs ${imageName}: ${message}`);
                    }
                }
                // Try synchronous get first - if image is already loaded
                try {
                    const imageData = page.objs.get(imageName);
                    if (imageData !== undefined) {
                        const result = processImageData(imageData);
                        resolve(result);
                        return;
                    }
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`[PDF Reader MCP] Sync image get failed for ${imageName}, trying async: ${message}`);
                }
                // Fallback to async callback-based get with timeout
                let resolved = false;
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        console.warn(`[PDF Reader MCP] Image extraction timeout for ${imageName} on page ${String(pageNum)}`);
                        resolve(null);
                    }
                }, 10000); // 10 second timeout as a safety net
                page.objs.get(imageName, (imageData) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        const result = processImageData(imageData);
                        resolve(result);
                    }
                });
            }));
            const resolvedImages = await Promise.all(imagePromises);
            contentItems.push(...resolvedImages.filter((item) => item !== null));
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[PDF Reader MCP] Error extracting page content for page ${String(pageNum)} in ${sourceDescription}: ${message}`);
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
