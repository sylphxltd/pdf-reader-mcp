import { describe, expect, it } from 'vitest';
import { buildTextLayer } from '../../src/pdf/textLayer.js';
import type { PageContentItem } from '../../src/types/pdf.js';

const textItem = (
  textContent: string,
  left: number,
  bottom: number,
  width: number,
  height: number
): PageContentItem => ({
  type: 'text',
  textContent,
  xPosition: left,
  yPosition: bottom,
  width,
  height,
  bounding_box: {
    left,
    bottom,
    right: left + width,
    top: bottom + height,
  },
});

describe('textLayer', () => {
  it('builds run, line, word, and character records with page-level ranges and estimated boxes', () => {
    const layer = buildTextLayer({
      selectedPages: [1],
      pageContents: [
        {
          page: 1,
          items: [
            textItem('Revenue growth', 40, 700, 140, 12),
            textItem('24% year over year', 40, 680, 170, 12),
          ],
        },
      ],
    });

    expect(layer).toMatchObject({
      version: '2026-06-15',
      profile: 'pdf_text_layer',
      summary: {
        selected_pages: [1],
        page_count: 1,
        run_count: 2,
        line_count: 2,
        word_count: 6,
        char_count: 'Revenue growth\n24% year over year'.length,
        chars_with_bounding_boxes: 'Revenue growth24% year over year'.length,
        runs_with_bounding_boxes: 2,
        lines_with_bounding_boxes: 2,
        words_with_bounding_boxes: 6,
      },
    });
    expect(layer.pages[0]?.text).toBe('Revenue growth\n24% year over year');
    expect(layer.pages[0]?.lines[0]).toMatchObject({
      id: 'p1-line-1',
      index: 0,
      text: 'Revenue growth',
      char_start: 0,
      char_end: 14,
      provenance: {
        engine: 'pdfjs',
        source: 'text-content',
        bounding_box_level: 'char_estimated',
      },
      runs: [
        {
          index: 0,
          text: 'Revenue growth',
          char_start: 0,
          char_end: 14,
          bounding_box: {
            left: 40,
            bottom: 700,
            right: 180,
            top: 712,
          },
          provenance: {
            engine: 'pdfjs',
            source: 'text-content',
            bounding_box_level: 'char_estimated',
          },
        },
      ],
      words: [
        {
          index: 0,
          text: 'Revenue',
          char_start: 0,
          char_end: 7,
          bounding_box: {
            left: 40,
            bottom: 700,
            right: 110,
            top: 712,
          },
          bounding_box_level: 'char_estimated',
          confidence: 0.74,
        },
        {
          index: 1,
          text: 'growth',
          char_start: 8,
          char_end: 14,
        },
      ],
    });
    expect(layer.pages[0]?.lines[0]?.chars[0]).toMatchObject({
      index: 0,
      text: 'R',
      char_start: 0,
      char_end: 1,
      run_index: 0,
      is_whitespace: false,
      bounding_box: {
        left: 40,
        bottom: 700,
        right: 50,
        top: 712,
      },
      bounding_box_level: 'char_estimated',
      confidence: 0.6,
    });
    expect(layer.pages[0]?.lines[1]?.char_start).toBe(15);
  });
});
