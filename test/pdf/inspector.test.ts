import { describe, expect, it } from 'vitest';
import {
  buildInspectionRecommendation,
  classifyPdfInspectionProfile,
  selectInspectionSamplePages,
} from '../../src/pdf/inspector.js';
import type { PdfInspectionDocumentSignals, PdfInspectionPageSignal } from '../../src/types/pdf.js';

const signal = (
  page: number,
  textChars: number,
  imagePaintOperations = 0
): PdfInspectionPageSignal => ({
  page,
  text_chars: textChars,
  text_items: textChars > 0 ? 4 : 0,
  estimated_tokens: Math.ceil(textChars / 4),
  image_paint_operations: imagePaintOperations,
  likely_scanned: textChars < 20 && imagePaintOperations > 0,
  low_text_density: textChars < 80,
});

const documentSignals = (
  overrides: Partial<PdfInspectionDocumentSignals> = {}
): PdfInspectionDocumentSignals => ({
  has_outline: false,
  has_page_labels: false,
  has_permissions: false,
  has_mark_info: false,
  has_form_fields: false,
  has_attachments: false,
  has_structure_tree: false,
  ...overrides,
});

describe('inspector', () => {
  describe('selectInspectionSamplePages', () => {
    it('samples the first, middle, and last pages without exceeding the limit', () => {
      expect(selectInspectionSamplePages(100, undefined, 5)).toEqual([1, 26, 51, 75, 100]);
    });

    it('samples inside explicit target pages only', () => {
      expect(selectInspectionSamplePages(20, [2, 4, 6, 8, 10, 12], 3)).toEqual([2, 8, 12]);
    });

    it('ignores target pages outside the document range', () => {
      expect(selectInspectionSamplePages(3, [10, 11], 5)).toEqual([]);
    });
  });

  describe('classifyPdfInspectionProfile', () => {
    it('classifies text-rich samples as digital text', () => {
      expect(classifyPdfInspectionProfile([signal(1, 500), signal(2, 300)])).toBe('digital_text');
    });

    it('classifies image-only samples as scanned or image-only', () => {
      expect(classifyPdfInspectionProfile([signal(1, 0, 2), signal(2, 3, 1)])).toBe(
        'scanned_or_image_only'
      );
    });

    it('classifies mixed selectable text and scanned pages', () => {
      expect(classifyPdfInspectionProfile([signal(1, 420), signal(2, 0, 1)])).toBe(
        'mixed_text_and_scan'
      );
    });
  });

  describe('buildInspectionRecommendation', () => {
    it('recommends opt-in OCR fusion for scanned PDFs', () => {
      const recommendation = buildInspectionRecommendation(
        { path: 'scan.pdf' },
        'scanned_or_image_only',
        documentSignals(),
        [signal(1, 0, 2), signal(2, 3, 1)]
      );

      expect(recommendation).toMatchObject({
        workflow: 'scanned_pdf_triage',
        needs_ocr: true,
        read_pdf_arguments: {
          include_document_map: true,
          include_layout_diagnostics: true,
          include_ocr_text_layer: true,
          include_visual_enrichments: true,
          max_visual_enrichments: 8,
        },
        next_tools: [
          {
            tool: 'read_pdf',
            priority: 1,
            ready: true,
            requires_provider: 'ocr_pages',
            arguments: {
              include_document_map: true,
              include_ocr_text_layer: true,
              include_visual_enrichments: true,
              max_visual_enrichments: 8,
            },
          },
          {
            tool: 'ocr_pages',
            priority: 2,
            ready: true,
            requires_provider: 'ocr_pages',
            arguments: {
              sources: [{ path: 'scan.pdf', pages: [1, 2] }],
              scale: 2,
            },
          },
          {
            tool: 'render_page',
            priority: 3,
            ready: true,
            arguments: {
              sources: [{ path: 'scan.pdf', pages: [1, 2] }],
              include_image: true,
            },
          },
        ],
      });
      expect(recommendation.reason).toContain('include_ocr_text_layer');
      expect(recommendation.read_pdf_arguments).not.toHaveProperty('include_full_text');
      expect(recommendation.read_pdf_arguments).not.toHaveProperty('include_chunks');
    });

    it('marks OCR-dependent routing as not ready when the OCR provider is unavailable', () => {
      const recommendation = buildInspectionRecommendation(
        { path: 'scan.pdf' },
        'scanned_or_image_only',
        documentSignals(),
        [signal(1, 0, 2)],
        { ocr_pages: 'not_configured', analyze_regions: 'ready' }
      );

      expect(recommendation.next_tools[0]).toMatchObject({
        tool: 'read_pdf',
        ready: false,
        required_inputs: ['configured OCR provider'],
        requires_provider: 'ocr_pages',
      });
      expect(recommendation.next_tools[1]).toMatchObject({
        tool: 'ocr_pages',
        ready: false,
        required_inputs: ['configured OCR provider'],
        requires_provider: 'ocr_pages',
      });
      expect(recommendation.next_tools[2]).toMatchObject({
        tool: 'render_page',
        ready: true,
      });
    });

    it('recommends citation-ready extraction for digital text PDFs', () => {
      const recommendation = buildInspectionRecommendation(
        { path: 'report.pdf' },
        'digital_text',
        documentSignals({ has_outline: true, has_structure_tree: true })
      );

      expect(recommendation).toMatchObject({
        workflow: 'agentic_rag',
        needs_ocr: false,
        read_pdf_arguments: {
          include_document_map: true,
          include_chunks: true,
          include_semantic_hints: true,
          include_safety_findings: true,
          include_tables: true,
          include_visual_enrichments: true,
          max_visual_enrichments: 8,
          include_outline: true,
          include_structure_tree: true,
        },
        next_tools: [
          {
            tool: 'read_pdf',
            priority: 1,
            ready: true,
          },
          {
            tool: 'search_pdf',
            priority: 2,
            ready: false,
            required_inputs: ['literal search query'],
            argument_template: {
              query: '<literal-query-from-user-task>',
              include_ocr_text_layer: false,
            },
          },
          {
            tool: 'extract_regions',
            priority: 3,
            ready: false,
            required_inputs: ['page number', 'PDF-coordinate bounding box'],
          },
          {
            tool: 'analyze_regions',
            priority: 4,
            ready: false,
            requires_provider: 'analyze_regions',
          },
          {
            tool: 'render_page',
            priority: 5,
            ready: true,
          },
        ],
      });
    });

    it('does not enable visual enrichment fusion when the visual provider is unavailable', () => {
      const recommendation = buildInspectionRecommendation(
        { path: 'report.pdf' },
        'digital_text',
        documentSignals(),
        [signal(1, 500)],
        { ocr_pages: 'ready', analyze_regions: 'not_configured' }
      );

      expect(recommendation.read_pdf_arguments).not.toHaveProperty('include_visual_enrichments');
      expect(recommendation.read_pdf_arguments).not.toHaveProperty('max_visual_enrichments');
      expect(recommendation.next_tools[0]?.arguments).not.toHaveProperty(
        'include_visual_enrichments'
      );
      expect(recommendation.next_tools[3]).toMatchObject({
        tool: 'analyze_regions',
        ready: false,
        required_inputs: [
          'page number',
          'PDF-coordinate bounding box',
          'configured analyze_regions provider',
        ],
      });
    });
  });
});
