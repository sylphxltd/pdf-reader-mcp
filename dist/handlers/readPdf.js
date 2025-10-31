// PDF reading handler - orchestrates PDF processing workflow
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildWarnings, extractImages, extractMetadataAndPageCount, extractPageTexts, } from '../pdf/extractor.js';
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
        // Extract text if needed
        if (pagesToProcess.length > 0) {
            const extractedPageTexts = await extractPageTexts(pdfDocument, pagesToProcess, sourceDescription);
            if (targetPages) {
                // Specific pages requested
                output.page_texts = extractedPageTexts;
            }
            else {
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
    // Build content parts preserving page order
    const content = [];
    // Add metadata/summary as first text part
    const summaryData = results.map((result) => ({
        source: result.source,
        success: result.success,
        num_pages: result.data?.num_pages,
        info: result.data?.info,
        metadata: result.data?.metadata,
        warnings: result.data?.warnings,
        error: result.error,
    }));
    content.push({
        type: 'text',
        text: JSON.stringify({ summary: summaryData }, null, 2),
    });
    // Add page content in order: text then images for each page
    for (const result of results) {
        if (!result.success || !result.data)
            continue;
        // Handle page_texts (specific pages requested)
        if (result.data.page_texts) {
            for (const pageText of result.data.page_texts) {
                // Add text for this page
                content.push({
                    type: 'text',
                    text: `[Page ${pageText.page} from ${result.source}]\n${pageText.text}`,
                });
                // Add images for this page (if any)
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
        // Handle full_text (all pages)
        if (result.data.full_text) {
            content.push({
                type: 'text',
                text: `[Full text from ${result.source}]\n${result.data.full_text}`,
            });
            // Add all images at the end for full text mode
            if (result.data.images) {
                for (const image of result.data.images) {
                    content.push({
                        type: 'image',
                        data: image.data,
                        mimeType: image.format === 'rgba' ? 'image/png' : 'image/jpeg',
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
