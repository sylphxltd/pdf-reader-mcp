/**
 * Star-project production contract suite (pure-Rust).
 *
 * Hard rules:
 * - Exercises published launcher bin/pdf-reader-mcp
 * - Pure-Rust only (no TS parity bridge)
 * - Fails closed on public-tool regressions and SSRF
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  binWrapper,
  callTool,
  ensureProductionArtifacts,
  initializeSession,
  listTools,
  packageJson,
  parseToolPayload,
  productionEnv,
  repoRoot,
  samplePdf,
  spawnProductionMcp,
} from './mcpContract.helpers.js';

type ContractMatrix = {
  requiredTools: string[];
  readPdfOptionSmoke: Array<{ id: string; args: Record<string, unknown> }>;
  searchPdfCases: Array<{ id: string; args: Record<string, unknown> }>;
  pdfEvidenceCases: Array<{ id: string; args: Record<string, unknown> }>;
  securityCases: Array<{
    id: string;
    url?: string;
    pathAndUrl?: boolean;
  }>;
};

const matrix = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'publicContract.matrix.json'), 'utf8')
) as ContractMatrix;

const buildReadPdfArgs = (entry: { id: string; args: Record<string, unknown> }) => {
  const args = { ...entry.args };
  const pageSpec = args.sources_pages;
  args.sources_pages = undefined;
  if (pageSpec !== undefined) {
    args.sources = [{ path: samplePdf, pages: pageSpec }];
  } else if (!args.sources) {
    args.sources = [{ path: samplePdf }];
  }
  return args as Record<string, unknown>;
};

describe('production-path public contract (pure-Rust)', () => {
  let proc: ChildProcess;
  let reqId = 10;

  const nextId = () => {
    reqId += 1;
    return reqId;
  };

  beforeAll(() => {
    ensureProductionArtifacts();
    expect(productionEnv().PDF_READER_ENGINE_MODE).toBeUndefined();

    proc = spawnProductionMcp();
  }, 420_000);

  afterAll(() => {
    proc?.kill('SIGTERM');
  });

  test('package public entry points at pure-Rust launcher', () => {
    expect(packageJson.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(fs.existsSync(binWrapper)).toBe(true);
    const launcher = fs.readFileSync(binWrapper, 'utf8');
    expect(launcher).toContain('resolve_rust_bin');
    expect(launcher).toContain('pdf-reader-mcp-server');
    expect(launcher).not.toContain('PDF_READER_ENGINE_MODE=full');
    expect(launcher).not.toContain('legacy-engine-runtime');
    expect(fs.existsSync(path.join(repoRoot, 'bin/native/pdf-reader-mcp-server'))).toBe(true);
    expect(
      fs.existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(false);
  });

  test('initialize advertises pdf-reader-mcp and package version', async () => {
    const init = await initializeSession(proc, 'production-contract-suite');
    expect(init.result?.serverInfo?.name).toBe('pdf-reader-mcp');
    expect(init.result?.serverInfo?.version).toBe(packageJson.version);
    if (init.result?.serverInfo?.instructions) {
      expect(init.result.serverInfo.instructions).toMatch(/read_pdf|PDF|document/i);
    }
  }, 60_000);

  test('tools/list exposes exactly the public V3 tool surface', async () => {
    const listed = await listTools(proc, nextId());
    const names = (listed.result?.tools ?? []).map((t) => t.name).sort();
    for (const tool of matrix.requiredTools) {
      expect(names).toContain(tool);
    }
    expect(names).not.toContain('inspect_pdf');
    expect(names).not.toContain('render_page');
    expect(names).not.toContain('extract_regions');
    expect(names).not.toContain('ocr_pages');
    expect(names).not.toContain('analyze_regions');
  }, 30_000);

  test('read_pdf option smoke matrix succeeds on production path', async () => {
    const failures: string[] = [];
    for (const entry of matrix.readPdfOptionSmoke) {
      const response = await callTool(proc, nextId(), 'read_pdf', buildReadPdfArgs(entry), 90_000);
      const payload = parseToolPayload(response);
      if (payload.isError) {
        failures.push(`${entry.id}: ${payload.text.slice(0, 300)}`);
        continue;
      }
      const text = payload.text.toLowerCase();
      const ok =
        text.includes('success') ||
        text.includes('results') ||
        text.includes('document') ||
        text.includes('num_pages') ||
        text.includes('markdown') ||
        text.includes('elements') ||
        text.includes('page');
      if (!ok) {
        failures.push(`${entry.id}: unexpected payload shape: ${payload.text.slice(0, 300)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 600_000);

  test('search_pdf public option smoke succeeds on production path', async () => {
    const failures: string[] = [];
    for (const entry of matrix.searchPdfCases) {
      const response = await callTool(
        proc,
        nextId(),
        'search_pdf',
        {
          sources: [{ path: samplePdf }],
          ...entry.args,
        },
        90_000
      );
      const payload = parseToolPayload(response);
      if (payload.isError) {
        failures.push(`${entry.id}: ${payload.text.slice(0, 300)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);

  test('pdf_evidence public operations smoke on production path', async () => {
    const failures: string[] = [];
    for (const entry of matrix.pdfEvidenceCases) {
      const args = structuredClone(entry.args) as Record<string, unknown>;
      if (!args.sources) {
        args.sources = [{ path: samplePdf }];
      } else if (Array.isArray(args.sources)) {
        args.sources = args.sources.map((source) => {
          if (!source || typeof source !== 'object') return source;
          const entrySource = { ...(source as Record<string, unknown>) };
          if (entrySource.path === '__SAMPLE__') entrySource.path = samplePdf;
          return entrySource;
        });
      }
      const response = await callTool(proc, nextId(), 'pdf_evidence', args, 120_000);
      const payload = parseToolPayload(response);
      if (payload.isError) {
        // Pure-Rust: visual ops fail closed (no crash). inspect must be green.
        if (
          entry.id === 'render_page' ||
          entry.id === 'extract_regions' ||
          entry.id === 'ocr_pages' ||
          entry.id === 'analyze_regions'
        ) {
          expect(payload.text.length).toBeGreaterThan(0);
          continue;
        }
        failures.push(`${entry.id}: ${payload.text.slice(0, 400)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);

  test('security contract rejects private/transition SSRF URLs and invalid locators', async () => {
    const failures: string[] = [];
    for (const entry of matrix.securityCases) {
      let args: Record<string, unknown>;
      if (entry.pathAndUrl) {
        args = {
          sources: [{ path: samplePdf, url: 'https://example.com/x.pdf' }],
          include_full_text: false,
          auto: false,
        };
      } else {
        args = {
          sources: [{ url: entry.url }],
          include_full_text: false,
          auto: false,
        };
      }
      const response = await callTool(proc, nextId(), 'read_pdf', args, 60_000);
      const payload = parseToolPayload(response);
      // Must fail closed: either isError or success:false with SSRF/locator message.
      const text = payload.text.toLowerCase();
      const blocked =
        payload.isError ||
        text.includes('non-public') ||
        text.includes('ssrf') ||
        text.includes('exactly one') ||
        text.includes('failed') ||
        text.includes('private') ||
        text.includes('invalid');
      if (!blocked) {
        failures.push(`${entry.id}: expected fail-closed, got: ${payload.text.slice(0, 300)}`);
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);
});
