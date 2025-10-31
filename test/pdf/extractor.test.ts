import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWarnings,
  extractImages,
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

  describe('extractImages', () => {
    it('should extract images from PDF pages', async () => {
      const mockImageData = {
        width: 100,
        height: 50,
        data: new Uint8Array([255, 0, 0, 255]), // Red pixel RGBA
        kind: 3, // RGBA
      };

      const mockPage = {
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [OPS.paintImageXObject, OPS.paintXObject],
          argsArray: [['img1'], ['img2']],
        }),
        objs: {
          get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
            callback(mockImageData);
          }),
        },
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractImages(mockDocument, [1]);

      expect(result.length).toBe(2);
      expect(result[0]).toMatchObject({
        page: 1,
        index: 0,
        width: 100,
        height: 50,
        format: 'rgba',
      });
      expect(result[0].data).toBeDefined();
      expect(result[0].data.length).toBeGreaterThan(0);
    });

    it('should handle pages with no images', async () => {
      const mockPage = {
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [],
          argsArray: [],
        }),
        objs: { get: vi.fn() },
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractImages(mockDocument, [1]);

      expect(result).toEqual([]);
    });

    it('should handle image extraction errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockDocument = {
        getPage: vi.fn().mockRejectedValue(new Error('Page error')),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractImages(mockDocument, [1]);

      expect(result).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting page 1 for image extraction')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should skip images with invalid data', async () => {
      const mockPage = {
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [OPS.paintImageXObject],
          argsArray: [['img1']],
        }),
        objs: {
          get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
            callback(null); // Invalid image data
          }),
        },
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractImages(mockDocument, [1]);

      expect(result).toEqual([]);
    });

    it('should handle different image formats', async () => {
      const mockGrayscaleImage = {
        width: 50,
        height: 50,
        data: new Uint8Array([128]),
        kind: 1, // Grayscale
      };

      const mockPage = {
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [OPS.paintImageXObject],
          argsArray: [['img1']],
        }),
        objs: {
          get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
            callback(mockGrayscaleImage);
          }),
        },
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractImages(mockDocument, [1]);

      expect(result[0].format).toBe('grayscale');
    });

    it('should extract images from multiple pages', async () => {
      const mockImageData = {
        width: 100,
        height: 100,
        data: new Uint8Array([255, 255, 255]),
        kind: 2, // RGB
      };

      const mockPage = {
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [OPS.paintImageXObject],
          argsArray: [['img1']],
        }),
        objs: {
          get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
            callback(mockImageData);
          }),
        },
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractImages(mockDocument, [1, 2]);

      expect(result.length).toBe(2);
      expect(result[0].page).toBe(1);
      expect(result[1].page).toBe(2);
    });
  });
});

it('should skip images with empty argsArray', async () => {
  const mockPage = {
    getOperatorList: vi.fn().mockResolvedValue({
      fnArray: [OPS.paintImageXObject],
      argsArray: [[]], // Empty args
    }),
    objs: { get: vi.fn() },
  };

  const mockDocument = {
    getPage: vi.fn().mockResolvedValue(mockPage),
  } as unknown as pdfjsLib.PDFDocumentProxy;

  const result = await extractImages(mockDocument, [1]);

  expect(result).toEqual([]);
  expect(mockPage.objs.get).not.toHaveBeenCalled();
});

it('should skip images missing required properties', async () => {
  const mockIncompleteImage = {
    width: 100,
    // Missing height and data
  };

  const mockPage = {
    getOperatorList: vi.fn().mockResolvedValue({
      fnArray: [OPS.paintImageXObject],
      argsArray: [['img1']],
    }),
    objs: {
      get: vi.fn().mockImplementation((_name: string, callback: (data: unknown) => void) => {
        callback(mockIncompleteImage);
      }),
    },
  };

  const mockDocument = {
    getPage: vi.fn().mockResolvedValue(mockPage),
  } as unknown as pdfjsLib.PDFDocumentProxy;

  const result = await extractImages(mockDocument, [1]);

  expect(result).toEqual([]);
});

it('should handle getOperatorList errors', async () => {
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const mockPage = {
    getOperatorList: vi.fn().mockRejectedValue(new Error('Operator list error')),
  };

  const mockDocument = {
    getPage: vi.fn().mockResolvedValue(mockPage),
  } as unknown as pdfjsLib.PDFDocumentProxy;

  const result = await extractImages(mockDocument, [1]);

  expect(result).toEqual([]);
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Error extracting images from page 1')
  );

  consoleWarnSpy.mockRestore();
});
