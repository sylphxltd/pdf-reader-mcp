import fs from 'node:fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import { loadPdfDocument } from '../../src/pdf/loader.js';
import { ErrorCode, PdfError } from '../../src/utils/errors.js';
import * as pathUtils from '../../src/utils/pathUtils.js';

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: vi.fn(),
}));

vi.mock('../../src/utils/pathUtils.js', () => ({
  resolvePath: vi.fn(),
}));

describe('loader', () => {
  describe('loadPdfDocument', () => {
    it('should load PDF from local file path', async () => {
      const mockBuffer = Buffer.from('fake pdf content');
      const mockDocument = { numPages: 5 };

      pathUtils.resolvePath.mockReturnValue('/safe/path/test.pdf');
      fs.readFile.mockResolvedValue(mockBuffer);
      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.resolve(mockDocument as unknown as pdfjsLib.PDFDocumentProxy),
      } as pdfjsLib.PDFDocumentLoadingTask);

      const result = await loadPdfDocument({ path: 'test.pdf' }, 'test.pdf');

      expect(result).toBe(mockDocument);
      expect(pathUtils.resolvePath).toHaveBeenCalledWith('test.pdf');
      expect(fs.readFile).toHaveBeenCalledWith('/safe/path/test.pdf');
    });

    it('should load PDF from URL', async () => {
      const mockDocument = { numPages: 3 };

      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.resolve(mockDocument as unknown as pdfjsLib.PDFDocumentProxy),
      } as pdfjsLib.PDFDocumentLoadingTask);

      const result = await loadPdfDocument({ url: 'https://example.com/test.pdf' }, 'https://example.com/test.pdf');

      expect(result).toBe(mockDocument);
      expect(pdfjsLib.getDocument).toHaveBeenCalledWith({
        cMapUrl: expect.stringContaining('pdfjs-dist') && expect.stringContaining('cmaps'),
        cMapPacked: true,
        url: 'https://example.com/test.pdf',
      });
    });

    it('should throw PdfError when neither path nor url provided', async () => {
      await expect(loadPdfDocument({}, 'unknown')).rejects.toThrow(PdfError);
      await expect(loadPdfDocument({}, 'unknown')).rejects.toThrow("Source unknown missing 'path' or 'url'.");
    });

    it('should handle file not found error (ENOENT)', async () => {
      const enoentError = Object.assign(new Error('File not found'), { code: 'ENOENT' });

      pathUtils.resolvePath.mockReturnValue('/safe/path/missing.pdf');
      fs.readFile.mockRejectedValue(enoentError);

      await expect(loadPdfDocument({ path: 'missing.pdf' }, 'missing.pdf')).rejects.toThrow(PdfError);
      await expect(loadPdfDocument({ path: 'missing.pdf' }, 'missing.pdf')).rejects.toThrow(
        "File not found at 'missing.pdf'."
      );
    });

    it('should handle generic file read errors', async () => {
      pathUtils.resolvePath.mockReturnValue('/safe/path/error.pdf');
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(loadPdfDocument({ path: 'error.pdf' }, 'error.pdf')).rejects.toThrow(PdfError);
      await expect(loadPdfDocument({ path: 'error.pdf' }, 'error.pdf')).rejects.toThrow(
        'Failed to prepare PDF source error.pdf. Reason: Permission denied'
      );
    });

    it('should handle non-Error exceptions during file read', async () => {
      pathUtils.resolvePath.mockReturnValue('/safe/path/test.pdf');
      fs.readFile.mockRejectedValue('String error');

      await expect(loadPdfDocument({ path: 'test.pdf' }, 'test.pdf')).rejects.toThrow(
        'Failed to prepare PDF source test.pdf. Reason: String error'
      );
    });

    it('should handle PDF.js loading errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockBuffer = Buffer.from('fake pdf');

      pathUtils.resolvePath.mockReturnValue('/safe/path/bad.pdf');
      fs.readFile.mockResolvedValue(mockBuffer);
      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF')),
      } as pdfjsLib.PDFDocumentLoadingTask);

      await expect(loadPdfDocument({ path: 'bad.pdf' }, 'bad.pdf')).rejects.toThrow(PdfError);
      await expect(loadPdfDocument({ path: 'bad.pdf' }, 'bad.pdf')).rejects.toThrow(
        'Failed to load PDF document from bad.pdf. Reason: Invalid PDF'
      );

      // Logger outputs message first, then structured JSON
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('PDF.js loading error'));

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error PDF.js loading exceptions', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.reject('Unknown error'),
      } as pdfjsLib.PDFDocumentLoadingTask);

      await expect(
        loadPdfDocument({ url: 'https://example.com/bad.pdf' }, 'https://example.com/bad.pdf')
      ).rejects.toThrow('Failed to load PDF document from https://example.com/bad.pdf');

      consoleErrorSpy.mockRestore();
    });

    it('should propagate PdfError from resolvePath', async () => {
      const pdfError = new PdfError(ErrorCode.InvalidRequest, 'Path validation failed');
      pathUtils.resolvePath.mockImplementation(() => {
        throw pdfError;
      });

      await expect(loadPdfDocument({ path: 'test.pdf' }, 'test.pdf')).rejects.toThrow(pdfError);
    });

    it('should use fallback message when PDF.js error message is empty', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      pdfjsLib.getDocument.mockReturnValue({
        promise: Promise.reject(new Error('')),
      } as pdfjsLib.PDFDocumentLoadingTask);

      await expect(
        loadPdfDocument({ url: 'https://example.com/bad.pdf' }, 'https://example.com/bad.pdf')
      ).rejects.toThrow('Unknown loading error');

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exception during file read with cause undefined', async () => {
      pathUtils.resolvePath.mockReturnValue('/safe/path/test.pdf');
      const nonErrorObject = { code: 'SOME_ERROR' };
      fs.readFile.mockRejectedValue(nonErrorObject);

      try {
        await loadPdfDocument({ path: 'test.pdf' }, 'test.pdf');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PdfError);
        // Verify that cause is undefined when error is not an Error instance
        expect((error as PdfError).cause).toBeUndefined();
      }
    });
  });
});
