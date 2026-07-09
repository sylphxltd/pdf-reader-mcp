import { describe, expect, it } from 'vitest';
import { attachPdfToolEvidence, buildPdfToolEvidence } from '../../src/evidence/envelope.js';

describe('pdf tool evidence envelope', () => {
  it('builds portfolio-aligned evidence fields for read_pdf', () => {
    const evidence = buildPdfToolEvidence({
      tool: 'read_pdf',
      sources: [{ path: '/tmp/report.pdf' }],
      sourceHash: 'abc123',
      route: 'auto-read-v3',
    });

    expect(evidence.subject).toBe('/tmp/report.pdf');
    expect(evidence.source).toBe('/tmp/report.pdf');
    expect(evidence.sourceHash).toBe('abc123');
    expect(evidence.locator.tool).toBe('read_pdf');
    expect(evidence.route.extraction).toBe('auto-read-v3');
    expect(evidence.confidence).toBe('deterministic');
    expect(evidence.nextActions.length).toBeGreaterThan(0);
  });

  it('attaches evidence without removing legacy payload fields', () => {
    const wrapped = attachPdfToolEvidence({
      tool: 'search_pdf',
      sources: [{ path: '/tmp/report.pdf' }],
      payload: {
        profile: 'pdf_search_results',
        results: [],
      },
    });

    expect(wrapped.evidence.locator.tool).toBe('search_pdf');
    expect(wrapped.profile).toBe('pdf_search_results');
    expect(wrapped.results).toEqual([]);
  });

  it('records pdf_evidence operation in locator and route', () => {
    const evidence = buildPdfToolEvidence({
      tool: 'pdf_evidence',
      operation: 'inspect',
      sources: [{ url: 'https://example.com/file.pdf' }],
    });

    expect(evidence.locator.operation).toBe('inspect');
    expect(evidence.route.operation).toBe('inspect');
    expect(evidence.locator.url).toBe('https://example.com/file.pdf');
  });
});
