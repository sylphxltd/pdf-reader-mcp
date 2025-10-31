// PDF reading handler - orchestrates PDF processing workflow
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildWarnings, extractMetadataAndPageCount, extractPageTexts } from '../pdf/extractor.js';
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
    const { sources, include_full_text, include_metadata, include_page_count } = parsedArgs;
    // Process all sources concurrently
    const results = await Promise.all(sources.map((source) => processSingleSource(source, {
        includeFullText: include_full_text,
        includeMetadata: include_metadata,
        includePageCount: include_page_count,
    })));
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ results }, null, 2),
            },
        ],
    };
};
// Export the tool definition
export const readPdfToolDefinition = {
    name: 'read_pdf',
    description: 'Reads content/metadata from one or more PDFs (local/URL). Each source can specify pages to extract.',
    schema: readPdfArgsSchema,
    handler: handleReadPdfFunc,
};
