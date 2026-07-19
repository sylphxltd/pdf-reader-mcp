import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

describe('pdf-reader-mcp differential harness (rej-010)', () => {
  it('ships fail-closed differential entrypoint and oracle artifacts', () => {
    expect(existsSync(path.join(repoRoot, 'scripts/run-pdf-reader-differential.sh'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'scripts/differential/pdf-reader-mcp-oracle.ts'))).toBe(
      true
    );
    expect(
      existsSync(path.join(repoRoot, 'scripts/differential/fixtures/pdf-reader-mcp-corpus.json'))
    ).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'scripts/differential/fixtures/v3014-behavior-oracle.json'))
    ).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'scripts/differential/check-v3014-behavior-differential.ts'))
    ).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'scripts/differential/fixtures/v3014-visual-oracle.json'))
    ).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'scripts/differential/check-v3014-visual-differential.ts'))
    ).toBe(true);
    expect(
      existsSync(
        path.join(repoRoot, 'crates/pdf-reader-mcp-server/tests/pdf_reader_mcp_differential.rs')
      )
    ).toBe(true);
  });

  it('parity slice manifest binds read_pdf and stdio transport domains', () => {
    const slice = JSON.parse(
      readFileSync(path.join(repoRoot, 'docs/specs/pdf-reader-mcp-parity-slice.json'), 'utf8')
    ) as {
      slice: string;
      differentialHarness: string;
      domains: Array<{ id: string; differentialTest: boolean }>;
    };

    expect(slice.slice).toContain('tool.read_pdf');
    expect(slice.slice).toContain('tool.search_pdf');
    expect(slice.slice).toContain('tool.pdf_evidence');
    expect(slice.slice).toContain('transport.stdio-rust-rmcp');
    expect(slice.differentialHarness).toBe('scripts/run-pdf-reader-differential.sh');
    expect(slice.domains.some((domain) => domain.id === 'tool/read_pdf')).toBe(true);
    expect(slice.domains.some((domain) => domain.id === 'tool/search_pdf')).toBe(true);
    expect(slice.domains.some((domain) => domain.id === 'tool/pdf_evidence')).toBe(true);
    expect(slice.domains.some((domain) => domain.id === 'transport/stdio-rust-rmcp')).toBe(true);
  });

  it('corpus includes search_pdf and pdf_evidence stdioProbe live transport cases', () => {
    const corpus = JSON.parse(
      readFileSync(
        path.join(repoRoot, 'scripts/differential/fixtures/pdf-reader-mcp-corpus.json'),
        'utf8'
      )
    ) as {
      stdioProbeCases?: Array<{ id: string; kind: string }>;
    };

    expect(corpus.stdioProbeCases?.some((probe) => probe.kind === 'searchPdf')).toBe(true);
    expect(corpus.stdioProbeCases?.some((probe) => probe.kind === 'pdfEvidence')).toBe(true);
  });
});
