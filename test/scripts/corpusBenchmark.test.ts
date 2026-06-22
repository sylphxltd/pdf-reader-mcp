import { describe, expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface CorpusBenchmarkReport {
  external_case_count?: number;
  external_url_case_count?: number;
  external_download_count?: number;
  corpus_cache_dir?: string;
  manifest_path?: string;
  cases: Array<{
    id: string;
    fixture_type: string;
    document_archetype: string;
    capability_tags: string[];
    score: number;
    assertions: Array<{ pass: boolean; observed?: Record<string, unknown> }>;
  }>;
  capability_summary: Array<{
    tag: string;
    case_count: number;
    assertion_count: number;
    passed_assertion_count: number;
    failed_assertion_count: number;
    score: number;
    status: string;
  }>;
}

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-corpus-benchmark-'));
  try {
    return await run(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const readCorpusReport = async (artifactDir: string): Promise<CorpusBenchmarkReport> =>
  JSON.parse(await fs.readFile(path.join(artifactDir, 'pdf_corpus_benchmark.json'), 'utf8'));

const withPdfServer = async <T>(run: (url: string) => Promise<T>): Promise<T> => {
  const bytes = await fs.readFile(path.resolve('test/fixtures/sample.pdf'));
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'application/pdf',
      'content-length': String(bytes.byteLength),
    });
    response.end(bytes);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    return await run(`http://127.0.0.1:${String(address.port)}/sample.pdf`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

describe('corpus benchmark external manifests', () => {
  test('adds operator-supplied external corpus cases from CLI flags or environment', async () => {
    await withTempDir(async (tempDir) => {
      const manifestPath = path.join(tempDir, 'corpus-manifest.json');
      const artifactDir = path.join(tempDir, 'artifacts');
      await fs.writeFile(
        manifestPath,
        JSON.stringify({
          cases: [
            {
              id: 'external-sample',
              path: path.resolve('test/fixtures/sample.pdf'),
              pages: [1],
              document_archetype: 'external text-rich sample',
              capability_tags: ['external_sample', 'selectable_text'],
              expected: {
                contains_text: ['Sample PDF'],
                min_pages: 1,
                min_text_chars: 2000,
                min_chunks: 1,
                required_document_map_layers: ['text_layer', 'citation_chunks', 'page_geometry'],
              },
            },
          ],
        })
      );

      const childEnv = {
        ...process.env,
        MCP_PDF_BENCHMARK_OUTPUT_DIR: artifactDir,
      };
      childEnv.MCP_PDF_CORPUS_MANIFEST = undefined;
      childEnv.MCP_PDF_ALLOWED_DIRS = undefined;

      await execFileAsync(
        process.execPath,
        ['scripts/benchmark-pdf-corpus.ts', '--corpus-manifest', manifestPath],
        {
          cwd: path.resolve('.'),
          env: childEnv,
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 10,
        }
      );

      const reportPath = path.join(artifactDir, 'pdf_corpus_benchmark.json');
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8')) as CorpusBenchmarkReport;
      const external = report.cases.find((entry) => entry.id === 'external-sample');

      expect(report.external_case_count).toBe(1);
      expect(report.manifest_path).toBe(path.resolve(manifestPath));
      expect(external).toMatchObject({
        fixture_type: 'external',
        document_archetype: 'external text-rich sample',
        capability_tags: ['external_sample', 'selectable_text'],
        score: 1,
      });
      expect(report.capability_summary).toContainEqual(
        expect.objectContaining({
          tag: 'external_sample',
          case_count: 1,
          status: 'passed',
        })
      );
      expect(external?.assertions.every((assertion) => assertion.pass)).toBe(true);

      await execFileAsync(process.execPath, ['scripts/benchmark-pdf-corpus.ts'], {
        cwd: path.resolve('.'),
        env: {
          ...childEnv,
          MCP_PDF_CORPUS_MANIFEST: manifestPath,
        },
        timeout: 20_000,
        maxBuffer: 1024 * 1024 * 10,
      });
    });
  }, 20_000);

  test('downloads public corpus URL cases only with opt-in and validates sha256 cache provenance', async () => {
    await withTempDir(async (tempDir) => {
      await withPdfServer(async (url) => {
        const sampleBytes = await fs.readFile(path.resolve('test/fixtures/sample.pdf'));
        const sha256 = createHash('sha256').update(sampleBytes).digest('hex');
        const manifestPath = path.join(tempDir, 'url-corpus-manifest.json');
        const artifactDir = path.join(tempDir, 'artifacts-url');
        const cachedArtifactDir = path.join(tempDir, 'artifacts-cache');
        const cacheDir = path.join(tempDir, 'cache');
        await fs.writeFile(
          manifestPath,
          JSON.stringify({
            cases: [
              {
                id: 'external-url-sample',
                url,
                sha256,
                source_label: 'local test PDF server',
                source_homepage: 'http://127.0.0.1/',
                source_rights: 'test fixture',
                source_retrieved_at: '2026-06-21',
                pages: [1],
                document_archetype: 'external URL text-rich sample',
                capability_tags: ['external_url', 'public_cache', 'selectable_text'],
                expected: {
                  contains_text: ['Sample PDF'],
                  min_pages: 1,
                  min_text_chars: 2000,
                },
              },
            ],
          })
        );

        const baseEnv = {
          ...process.env,
          MCP_PDF_CORPUS_CACHE_DIR: cacheDir,
          MCP_PDF_ALLOWED_DIRS: undefined,
          MCP_PDF_ALLOW_PRIVATE_IPS: undefined,
        };

        await expect(
          execFileAsync(
            process.execPath,
            ['scripts/benchmark-pdf-corpus.ts', '--corpus-manifest', manifestPath],
            {
              cwd: path.resolve('.'),
              env: {
                ...baseEnv,
                MCP_PDF_BENCHMARK_OUTPUT_DIR: path.join(tempDir, 'artifacts-denied'),
                MCP_PDF_CORPUS_ALLOW_DOWNLOADS: undefined,
              },
              timeout: 20_000,
              maxBuffer: 1024 * 1024 * 10,
            }
          )
        ).rejects.toThrow(/allow-corpus-downloads|MCP_PDF_CORPUS_ALLOW_DOWNLOADS/u);

        await expect(
          execFileAsync(process.execPath, ['scripts/benchmark-pdf-corpus.ts'], {
            cwd: path.resolve('.'),
            env: {
              ...baseEnv,
              MCP_PDF_BENCHMARK_OUTPUT_DIR: path.join(tempDir, 'artifacts-private-denied'),
              MCP_PDF_CORPUS_MANIFEST: manifestPath,
              MCP_PDF_CORPUS_ALLOW_DOWNLOADS: 'true',
            },
            timeout: 20_000,
            maxBuffer: 1024 * 1024 * 10,
          })
        ).rejects.toThrow(/URL rejected|non-public|SSRF protection/u);

        await execFileAsync(process.execPath, ['scripts/benchmark-pdf-corpus.ts'], {
          cwd: path.resolve('.'),
          env: {
            ...baseEnv,
            MCP_PDF_BENCHMARK_OUTPUT_DIR: artifactDir,
            MCP_PDF_CORPUS_MANIFEST: manifestPath,
            MCP_PDF_CORPUS_ALLOW_DOWNLOADS: 'true',
            MCP_PDF_ALLOW_PRIVATE_IPS: 'true',
          },
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 10,
        });

        const report = await readCorpusReport(artifactDir);
        const external = report.cases.find((entry) => entry.id === 'external-url-sample');
        expect(report.external_url_case_count).toBe(1);
        expect(report.external_download_count).toBe(1);
        expect(report.corpus_cache_dir).toBe(path.resolve(cacheDir));
        expect(external?.score).toBe(1);
        expect(external?.capability_tags).toEqual([
          'external_url',
          'public_cache',
          'selectable_text',
        ]);
        expect(report.capability_summary).toContainEqual(
          expect.objectContaining({
            tag: 'external_url',
            case_count: 1,
            status: 'passed',
          })
        );
        expect(external?.assertions[0]?.observed).toMatchObject({
          source_type: 'url',
          source_url: url,
          source_label: 'local test PDF server',
          source_homepage: 'http://127.0.0.1/',
          source_rights: 'test fixture',
          source_retrieved_at: '2026-06-21',
          sha256,
          downloaded: true,
        });

        await execFileAsync(process.execPath, ['scripts/benchmark-pdf-corpus.ts'], {
          cwd: path.resolve('.'),
          env: {
            ...baseEnv,
            MCP_PDF_BENCHMARK_OUTPUT_DIR: cachedArtifactDir,
            MCP_PDF_CORPUS_MANIFEST: manifestPath,
            MCP_PDF_CORPUS_ALLOW_DOWNLOADS: undefined,
          },
          timeout: 20_000,
          maxBuffer: 1024 * 1024 * 10,
        });

        const cachedReport = await readCorpusReport(cachedArtifactDir);
        const cachedExternal = cachedReport.cases.find(
          (entry) => entry.id === 'external-url-sample'
        );
        expect(cachedReport.external_url_case_count).toBe(1);
        expect(cachedReport.external_download_count).toBeUndefined();
        expect(cachedExternal?.score).toBe(1);
        expect(cachedExternal?.assertions[0]?.observed).toMatchObject({
          source_type: 'url',
          source_url: url,
          sha256,
          downloaded: false,
        });
      });
    });
  }, 20_000);
});
