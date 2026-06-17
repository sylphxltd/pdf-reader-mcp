import { describe, expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-reader-corpus-benchmark-'));
  try {
    return await run(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
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
      const report = JSON.parse(await fs.readFile(reportPath, 'utf8')) as {
        external_case_count?: number;
        manifest_path?: string;
        cases: Array<{
          id: string;
          fixture_type: string;
          document_archetype: string;
          score: number;
          assertions: Array<{ pass: boolean }>;
        }>;
      };
      const external = report.cases.find((entry) => entry.id === 'external-sample');

      expect(report.external_case_count).toBe(1);
      expect(report.manifest_path).toBe(path.resolve(manifestPath));
      expect(external).toMatchObject({
        fixture_type: 'external',
        document_archetype: 'external text-rich sample',
        score: 1,
      });
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
  });
});
