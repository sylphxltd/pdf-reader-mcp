import { describe, expect, it } from 'vitest';
import {
  defaultSearchPdfOptions,
  resolvePagesToSearch,
  searchOcrPage,
  searchPageContentItems,
} from '../../src/pdf/search.js';
import type { BoundingBox, PageContentItem, SearchPdfOptions } from '../../src/types/pdf.js';

const box = (left: number, bottom: number, width: number, height: number): BoundingBox => ({
  left,
  bottom,
  right: left + width,
  top: bottom + height,
});

const textItem = (textContent: string, bounding_box?: BoundingBox): PageContentItem => ({
  type: 'text',
  textContent,
  yPosition: bounding_box?.bottom ?? 0,
  xPosition: bounding_box?.left,
  width: bounding_box ? bounding_box.right - bounding_box.left : undefined,
  height: bounding_box ? bounding_box.top - bounding_box.bottom : undefined,
  ...(bounding_box ? { bounding_box } : {}),
});

const textItemWithCharBoxes = (textContent: string, bounding_box: BoundingBox): PageContentItem => {
  const width = bounding_box.right - bounding_box.left;
  return {
    ...textItem(textContent, bounding_box),
    textRuns: [
      {
        index: 0,
        text: textContent,
        item_char_start: 0,
        item_char_end: textContent.length,
        bounding_box,
        chars: Array.from(textContent).map((text, index) => {
          const left = bounding_box.left + (width * index) / textContent.length;
          const right = bounding_box.left + (width * (index + 1)) / textContent.length;
          return {
            index,
            text,
            item_char_start: index,
            item_char_end: index + 1,
            is_whitespace: /\s/u.test(text),
            bounding_box: { left, bottom: bounding_box.bottom, right, top: bounding_box.top },
            confidence: 0.74,
          };
        }),
      },
    ],
  };
};

const options = (overrides: Partial<SearchPdfOptions> = {}): SearchPdfOptions => ({
  ...defaultSearchPdfOptions('risk'),
  context_chars: 6,
  ...overrides,
});

describe('search', () => {
  it('resolves all pages by default while reporting invalid and truncated pages', () => {
    expect(resolvePagesToSearch(undefined, 5, 3)).toEqual({
      pagesToSearch: [1, 2, 3],
      invalidPages: [],
      truncatedPages: [4, 5],
    });

    expect(resolvePagesToSearch([2, 6, 4, 2], 5, 10)).toEqual({
      pagesToSearch: [2, 4],
      invalidPages: [6],
      truncatedPages: [],
    });
  });

  it('falls back to text-item bounding boxes when char evidence is unavailable', () => {
    const matches = searchPageContentItems(
      1,
      [
        textItem('Executive risk controls are documented.', box(40, 700, 220, 12)),
        textItem('No match here.', box(40, 680, 120, 12)),
      ],
      options(),
      0
    );

    expect(matches).toEqual([
      {
        id: 'p1-match-1',
        page: 1,
        text: 'risk',
        snippet: '...utive risk contr...',
        match_start: 10,
        match_end: 14,
        text_item_index: 0,
        bounding_box: { left: 40, bottom: 700, right: 260, top: 712 },
        bounding_box_level: 'text_item',
        provenance: {
          engine: 'pdfjs',
          source: 'text-content',
        },
      },
    ]);
  });

  it('uses char-derived bounding boxes when text-run evidence is available', () => {
    const matches = searchPageContentItems(
      1,
      [textItemWithCharBoxes('abc risk xyz', box(100, 700, 120, 12))],
      options(),
      0
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      text: 'risk',
      match_start: 4,
      match_end: 8,
      bounding_box: { left: 140, bottom: 700, right: 180, top: 712 },
      bounding_box_level: 'char_estimated',
    });
  });

  it('supports whole-word and case-sensitive matching', () => {
    const items = [textItem('Risk controls reduce risky exposure.'), textItem('risk owners review controls.')];

    expect(searchPageContentItems(1, items, options({ whole_word: true }), 0).map((m) => m.text)).toEqual([
      'Risk',
      'risk',
    ]);
    expect(
      searchPageContentItems(1, items, options({ case_sensitive: true, query: 'Risk' }), 0).map((m) => m.text)
    ).toEqual(['Risk']);
  });

  it('continues match IDs from the provided offset', () => {
    const matches = searchPageContentItems(3, [textItem('risk risk')], options(), 4);
    expect(matches.map((match) => match.id)).toEqual(['p3-match-5', 'p3-match-6']);
  });

  it('searches OCR page text with word bounding-box provenance', () => {
    const matches = searchOcrPage(
      {
        page: 4,
        text: 'Scanned risk controls',
        confidence: 0.9,
        words: [
          { text: 'Scanned', bounding_box: box(40, 720, 50, 12), confidence: 0.9 },
          { text: 'risk', bounding_box: box(96, 720, 28, 12), confidence: 0.91 },
          { text: 'controls', bounding_box: box(130, 720, 60, 12), confidence: 0.92 },
        ],
        provider: 'command',
        source_render_evidence_id: 'page-4-render-scale-2',
        provenance: {
          engine: 'external-command',
          source: 'ocr-provider',
        },
      },
      options(),
      2
    );

    expect(matches).toEqual([
      {
        id: 'p4-ocr-match-3',
        page: 4,
        text: 'risk',
        snippet: '...anned risk contr...',
        match_start: 8,
        match_end: 12,
        ocr_word_index: 1,
        source_render_evidence_id: 'page-4-render-scale-2',
        bounding_box: { left: 96, bottom: 720, right: 124, top: 732 },
        bounding_box_level: 'ocr_word',
        provenance: {
          engine: 'external-command',
          source: 'ocr-provider',
        },
      },
    ]);
  });
});
