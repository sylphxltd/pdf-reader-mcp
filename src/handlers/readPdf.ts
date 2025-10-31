import fs from 'node:fs/promises';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { z } from 'zod';
import { resolvePath } from '../utils/pathUtils.js';
import type { ToolDefinition } from './index.js';

// Helper to parse page range strings (e.g., "1-3,5,7-")
// Helper to parse a single range part (e.g., "1-3", "5", "7-")
const parseRangePart = (part: string, pages: Set<number>): void => {
  const trimmedPart = part.trim();
  if (trimmedPart.includes('-')) {
    const [startStr, endStr] = trimmedPart.split('-');
    if (startStr === undefined) {
      // Basic check
      throw new Error(`Invalid page range format: ${trimmedPart}`);
    }
    const start = parseInt(startStr, 10);
    const end = endStr === '' || endStr === undefined ? Infinity : parseInt(endStr, 10);

    if (Number.isNaN(start) || Number.isNaN(end) || start <= 0 || start > end) {
      throw new Error(`Invalid page range values: ${trimmedPart}`);
    }

    // Add a reasonable upper limit to prevent infinite loops for open ranges
    const practicalEnd = Math.min(end, start + 10000); // Limit range parsing depth
    for (let i = start; i <= practicalEnd; i++) {
      pages.add(i);
    }
    if (end === Infinity && practicalEnd === start + 10000) {
      console.warn(
        `[PDF Reader MCP] Open-ended range starting at ${String(start)} was truncated at page ${String(practicalEnd)} during parsing.`
      );
    }
  } else {
    const page = parseInt(trimmedPart, 10);
    if (Number.isNaN(page) || page <= 0) {
      throw new Error(`Invalid page number: ${trimmedPart}`);
    }
    pages.add(page);
  }
};

// Parses the complete page range string (e.g., "1-3,5,7-")
const parsePageRanges = (ranges: string): number[] => {
  const pages = new Set<number>();
  const parts = ranges.split(',');
  for (const part of parts) {
    parseRangePart(part, pages); // Delegate parsing of each part
  }
  if (pages.size === 0) {
    throw new Error('Page range string resulted in zero valid pages.');
  }
  return Array.from(pages).sort((a, b) => a - b);
};

// --- Zod Schemas ---
const pageSpecifierSchema = z.union([
  z
    .array(z.number().int().min(1))
    .min(1), // Array of integers with minimum value 1 (pages are 1-based)
  z
    .string()
    .min(1)
    .refine((val) => /^[0-9,-]+$/.test(val.replace(/\s/g, '')), {
      // Allow spaces but test without them
      message: 'Page string must contain only numbers, commas, and hyphens.',
    }),
]);

const PdfSourceSchema = z
  .object({
    path: z.string().min(1).optional().describe('Relative path to the local PDF file.'),
    url: z.string().url().optional().describe('URL of the PDF file.'),
    pages: pageSpecifierSchema
      .optional()
      .describe(
        "Extract text only from specific pages (1-based) or ranges for *this specific source*. If provided, 'include_full_text' for the entire request is ignored for this source."
      ),
  })
  .strict()
  .refine((data) => !!(data.path && !data.url) || !!(!data.path && data.url), {
    // Use boolean coercion instead of || for truthiness check if needed, though refine expects boolean
    message: "Each source must have either 'path' or 'url', but not both.",
  });

const ReadPdfArgsSchema = z
  .object({
    sources: z
      .array(PdfSourceSchema)
      .min(1)
      .describe('An array of PDF sources to process, each can optionally specify pages.'),
    include_full_text: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Include the full text content of each PDF (only if 'pages' is not specified for that source)."
      ),
    include_metadata: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include metadata and info objects for each PDF.'),
    include_page_count: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include the total number of pages for each PDF.'),
  })
  .strict();

type ReadPdfArgs = z.infer<typeof ReadPdfArgsSchema>;

// --- Result Type Interfaces ---
interface PdfInfo {
  PDFFormatVersion?: string;
  IsLinearized?: boolean;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  [key: string]: unknown;
}

type PdfMetadata = Record<string, unknown>; // Use Record for better type safety

interface ExtractedPageText {
  page: number;
  text: string;
}

interface PdfResultData {
  info?: PdfInfo;
  metadata?: PdfMetadata;
  num_pages?: number;
  full_text?: string;
  page_texts?: ExtractedPageText[];
  warnings?: string[];
}

interface PdfSourceResult {
  source: string;
  success: boolean;
  data?: PdfResultData | undefined;
  error?: string;
}

// --- Helper Functions ---

// Parses the page specification for a single source
const getTargetPages = (
  sourcePages: string | number[] | undefined,
  sourceDescription: string
): number[] | undefined => {
  if (!sourcePages) {
    return undefined;
  }
  try {
    let targetPages: number[];
    if (typeof sourcePages === 'string') {
      targetPages = parsePageRanges(sourcePages);
    } else {
      // Ensure array elements are positive integers
      if (sourcePages.some((p) => !Number.isInteger(p) || p <= 0)) {
        throw new Error('Page numbers in array must be positive integers.');
      }
      targetPages = [...new Set(sourcePages)].sort((a, b) => a - b);
    }
    if (targetPages.length === 0) {
      // Check after potential Set deduplication
      throw new Error('Page specification resulted in an empty set of pages.');
    }
    return targetPages;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Throw McpError for invalid page specs caught during parsing
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid page specification for source ${sourceDescription}: ${message}`
    );
  }
};

// Loads the PDF document from path or URL
const loadPdfDocument = async (
  source: { path?: string | undefined; url?: string | undefined }, // Explicitly allow undefined
  sourceDescription: string
): Promise<pdfjsLib.PDFDocumentProxy> => {
  let pdfDataSource: Uint8Array | { url: string };
  try {
    if (source.path) {
      const safePath = resolvePath(source.path); // resolvePath handles security checks
      const buffer = await fs.readFile(safePath);
      pdfDataSource = new Uint8Array(buffer); // Convert Buffer to Uint8Array
    } else if (source.url) {
      pdfDataSource = { url: source.url };
    } else {
      // This case should be caught by Zod, but added for robustness
      throw new McpError(
        ErrorCode.InvalidParams,
        `Source ${sourceDescription} missing 'path' or 'url'.`
      );
    }
  } catch (err: unknown) {
    // Handle errors during path resolution or file reading
    let errorMessage: string; // Declare errorMessage here
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = ErrorCode.InvalidRequest; // Default error code

    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      err.code === 'ENOENT' &&
      source.path
    ) {
      // Specific handling for file not found
      errorMessage = `File not found at '${source.path}'.`;
      // Optionally keep errorCode as InvalidRequest or change if needed
    } else {
      // Generic error for other file prep issues or resolvePath errors
      errorMessage = `Failed to prepare PDF source ${sourceDescription}. Reason: ${message}`;
    }
    throw new McpError(errorCode, errorMessage, { cause: err instanceof Error ? err : undefined });
  }

  const loadingTask = pdfjsLib.getDocument(pdfDataSource);
  try {
    return await loadingTask.promise;
  } catch (err: unknown) {
    console.error(`[PDF Reader MCP] PDF.js loading error for ${sourceDescription}:`, err);
    const message = err instanceof Error ? err.message : String(err);
    // Use ?? for default message
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Failed to load PDF document from ${sourceDescription}. Reason: ${message || 'Unknown loading error'}`, // Revert to || as message is likely always string here
      { cause: err instanceof Error ? err : undefined }
    );
  }
};

// Extracts metadata and page count
const extractMetadataAndPageCount = async (
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
      // Convert the metadata object to a plain object by extracting all properties
      // Check if it has a getAll method (as used in tests)
      if (typeof (metadataObj as unknown as { getAll?: () => unknown }).getAll === 'function') {
        output.metadata = (metadataObj as unknown as { getAll: () => PdfMetadata }).getAll();
      } else {
        // For real PDF.js metadata, convert to plain object
        const metadataRecord: PdfMetadata = {};
        // Extract enumerable properties
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
      // Optionally add a warning to the result if metadata extraction fails partially
    }
  }
  return output;
};

// Extracts text from specified pages
const extractPageTexts = async (
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
      pageText = textContent.items
        .map((item: unknown) => (item as { str: string }).str) // Type assertion
        .join('');
    } catch (pageError: unknown) {
      const message = pageError instanceof Error ? pageError.message : String(pageError);
      console.warn(
        `[PDF Reader MCP] Error getting text content for page ${String(pageNum)} in ${sourceDescription}: ${message}` // Explicit string conversion
      );
      pageText = `Error processing page: ${message}`; // Include error in text
    }
    extractedPageTexts.push({ page: pageNum, text: pageText });
  }
  // Sorting is likely unnecessary if pagesToProcess was sorted, but keep for safety
  extractedPageTexts.sort((a, b) => a.page - b.page);
  return extractedPageTexts;
};

// Determines the actual list of pages to process based on target pages and total pages
const determinePagesToProcess = (
  targetPages: number[] | undefined,
  totalPages: number,
  includeFullText: boolean
): { pagesToProcess: number[]; invalidPages: number[] } => {
  let pagesToProcess: number[] = [];
  let invalidPages: number[] = [];

  if (targetPages) {
    // Filter target pages based on actual total pages
    pagesToProcess = targetPages.filter((p) => p <= totalPages);
    invalidPages = targetPages.filter((p) => p > totalPages);
  } else if (includeFullText) {
    // If no specific pages requested for this source, use global flag
    pagesToProcess = Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  return { pagesToProcess, invalidPages };
};

// Processes a single PDF source
const processSingleSource = async (
  source: z.infer<typeof PdfSourceSchema>,
  globalIncludeFullText: boolean,
  globalIncludeMetadata: boolean,
  globalIncludePageCount: boolean
): Promise<PdfSourceResult> => {
  const sourceDescription: string = source.path ?? source.url ?? 'unknown source';
  let individualResult: PdfSourceResult = { source: sourceDescription, success: false };

  try {
    // 1. Parse target pages for this source (throws McpError on invalid spec)
    const targetPages = getTargetPages(source.pages, sourceDescription);

    // 2. Load PDF Document (throws McpError on loading failure)
    // Destructure to remove 'pages' before passing to loadPdfDocument due to exactOptionalPropertyTypes
    const { pages: _pages, ...loadArgs } = source;
    const pdfDocument = await loadPdfDocument(loadArgs, sourceDescription);
    const totalPages = pdfDocument.numPages;

    // 3. Extract Metadata & Page Count
    const metadataOutput = await extractMetadataAndPageCount(
      pdfDocument,
      globalIncludeMetadata,
      globalIncludePageCount
    );
    const output: PdfResultData = { ...metadataOutput }; // Start building output

    // 4. Determine actual pages to process
    const { pagesToProcess, invalidPages } = determinePagesToProcess(
      targetPages,
      totalPages,
      globalIncludeFullText // Pass the global flag
    );

    // Add warnings for invalid requested pages
    if (invalidPages.length > 0) {
      output.warnings = output.warnings ?? [];
      output.warnings.push(
        `Requested page numbers ${invalidPages.join(', ')} exceed total pages (${String(totalPages)}).`
      );
    }

    // 5. Extract Text (if needed)
    if (pagesToProcess.length > 0) {
      const extractedPageTexts = await extractPageTexts(
        pdfDocument,
        pagesToProcess,
        sourceDescription
      );
      if (targetPages) {
        // If specific pages were requested for *this source*
        output.page_texts = extractedPageTexts;
      } else {
        // Only assign full_text if pages were NOT specified for this source
        output.full_text = extractedPageTexts.map((p) => p.text).join('\n\n');
      }
    }

    individualResult = { ...individualResult, data: output, success: true };
  } catch (error: unknown) {
    let errorMessage = `Failed to process PDF from ${sourceDescription}.`;
    if (error instanceof McpError) {
      errorMessage = error.message; // Use message from McpError directly
    } else if (error instanceof Error) {
      errorMessage += ` Reason: ${error.message}`;
    } else {
      errorMessage += ` Unknown error: ${JSON.stringify(error)}`;
    }
    individualResult.error = errorMessage;
    individualResult.success = false;
    individualResult.data = undefined; // Ensure no data on error
  }
  return individualResult;
};

// --- Main Handler Function ---
export const handleReadPdfFunc = async (
  args: unknown
): Promise<{ content: { type: string; text: string }[] }> => {
  let parsedArgs: ReadPdfArgs;
  try {
    parsedArgs = ReadPdfArgsSchema.parse(args);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${error.errors.map((e) => `${e.path.join('.')} (${e.message})`).join(', ')}`
      );
    }
    // Added fallback for non-Zod errors during parsing
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InvalidParams, `Argument validation failed: ${message}`);
  }

  const { sources, include_full_text, include_metadata, include_page_count } = parsedArgs;

  // Process all sources concurrently
  const results = await Promise.all(
    sources.map((source) =>
      processSingleSource(source, include_full_text, include_metadata, include_page_count)
    )
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ results }, null, 2),
      },
    ],
  };
};

// Export the consolidated ToolDefinition
export const readPdfToolDefinition: ToolDefinition = {
  name: 'read_pdf',
  description:
    'Reads content/metadata from one or more PDFs (local/URL). Each source can specify pages to extract.',
  schema: ReadPdfArgsSchema,
  handler: handleReadPdfFunc,
};
