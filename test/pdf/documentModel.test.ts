import { describe, expect, it } from 'vitest';
import { buildSafetyFindings } from '../../src/pdf/documentModel.js';
import type { BoundingBox, PageContentItem, PdfPageGeometry } from '../../src/types/pdf.js';

const box = (left: number, bottom: number, width: number, height: number): BoundingBox => ({
  left,
  bottom,
  right: left + width,
  top: bottom + height,
});

const textItem = (textContent: string, boundingBox: BoundingBox): PageContentItem => ({
  type: 'text',
  textContent,
  xPosition: boundingBox.left,
  yPosition: boundingBox.bottom,
  width: boundingBox.right - boundingBox.left,
  height: boundingBox.top - boundingBox.bottom,
  bounding_box: boundingBox,
});

const geometry: PdfPageGeometry[] = [
  {
    page: 1,
    width: 612,
    height: 792,
    rotation: 0,
    view_box: { left: 0, bottom: 0, right: 612, top: 792 },
  },
];

describe('documentModel', () => {
  it('detects overlapping text that may visually spoof or obscure content', () => {
    const findings = buildSafetyFindings(
      [
        {
          page: 1,
          items: [
            textItem('Visible amount: $100', box(100, 650, 120, 10)),
            textItem('Visible amount: $900', box(104, 650, 120, 10)),
          ],
        },
      ],
      geometry
    );

    expect(findings).toEqual([
      {
        type: 'overlapping_text',
        severity: 'high',
        page: 1,
        element_id: 'p1-text-2',
        message: 'Text substantially overlaps different text, which may visually spoof or obscure content.',
        snippet: 'Visible amount: $100 / Visible amount: $900',
        bounding_box: { left: 100, bottom: 650, right: 224, top: 660 },
      },
    ]);
  });
});
