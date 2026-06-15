import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWarnings,
  extractDocumentStructure,
  extractImages,
  extractMetadataAndPageCount,
  extractPageContent,
  extractPageGeometry,
  extractPageTexts,
  extractStructureTrees,
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

    it('should ignore missing PDF.js metadata object without logging a warning', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockMetadata = {
        info: { PDFFormatVersion: '1.7', Title: 'No XMP Metadata' },
        metadata: null,
      };

      const mockDocument = {
        numPages: 1,
        getMetadata: vi.fn().mockResolvedValue(mockMetadata),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractMetadataAndPageCount(mockDocument, true, true);

      expect(result).toEqual({
        info: { PDFFormatVersion: '1.7', Title: 'No XMP Metadata' },
        num_pages: 1,
      });
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
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
      // Logger outputs message first, then structured JSON
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error extracting metadata')
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
      // Logger outputs message first, then structured JSON
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error extracting metadata')
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

  describe('extractDocumentStructure', () => {
    it('normalizes real PDF.js zero-based form field page indexes to public 1-based pages', async () => {
      const mockDocument = {
        getFieldObjects: vi.fn().mockResolvedValue({
          customer_name: [
            {
              id: 'field-1',
              name: 'customer_name',
              type: 'text',
              value: 'Ada Lovelace',
              page: 0,
              rect: [20, 30, 220, 50],
            },
          ],
        }),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractDocumentStructure(mockDocument, {
        includeOutline: false,
        includePageLabels: false,
        includePermissions: false,
        includeFormFields: true,
        includeAttachments: false,
      });

      expect(result.form_fields).toEqual([
        {
          name: 'customer_name',
          type: 'text',
          value: 'Ada Lovelace',
          page: 1,
          id: 'field-1',
          bounding_box: { left: 20, bottom: 30, right: 220, top: 50 },
        },
      ]);
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

    it('should handle page extraction errors gracefully with a sanitized placeholder (SSS-02)', async () => {
      const mockDocument = {
        getPage: vi.fn().mockRejectedValue(new Error('Failed to get page /private/leak')),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageTexts(mockDocument, [1], 'test.pdf');

      // The page-text payload returned to the LLM must carry only the
      // sanitized placeholder — the raw error text stays in logs.
      expect(result).toEqual([{ page: 1, text: '[Error processing page 1]' }]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting text content for page')
      );
    });

    it('should handle non-Error page exceptions with a sanitized placeholder (SSS-02)', async () => {
      const mockDocument = {
        getPage: vi.fn().mockRejectedValue('String error'),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageTexts(mockDocument, [1], 'test.pdf');

      expect(result).toEqual([{ page: 1, text: '[Error processing page 1]' }]);
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

  describe('extractPageContent', () => {
    it('should preserve two-column reading order without merging distant same-line text', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Title', transform: [1, 0, 0, 12, 50, 760], width: 500, height: 12 },
            { str: 'Left 1', transform: [1, 0, 0, 10, 50, 700], width: 50, height: 10 },
            { str: 'Right 1', transform: [1, 0, 0, 10, 300, 700], width: 55, height: 10 },
            { str: 'Left 2', transform: [1, 0, 0, 10, 50, 680], width: 50, height: 10 },
            { str: 'Right 2', transform: [1, 0, 0, 10, 300, 680], width: 55, height: 10 },
          ],
        }),
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [],
          argsArray: [],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageContent(mockDocument, 1, false, 'two-column.pdf');

      expect(result.map((item) => item.textContent)).toEqual([
        'Title',
        'Left 1',
        'Left 2',
        'Right 1',
        'Right 2',
      ]);
      expect(result[1]?.bounding_box).toEqual({ left: 50, bottom: 700, right: 100, top: 710 });
    });

    it('should preserve right-to-left text-run order within rows and columns', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            {
              str: 'left top',
              transform: [1, 0, 0, 10, 40, 700],
              width: 60,
              height: 10,
              dir: 'rtl',
            },
            {
              str: 'right top',
              transform: [1, 0, 0, 10, 240, 700],
              width: 70,
              height: 10,
              dir: 'rtl',
            },
            {
              str: 'left lower',
              transform: [1, 0, 0, 10, 40, 680],
              width: 70,
              height: 10,
              dir: 'rtl',
            },
            {
              str: 'right lower',
              transform: [1, 0, 0, 10, 240, 680],
              width: 80,
              height: 10,
              dir: 'rtl',
            },
            {
              str: 'row left',
              transform: [1, 0, 0, 10, 40, 650],
              width: 64,
              height: 10,
              dir: 'rtl',
            },
            {
              str: 'row right',
              transform: [1, 0, 0, 10, 118, 650],
              width: 70,
              height: 10,
              dir: 'rtl',
            },
          ],
        }),
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [],
          argsArray: [],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageContent(mockDocument, 1, false, 'rtl-layout.pdf');

      expect(result.map((item) => item.textContent)).toEqual([
        'right top',
        'right lower',
        'left top',
        'left lower',
        'row rightrow left',
      ]);
      expect(result[4]?.textRuns?.map((run) => run.text)).toEqual(['row right', 'row left']);
    });

    it('should preserve recursive reading order across spanning section bands', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Title', transform: [1, 0, 0, 12, 50, 760], width: 500, height: 12 },
            { str: 'A Left 1', transform: [1, 0, 0, 10, 50, 700], width: 70, height: 10 },
            { str: 'A Right 1', transform: [1, 0, 0, 10, 300, 700], width: 75, height: 10 },
            { str: 'A Left 2', transform: [1, 0, 0, 10, 50, 680], width: 70, height: 10 },
            { str: 'A Right 2', transform: [1, 0, 0, 10, 300, 680], width: 75, height: 10 },
            { str: 'Section B', transform: [1, 0, 0, 12, 50, 610], width: 500, height: 12 },
            { str: 'B Left 1', transform: [1, 0, 0, 10, 50, 550], width: 70, height: 10 },
            { str: 'B Right 1', transform: [1, 0, 0, 10, 300, 550], width: 75, height: 10 },
            { str: 'B Left 2', transform: [1, 0, 0, 10, 50, 530], width: 70, height: 10 },
            { str: 'B Right 2', transform: [1, 0, 0, 10, 300, 530], width: 75, height: 10 },
            { str: 'Footer', transform: [1, 0, 0, 10, 50, 80], width: 120, height: 10 },
          ],
        }),
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [],
          argsArray: [],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageContent(mockDocument, 1, false, 'recursive-layout.pdf');

      expect(result.map((item) => item.textContent)).toEqual([
        'Title',
        'A Left 1',
        'A Left 2',
        'A Right 1',
        'A Right 2',
        'Section B',
        'B Left 1',
        'B Left 2',
        'B Right 1',
        'B Right 2',
        'Footer',
      ]);
    });

    it('should preserve text-run and estimated character evidence from PDF.js text items', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            {
              str: 'Risk',
              transform: [1, 0, 0, 12, 40, 700],
              width: 48,
              height: 12,
              fontName: 'g_d0_f1',
              dir: 'ltr',
              hasEOL: false,
            },
          ],
        }),
        getOperatorList: vi.fn().mockResolvedValue({
          fnArray: [],
          argsArray: [],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageContent(mockDocument, 1, false, 'evidence.pdf');

      expect(result[0]).toMatchObject({
        textContent: 'Risk',
        bounding_box: { left: 40, bottom: 700, right: 88, top: 712 },
        textRuns: [
          {
            index: 0,
            text: 'Risk',
            item_char_start: 0,
            item_char_end: 4,
            bounding_box: { left: 40, bottom: 700, right: 88, top: 712 },
            font_name: 'g_d0_f1',
            direction: 'ltr',
            transform: [1, 0, 0, 12, 40, 700],
            has_eol: false,
          },
        ],
      });
      expect(result[0]?.textRuns?.[0]?.chars[0]).toMatchObject({
        index: 0,
        text: 'R',
        item_char_start: 0,
        item_char_end: 1,
        bounding_box: { left: 40, bottom: 700, right: 52, top: 712 },
        confidence: 0.74,
      });
    });
  });

  describe('extractPageGeometry', () => {
    it('should extract viewport geometry and PDF view box for selected pages', async () => {
      const mockPage = {
        view: [0, 0, 612, 792],
        rotate: 90,
        userUnit: 1.5,
        getViewport: vi.fn().mockReturnValue({ width: 792, height: 612 }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractPageGeometry(mockDocument, [3]);

      expect(mockDocument.getPage).toHaveBeenCalledWith(3);
      expect(mockPage.getViewport).toHaveBeenCalledWith({ scale: 1 });
      expect(result).toEqual([
        {
          page: 3,
          width: 792,
          height: 612,
          rotation: 90,
          user_unit: 1.5,
          view_box: { left: 0, bottom: 0, right: 612, top: 792 },
        },
      ]);
    });
  });

  describe('extractStructureTrees', () => {
    it('should extract sanitized tagged PDF structure trees for selected pages', async () => {
      const mockPage = {
        getStructTree: vi.fn().mockResolvedValue({
          role: 'Root',
          children: [
            {
              role: 'H1',
              children: [{ type: 'content', id: 'p1-text-1' }],
            },
            { type: 'object', id: 'p1-image-1' },
            { type: '', id: '' },
          ],
        }),
      };

      const mockDocument = {
        getPage: vi.fn().mockResolvedValue(mockPage),
      } as unknown as pdfjsLib.PDFDocumentProxy;

      const result = await extractStructureTrees(mockDocument, [1]);

      expect(mockDocument.getPage).toHaveBeenCalledWith(1);
      expect(mockPage.getStructTree).toHaveBeenCalled();
      expect(result).toEqual([
        {
          page: 1,
          tree: {
            role: 'Root',
            children: [
              {
                role: 'H1',
                children: [{ type: 'content', id: 'p1-text-1' }],
              },
              { type: 'object', id: 'p1-image-1' },
            ],
          },
        },
      ]);
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
      // Logger outputs message first, then structured JSON
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting page for image extraction')
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
  // Logger outputs message first, then structured JSON
  expect(consoleWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Error extracting images from page')
  );

  consoleWarnSpy.mockRestore();
});

it('should handle empty argsArray in operator list', async () => {
  const mockPage = {
    getOperatorList: vi.fn().mockResolvedValue({
      fnArray: [89], // OPS.paintImageXObject
      argsArray: [[]], // Empty argsArray
    }),
    objs: { get: vi.fn() },
    commonObjs: { get: vi.fn() },
  };

  const mockDocument = {
    numPages: 1,
    getPage: vi.fn().mockResolvedValue(mockPage),
  } as unknown as pdfjsLib.PDFDocumentProxy;

  const result = await extractImages(mockDocument, [1]);
  expect(result).toEqual([]);
});

it('should handle null argsArray in operator list', async () => {
  const mockPage = {
    getOperatorList: vi.fn().mockResolvedValue({
      fnArray: [89], // OPS.paintImageXObject
      argsArray: [null], // null argsArray
    }),
    objs: { get: vi.fn() },
    commonObjs: { get: vi.fn() },
  };

  const mockDocument = {
    numPages: 1,
    getPage: vi.fn().mockResolvedValue(mockPage),
  } as unknown as pdfjsLib.PDFDocumentProxy;

  const result = await extractImages(mockDocument, [1]);
  expect(result).toEqual([]);
});
