import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const readText = (path: string) => readFileSync(path, 'utf8');

describe('project control (Skills + project manifest v2)', () => {
  it('uses project.manifest.json as sole machine fact authority', () => {
    const manifest = readJson('project.manifest.json');
    const project = readText('PROJECT.md');
    const agents = readText('AGENTS.md');

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.kind).toBe('ProjectManifest');
    expect(manifest.project.id).toBe('pdf-reader-mcp');
    expect(manifest.project.lifecycle).toBe('production');
    expect(manifest.adoption.status).not.toBe('adopted');
    expect(Array.isArray(manifest.adoption.gaps)).toBe(true);
    expect(manifest.adoption.gaps.length).toBeGreaterThan(0);
    expect(manifest.architecture.capabilities).toEqual(
      expect.arrayContaining([
        'document-intelligence-mcp-contract',
        'local-document-processing-engine',
      ])
    );
    expect(manifest.delivery.deployable).toBe(false);
    expect(manifest.delivery.packageRelease.producer).toBe(true);
    expect(manifest.boundaries.forbiddenCouplings.join('\n')).toMatch(/Doctrine|GroundAtlas/i);

    expect(project).toContain('project.manifest.json');
    expect(project).toContain('SylphxAI/skills');
    // Product may publish a thin portfolio-compatible .doctrine/project.json, but
    // project.manifest.json remains the product machine fact authority.
    expect(agents).toContain('project.manifest.json');
  });

  it('does not restore Doctrine adapter or GroundAtlas package dogfood', () => {
    const workflow = readText('.github/workflows/ci.yml');
    const project = readText('PROJECT.md');
    const specification = readText('docs/specs/project-control-gate.md');
    const historicalAdr = readText('docs/adr/0003-groundatlas-013-scorecard-gate.md');
    const manifest = readJson('project.manifest.json');

    // Thin portfolio catalog manifest is allowed; GroundAtlas/doctrine dogfood is not.
    if (existsSync('.doctrine/project.json')) {
      const doctrine = readJson('.doctrine/project.json');
      expect(doctrine.schemaVersion).toBe(1);
      expect(doctrine.project.repo).toBe('SylphxAI/pdf-reader-mcp');
      expect(JSON.stringify(doctrine)).not.toMatch(/groundatlas/i);
    }
    expect(workflow).not.toContain('SylphxAI/groundatlas');
    expect(workflow).not.toContain('groundatlas-package-dogfood');
    expect(project).toContain('Control Plane ADR-0014');
    expect(project).toMatch(/retired historical lineage/i);
    expect(specification).not.toContain('SylphxAI/groundatlas@');
    expect(specification).toMatch(
      /must not be restored|fail tests if.*GroundAtlas package dogfood/i
    );
    expect(specification).toContain('project-manifest-standard');
    expect(historicalAdr).toContain('Superseded by Control Plane ADR-0014.');
    // Retired lineage may be named in gaps/forbiddens; must not be schema or adapter path.
    expect(manifest.$schema).toContain('project-manifest-standard');
    expect(manifest.$schema).not.toContain('groundatlas');
  });
});
