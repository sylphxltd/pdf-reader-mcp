import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const readText = (path: string) => readFileSync(path, 'utf8');

describe('project control after GroundAtlas package-gate retirement', () => {
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
    expect(doctrine.delivery.productionProof).toContain('local project-manifest readback');
    expect(doctrine.delivery.productionProof).not.toContain('ingested centrally');
  });

  it('keeps the retired package gate out of CI without inventing central proof', () => {
    const workflow = readText('.github/workflows/ci.yml');
    const project = readText('PROJECT.md');
    const specification = readText('docs/specs/project-control-gate.md');
    const historicalAdr = readText('docs/adr/0003-groundatlas-013-scorecard-gate.md');
    const manifest = readJson('project.manifest.json');
    const doctrine = readJson('.doctrine/project.json');

    expect(workflow).not.toContain('SylphxAI/groundatlas');
    expect(workflow).not.toContain('groundatlas-package-dogfood');
    expect(project).toContain('Control Plane ADR-0014');
    expect(project).toContain('does not treat the ownership decision as proof');
    expect(specification).not.toContain('SylphxAI/groundatlas@');
    expect(specification).toContain('Do not re-add a required');
    expect(historicalAdr).toContain('Superseded by Control Plane ADR-0014.');
    expect(
      manifest.surfaces.find((surface: { name: string }) => surface.name === 'CI').description
    ).not.toContain('GroundAtlas package dogfood');
    expect(manifest.adoption.notes).not.toContain('for package/action dogfooding');
    expect(manifest.adoption.notes).toContain('retired by Control Plane ADR-0014');
    expect(doctrine.delivery.productionProof).not.toContain('GroundAtlas package dogfood');
  });
});
