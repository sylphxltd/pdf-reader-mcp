import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const readText = (path: string) => readFileSync(path, 'utf8');

describe('GroundAtlas project control', () => {
  it('keeps the vendor-neutral manifest separate from the Doctrine adapter', () => {
    const manifest = readJson('project.manifest.json');
    const doctrine = readJson('.doctrine/project.json');

    expect(manifest.project.id).toBe('pdf-reader-mcp');
    expect(manifest.surfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '.doctrine/project.json',
          description: expect.stringContaining('not the vendor-neutral GroundAtlas default'),
        }),
      ])
    );
    expect(doctrine.boundaries.publicSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Vendor-neutral GroundAtlas project manifest',
          location: 'project.manifest.json',
        }),
      ])
    );
    expect(doctrine.delivery.productionProof).toContain('GroundAtlas package dogfood');
  });

  it('dogfoods GroundAtlas 0.1.3 JSON and Markdown scorecard outputs in CI', () => {
    const workflow = readText('.github/workflows/ci.yml');

    expect(workflow).toContain('uses: SylphxAI/groundatlas@v0.1.3');
    expect(workflow).toContain('package-spec: groundatlas@0.1.3');
    expect(workflow).toContain('fleet-markdown-report-path');
    expect(workflow).toContain('groundatlas-package-dogfood');
    expect(workflow).toContain('project.manifest.json');
    expect(workflow).toContain('.doctrine/project.json');
    expect(workflow).toContain('# GroundAtlas fleet adoption report');
    expect(workflow).toContain('Summary: 1 adopted, 0 warning, 0 blocked, 1 total.');
  });
});
