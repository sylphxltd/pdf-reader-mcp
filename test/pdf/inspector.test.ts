import { describe, expect, it } from 'vitest';
import {
  buildInspectionRecommendation,
  classifyPdfInspectionProfile,
  selectInspectionSamplePages,
} from '../../src/pdf/inspector.js';
import type { PdfInspectionDocumentSignals, PdfInspectionPageSignal } from '../../src/types/pdf.js';

const signal = (page: number, textChars: number, imagePaintOperations = 0): PdfInspectionPageSignal => ({
  page,
  text_chars: textChars,
  text_items: textChars > 0 ? 4 : 0,
  estimated_tokens: Math.ceil(textChars / 4),
  image_paint_operations: imagePaintOperations,
  likely_scanned: textChars < 20 && imagePaintOperations > 0,
  low_text_density: textChars < 80,
});

const documentSignals = (overrides: Partial<PdfInspectionDocumentSignals> = {}): PdfInspectionDocumentSignals => ({
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
      expect(classifyPdfInspectionProfile([signal(1, 0, 2), signal(2, 3, 1)])).toBe('scanned_or_image_only');
    });

    it('classifies mixed selectable text and scanned pages', () => {
      expect(classifyPdfInspectionProfile([signal(1, 420), signal(2, 0, 1)])).toBe('mixed_text_and_scan');
    });
  });

  describe('buildInspectionRecommendation', () => {
    it('recommends opt-in OCR fusion for scanned PDFs', () => {
      const recommendation = buildInspectionRecommendation(
        { path: 'scan.pdf' },
        'scanned_or_image_only',
        documentSignals()
      );

      expect(recommendation).toMatchObject({
        workflow: 'scanned_pdf_triage',
        needs_ocr: true,
        read_pdf_arguments: {
          include_document_map: true,
          include_layout_diagnostics: true,
          include_ocr_text_layer: true,
        },
      });
      expect(recommendation.reason).toContain('include_ocr_text_layer');
      expect(recommendation.read_pdf_arguments).not.toHaveProperty('include_full_text');
      expect(recommendation.read_pdf_arguments).not.toHaveProperty('include_chunks');
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
          include_outline: true,
          include_structure_tree: true,
        },
      });
    });
  });
});
