import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  callTool,
  ensureProductionArtifacts,
  initializeSession,
  parseToolPayload,
  spawnProductionMcp,
} from '../production/mcpContract.helpers.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixture = path.join(repoRoot, 'test/fixtures/differential/v3014-visual-v1.pdf');
const provider = path.join(repoRoot, 'scripts/differential/reference-ocr-provider.ts');

describe('pure-Rust command OCR provider integration', () => {
  let proc: ChildProcess;
  let failingProc: ChildProcess;
  let timeoutProc: ChildProcess;
  let descendantProc: ChildProcess;
  const descendantWorkspace = mkdtempSync(path.join(tmpdir(), 'pdf-reader-ocr-descendant-'));
  const descendantMarker = path.join(descendantWorkspace, 'input-path.txt');

  beforeAll(async () => {
    ensureProductionArtifacts('pure-rust');
    proc = spawnProductionMcp({
      PDF_READER_ENGINE_MODE: 'pure-rust',
      MCP_PDF_OCR_COMMAND: process.execPath,
      MCP_PDF_OCR_ARGS_JSON: JSON.stringify([provider, '{input}', '{page}', '{languages}']),
    });
    await initializeSession(proc, 'rust-ocr-provider-contract');

    failingProc = spawnProductionMcp({
      PDF_READER_ENGINE_MODE: 'pure-rust',
      MCP_PDF_OCR_COMMAND: process.execPath,
      MCP_PDF_OCR_ARGS_JSON: JSON.stringify([provider, '{input}', '{page}', '{languages}', 'fail']),
    });
    await initializeSession(failingProc, 'rust-ocr-provider-failure-contract');

    timeoutProc = spawnProductionMcp({
      PDF_READER_ENGINE_MODE: 'pure-rust',
      MCP_PDF_OCR_COMMAND: process.execPath,
      MCP_PDF_OCR_ARGS_JSON: JSON.stringify([
        provider,
        '{input}',
        '{page}',
        '{languages}',
        'sleep',
      ]),
    });
    await initializeSession(timeoutProc, 'rust-ocr-provider-timeout-contract');

    descendantProc = spawnProductionMcp({
      PDF_READER_ENGINE_MODE: 'pure-rust',
      MCP_PDF_OCR_COMMAND: process.execPath,
      MCP_PDF_OCR_ARGS_JSON: JSON.stringify([
        provider,
        '{input}',
        '{page}',
        '{languages}',
        'escaped-descendant',
        descendantMarker,
      ]),
    });
    await initializeSession(descendantProc, 'rust-ocr-provider-descendant-contract');
  }, 420_000);

  afterAll(() => {
    proc?.kill('SIGTERM');
    failingProc?.kill('SIGTERM');
    timeoutProc?.kill('SIGTERM');
    descendantProc?.kill('SIGTERM');
    rmSync(descendantWorkspace, { recursive: true, force: true });
  });

  test('renders a bounded page and returns normalized OCR provenance', async () => {
    const response = await callTool(
      proc,
      41,
      'pdf_evidence',
      {
        operation: 'ocr_pages',
        sources: [{ path: fixture, pages: [1] }],
        scale: 2,
        max_pages: 1,
        languages: ['fra', 'eng'],
      },
      90_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError).toBe(false);
    expect(response.result?.content).toHaveLength(1);
    const result = JSON.parse(payload.text) as {
      profile: string;
      ocr_options: Record<string, unknown>;
      results: Array<{
        success: boolean;
        ocr_pages: Array<Record<string, unknown>>;
      }>;
    };
    expect(result.profile).toBe('ocr_text_layer');
    expect(result.ocr_options).toMatchObject({
      scale: 2,
      max_pages: 1,
      languages: ['fra', 'eng'],
    });
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[0]?.ocr_pages[0]).toMatchObject({
      page: 1,
      text: 'Reference OCR page 1 at 240x160',
      confidence: 0.87,
      language: 'fra',
      provider: 'command',
      source_render_evidence_id: 'page-1-render-scale-2',
      source_render_scale: 2,
      source_render_width: 240,
      source_render_height: 160,
      provenance: { engine: 'external-command', source: 'ocr-provider' },
      words: [
        {
          text: 'Reference',
          confidence: 0.91,
          bounding_box: { left: 10, bottom: 5, right: 50, top: 15 },
        },
      ],
    });
  }, 120_000);

  test('fails closed when the provider exits unsuccessfully', async () => {
    const response = await callTool(
      failingProc,
      42,
      'pdf_evidence',
      {
        operation: 'ocr_pages',
        sources: [{ path: fixture, pages: [1] }],
        scale: 1,
        max_pages: 1,
      },
      30_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError).toBe(true);
    expect(payload.text).toContain('All PDF sources failed OCR');
    expect(payload.text).toContain('OCR provider command failed for page 1');
  });

  test('kills and fails closed when the provider exceeds its timeout', async () => {
    const started = Date.now();
    const response = await callTool(
      timeoutProc,
      43,
      'pdf_evidence',
      {
        operation: 'ocr_pages',
        sources: [{ path: fixture, pages: [1] }],
        scale: 1,
        max_pages: 1,
        timeout_ms: 1_000,
      },
      30_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError).toBe(true);
    expect(payload.text).toContain('OCR provider command timed out for page 1');
    expect(Date.now() - started).toBeLessThan(4_000);
  }, 30_000);

  test('bounds escaped inherited-pipe descendants and cleans the temporary page', async () => {
    const started = Date.now();
    const response = await callTool(
      descendantProc,
      44,
      'pdf_evidence',
      {
        operation: 'ocr_pages',
        sources: [{ path: fixture, pages: [1] }],
        scale: 1,
        max_pages: 1,
        timeout_ms: 1_000,
      },
      30_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError).toBe(true);
    expect(payload.text).toContain('OCR provider command timed out for page 1');
    expect(Date.now() - started).toBeLessThan(4_000);
    const temporaryInput = readFileSync(descendantMarker, 'utf8');
    expect(existsSync(temporaryInput)).toBe(false);
  }, 30_000);
});
