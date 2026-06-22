import { describe, expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  buildProviderManifestBenchmarkReport,
  resolveProviderManifestBenchmarkOptions,
} from '../../scripts/benchmark-pdf-provider-manifest.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const execFileAsync = promisify(execFile);
const CLI_TEST_TIMEOUT_MS = 20_000;

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-provider-manifest-test-'));
  try {
    return await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const writeJson = (filePath: string, value: JsonValue) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const childEnvWithoutRegionProvider = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  Reflect.deleteProperty(env, 'MCP_PDF_REGION_ANALYSIS_COMMAND');
  Reflect.deleteProperty(env, 'MCP_PDF_REGION_ANALYSIS_ARGS_JSON');
  Reflect.deleteProperty(env, 'MCP_PDF_REGION_ANALYSIS_HTTP_URL');
  Reflect.deleteProperty(env, 'MCP_PDF_REGION_ANALYSIS_PRESET');
  return env;
};

describe('provider manifest benchmark', () => {
  test(
    'scores external visual-region provider manifest cases',
    async () => {
      await withTempDir(async (tempDir) => {
        const providerPath = path.join(tempDir, 'mock-provider.mjs');
        fs.writeFileSync(
          providerPath,
          [
            "import fs from 'node:fs';",
            "const inputPath = process.argv[2] ?? '';",
            "const regionId = process.argv[4] ?? '';",
            'if (!fs.existsSync(inputPath)) process.exit(2);',
            'const outputs = {',
            "  'public-region': {",
            "    kind: 'image',",
            "    description: 'Dashboard image with evidence map and citation panel.',",
            "    text: 'Dashboard evidence citation map',",
            '    confidence: 0.91',
            '  }',
            '};',
            "process.stdout.write(JSON.stringify(outputs[regionId] ?? { kind: 'unknown', confidence: 0.5 }));",
          ].join('\n'),
          'utf8'
        );

        const manifestPath = path.join(tempDir, 'provider-manifest.json');
        writeJson(manifestPath, {
          cases: [
            {
              id: 'local-provider-case',
              path: path.resolve('test/fixtures/sample.pdf'),
              source_label: 'local provider manifest fixture',
              source_rights: 'test fixture',
              document_archetype: 'local visual provider fixture',
              capability_tags: ['visual_text', 'document_twin'],
              regions: [
                {
                  id: 'public-region',
                  page: 1,
                  bounding_box: { left: 0, bottom: 0, right: 612, top: 792 },
                  capability_tags: ['full_page_crop'],
                  expected: {
                    kind: 'image',
                    contains_text: ['dashboard', 'citation'],
                    min_confidence: 0.9,
                  },
                },
              ],
            },
          ],
        });

        const outputDir = path.join(tempDir, 'artifacts');
        await execFileAsync(
          'bun',
          ['scripts/benchmark-pdf-provider-manifest.ts', '--provider-manifest', manifestPath],
          {
            env: {
              ...childEnvWithoutRegionProvider(),
              MCP_PDF_REGION_ANALYSIS_COMMAND: 'bun',
              MCP_PDF_REGION_ANALYSIS_ARGS_JSON: JSON.stringify([
                providerPath,
                '{input}',
                '{page}',
                '{region_id}',
              ]),
              MCP_PDF_BENCHMARK_OUTPUT_DIR: outputDir,
            },
            maxBuffer: 10 * 1024 * 1024,
          }
        );
        const report = JSON.parse(
          fs.readFileSync(path.join(outputDir, 'pdf_provider_manifest_benchmark.json'), 'utf8')
        ) as Awaited<ReturnType<typeof buildProviderManifestBenchmarkReport>>;

        expect(report.status).toBe('passed');
        expect(report.summary).toMatchObject({
          case_count: 1,
          region_count: 1,
          failed_assertion_count: 0,
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
    },
    CLI_TEST_TIMEOUT_MS
  );

  test('skips when no provider manifest is configured unless strict', async () => {
    const skipped = await buildProviderManifestBenchmarkReport();
    const strict = await buildProviderManifestBenchmarkReport({ strict: true });

    expect(skipped.status).toBe('skipped');
    expect(strict.status).toBe('failed');
  });

  test(
    'fails when a configured provider manifest has no cases',
    async () => {
      await withTempDir(async (tempDir) => {
        const providerPath = path.join(tempDir, 'mock-provider.mjs');
        fs.writeFileSync(providerPath, "process.stdout.write('{}');\n", 'utf8');
        const manifestPath = path.join(tempDir, 'empty-provider-manifest.json');
        const outputDir = path.join(tempDir, 'artifacts');
        writeJson(manifestPath, { cases: [] });

        await expect(
          execFileAsync(
            'bun',
            ['scripts/benchmark-pdf-provider-manifest.ts', '--provider-manifest', manifestPath],
            {
              env: {
                ...childEnvWithoutRegionProvider(),
                MCP_PDF_REGION_ANALYSIS_COMMAND: 'bun',
                MCP_PDF_REGION_ANALYSIS_ARGS_JSON: JSON.stringify([providerPath]),
                MCP_PDF_BENCHMARK_OUTPUT_DIR: outputDir,
              },
              maxBuffer: 10 * 1024 * 1024,
            }
          )
        ).rejects.toThrow();

        const report = JSON.parse(
          fs.readFileSync(path.join(outputDir, 'pdf_provider_manifest_benchmark.json'), 'utf8')
        ) as Awaited<ReturnType<typeof buildProviderManifestBenchmarkReport>>;
        expect(report.status).toBe('failed');
        expect(report.summary.case_count).toBe(0);
        expect(report.external_case_count).toBe(0);
      });
    },
    CLI_TEST_TIMEOUT_MS
  );

  test(
    'fails when a manifest is supplied with invalid provider configuration',
    async () => {
      await withTempDir(async (tempDir) => {
        const manifestPath = path.join(tempDir, 'provider-manifest.json');
        writeJson(manifestPath, {
          cases: [
            {
              id: 'local-provider-case',
              path: path.resolve('test/fixtures/sample.pdf'),
              regions: [
                {
                  id: 'public-region',
                  page: 1,
                  bounding_box: { left: 0, bottom: 0, right: 612, top: 792 },
                  expected: { contains_text: ['sample'] },
                },
              ],
            },
          ],
        });
        const outputDir = path.join(tempDir, 'artifacts');

        await expect(
          execFileAsync(
            'bun',
            ['scripts/benchmark-pdf-provider-manifest.ts', '--provider-manifest', manifestPath],
            {
              env: {
                ...childEnvWithoutRegionProvider(),
                MCP_PDF_REGION_ANALYSIS_PRESET: 'unsupported-provider',
                MCP_PDF_BENCHMARK_OUTPUT_DIR: outputDir,
              },
              maxBuffer: 10 * 1024 * 1024,
            }
          )
        ).rejects.toThrow();

        const report = JSON.parse(
          fs.readFileSync(path.join(outputDir, 'pdf_provider_manifest_benchmark.json'), 'utf8')
        ) as Awaited<ReturnType<typeof buildProviderManifestBenchmarkReport>>;
        expect(report.status).toBe('failed');
        expect(report.provider_status?.readiness).toBe('invalid_configuration');
      });
    },
    CLI_TEST_TIMEOUT_MS
  );

  test('resolves CLI and environment options', () => {
    expect(
      resolveProviderManifestBenchmarkOptions(
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
