/**
 * EXPERIMENTAL pure-Rust capability contract.
 *
 * NOT the published product path. Requires PDF_READER_ENGINE_MODE=pure-rust.
 * Key-presence alone is insufficient for true parity; assertions below mix
 * presence + a few semantic checks. Full TS↔Rust golden differential is still TODO.
 *
 * Skip unless explicitly enabled so default CI exercises the published TS path.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import {
  callTool,
  ensureProductionArtifacts,
  initializeSession,
  parseToolPayload,
  samplePdf,
  spawnProductionMcp,
} from './mcpContract.helpers.js';

const READ_PDF_REQUIRED_FIELDS: Record<string, string[]> = {
  'meta-pages': ['info', 'num_pages'],
  'full-text': ['full_text'],
  markdown: ['markdown'],
  html: ['html'],
  chunks: ['chunks'],
  elements: ['elements'],
  'text-layer': ['text_layer'],
  tables: ['tables'],
  'document-map': ['document_map'],
  'document-ast': ['document_ast'],
  safety: ['safety_findings'],
  layout: ['layout_diagnostics'],
  trust: ['trust_report'],
  a11y: ['accessibility_report'],
  outline: ['outline'],
  annotations: ['annotations'],
  'page-labels': ['page_labels'],
  'page-geometry': ['page_geometry'],
  permissions: ['permissions'],
  forms: ['form_fields'],
  attachments: ['attachments'],
  structure: ['structure_trees'],
  images: ['images'],
  visual: ['visual_enrichments'],
};

const READ_PDF_CASES: Array<{ id: string; args: Record<string, unknown>; fields: string[] }> =
  Object.entries(READ_PDF_REQUIRED_FIELDS).map(([id, fields]) => {
    const flagMap: Record<string, Record<string, unknown>> = {
      'meta-pages': { include_metadata: true, include_page_count: true },
      'full-text': { include_full_text: true },
      markdown: { include_markdown: true },
      html: { include_html: true },
      chunks: { include_chunks: true },
      elements: { include_elements: true, include_semantic_hints: true },
      'text-layer': { include_text_layer: true },
      tables: { include_tables: true },
      'document-map': { include_document_map: true },
      'document-ast': { include_document_ast: true },
      safety: { include_safety_findings: true },
      layout: { include_layout_diagnostics: true },
      trust: { include_trust_report: true },
      a11y: { include_accessibility_report: true },
      outline: { include_outline: true },
      annotations: { include_annotations: true },
      'page-labels': { include_page_labels: true },
      'page-geometry': { include_page_geometry: true },
      permissions: { include_permissions: true },
      forms: { include_form_fields: true },
      attachments: { include_attachments: true },
      structure: { include_structure_tree: true },
      images: { include_images: true },
      ocr: { include_ocr_text_layer: true },
      visual: { include_visual_enrichments: true },
    };
    return {
      id,
      args: { auto: false, ...flagMap[id] },
      fields,
    };
  });

function deepHasKey(value: unknown, key: string): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((entry) => deepHasKey(entry, key));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Object.hasOwn(record, key)) return true;
    return Object.values(record).some((entry) => deepHasKey(entry, key));
  }
  return false;
}

const pureRustEnabled =
  process.env.PDF_READER_ENGINE_MODE === 'pure-rust' ||
  process.env.PDF_READER_ENGINE_MODE === 'rust' ||
  process.env.RUN_PURE_RUST_CAPABILITY === '1';

describe.skipIf(!pureRustEnabled)('experimental pure-Rust capability contract', () => {
  let proc: ChildProcess;
  let reqId = 100;

  const nextId = () => {
    reqId += 1;
    return reqId;
  };

  beforeAll(async () => {
    process.env.PDF_READER_ENGINE_MODE = 'pure-rust';
    ensureProductionArtifacts();
    proc = spawnProductionMcp({
      PDF_READER_ENGINE_MODE: 'pure-rust',
      MCP_PDF_OCR_COMMAND: '',
      MCP_PDF_OCR_ARGS_JSON: '',
      MCP_PDF_OCR_PRESET: '',
    });
    await initializeSession(proc, 'capability-parity-contract');
  }, 420_000);

  afterAll(() => {
    proc?.kill('SIGTERM');
  });

  test('every public read_pdf include_* capability returns its response field', async () => {
    const failures: string[] = [];
    for (const entry of READ_PDF_CASES) {
      const response = await callTool(
        proc,
        nextId(),
        'read_pdf',
        {
          sources: [{ path: samplePdf }],
          ...entry.args,
        },
        90_000
      );
      const payload = parseToolPayload(response);
      if (payload.isError) {
        failures.push(`${entry.id}: tool error: ${payload.text.slice(0, 240)}`);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload.text);
      } catch {
        failures.push(`${entry.id}: non-JSON payload`);
        continue;
      }
      for (const field of entry.fields) {
        if (!deepHasKey(parsed, field)) {
          failures.push(`${entry.id}: missing field '${field}'`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);

  test('auto balanced twin matches v3.0.14 depth without full text', async () => {
    const response = await callTool(
      proc,
      nextId(),
      'read_pdf',
      {
        sources: [{ path: samplePdf }],
        auto: true,
        auto_detail: 'balanced',
      },
      90_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError).toBe(false);
    const parsed = JSON.parse(payload.text) as unknown;
    const missing: string[] = [];
    for (const field of [
      'markdown',
      'chunks',
      'document_map',
      'tables',
      'trust_report',
      'accessibility_report',
    ]) {
      if (!deepHasKey(parsed, field)) missing.push(field);
    }
    expect(missing).toEqual([]);
    expect(deepHasKey(parsed, 'full_text')).toBe(false);
  }, 120_000);

  test('provider-backed OCR is omitted with an explicit warning when no provider is configured', async () => {
    const response = await callTool(
      proc,
      nextId(),
      'read_pdf',
      {
        sources: [{ path: samplePdf, pages: [1] }],
        auto: false,
        include_ocr_text_layer: true,
      },
      90_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError).toBe(false);
    const parsed = JSON.parse(payload.text) as {
      results?: Array<{
        success?: boolean;
        data?: { ocr_text_layer?: unknown; warnings?: string[] };
      }>;
    };
    expect(parsed.results?.[0]?.success).toBe(true);
    expect(parsed.results?.[0]?.data?.ocr_text_layer).toBeUndefined();
    expect(parsed.results?.[0]?.data?.warnings).toContain(
      'OCR text layer unavailable: OCR provider is not configured. Set MCP_PDF_OCR_COMMAND or MCP_PDF_OCR_PRESET=tesseract to enable ocr_pages.'
    );
  }, 120_000);

  test('search_pdf public options remain available', async () => {
    for (const args of [
      { query: 'a', case_sensitive: true },
      { query: 'a', whole_word: true },
      { query: 'a', context_chars: 40, max_matches_per_source: 5 },
    ]) {
      const response = await callTool(
        proc,
        nextId(),
        'search_pdf',
        { sources: [{ path: samplePdf }], ...args },
        60_000
      );
      const payload = parseToolPayload(response);
      expect(payload.isError).toBe(false);
      const parsed = JSON.parse(payload.text) as unknown;
      expect(deepHasKey(parsed, 'matches') || deepHasKey(parsed, 'results')).toBe(true);
    }
  }, 180_000);

  test('pdf_evidence inspect and bounded visual ops work; provider ops fail closed', async () => {
    const inspect = await callTool(
      proc,
      nextId(),
      'pdf_evidence',
      { operation: 'inspect', sources: [{ path: samplePdf }], sample_pages: 2 },
      60_000
    );
    const inspectPayload = parseToolPayload(inspect);
    expect(inspectPayload.isError).toBe(false);
    const inspectJson = JSON.parse(inspectPayload.text) as unknown;
    expect(deepHasKey(inspectJson, 'recommendation') || deepHasKey(inspectJson, 'num_pages')).toBe(
      true
    );

    for (const operation of ['render_page', 'extract_regions']) {
      const response = await callTool(
        proc,
        nextId(),
        'pdf_evidence',
        {
          operation,
          sources: [
            {
              path: samplePdf,
              regions:
                operation === 'extract_regions' || operation === 'analyze_regions'
                  ? [
                      {
                        id: 'r1',
                        page: 1,
                        bounding_box: { left: 0, bottom: 0, right: 100, top: 100 },
                      },
                    ]
                  : undefined,
            },
          ],
          max_pages: 1,
          max_regions: 1,
        },
        60_000
      );
      const payload = parseToolPayload(response);
      expect(payload.isError).toBe(false);
      const result = JSON.parse(payload.text) as unknown;
      expect(deepHasKey(result, operation === 'render_page' ? 'rendered_pages' : 'regions')).toBe(
        true
      );
    }

    for (const operation of ['ocr_pages', 'analyze_regions']) {
      const response = await callTool(
        proc,
        nextId(),
        'pdf_evidence',
        {
          operation,
          sources: [
            {
              path: samplePdf,
              regions:
                operation === 'analyze_regions'
                  ? [
                      {
                        id: 'r1',
                        page: 1,
                        bounding_box: { left: 0, bottom: 0, right: 100, top: 100 },
                      },
                    ]
                  : undefined,
            },
          ],
          max_pages: 1,
          max_regions: 1,
        },
        60_000
      );
      const payload = parseToolPayload(response);
      expect(payload.isError).toBe(true);
      expect(payload.text).toContain(
        operation === 'ocr_pages'
          ? 'OCR provider is not configured'
          : 'Region analysis provider is not configured'
      );
    }
  }, 240_000);
});
