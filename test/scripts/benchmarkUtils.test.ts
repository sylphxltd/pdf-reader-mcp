import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveBenchmarkOutputPath, writeBenchmarkReport } from '../../scripts/benchmark-utils.js';

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-benchmark-utils-'));
  try {
    return await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

describe('benchmark utils', () => {
  test('returns undefined when no output target is configured', () => {
    expect(
      resolveBenchmarkOutputPath({
        profile: 'pdf_quality_benchmark',
        argv: [],
        env: {},
      })
    ).toBeUndefined();
  });

  test('resolves an explicit output file flag', async () => {
    await withTempDir(async (tempDir) => {
      const outputPath = path.join(tempDir, 'quality.json');

      expect(
        resolveBenchmarkOutputPath({
          profile: 'pdf_quality_benchmark',
          argv: ['--output', outputPath],
          env: {},
        })
      ).toBe(path.resolve(outputPath));
    });
  });

  test('resolves an explicit output file equals flag', async () => {
    await withTempDir(async (tempDir) => {
      const outputPath = path.join(tempDir, 'quality.json');

      expect(
        resolveBenchmarkOutputPath({
          profile: 'pdf_quality_benchmark',
          argv: [`--output=${outputPath}`],
          env: {},
        })
      ).toBe(path.resolve(outputPath));
    });
  });

  test('ignores output flags without a file value', async () => {
    await withTempDir(async (tempDir) => {
      expect(
        resolveBenchmarkOutputPath({
          profile: 'pdf_quality_benchmark',
          argv: ['--output', '--output-dir', tempDir],
          env: {},
        })
      ).toBe(path.join(tempDir, 'pdf_quality_benchmark.json'));
    });
  });

  test('resolves output directories to stable profile file names', async () => {
    await withTempDir(async (tempDir) => {
      expect(
        resolveBenchmarkOutputPath({
          profile: 'PDF Quality Benchmark',
          argv: ['--output-dir', tempDir],
          env: {},
        })
      ).toBe(path.join(tempDir, 'pdf-quality-benchmark.json'));
    });
  });

  test('resolves output directories from the environment', async () => {
    await withTempDir(async (tempDir) => {
      expect(
        resolveBenchmarkOutputPath({
          profile: 'pdf_provider_benchmark',
          argv: [],
          env: { MCP_PDF_BENCHMARK_OUTPUT_DIR: tempDir },
        })
      ).toBe(path.join(tempDir, 'pdf_provider_benchmark.json'));
    });
  });

  test('writes benchmark reports as formatted JSON', async () => {
    await withTempDir(async (tempDir) => {
      const report = {
        profile: 'pdf_quality_benchmark',
        score: 1,
      };

      const outputPath = await writeBenchmarkReport(report, {
        argv: ['--output-dir', tempDir],
        env: {},
      });

      expect(outputPath).toBe(path.join(tempDir, 'pdf_quality_benchmark.json'));
      if (!outputPath) {
        throw new Error('Expected benchmark report output path');
      }
      expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(report);
    });
  });
});
