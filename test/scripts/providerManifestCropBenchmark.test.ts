import { describe, expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  buildProviderManifestCropBenchmarkReport,
  resolveProviderManifestCropBenchmarkOptions,
} from '../../scripts/benchmark-pdf-provider-manifest-crops.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const execFileAsync = promisify(execFile);

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-provider-crop-test-'));
  try {
    return await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const writeJson = (filePath: string, value: JsonValue) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const childEnvWithoutSecurityPolicy = (outputDir: string): NodeJS.ProcessEnv => {
  const env = {
    ...process.env,
    MCP_PDF_BENCHMARK_OUTPUT_DIR: outputDir,
  };
  Reflect.deleteProperty(env, 'MCP_PDF_ALLOWED_DIRS');
  Reflect.deleteProperty(env, 'MCP_PDF_ALLOW_HTTP');
  Reflect.deleteProperty(env, 'MCP_PDF_ALLOWED_HOSTS');
  return env;
};

const readCropReport = (outputDir: string) =>
  JSON.parse(
    fs.readFileSync(path.join(outputDir, 'pdf_provider_manifest_crop_benchmark.json'), 'utf8')
  ) as Awaited<ReturnType<typeof buildProviderManifestCropBenchmarkReport>>;

const runCropBenchmarkCli = async (manifestPath: string, outputDir: string) => {
  await execFileAsync(
    'bun',
    ['scripts/benchmark-pdf-provider-manifest-crops.ts', '--provider-manifest', manifestPath],
    {
      env: childEnvWithoutSecurityPolicy(outputDir),
      maxBuffer: 10 * 1024 * 1024,
    }
  );
};

const writeLocalCropManifest = (manifestPath: string) => {
  writeJson(manifestPath, {
    cases: [
      {
        id: 'local-crop-case',
        path: path.resolve('test/fixtures/sample.pdf'),
        source_label: 'local crop manifest fixture',
        source_rights: 'test fixture',
        document_archetype: 'local public crop fixture',
        capability_tags: ['visual_text', 'document_twin'],
        regions: [
          {
            id: 'public-region',
            page: 1,
            bounding_box: { left: 0, bottom: 0, right: 612, top: 792 },
            capability_tags: ['full_page_crop'],
            expected: { contains_text: ['sample'] },
          },
        ],
      },
    ],
  });
};

describe('provider manifest crop benchmark', () => {
  test('verifies manifest crops without a visual-region provider', async () => {
    await withTempDir(async (tempDir) => {
      const manifestPath = path.join(tempDir, 'provider-manifest.json');
      const outputDir = path.join(tempDir, 'artifacts');
      writeLocalCropManifest(manifestPath);

      await runCropBenchmarkCli(manifestPath, outputDir);
      const report = readCropReport(outputDir);

      expect(report.status).toBe('passed');
      expect(report.profile).toBe('pdf_provider_manifest_crop_benchmark');
      expect(report.summary).toMatchObject({
        case_count: 1,
        region_count: 1,
        failed_assertion_count: 0,
      });
      expect(report.cases[0]?.regions[0]?.crop).toMatchObject({
        evidence_id: 'page-1-public-region-crop-scale-2',
        byte_length: expect.any(Number),
      });
      expect(report.cases[0]?.regions[0]?.assertions.map((assertion) => assertion.id)).toContain(
        'public-region:crop-provenance'
      );
      expect(report.cases[0]?.capability_tags).toEqual([
        'visual_text',
        'document_twin',
        'full_page_crop',
      ]);
      expect(report.capability_summary.map((entry) => entry.tag)).toEqual([
        'document_twin',
        'full_page_crop',
        'visual_text',
      ]);
      expect(report.capability_summary.every((entry) => entry.status === 'passed')).toBe(true);
    });
  });

  test('CLI writes the provider manifest crop artifact', async () => {
    await withTempDir(async (tempDir) => {
      const manifestPath = path.join(tempDir, 'provider-manifest.json');
      const outputDir = path.join(tempDir, 'artifacts');
      writeLocalCropManifest(manifestPath);

      await runCropBenchmarkCli(manifestPath, outputDir);
      const report = readCropReport(outputDir);

      expect(report.status).toBe('passed');
      expect(report.external_case_count).toBe(1);
      expect(report.external_region_count).toBe(1);
      expect(report.cases[0]?.regions[0]?.crop?.byte_length).toBeGreaterThan(0);
    });
  });

  test('skips when no manifest is configured unless strict crop evidence is required', async () => {
    const skipped = await buildProviderManifestCropBenchmarkReport();
    const strict = await buildProviderManifestCropBenchmarkReport({ strict: true });

    expect(skipped.status).toBe('skipped');
    expect(strict.status).toBe('failed');
  });

  test('fails when a crop manifest has no cases', async () => {
    await withTempDir(async (tempDir) => {
      const manifestPath = path.join(tempDir, 'empty-provider-manifest.json');
      writeJson(manifestPath, { cases: [] });

      const report = await buildProviderManifestCropBenchmarkReport({ manifestPath });

      expect(report.status).toBe('failed');
      expect(report.summary.case_count).toBe(0);
      expect(report.external_case_count).toBe(0);
    });
  });

  test('fails when declared regions cannot be cropped', async () => {
    await withTempDir(async (tempDir) => {
      const manifestPath = path.join(tempDir, 'provider-manifest.json');
      writeJson(manifestPath, {
        cases: [
          {
            id: 'invalid-crop-case',
            path: path.resolve('test/fixtures/sample.pdf'),
            document_archetype: 'invalid crop fixture',
            capability_tags: ['visual_text'],
            regions: [
              {
                id: 'bad-region',
                page: 999,
                bounding_box: { left: 0, bottom: 0, right: 612, top: 792 },
                capability_tags: ['full_page_crop'],
              },
            ],
          },
        ],
      });

      const outputDir = path.join(tempDir, 'artifacts');
      await expect(runCropBenchmarkCli(manifestPath, outputDir)).rejects.toThrow();
      const report = readCropReport(outputDir);

      expect(report.status).toBe('failed');
      expect(report.summary.failed_assertion_count).toBe(1);
      expect(report.cases[0]?.regions[0]?.assertions[0]?.id).toBe('invalid-crop-case:runtime');
    });
  });

  test('resolves CLI and environment options', () => {
    expect(
      resolveProviderManifestCropBenchmarkOptions(
        [
          '--provider-manifest',
          'corpus/provider.json',
          '--provider-manifest-cache-dir=/tmp/pdf-cache',
          '--allow-provider-manifest-downloads',
          '--allow-private-ips',
          '--strict',
        ],
        {}
      )
    ).toMatchObject({
      manifestPath: 'corpus/provider.json',
      cacheDir: '/tmp/pdf-cache',
      allowDownloads: true,
      allowPrivateIps: true,
      strict: true,
    });
  });
});
