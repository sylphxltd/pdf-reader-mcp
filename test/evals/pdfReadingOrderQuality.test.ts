import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import { extractPageContent } from '../../src/pdf/extractor.js';

const textItem = (str: string, x: number, y: number, width: number, height = 10) => ({
  str,
  transform: [1, 0, 0, height, x, y],
  width,
  height,
});

describe('PDF reading-order quality evals', () => {
  it('orders spanning headers, independent column bands, and footers by visual reading sequence', async () => {
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          textItem('Quarterly Report', 50, 760, 500, 12),
          textItem('A Left 1', 50, 700, 70),
          textItem('A Right 1', 300, 700, 75),
          textItem('A Left 2', 50, 680, 70),
          textItem('A Right 2', 300, 680, 75),
          textItem('Risk Section', 50, 610, 500, 12),
          textItem('B Left 1', 50, 550, 70),
          textItem('B Right 1', 300, 550, 75),
          textItem('B Left 2', 50, 530, 70),
          textItem('B Right 2', 300, 530, 75),
          textItem('Page 1 footer', 50, 80, 500),
        ],
      }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [], argsArray: [] }),
    };
    const mockDocument = {
      getPage: vi.fn().mockResolvedValue(mockPage),
    } as unknown as pdfjsLib.PDFDocumentProxy;

    const items = await extractPageContent(mockDocument, 1, false, 'reading-order-eval.pdf');

    expect(items.map((item) => item.textContent)).toEqual([
      'Quarterly Report',
      'A Left 1',
      'A Left 2',
      'A Right 1',
      'A Right 2',
      'Risk Section',
      'B Left 1',
      'B Left 2',
      'B Right 1',
      'B Right 2',
      'Page 1 footer',
    ]);
  });
});
