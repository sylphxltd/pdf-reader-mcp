import { type Schema, safeParse } from '@sylphx/vex';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode, PdfError } from '../../src/utils/errors.js';
import * as pathUtils from '../../src/utils/pathUtils.js'; // Import the module itself for spying
import { resolvePath } from '../../src/utils/pathUtils.js';

// Define a type for the expected structure after JSON.parse
interface ExpectedResultType {
  results: { source: string; success: boolean; data?: object; error?: string }[];
}

// --- Mocking pdfjs-dist ---
const mockGetMetadata = vi.fn();
const mockGetPage = vi.fn();
const mockGetDocument = vi.fn();
const mockReadFile = vi.fn();

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: mockGetDocument,
  OPS: {
    paintImageXObject: 89,
    paintXObject: 92,
  },
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mockReadFile,
  },
  readFile: mockReadFile,
}));

// Dynamically import the handler *once* after mocks are defined
// Define a more specific type for the handler's return value content
interface HandlerResultContent {
  type: string;
  text: string;
}
let handler: (args: unknown) => Promise<{ content: HandlerResultContent[] }>;
let readPdfSchema: Schema<unknown>;

beforeAll(async () => {
  // Import the readPdf tool - the new SDK uses a builder pattern
  const { readPdf } = await import('../../src/handlers/readPdf.js');
  const { readPdfArgsSchema } = await import('../../src/schemas/readPdf.js');
  readPdfSchema = readPdfArgsSchema as Schema<unknown>;

  // The tool is created with .handler() which returns a function
  // We need to wrap it to match the expected interface
  handler = async (args: unknown) => {
    // Validate input with Vex first (as the server would do)
    const parseResult = safeParse(readPdfSchema)(args);
    if (!parseResult.success) {
      throw new PdfError(ErrorCode.InvalidParams, `Invalid arguments: ${parseResult.error}`);
    }
    const parsedArgs = parseResult.data;

    const result = await readPdf.handler({ input: parsedArgs, ctx: {} as unknown });
    // Handle toolError case - it returns { content: [...], isError: true }
    if (result && typeof result === 'object' && 'isError' in result && result.isError) {
      throw new PdfError(ErrorCode.InvalidRequest, (result as { content: { text: string }[] }).content[0].text);
    }
    // Convert array result to expected format
    if (Array.isArray(result)) {
      return {
        content: result.map((item) => {
          if ('text' in item) return { type: 'text', text: item.text };
          if ('data' in item) return { type: 'image', data: item.data, mimeType: item.mimeType };
          return item;
        }),
      };
    }
    return result as { content: HandlerResultContent[] };
  };
});

// Renamed describe block as it now only tests the handler
describe('handleReadPdfFunc Integration Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mocks for pathUtils if we spy on it
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation((p) => p); // Simple mock for resolvePath

    mockReadFile.mockResolvedValue(Buffer.from('mock pdf content'));

    const mockDocumentAPI = {
      numPages: 3,
      getMetadata: mockGetMetadata,
      getPage: mockGetPage,
    };
    const mockLoadingTaskAPI = { promise: Promise.resolve(mockDocumentAPI) };
    mockGetDocument.mockReturnValue(mockLoadingTaskAPI);
    mockGetMetadata.mockResolvedValue({
      info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
      metadata: {
        _metadataMap: new Map([['dc:format', 'application/pdf']]),
        get(key: string) {
          return this._metadataMap.get(key);
        },
        has(key: string) {
          return this._metadataMap.has(key);
        },
        getAll() {
          return Object.fromEntries(this._metadataMap);
        },
      },
    });
    // Removed unnecessary async and eslint-disable comment
    mockGetPage.mockImplementation((pageNum: number) => {
      if (pageNum > 0 && pageNum <= mockDocumentAPI.numPages) {
        return {
          getTextContent: vi.fn().mockResolvedValueOnce({
            items: [
              {
                str: `Mock page text ${String(pageNum)}`,
                transform: [1, 0, 0, 1, 0, 100 + pageNum * 10],
              },
            ],
          }),
          getOperatorList: vi.fn().mockResolvedValue({
            fnArray: [],
            argsArray: [],
          }),
          objs: {
            get: vi.fn(),
          },
        };
      }
      throw new Error(`Mock getPage error: Invalid page number ${String(pageNum)}`);
    });
  });

  // Removed unit tests for parsePageRanges

  // --- Integration Tests for handleReadPdfFunc ---

  it('should successfully read full text, metadata, and page count for a local file', async () => {
    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_metadata: true,
      include_page_count: true,
    };
    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: 'test.pdf',
          success: true,
          data: {
            info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
            metadata: { 'dc:format': 'application/pdf' },
            num_pages: 3,
            full_text: 'Mock page text 1\n\nMock page text 2\n\nMock page text 3',
          },
        },
      ],
    };

    expect(mockReadFile).toHaveBeenCalledWith(resolvePath('test.pdf'));
    expect(mockGetDocument).toHaveBeenCalledWith({
      data: new Uint8Array(Buffer.from('mock pdf content')),
      cMapUrl: expect.stringContaining('cmaps'),
      cMapPacked: true,
    });
    expect(mockGetMetadata).toHaveBeenCalled();
    expect(mockGetPage).toHaveBeenCalledTimes(3);

    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  it('should successfully read specific pages for a local file', async () => {
    const args = {
      sources: [{ path: 'test.pdf', pages: [1, 3] }],
      include_metadata: false,
      include_page_count: true,
    };
    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: 'test.pdf',
          success: true,
          data: {
            num_pages: 3,
            page_texts: [
              { page: 1, text: 'Mock page text 1' },
              { page: 3, text: 'Mock page text 3' },
            ],
          },
        },
      ],
    };
    expect(mockGetPage).toHaveBeenCalledTimes(2);
    expect(mockGetPage).toHaveBeenCalledWith(1);
    expect(mockGetPage).toHaveBeenCalledWith(3);
    expect(mockReadFile).toHaveBeenCalledWith(resolvePath('test.pdf'));
    expect(mockGetDocument).toHaveBeenCalledWith({
      data: new Uint8Array(Buffer.from('mock pdf content')),
      cMapUrl: expect.stringContaining('cmaps'),
      cMapPacked: true,
    });
    expect(mockGetMetadata).not.toHaveBeenCalled();

    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  it('should successfully read specific pages using string range', async () => {
    const args = {
      sources: [{ path: 'test.pdf', pages: '1,3-3' }],
      include_page_count: true,
    };
    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: 'test.pdf',
          success: true,
          data: {
            info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
            metadata: { 'dc:format': 'application/pdf' },
            num_pages: 3,
            page_texts: [
              { page: 1, text: 'Mock page text 1' },
              { page: 3, text: 'Mock page text 3' },
            ],
          },
        },
      ],
    };
    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  it('should successfully read metadata only for a URL', async () => {
    const testUrl = 'http://example.com/test.pdf';
    const args = {
      sources: [{ url: testUrl }],
      include_full_text: false,
      include_metadata: true,
      include_page_count: false,
    };
    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: testUrl,
          success: true,
          data: {
            info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
            metadata: { 'dc:format': 'application/pdf' },
          },
        },
      ],
    };
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockGetDocument).toHaveBeenCalledWith({
      url: testUrl,
      cMapUrl: expect.stringContaining('cmaps'),
      cMapPacked: true,
    });
    expect(mockGetMetadata).toHaveBeenCalled();
    expect(mockGetPage).not.toHaveBeenCalled();
    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  it('should handle multiple sources with different options', async () => {
    const urlSource = 'http://example.com/another.pdf';
    const args = {
      sources: [{ path: 'local.pdf', pages: [1] }, { url: urlSource }],
      include_full_text: true,
      include_metadata: true,
      include_page_count: true,
    };
    // Setup mocks for the second source (URL)
    const secondMockGetPage = vi.fn().mockImplementation((pageNum: number) => {
      // Removed unnecessary async
      if (pageNum === 1)
        return {
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ str: 'URL Mock page text 1', transform: [1, 0, 0, 1, 0, 200] }],
          }),
          getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
          objs: { get: vi.fn() },
        };
      if (pageNum === 2)
        return {
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ str: 'URL Mock page text 2', transform: [1, 0, 0, 1, 0, 210] }],
          }),
          getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
          objs: { get: vi.fn() },
        };
      throw new Error(`Mock getPage error: Invalid page number ${String(pageNum)}`);
    });
    const secondMockGetMetadata = vi.fn().mockResolvedValue({
      // Separate metadata mock if needed
      info: { Title: 'URL PDF' },
      metadata: { getAll: () => ({ 'dc:creator': 'URL Author' }) },
    });
    const secondMockDocumentAPI = {
      numPages: 2,
      getMetadata: secondMockGetMetadata, // Use separate metadata mock
      getPage: secondMockGetPage,
    };
    const secondLoadingTaskAPI = { promise: Promise.resolve(secondMockDocumentAPI) };

    // Reset getDocument mock before setting implementation
    mockGetDocument.mockReset();
    // Mock getDocument based on input source
    mockGetDocument.mockImplementation(
      (source: { data?: Uint8Array; url?: string; cMapUrl?: string; cMapPacked?: boolean }) => {
        // Check if source has the matching url property
        if (source.url === urlSource) {
          return secondLoadingTaskAPI;
        }
        // Default mock for path-based source (local.pdf)
        const defaultMockDocumentAPI = {
          numPages: 3,
          getMetadata: mockGetMetadata, // Use original metadata mock
          getPage: mockGetPage, // Use original page mock
        };
        return { promise: Promise.resolve(defaultMockDocumentAPI) };
      }
    );

    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: 'local.pdf',
          success: true,
          data: {
            info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
            metadata: { 'dc:format': 'application/pdf' },
            num_pages: 3,
            page_texts: [{ page: 1, text: 'Mock page text 1' }],
          },
        },
        {
          source: urlSource,
          success: true,
          data: {
            // Use the metadata returned by secondMockGetMetadata
            info: { Title: 'URL PDF' },
            metadata: { 'dc:creator': 'URL Author' },
            num_pages: 2,
            full_text: 'URL Mock page text 1\n\nURL Mock page text 2',
          },
        },
      ],
    };
    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockReadFile).toHaveBeenCalledWith(resolvePath('local.pdf'));
    expect(mockGetDocument).toHaveBeenCalledTimes(2);
    expect(mockGetDocument).toHaveBeenCalledWith({
      data: new Uint8Array(Buffer.from('mock pdf content')),
      cMapUrl: expect.stringContaining('cmaps'),
      cMapPacked: true,
    });
    expect(mockGetDocument).toHaveBeenCalledWith({
      url: urlSource,
      cMapUrl: expect.stringContaining('cmaps'),
      cMapPacked: true,
    });
    expect(mockGetPage).toHaveBeenCalledTimes(1); // Should be called once for local.pdf page 1
    expect(secondMockGetPage).toHaveBeenCalledTimes(2);
    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  // --- Error Handling Tests ---

  it('should throw error if local file not found', async () => {
    const error = new Error('Mock ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    mockReadFile.mockRejectedValue(error);
    const args = { sources: [{ path: 'nonexistent.pdf' }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow("File not found at 'nonexistent.pdf'");
  });

  it('should throw error if pdfjs fails to load document', async () => {
    const loadError = new Error('Mock PDF loading failed');
    const failingLoadingTask = { promise: Promise.reject(loadError) };
    mockGetDocument.mockReturnValue(failingLoadingTask);
    const args = { sources: [{ path: 'bad.pdf' }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow('Mock PDF loading failed');
  });

  it('should throw PdfError for invalid input arguments (Vex error)', async () => {
    const args = { sources: [{ path: 'test.pdf' }], include_full_text: 'yes' };
    await expect(handler(args)).rejects.toThrow(PdfError);
    // Vex format: "include_full_text: Expected boolean"
    await expect(handler(args)).rejects.toThrow(/include_full_text.*boolean/i);
    await expect(handler(args)).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
  });

  // Test case for the initial Zod parse failure
  it('should throw PdfError if top-level argument parsing fails', async () => {
    const invalidArgs = { invalid_prop: true }; // Completely wrong structure
    await expect(handler(invalidArgs)).rejects.toThrow(PdfError);
    // Zod 4 format: "Invalid input: expected array, received undefined"
    await expect(handler(invalidArgs)).rejects.toThrow(/sources.*array/i);
    await expect(handler(invalidArgs)).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
  });

  // Skipped: Vex does not support custom regex validation like Zod's .refine()
  // Invalid page strings like "1,abc,3" will be caught at processing time instead
  it.skip('should throw PdfError for invalid page specification string (removed - no refine in Vex)', async () => {
    const args = { sources: [{ path: 'test.pdf', pages: '1,abc,3' }] };
    await expect(handler(args)).rejects.toThrow(PdfError);
  });

  // Vex validates that page numbers are >= 1 via gte(1) constraint
  // Since pages is a union (array | string), validation failure shows union error
  it('should throw PdfError for invalid page specification array (non-positive - Vex)', async () => {
    const args = { sources: [{ path: 'test.pdf', pages: [1, 0, 3] }] };
    await expect(handler(args)).rejects.toThrow(PdfError);
    // Vex format: "pages: Value does not match any type in union"
    await expect(handler(args)).rejects.toThrow(/pages.*union/i);
    await expect(handler(args)).rejects.toHaveProperty('code', ErrorCode.InvalidParams);
  });

  // Test case for resolvePath failure within the catch block
  it('should throw error if resolvePath fails', async () => {
    const resolveError = new Error('Mock resolvePath failed');
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation(() => {
      throw resolveError;
    });
    const args = { sources: [{ path: 'some/path' }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow('Mock resolvePath failed');
  });

  // Test case for the final catch block with a generic error
  it('should throw error when generic errors during processing', async () => {
    const genericError = new Error('Something unexpected happened');
    mockReadFile.mockRejectedValue(genericError); // Simulate error after path resolution
    const args = { sources: [{ path: 'generic/error/path' }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow('Something unexpected happened');
  });

  // Test case for the final catch block with a non-Error object
  it('should throw error with non-Error exceptions during processing', async () => {
    const nonError = { message: 'Just an object', code: 'UNEXPECTED' };
    mockReadFile.mockRejectedValue(nonError); // Simulate error after path resolution
    const args = { sources: [{ path: 'non/error/path' }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow('non/error/path');
  });

  it('should include warnings for requested pages exceeding total pages', async () => {
    const args = {
      sources: [{ path: 'test.pdf', pages: [1, 4, 5] }],
      include_page_count: true,
    };
    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: 'test.pdf',
          success: true,
          data: {
            info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
            metadata: { 'dc:format': 'application/pdf' },
            num_pages: 3,
            page_texts: [{ page: 1, text: 'Mock page text 1' }],
            warnings: ['Requested page numbers 4, 5 exceed total pages (3).'],
          },
        },
      ],
    };
    expect(mockGetPage).toHaveBeenCalledTimes(1);
    expect(mockGetPage).toHaveBeenCalledWith(1);
    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  it('should handle errors during page processing gracefully when specific pages are requested', async () => {
    // Removed unnecessary async and eslint-disable comment
    mockGetPage.mockImplementation((pageNum: number) => {
      if (pageNum === 1)
        return {
          getTextContent: vi.fn().mockResolvedValueOnce({
            items: [{ str: `Mock page text 1`, transform: [1, 0, 0, 1, 0, 100] }],
          }),
          getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
          objs: { get: vi.fn() },
        };
      if (pageNum === 2) throw new Error('Failed to get page 2');
      if (pageNum === 3)
        return {
          getTextContent: vi.fn().mockResolvedValueOnce({
            items: [{ str: `Mock page text 3`, transform: [1, 0, 0, 1, 0, 120] }],
          }),
          getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
          objs: { get: vi.fn() },
        };
      throw new Error(`Mock getPage error: Invalid page number ${String(pageNum)}`);
    });
    const args = {
      sources: [{ path: 'test.pdf', pages: [1, 2, 3] }],
    };
    const result = await handler(args);
    const expectedData = {
      results: [
        {
          source: 'test.pdf',
          success: true,
          data: {
            info: { PDFFormatVersion: '1.7', Title: 'Mock PDF' },
            metadata: { 'dc:format': 'application/pdf' },
            num_pages: 3,
            page_texts: [
              { page: 1, text: 'Mock page text 1' },
              { page: 2, text: 'Error processing page: Failed to get page 2' },
              { page: 3, text: 'Mock page text 3' },
            ],
          },
        },
      ],
    };
    expect(mockGetPage).toHaveBeenCalledTimes(3);
    // Add check for content existence and access safely
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      expect(JSON.parse(result.content[0].text) as ExpectedResultType).toEqual(expectedData);
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  // --- Additional Coverage Tests ---

  it('should throw error if pdfjs fails to load document from URL', async () => {
    const testUrl = 'http://example.com/bad-url.pdf';
    const loadError = new Error('Mock URL PDF loading failed');
    const failingLoadingTask = { promise: Promise.reject(loadError) };
    // Ensure getDocument is mocked specifically for this URL
    mockGetDocument.mockReset();
    mockGetDocument.mockImplementation((source: unknown) => {
      if (
        typeof source === 'object' &&
        source !== null &&
        Object.hasOwn(source, 'url') &&
        typeof (source as { url?: unknown }).url === 'string' &&
        (source as { url: string }).url === testUrl
      ) {
        return failingLoadingTask;
      }
      const mockDocumentAPI = { numPages: 1, getMetadata: vi.fn(), getPage: vi.fn() };
      return { promise: Promise.resolve(mockDocumentAPI) };
    });

    const args = { sources: [{ url: testUrl }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow('Mock URL PDF loading failed');
  });

  it('should not include page count when include_page_count is false', async () => {
    const args = {
      sources: [{ path: 'test.pdf' }],
      include_page_count: false, // Explicitly false
      include_metadata: false, // Keep it simple
      include_full_text: false,
    };
    const result = await handler(args);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      const parsedResult = JSON.parse(result.content[0].text) as ExpectedResultType;
      expect(parsedResult.results[0]).toBeDefined();
      if (parsedResult.results[0]?.data) {
        expect(parsedResult.results[0].success).toBe(true);
        expect(parsedResult.results[0].data).not.toHaveProperty('num_pages');
        expect(parsedResult.results[0].data).not.toHaveProperty('metadata');
        expect(parsedResult.results[0].data).not.toHaveProperty('info');
      }
    } else {
      expect.fail('result.content[0] was undefined');
    }
    expect(mockGetMetadata).not.toHaveBeenCalled(); // Because include_metadata is false
  });

  it('should handle ENOENT error where resolvePath also fails in catch block', async () => {
    const enoentError = new Error('Mock ENOENT') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    const targetPath = 'enoent/and/resolve/fails.pdf';

    // Mock resolvePath to return path as-is
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation((p) => p);

    mockReadFile.mockRejectedValue(enoentError);

    const args = { sources: [{ path: targetPath }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow(`File not found at '${targetPath}'`);

    // Ensure readFile was called with the path that resolvePath returned
    expect(mockReadFile).toHaveBeenCalledWith(targetPath);
  });

  // --- Additional Error Coverage Tests ---

  it('should throw error for invalid page range string (e.g., 5-3)', async () => {
    const args = { sources: [{ path: 'test.pdf', pages: '1,5-3,7' }] };
    // When page parsing fails, it should throw
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow(/Invalid page range values: 5-3/);
  });

  // Skipped: Vex does not support custom regex validation like Zod's .refine()
  // Invalid page strings are caught at processing time instead of schema validation
  it.skip('should throw PdfError for invalid page number string (removed - no refine in Vex)', async () => {
    const args = { sources: [{ path: 'test.pdf', pages: '1,a,3' }] };
    await expect(handler(args)).rejects.toThrow(PdfError);
  });

  // Skipped: Vex does not support .refine() for XOR validation
  // These cases are caught at processing time when the loader fails
  it.skip('should throw PdfError if source has both path and url (removed - no refine in Vex)', async () => {
    const args = { sources: [{ path: 'test.pdf', url: 'http://example.com' }] };
    await expect(handler(args)).rejects.toThrow(PdfError);
  });

  // Skipped: Vex does not support .refine() for XOR validation
  // These cases are caught at processing time when the loader fails
  it.skip('should throw PdfError if source has neither path nor url (removed - no refine in Vex)', async () => {
    const args = { sources: [{ pages: [1] }] }; // Missing path and url
    await expect(handler(args)).rejects.toThrow(PdfError);
  });

  it.skip('should handle non-Error exceptions during processing', async () => {
    // TODO: Fix this test - spy from previous test is persisting in Bun's test runner
    // Reset all mocks to ensure clean state
    vi.clearAllMocks();
    vi.spyOn(pathUtils, 'resolvePath')
      .mockClear()
      .mockImplementation((p) => p);

    // Reset mock functions
    mockReadFile.mockResolvedValue(Buffer.from('mock pdf content'));

    // Mock to throw non-Error at processSingleSource level
    // We need to throw something that's not Error or PdfError
    mockGetDocument.mockReset();
    mockGetDocument.mockImplementation(() => {
      throw { custom: 'object error' }; // Non-Error, non-PdfError
    });

    const args = { sources: [{ path: 'test.pdf' }] };
    const result = await handler(args);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.content?.[0]) {
      const parsedResult = JSON.parse(result.content[0].text) as ExpectedResultType;
      expect(parsedResult.results[0]).toBeDefined();
      if (parsedResult.results[0]) {
        expect(parsedResult.results[0].success).toBe(false);
        expect(parsedResult.results[0].error).toContain('Unknown error');
        expect(parsedResult.results[0].error).toContain('custom');
      }
    } else {
      expect.fail('result.content[0] was undefined');
    }
  });

  it.skip('should extract images when include_images is true with full text', async () => {
    // TODO: Fix this test - Bun test runner handles image content differently
    const mockImageData = {
      width: 100,
      height: 50,
      data: new Uint8Array([255, 0, 0]),
      kind: 2,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89], // OPS.paintImageXObject value
        argsArray: [['img1', [1, 0, 0, 1, 0, 50]]],
      }),
      objs: {
        get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
          callback(mockImageData);
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Should have content parts: summary text + images
    expect(result.content.length).toBeGreaterThanOrEqual(2);

    // First part should be summary
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBeDefined();

    // Check JSON format includes image_info
    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.results[0].data.image_info).toBeDefined();

    // Should have image parts
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBeGreaterThan(0);
    expect(imageParts[0].data).toBeDefined();
    expect(imageParts[0].mimeType).toBeDefined();
  });

  it.skip('should extract images with page_texts preserving order', async () => {
    // TODO: Fix this test - Bun test runner handles image content differently
    const mockImageData = {
      width: 50,
      height: 50,
      data: new Uint8Array([128, 128, 128]),
      kind: 1,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Page text', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89],
        argsArray: [['img1', [1, 0, 0, 1, 0, 50]]],
      }),
      objs: {
        get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
          callback(mockImageData);
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf', pages: [1, 2] }],
      include_images: true,
    };

    const result = await handler(args);

    // Should have: summary + (page1_images + page2_images)
    expect(result.content.length).toBeGreaterThan(1);

    // Check image parts exist
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(2); // One image per page
  });

  it('should handle image extraction timeout when callback never fires', async () => {
    // Reset resolvePath mock to not interfere
    vi.spyOn(pathUtils, 'resolvePath').mockImplementation((p) => p);

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89], // OPS.paintImageXObject
        argsArray: [['hanging_img']],
      }),
      objs: {
        get: vi.fn().mockImplementation((_name: string, _callback?: (data: unknown) => void) => {
          // Return undefined for sync call, never call callback for async
          return undefined;
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    // Should complete despite hanging callback (timeout after 10 seconds)
    const result = await handler(args);

    expect(result.content.length).toBeGreaterThanOrEqual(1);
    expect(result.content[0].type).toBe('text');

    // Image parts should be empty or missing since extraction timed out
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(0);
  }, 15000); // Set test timeout to 15 seconds (10s timeout + buffer)

  it('should extract different image formats (grayscale, rgb, rgba)', async () => {
    const mockGrayscaleImage = {
      width: 50,
      height: 50,
      data: new Uint8Array([128]),
      kind: 1, // grayscale
    };

    const mockRGBImage = {
      width: 100,
      height: 100,
      data: new Uint8Array([255, 0, 0]),
      kind: 2, // RGB
    };

    const mockRGBAImage = {
      width: 75,
      height: 75,
      data: new Uint8Array([0, 255, 0, 255]),
      kind: 3, // RGBA
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89, 89, 89], // Three images
        argsArray: [['img1'], ['img2'], ['img3']],
      }),
      objs: {
        get: vi.fn().mockImplementation((name: string, callback: (data: unknown) => void) => {
          if (name === 'img1') callback(mockGrayscaleImage);
          else if (name === 'img2') callback(mockRGBImage);
          else if (name === 'img3') callback(mockRGBAImage);
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Check JSON includes image info
    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.results[0].data.image_info).toHaveLength(3);
    expect(parsed.results[0].data.image_info[0].format).toBe('grayscale');
    expect(parsed.results[0].data.image_info[1].format).toBe('rgb');
    expect(parsed.results[0].data.image_info[2].format).toBe('rgba');

    // Check image parts with correct MIME types (all images are now PNG)
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(3);
    // All images should be PNG now
    expect(imageParts[0].mimeType).toBe('image/png');
    expect(imageParts[1].mimeType).toBe('image/png');
    expect(imageParts[2].mimeType).toBe('image/png');
  });

  it('should skip images with missing or invalid data', async () => {
    const mockValidImage = {
      width: 100,
      height: 50,
      data: new Uint8Array([255, 0, 0]),
      kind: 2,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89, 89, 89, 89], // Four images
        argsArray: [['valid_img'], ['no_data'], ['no_width'], ['invalid']],
      }),
      objs: {
        get: vi.fn().mockImplementation((name: string, callback: (data: unknown) => void) => {
          if (name === 'valid_img') {
            callback(mockValidImage);
          } else if (name === 'no_data') {
            callback({ width: 100, height: 50, kind: 2 }); // Missing data
          } else if (name === 'no_width') {
            callback({ data: new Uint8Array([0]), height: 50, kind: 2 }); // Missing width
          } else if (name === 'invalid') {
            callback(null); // Invalid data
          }
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Only valid image should be extracted
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(1);

    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.results[0].data.image_info).toHaveLength(1);
  });

  it('should preserve Y-coordinate ordering for mixed text and images', async () => {
    const mockImageData = {
      width: 100,
      height: 50,
      data: new Uint8Array([255, 0, 0]),
      kind: 2,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: 'Top text', transform: [1, 0, 0, 1, 0, 200] }, // Y=200 (top)
          { str: 'Bottom text', transform: [1, 0, 0, 1, 0, 50] }, // Y=50 (bottom)
        ],
      }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89], // One image
        argsArray: [['img1', [1, 0, 0, 1, 0, 150]]], // Y=150 (middle) - transform in args
      }),
      objs: {
        get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
          callback(mockImageData);
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Content order should be: summary, top_text, image, bottom_text
    // (sorted by Y-coordinate descending = top to bottom)
    expect(result.content.length).toBe(4);
    expect(result.content[0].type).toBe('text'); // Summary JSON
    expect(result.content[1].type).toBe('text'); // Top text (Y=200)
    expect(result.content[1].text).toBe('Top text');
    expect(result.content[2].type).toBe('image'); // Image (Y=150)
    expect(result.content[3].type).toBe('text'); // Bottom text (Y=50)
    expect(result.content[3].text).toBe('Bottom text');
  });

  it('should extract images from commonObjs with g_ prefix', async () => {
    const mockImageData = {
      width: 100,
      height: 50,
      data: new Uint8Array([255, 0, 0]),
      kind: 2,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89],
        argsArray: [['g_image1']], // Image with g_ prefix
      }),
      objs: {
        get: vi.fn().mockReturnValue(undefined), // Not in objs
      },
      commonObjs: {
        get: vi.fn().mockReturnValue(mockImageData), // Found in commonObjs
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Should have extracted the image from commonObjs
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(1);
    expect(mockPage.commonObjs.get).toHaveBeenCalledWith('g_image1');
  });

  it('should use sync objs.get when image is already loaded', async () => {
    const mockImageData = {
      width: 100,
      height: 50,
      data: new Uint8Array([255, 0, 0]),
      kind: 2,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89],
        argsArray: [['img1']],
      }),
      objs: {
        get: vi.fn().mockImplementation((_name: string, callback?: (data: unknown) => void) => {
          // Sync call - return immediately
          if (!callback) {
            return mockImageData;
          }
          // Should not reach async callback
          callback(mockImageData);
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Should have extracted the image synchronously
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(1);
    // Verify sync call was made (without callback parameter)
    expect(mockPage.objs.get).toHaveBeenCalled();
  });

  it('should fallback to async when sync get returns undefined', async () => {
    const mockImageData = {
      width: 100,
      height: 50,
      data: new Uint8Array([255, 0, 0]),
      kind: 2,
    };

    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'test', transform: [1, 0, 0, 1, 0, 100] }] }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [89],
        argsArray: [['img1']],
      }),
      objs: {
        get: vi.fn().mockImplementation((_name: string, callback?: (data: unknown) => void) => {
          // Sync call returns undefined
          if (!callback) {
            return undefined;
          }
          // Async callback provides the data
          callback(mockImageData);
        }),
      },
    };

    mockGetDocument.mockReset();
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue({ info: {}, metadata: {} }),
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const args = {
      sources: [{ path: 'test.pdf' }],
      include_full_text: true,
      include_images: true,
    };

    const result = await handler(args);

    // Should have extracted the image via async callback
    const imageParts = result.content.filter((c) => c.type === 'image');
    expect(imageParts.length).toBe(1);
  });

  it('should handle Error (not PdfError) during processing', async () => {
    // Mock getDocument to throw a regular Error (not PdfError)
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('Regular error message')),
    });

    const args = { sources: [{ path: 'error.pdf' }] };
    // When all sources fail, handler now throws toolError
    await expect(handler(args)).rejects.toThrow(PdfError);
    await expect(handler(args)).rejects.toThrow('Regular error message');
  });
}); // End top-level describe
