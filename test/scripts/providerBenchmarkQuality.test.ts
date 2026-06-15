import { describe, expect, test } from 'bun:test';
import {
  buildRegionAnalysisQuality,
  buildTesseractTsvQuality,
} from '../../scripts/benchmark-pdf-providers.js';
import type { PdfRegionAnalysisData } from '../../src/types/pdf.js';

const baseRegion = (
  regionId: string,
  kind: PdfRegionAnalysisData['kind'],
  overrides: Partial<PdfRegionAnalysisData> = {}
): PdfRegionAnalysisData => ({
  region_id: regionId,
  page: 1,
  kind,
  provider: 'command',
  source_crop_evidence_id: `page-1-${regionId}-crop-scale-2`,
  source_bounding_box: { left: 10, bottom: 10, right: 100, top: 100 },
  crop_pixels: { left: 20, top: 20, width: 180, height: 180 },
  scale: 2,
  provenance: {
    engine: 'external-command',
    source: 'region-analysis-provider',
  },
  ...overrides,
});

describe('provider benchmark quality metrics', () => {
  test('scores OCR token recall, word boxes, and document-map fusion', () => {
    const quality = buildTesseractTsvQuality({
      ocrTextLayer: {
        pages: [
          {
            text: 'Hello World',
            words: [
              { bounding_box: { left: 0, bottom: 0, right: 10, top: 10 } },
              { bounding_box: { left: 10, bottom: 0, right: 20, top: 10 } },
            ],
            source_render_evidence_id: 'page-1-render-scale-2',
          },
        ],
        summary: {
          text_chars: 11,
          word_count: 2,
          words_with_bounding_boxes: 2,
          average_confidence: 91,
        },
      },
      documentMap: {
        layers: ['ocr_text_layer'],
        routing: { ocr_applied_pages: [1] },
      },
      page: {
        text: 'Hello World',
        words: [
          { bounding_box: { left: 0, bottom: 0, right: 10, top: 10 } },
          { bounding_box: { left: 10, bottom: 0, right: 20, top: 10 } },
        ],
        source_render_evidence_id: 'page-1-render-scale-2',
      },
      normalizedText: 'HELLO WORLD',
    });

    expect(quality.score).toBe(1);
    expect(quality.passed_metric_count).toBe(3);
    expect(quality.metrics.map((metric) => metric.id)).toEqual([
      'ocr_token_recall',
      'ocr_word_box_coverage',
      'ocr_document_map_fusion',
    ]);
    expect(quality.metrics.every((metric) => metric.status === 'passed')).toBe(true);
  });

  test('scores visual full-fidelity region metrics with expected and observed evidence', () => {
    const quality = buildRegionAnalysisQuality([
      baseRegion('cert-table', 'table', {
        table: {
          row_count: 3,
          column_count: 2,
          cells: [
            {
              text: 'Metric',
              row_index: 0,
              column_index: 0,
              bounding_box: { left: 1, bottom: 1, right: 2, top: 2 },
            },
            {
              text: 'Value',
              row_index: 0,
              column_index: 1,
              bounding_box: { left: 2, bottom: 1, right: 3, top: 2 },
            },
            {
              text: 'Revenue',
              row_index: 1,
              column_index: 0,
              bounding_box: { left: 1, bottom: 0, right: 2, top: 1 },
            },
            {
              text: '$1.2M',
              row_index: 1,
              column_index: 1,
              bounding_box: { left: 2, bottom: 0, right: 3, top: 1 },
            },
          ],
        },
      }),
      baseRegion('cert-formula', 'formula', {
        formula: { latex: 'E=mc^2', mathml: '<math />', text: 'E equals m c squared' },
      }),
      baseRegion('cert-chart', 'chart', {
        chart: {
          x_axis: { label: 'Quarter' },
          y_axis: { label: 'Revenue' },
          series: [{ name: 'Revenue', data_points: [{ quarter: 'Q1', value: 1.2 }] }],
        },
      }),
      baseRegion('cert-figure', 'figure', {
        description: 'Certification pipeline graphic.',
        text: 'Pipeline figure: ingest, analyze, cite.',
      }),
      baseRegion('cert-image', 'image', {
        description: 'Certification office image.',
        text: 'Office image: framed landscape.',
      }),
    ]);

    expect(quality.score).toBe(1);
    expect(quality.passed_metric_count).toBe(7);
    expect(quality.metrics.map((metric) => metric.id)).toEqual([
      'visual_fixture_coverage',
      'visual_crop_provenance_coverage',
      'visual_table_cell_box_coverage',
      'visual_formula_format_coverage',
      'visual_chart_data_coverage',
      'visual_figure_text_coverage',
      'visual_image_description_coverage',
    ]);
    expect(quality.metrics.every((metric) => metric.status === 'passed')).toBe(true);
    expect(
      quality.metrics.find((metric) => metric.id === 'visual_table_cell_box_coverage')?.observed
    ).toMatchObject({
      cell_boxes: 4,
    });
  });
});
