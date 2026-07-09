import { describe, expect, test } from 'bun:test';
import { buildCorpusBenchmarkReport } from '../../scripts/benchmark-pdf-corpus.js';

describe('corpus trust-routing archetypes', () => {
  test('covers malformed and encrypted PDF failure envelopes', async () => {
    const report = await buildCorpusBenchmarkReport();
    const malformed = report.cases.find((entry) => entry.id === 'runtime-malformed-pdf-trust-routing');
    const encrypted = report.cases.find((entry) => entry.id === 'runtime-encrypted-pdf-trust-routing');

    expect(malformed?.score).toBe(1);
    expect(encrypted?.score).toBe(1);
    expect(malformed?.capability_tags).toContain('malformed_pdf');
    expect(encrypted?.capability_tags).toContain('encrypted_pdf');
    expect(report.capability_summary).toContainEqual(
      expect.objectContaining({ tag: 'trust_routing', status: 'passed' })
    );
  }, 30_000);
});