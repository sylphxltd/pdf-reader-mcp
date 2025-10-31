import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWarnings,
  extractMetadataAndPageCount,
  extractPageTexts,
} from '../../src/pdf/extractor.js';

describe('extractor', () => {
  describe('extractMetadataAndPageCount', () => {
    it('should extract metadata using getAll method when available', async () => {
      const mockMetadata = {
        info: { PDFFormatVersion: '1.7', IsLinearized: false },
        metadata: {
          getAll: vi.fn().mockReturnValue({ Author: 'Test Author', Title: 'Test Title' }),
        },
      };

      const mockDocument = {
        numPages: 5,
        getMetadata: vi.fn().mockResolvedValue(mockMetadata),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, true, true);

      expect(result.num_pages).toBe(5);
      expect(result.info).toEqual({ PDFFormatVersion: '1.7', IsLinearized: false });
      expect(result.metadata).toEqual({ Author: 'Test Author', Title: 'Test Title' });
      expect(mockMetadata.metadata.getAll).toHaveBeenCalled();
    });

    it('should extract metadata by enumerating properties when getAll is not available', async () => {
      const mockMetadataObj = {
        Author: 'Direct Author',
        Title: 'Direct Title',
        CreationDate: '2025-01-01',
      };

      const mockMetadata = {
        info: { PDFFormatVersion: '1.6' },
        metadata: mockMetadataObj,
      };

      const mockDocument = {
        numPages: 3,
        getMetadata: vi.fn().mockResolvedValue(mockMetadata),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, true, true);

      expect(result.metadata).toEqual({
        Author: 'Direct Author',
        Title: 'Direct Title',
        CreationDate: '2025-01-01',
      });
    });

    it('should handle metadata extraction errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockDocument = {
        numPages: 2,
        getMetadata: vi.fn().mockRejectedValue(new Error('Metadata error')),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, true, true);

      expect(result.num_pages).toBe(2);
      expect(result.metadata).toBeUndefined();
      expect(result.info).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error extracting metadata: Metadata error')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle non-Error metadata exceptions', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockDocument = {
        numPages: 1,
        getMetadata: vi.fn().mockRejectedValue('String error'),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, true, true);

      expect(result.num_pages).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error extracting metadata: String error')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should not extract metadata when includeMetadata is false', async () => {
      const mockDocument = {
        numPages: 5,
        getMetadata: vi.fn(),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, false, true);

      expect(result.num_pages).toBe(5);
      expect(result.metadata).toBeUndefined();
      expect(result.info).toBeUndefined();
      expect(mockDocument.getMetadata).not.toHaveBeenCalled();
    });

    it('should not extract page count when includePageCount is false', async () => {
      const mockDocument = {
        numPages: 10,
        getMetadata: vi.fn(),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, false, false);

      expect(result.num_pages).toBeUndefined();
    });
  });

  describe('extractPageTexts', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should extract text from specified pages', async () => {
      const mockPage1 = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Page 1 ' }, { str: 'text' }],
        }),
      };

      const mockPage2 = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Page 2 ' }, { str: 'content' }],
        }),
      };

      const mockDocument = {
        getPage: vi
          .fn()
          .mockImplementation((pageNum: number) =>
            Promise.resolve(pageNum === 1 ? mockPage1 : mockPage2)
          ),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageTexts(mockDocument, [1, 2], 'test.pdf');

      expect(result).toEqual([
        { page: 1, text: 'Page 1 text' },
        { page: 2, text: 'Page 2 content' },
      ]);
    });

    it('should handle page extraction errors gracefully', async () => {
      const mockDocument = {
        getPage: vi.fn().mockRejectedValue(new Error('Failed to get page')),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageTexts(mockDocument, [1], 'test.pdf');

      expect(result).toEqual([{ page: 1, text: 'Error processing page: Failed to get page' }]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting text content for page 1 in test.pdf')
      );
    });

    it('should handle non-Error page exceptions', async () => {
      const mockDocument = {
        getPage: vi.fn().mockRejectedValue('String error'),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageTexts(mockDocument, [1], 'test.pdf');

      expect(result).toEqual([{ page: 1, text: 'Error processing page: String error' }]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('String error'));
    });

    it('should sort pages by page number', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'text' }],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageTexts(mockDocument, [3, 1, 2], 'test.pdf');

      expect(result.map((r) => r.page)).toEqual([1, 2, 3]);
    });
  });

  describe('buildWarnings', () => {
    it('should return empty array when no invalid pages', () => {
      const warnings = buildWarnings([], 10);
      expect(warnings).toEqual([]);
    });

    it('should build warning for invalid pages', () => {
      const warnings = buildWarnings([11, 12, 15], 10);
      expect(warnings).toEqual(['Requested page numbers 11, 12, 15 exceed total pages (10).']);
    });

    it('should build warning for single invalid page', () => {
      const warnings = buildWarnings([20], 10);
      expect(warnings).toEqual(['Requested page numbers 20 exceed total pages (10).']);
    });
  });
});
