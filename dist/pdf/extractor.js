// PDF text and metadata extraction utilities
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
 * Extract text from specified pages
 */
export const extractPageTexts = async (pdfDocument, pagesToProcess, sourceDescription) => {
    const extractedPageTexts = [];
    for (const pageNum of pagesToProcess) {
        let pageText = '';
        try {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            pageText = textContent.items.map((item) => item.str).join('');
        }
        catch (pageError) {
            const message = pageError instanceof Error ? pageError.message : String(pageError);
            console.warn(`[PDF Reader MCP] Error getting text content for page ${String(pageNum)} in ${sourceDescription}: ${message}`);
            pageText = `Error processing page: ${message}`;
        }
        extractedPageTexts.push({ page: pageNum, text: pageText });
    }
    return extractedPageTexts.sort((a, b) => a.page - b.page);
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
