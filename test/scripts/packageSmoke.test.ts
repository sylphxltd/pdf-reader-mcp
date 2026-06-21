import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findPackedTarballPath, validateExtractedPackage } from '../../scripts/package-smoke.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const withTempDir = async <T>(run: (tempDir: string) => Promise<T>): Promise<T> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-package-smoke-test-'));
  try {
    return await run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const writeJson = (filePath: string, value: JsonValue) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeExtractedPackage = (packageDir: string, includeRuntime = true) => {
  fs.mkdirSync(path.join(packageDir, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(packageDir, 'corpus'), { recursive: true });
  writeJson(path.join(packageDir, 'package.json'), {
    name: '@sylphx/pdf-reader-mcp',
    version: '0.0.0-smoke',
    bin: {
      'pdf-reader-mcp': './dist/index.js',
    },
    exports: {
      '.': './dist/index.js',
    },
    files: ['dist/', 'corpus/', 'README.md', 'LICENSE'],
  });
  writeJson(path.join(packageDir, 'corpus', 'public-url-corpus.json'), {
    cases: [
      {
        id: 'public-smoke',
        url: 'https://example.com/public-smoke.pdf',
        sha256: 'a'.repeat(64),
        source_label: 'public smoke fixture',
        source_homepage: 'https://example.com/',
        source_rights: 'test fixture',
        source_retrieved_at: '2026-06-21',
        capability_tags: [
          'accessibility_guidance',
          'document_map',
          'fillable_form',
          'government_newsletter',
          'image_plus_text',
          'legacy_scan',
          'official_form',
          'public_domain_text',
          'selectable_text',
          'technical_report',
          'text_layer',
          'visual_text',
        ],
      },
    ],
  });
  writeJson(path.join(packageDir, 'corpus', 'public-provider-accuracy.json'), {
    cases: [
      {
        id: 'provider-smoke',
        url: 'https://example.com/provider-smoke.pdf',
        sha256: 'b'.repeat(64),
        source_label: 'provider smoke fixture',
        source_homepage: 'https://example.com/',
        source_rights: 'test fixture',
        source_retrieved_at: '2026-06-21',
        capability_tags: ['accessibility_diagram', 'image_plus_text', 'legacy_scan', 'visual_text'],
        regions: [
          {
            id: 'provider-region',
            page: 1,
            bounding_box: { left: 0, bottom: 0, right: 100, top: 100 },
            capability_tags: [
              'diagram_context',
              'full_page_crop',
              'layout_diagram',
              'scanned_page_triage',
            ],
            expected: { contains_text: ['provider'] },
          },
        ],
      },
    ],
  });
  if (includeRuntime) {
    fs.writeFileSync(
      path.join(packageDir, 'dist', 'index.js'),
      '#!/usr/bin/env node\nconsole.log("smoke");\n',
      'utf8'
    );
  }
};

describe('package smoke', () => {
  test('validates the packed package runtime contract', async () => {
    await withTempDir(async (tempDir) => {
      writeExtractedPackage(tempDir);

      const checks = await validateExtractedPackage(tempDir);

      expect(checks.every((check) => check.status === 'passed')).toBe(true);
    });
  });

  test('fails when the runtime artifact is missing', async () => {
    await withTempDir(async (tempDir) => {
      writeExtractedPackage(tempDir, false);

      const checks = await validateExtractedPackage(tempDir);

      expect(checks.find((check) => check.id === 'runtime:dist-index')?.status).toBe('failed');
    });
  });

  test('fails when public corpus capability coverage is missing', async () => {
    await withTempDir(async (tempDir) => {
      writeExtractedPackage(tempDir);
      writeJson(path.join(tempDir, 'corpus', 'public-url-corpus.json'), {
        cases: [
          {
            id: 'public-smoke',
            url: 'https://example.com/public-smoke.pdf',
            sha256: 'a'.repeat(64),
            source_label: 'public smoke fixture',
            source_homepage: 'https://example.com/',
            source_rights: 'test fixture',
            source_retrieved_at: '2026-06-21',
            capability_tags: ['selectable_text'],
          },
        ],
      });

      const checks = await validateExtractedPackage(tempDir);

      const publicCorpusCheck = checks.find(
        (check) => check.id === 'corpus:public-url-manifest-shape'
      );
      expect(publicCorpusCheck?.status).toBe('failed');
      expect(publicCorpusCheck?.evidence?.missing_required_capability_tags).toContain(
        'legacy_scan'
      );
    });
  });

  test('fails when public provider capability coverage is missing', async () => {
    await withTempDir(async (tempDir) => {
      writeExtractedPackage(tempDir);
      writeJson(path.join(tempDir, 'corpus', 'public-provider-accuracy.json'), {
        cases: [
          {
            id: 'provider-smoke',
            url: 'https://example.com/provider-smoke.pdf',
            sha256: 'b'.repeat(64),
            source_label: 'provider smoke fixture',
            source_homepage: 'https://example.com/',
            source_rights: 'test fixture',
            source_retrieved_at: '2026-06-21',
            capability_tags: ['visual_text'],
            regions: [
              {
                id: 'provider-region',
                page: 1,
                bounding_box: { left: 0, bottom: 0, right: 100, top: 100 },
                capability_tags: ['full_page_crop'],
                expected: { contains_text: ['provider'] },
              },
            ],
          },
        ],
      });

      const checks = await validateExtractedPackage(tempDir);

      const publicProviderCheck = checks.find(
        (check) => check.id === 'corpus:public-provider-manifest-shape'
      );
      expect(publicProviderCheck?.status).toBe('failed');
      expect(publicProviderCheck?.evidence?.missing_required_capability_tags).toContain(
        'scanned_page_triage'
      );
    });
  });

  test('finds the tarball path from bun pack output or destination contents', async () => {
    await withTempDir(async (tempDir) => {
      const tarballPath = path.join(tempDir, 'package.tgz');
      fs.writeFileSync(tarballPath, 'tgz', 'utf8');

      await expect(findPackedTarballPath(`\n${tarballPath}\n`, tempDir)).resolves.toBe(tarballPath);
      await expect(findPackedTarballPath('', tempDir)).resolves.toBe(tarballPath);
    });
  });
});
