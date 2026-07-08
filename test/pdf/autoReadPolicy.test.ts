import { describe, expect, test } from 'bun:test';
import {
  buildAutoDetailOptions,
  buildReadOptions,
  DEFAULT_AUTO_DETAIL,
  hasExplicitReadOptions,
  hasExplicitSourcePageSelection,
  MAX_CONCURRENT_SOURCES,
  shouldUseAutoRead,
} from '../../src/pdf/autoReadPolicy.js';
import type { ReadPdfArgs } from '../../src/schemas/readPdf.js';

const baseInput = (overrides: Partial<ReadPdfArgs> = {}): ReadPdfArgs => ({
  sources: [{ path: '/test.pdf' }],
  ...overrides,
});

describe('autoReadPolicy', () => {
  describe('hasExplicitReadOptions', () => {
    test('returns false when no include_* options are set', () => {
      expect(hasExplicitReadOptions(baseInput())).toBe(false);
    });

    test('returns true when any include_* option is set', () => {
      expect(hasExplicitReadOptions(baseInput({ include_full_text: true }))).toBe(true);
      expect(hasExplicitReadOptions(baseInput({ include_tables: true }))).toBe(true);
      expect(hasExplicitReadOptions(baseInput({ include_markdown: true }))).toBe(true);
    });

    test('returns true when trust_report_redaction is set', () => {
      expect(hasExplicitReadOptions(baseInput({ trust_report_redaction: 'standard' }))).toBe(true);
    });

    test('returns true when max_visual_enrichments is set', () => {
      expect(hasExplicitReadOptions(baseInput({ max_visual_enrichments: 5 }))).toBe(true);
    });
  });

  describe('hasExplicitSourcePageSelection', () => {
    test('returns false when no source pages are set', () => {
      expect(hasExplicitSourcePageSelection(baseInput())).toBe(false);
    });

    test('returns true when any source pins pages', () => {
      expect(
        hasExplicitSourcePageSelection(baseInput({ sources: [{ path: '/test.pdf', pages: [1] }] }))
      ).toBe(true);
    });
  });

  describe('shouldUseAutoRead', () => {
    test('defaults to true when no explicit options and no auto flag', () => {
      expect(shouldUseAutoRead(baseInput())).toBe(true);
    });

    test('returns false when only source pages are specified', () => {
      expect(
        shouldUseAutoRead(baseInput({ sources: [{ path: '/test.pdf', pages: [1, 2] }] }))
      ).toBe(false);
    });

    test('returns false when auto is explicitly false', () => {
      expect(shouldUseAutoRead(baseInput({ auto: false }))).toBe(false);
    });

    test('returns true when auto is explicitly true even with explicit options', () => {
      expect(shouldUseAutoRead(baseInput({ auto: true, include_tables: true }))).toBe(true);
    });

    test('returns false when explicit options are set and auto is not specified', () => {
      expect(shouldUseAutoRead(baseInput({ include_tables: true }))).toBe(false);
    });
  });

  describe('buildAutoDetailOptions', () => {
    test('fast preset includes core extraction only', () => {
      const opts = buildAutoDetailOptions('fast');
      expect(opts.include_metadata).toBe(true);
      expect(opts.include_page_count).toBe(true);
      expect(opts.include_markdown).toBe(true);
      expect(opts.include_tables).toBe(true);
      expect(opts.include_chunks).toBe(true);
      expect(opts.include_document_map).toBe(true);
      // Fast does NOT include trust/accessibility
      expect(opts.include_trust_report).toBeUndefined();
      expect(opts.include_accessibility_report).toBeUndefined();
    });

    test('balanced preset adds trust and accessibility', () => {
      const opts = buildAutoDetailOptions('balanced');
      expect(opts.include_trust_report).toBe(true);
      expect(opts.include_accessibility_report).toBe(true);
      expect(opts.include_safety_findings).toBe(true);
      // Balanced does NOT include full text/elements/html
      expect(opts.include_full_text).toBeUndefined();
      expect(opts.include_elements).toBeUndefined();
      expect(opts.include_html).toBeUndefined();
    });

    test('full preset adds everything', () => {
      const opts = buildAutoDetailOptions('full');
      expect(opts.include_full_text).toBe(true);
      expect(opts.include_html).toBe(true);
      expect(opts.include_elements).toBe(true);
      expect(opts.include_text_layer).toBe(true);
      expect(opts.include_document_ast).toBe(true);
      expect(opts.include_outline).toBe(true);
      expect(opts.include_annotations).toBe(true);
      expect(opts.include_structure_tree).toBe(true);
    });
  });

  describe('buildReadOptions', () => {
    test('applies correct defaults for unset options', () => {
      const opts = buildReadOptions(baseInput());
      expect(opts.includeMetadata).toBe(true);
      expect(opts.includePageCount).toBe(true);
      expect(opts.includeFullText).toBe(false);
      expect(opts.includeTables).toBe(false);
      expect(opts.includeMarkdown).toBe(false);
      expect(opts.includeTrustReport).toBe(false);
      expect(opts.includeAccessibilityReport).toBe(false);
    });

    test('respects explicit options', () => {
      const opts = buildReadOptions(
        baseInput({
          include_full_text: true,
          include_tables: true,
          include_trust_report: true,
          trust_report_redaction: 'strict',
        })
      );
      expect(opts.includeFullText).toBe(true);
      expect(opts.includeTables).toBe(true);
      expect(opts.includeTrustReport).toBe(true);
      expect(opts.trustReportRedaction).toBe('strict');
    });

    test('defaults max_visual_enrichments to DEFAULT_VISUAL_ENRICHMENT_MAX_REGIONS', () => {
      const opts = buildReadOptions(baseInput());
      expect(opts.maxVisualEnrichments).toBeGreaterThan(0);
    });
  });

  describe('constants', () => {
    test('DEFAULT_AUTO_DETAIL is balanced', () => {
      expect(DEFAULT_AUTO_DETAIL).toBe('balanced');
    });

    test('MAX_CONCURRENT_SOURCES is 3', () => {
      expect(MAX_CONCURRENT_SOURCES).toBe(3);
    });
  });
});
