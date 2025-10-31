import fs from 'node:fs/promises';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import { loadPdfDocument } from '../../src/pdf/loader.js';
import * as pathUtils from '../../src/utils/pathUtils.js';

vi.mock('node:fs/promises');
vi.mock('pdfjs-dist/legacy/build/pdf.mjs');
vi.mock('../../src/utils/pathUtils.js', async () => {
  const actual = await vi.importActual('../../src/utils/pathUtils.js');
  return {
    ...actual,
    resolvePath: vi.fn(),
  };
});

describe('loader', () => {
  describe('loadPdfDocument', () => {
    it('should load PDF from local file path', async () => {
      const mockBuffer = Buffer.from('fake pdf content');
      const mockDocument = { numPages: 5 };

      vi.mocked(pathUtils.resolvePath).mockReturnValue('/safe/path/test.pdf');
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDocument as unknown as pdfjsLib.PDFDocumentProxy),
      } as pdfjsLib.PDFDocumentLoadingTask);

      const result = await loadPdfDocument({ path: 'test.pdf' }, 'test.pdf');

      expect(result).toBe(mockDocument);
      expect(pathUtils.resolvePath).toHaveBeenCalledWith('test.pdf');
      expect(fs.readFile).toHaveBeenCalledWith('/safe/path/test.pdf');
    });

    it('should load PDF from URL', async () => {
      const mockDocument = { numPages: 3 };

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDocument as unknown as pdfjsLib.PDFDocumentProxy),
      } as pdfjsLib.PDFDocumentLoadingTask);

      const result = await loadPdfDocument(
        { url: 'https://example.com/test.pdf' },
        'https://example.com/test.pdf'
      );

      expect(result).toBe(mockDocument);
      expect(pdfjsLib.getDocument).toHaveBeenCalledWith({
        url: 'https://example.com/test.pdf',
      });
    });

    it('should throw McpError when neither path nor url provided', async () => {
      await expect(loadPdfDocument({}, 'unknown')).rejects.toThrow(McpError);
      await expect(loadPdfDocument({}, 'unknown')).rejects.toThrow(
        "Source unknown missing 'path' or 'url'."
      );
    });

    it('should handle file not found error (ENOENT)', async () => {
      const enoentError = Object.assign(new Error('File not found'), { code: 'ENOENT' });

      vi.mocked(pathUtils.resolvePath).mockReturnValue('/safe/path/missing.pdf');
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);

      await expect(loadPdfDocument({ path: 'missing.pdf' }, 'missing.pdf')).rejects.toThrow(
        McpError
      );
      await expect(loadPdfDocument({ path: 'missing.pdf' }, 'missing.pdf')).rejects.toThrow(
        "File not found at 'missing.pdf'."
      );
    });

    it('should handle generic file read errors', async () => {
      vi.mocked(pathUtils.resolvePath).mockReturnValue('/safe/path/error.pdf');
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      await expect(loadPdfDocument({ path: 'error.pdf' }, 'error.pdf')).rejects.toThrow(McpError);
      await expect(loadPdfDocument({ path: 'error.pdf' }, 'error.pdf')).rejects.toThrow(
        'Failed to prepare PDF source error.pdf. Reason: Permission denied'
      );
    });

    it('should handle non-Error exceptions during file read', async () => {
      vi.mocked(pathUtils.resolvePath).mockReturnValue('/safe/path/test.pdf');
      vi.mocked(fs.readFile).mockRejectedValue('String error');

      await expect(loadPdfDocument({ path: 'test.pdf' }, 'test.pdf')).rejects.toThrow(
        'Failed to prepare PDF source test.pdf. Reason: String error'
      );
    });

    it('should handle PDF.js loading errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockBuffer = Buffer.from('fake pdf');

      vi.mocked(pathUtils.resolvePath).mockReturnValue('/safe/path/bad.pdf');
      vi.mocked(fs.readFile).mockResolvedValue(mockBuffer);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF')),
      } as pdfjsLib.PDFDocumentLoadingTask);

      await expect(loadPdfDocument({ path: 'bad.pdf' }, 'bad.pdf')).rejects.toThrow(McpError);
      await expect(loadPdfDocument({ path: 'bad.pdf' }, 'bad.pdf')).rejects.toThrow(
        'Failed to load PDF document from bad.pdf. Reason: Invalid PDF'
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('PDF.js loading error for bad.pdf'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error PDF.js loading exceptions', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.reject('Unknown error'),
      } as pdfjsLib.PDFDocumentLoadingTask);

      await expect(
        loadPdfDocument({ url: 'https://example.com/bad.pdf' }, 'https://example.com/bad.pdf')
      ).rejects.toThrow('Failed to load PDF document from https://example.com/bad.pdf');

      consoleErrorSpy.mockRestore();
    });

    it('should propagate McpError from resolvePath', async () => {
      const mcpError = new McpError(ErrorCode.InvalidRequest, 'Path validation failed');
      vi.mocked(pathUtils.resolvePath).mockImplementation(() => {
        throw mcpError;
      });

      await expect(loadPdfDocument({ path: 'test.pdf' }, 'test.pdf')).rejects.toThrow(mcpError);
    });
  });
});
