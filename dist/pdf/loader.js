// PDF document loading utilities
import fs from 'node:fs/promises';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { resolvePath } from '../utils/pathUtils.js';
/**
 * Load a PDF document from a local file path or URL
 * @param source - Object containing either path or url
 * @param sourceDescription - Description for error messages
 * @returns PDF document proxy
 */
export const loadPdfDocument = async (source, sourceDescription) => {
    let pdfDataSource;
    try {
        if (source.path) {
            const safePath = resolvePath(source.path);
            const buffer = await fs.readFile(safePath);
            pdfDataSource = new Uint8Array(buffer);
        }
        else if (source.url) {
            pdfDataSource = { url: source.url };
        }
        else {
            throw new McpError(ErrorCode.InvalidParams, `Source ${sourceDescription} missing 'path' or 'url'.`);
        }
    }
    catch (err) {
        if (err instanceof McpError) {
            throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        const errorCode = ErrorCode.InvalidRequest;
        if (typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            err.code === 'ENOENT' &&
            source.path) {
            throw new McpError(errorCode, `File not found at '${source.path}'.`, {
                cause: err instanceof Error ? err : undefined,
            });
        }
        throw new McpError(errorCode, `Failed to prepare PDF source ${sourceDescription}. Reason: ${message}`, { cause: err instanceof Error ? err : undefined });
    }
    const loadingTask = getDocument(pdfDataSource);
    try {
        return await loadingTask.promise;
    }
    catch (err) {
        console.error(`[PDF Reader MCP] PDF.js loading error for ${sourceDescription}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw new McpError(ErrorCode.InvalidRequest, `Failed to load PDF document from ${sourceDescription}. Reason: ${message || 'Unknown loading error'}`, { cause: err instanceof Error ? err : undefined });
    }
};
