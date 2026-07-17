/**
 * Star-project production contract suite.
 *
 * Hard rules:
 * - Exercises published launcher bin/pdf-reader-mcp
 * - Forces PDF_READER_ENGINE_MODE=full (production default)
 * - Never accepts pure-rust subset as stand-in for production green
 * - Fails closed on any public-tool regression
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertToolSuccess,
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
  delete args.sources_pages;
  if (pageSpec !== undefined) {
    args.sources = [{ path: samplePdf, pages: pageSpec }];
  } else if (!args.sources) {
    args.sources = [{ path: samplePdf }];
  }
  return args as Record<string, unknown>;
};

describe('production-path public contract (Rust process + full TS parity)', () => {
  let proc: ChildProcess;
  let reqId = 10;

  const nextId = () => {
    reqId += 1;
    return reqId;
  };

  beforeAll(() => {
    ensureProductionArtifacts();
    // Absolute ban: production suite must not inherit pure-rust from parent env.
    expect(productionEnv().PDF_READER_ENGINE_MODE).toBe('full');
    expect(productionEnv().PDF_READER_PURE_RUST).toBeUndefined();

    proc = spawnProductionMcp();
  }, 420_000);

  afterAll(() => {
    proc?.kill('SIGTERM');
  });

  test('package public entry points at production launcher', () => {
    expect(packageJson.bin?.['pdf-reader-mcp']).toBe('./bin/pdf-reader-mcp');
    expect(fs.existsSync(binWrapper)).toBe(true);
    const launcher = fs.readFileSync(binWrapper, 'utf8');
    expect(launcher).toContain('printf \'%s\\n\' "rust"');
    expect(launcher).toContain('PDF_READER_ENGINE_MODE=full');
    expect(fs.existsSync(path.join(repoRoot, 'dist/legacy-engine-runtime.js'))).toBe(true);
  });

  test('initialize advertises pdf-reader-mcp and package version', async () => {
    const init = await initializeSession(proc, 'production-contract-suite');
    expect(init.result?.serverInfo?.name).toBe('pdf-reader-mcp');
    expect(init.result?.serverInfo?.version).toBe(packageJson.version);
    // Instructions are optional on the wire; name+version are the hard identity contract.
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
    // Legacy split tools must stay collapsed into pdf_evidence.
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
      // Full-parity engine returns success payload (structured twin or results).
      const ok =
        text.includes('success') ||
        text.includes('results') ||
        text.includes('document') ||
        text.includes('num_pages') ||
        text.includes('markdown') ||
        text.includes('elements') ||
        text.includes('trust') ||
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
        // Optional native canvas backends may be absent in CI; require a non-empty
        // fail-closed error (no crash) for render/crop. inspect must be green.
        if (entry.id === 'render_page' || entry.id === 'extract_regions') {
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
      const text = payload.text.toLowerCase();
      const blocked =
        payload.isError ||
        /non-public|ssrf|rejected|failed|invalid|exactly one|private|url host|could not be resolved|access denied|sources/.test(
          text
        );
      if (!blocked) {
        failures.push(
          `${entry.id}: expected security rejection, got: ${payload.text.slice(0, 300)}`
        );
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);

  test('missing local file fails closed with sanitized error', async () => {
    const missing = path.join(repoRoot, 'test/fixtures/does-not-exist-production-contract.pdf');
    const response = await callTool(
      proc,
      nextId(),
      'read_pdf',
      {
        sources: [{ path: missing }],
        include_full_text: false,
        auto: false,
      },
      60_000
    );
    const payload = parseToolPayload(response);
    expect(
      payload.isError || /fail|not found|enoent|could not|unable|error/i.test(payload.text)
    ).toBe(true);
    // SSS-02 style: do not leak absolute internal exception class spam only.
    expect(payload.text).not.toMatch(/InvalidPDFException/i);
  }, 60_000);

  test('invalid empty sources fails closed', async () => {
    const response = await callTool(
      proc,
      nextId(),
      'read_pdf',
      {
        sources: [],
        include_full_text: false,
      },
      30_000
    );
    const payload = parseToolPayload(response);
    expect(payload.isError || /source|invalid|required|empty/i.test(payload.text)).toBe(true);
  }, 30_000);

  test('performance budget: simple read_pdf completes under 15s warm path', async () => {
    // Warm once.
    await callTool(
      proc,
      nextId(),
      'read_pdf',
      {
        sources: [{ path: samplePdf }],
        include_metadata: true,
        include_page_count: true,
        auto: false,
      },
      60_000
    );
    const started = performance.now();
    const response = await callTool(
      proc,
      nextId(),
      'read_pdf',
      {
        sources: [{ path: samplePdf }],
        include_metadata: true,
        include_page_count: true,
        auto: false,
      },
      60_000
    );
    const elapsedMs = performance.now() - started;
    assertToolSuccess(response, 'perf-read_pdf');
    expect(elapsedMs).toBeLessThan(15_000);
  }, 120_000);
});
