// PDF reading handler - orchestrates PDF processing workflow
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildWarnings, extractMetadataAndPageCount, extractPageContent, } from '../pdf/extractor.js';
import { loadPdfDocument } from '../pdf/loader.js';
import { determinePagesToProcess, getTargetPages } from '../pdf/parser.js';
import { readPdfArgsSchema } from '../schemas/readPdf.js';
/**
 * Process a single PDF source
 */
const processSingleSource = async (source, options) => {
    const sourceDescription = source.path ?? source.url ?? 'unknown source';
    let individualResult = { source: sourceDescription, success: false };
    try {
        // Parse target pages
        const targetPages = getTargetPages(source.pages, sourceDescription);
        // Load PDF document
        const { pages: _pages, ...loadArgs } = source;
        const pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
        const totalPages = pdfDocument.numPages;
        // Extract metadata and page count
        const metadataOutput = await extractMetadataAndPageCount(pdfDocument, options.includeMetadata, options.includePageCount);
        const output = { ...metadataOutput };
        // Determine pages to process
        const { pagesToProcess, invalidPages } = determinePagesToProcess(targetPages, totalPages, options.includeFullText);
        // Add warnings for invalid pages
        const warnings = buildWarnings(invalidPages, totalPages);
        if (warnings.length > 0) {
            output.warnings = warnings;
        }
        // Extract content with ordering preserved
        if (pagesToProcess.length > 0) {
            // Use new extractPageContent to preserve Y-coordinate ordering
            const pageContents = await Promise.all(pagesToProcess.map((pageNum) => extractPageContent(pdfDocument, pageNum, options.includeImages, sourceDescription)));
            // Store page contents for ordered retrieval
            output.page_contents = pageContents.map((items, idx) => ({
                page: pagesToProcess[idx],
                items,
            }));
            // For backward compatibility, also provide text-only outputs
            const extractedPageTexts = pageContents.map((items, idx) => ({
                page: pagesToProcess[idx],
                text: items
                    .filter((item) => item.type === 'text')
                    .map((item) => item.textContent)
                    .join(''),
            }));
            if (targetPages) {
                // Specific pages requested
                output.page_texts = extractedPageTexts;
            }
            else {
                // Full text requested
                output.full_text = extractedPageTexts.map((p) => p.text).join('\n\n');
            }
            // Extract image metadata for JSON response
            if (options.includeImages) {
                const extractedImages = pageContents
                    .flatMap((items) => items.filter((item) => item.type === 'image' && item.imageData))
                    .map((item) => item.imageData)
                    .filter((img) => img !== undefined);
                if (extractedImages.length > 0) {
                    output.images = extractedImages;
                }
            }
        }
        individualResult = { ...individualResult, data: output, success: true };
    }
    catch (error) {
        let errorMessage = `Failed to process PDF from ${sourceDescription}.`;
        if (error instanceof McpError) {
            errorMessage = error.message;
        }
        else if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
        }
        else {
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
export const handleReadPdfFunc = async (args) => {
    let parsedArgs;
    try {
        parsedArgs = readPdfArgsSchema.parse(args);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`);
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InvalidParams, `Argument validation failed: ${message}`);
    }
    const { sources, include_full_text, include_metadata, include_page_count, include_images } = parsedArgs;
    // Process all sources concurrently
    const results = await Promise.all(sources.map((source) => processSingleSource(source, {
        includeFullText: include_full_text,
        includeMetadata: include_metadata,
        includePageCount: include_page_count,
        includeImages: include_images,
    })));
    // Build content parts - start with structured JSON for backward compatibility
    const content = [];
    // Strip image data and page_contents from JSON to keep it manageable
    const resultsForJson = results.map((result) => {
        if (result.data) {
            const { images, page_contents, ...dataWithoutBinaryContent } = result.data;
            // Include image count and metadata in JSON, but not the base64 data
            if (images) {
                const imageInfo = images.map((img) => ({
                    page: img.page,
                    index: img.index,
                    width: img.width,
                    height: img.height,
                    format: img.format,
                }));
                return { ...result, data: { ...dataWithoutBinaryContent, image_info: imageInfo } };
            }
            return { ...result, data: dataWithoutBinaryContent };
        }
        return result;
    });
    // First content part: Structured JSON results
    content.push({
        type: 'text',
        text: JSON.stringify({ results: resultsForJson }, null, 2),
    });
    // Add page content in exact Y-coordinate order
    for (const result of results) {
        if (!result.success || !result.data?.page_contents)
            continue;
        // Process each page's content items in order
        for (const pageContent of result.data.page_contents) {
            for (const item of pageContent.items) {
                if (item.type === 'text' && item.textContent) {
                    // Add text content part
                    content.push({
                        type: 'text',
                        text: item.textContent,
                    });
                }
                else if (item.type === 'image' && item.imageData) {
                    // Add image content part
                    content.push({
                        type: 'image',
                        data: item.imageData.data,
                        mimeType: item.imageData.format === 'rgba' ? 'image/png' : 'image/jpeg',
                    });
                }
            }
        }
    }
    return { content };
};
// Export the tool definition
export const readPdfToolDefinition = {
    name: 'read_pdf',
    description: 'Reads content/metadata/images from one or more PDFs (local/URL). Each source can specify pages to extract.',
    schema: readPdfArgsSchema,
    handler: handleReadPdfFunc,
};
