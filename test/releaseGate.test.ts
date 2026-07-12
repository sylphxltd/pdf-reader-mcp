import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { buildSotaReleaseGateReport } from '../scripts/sota-release-gate.js';

describe('pdf reader SOTA release gate golden probes', () => {
  it('includes read_pdf golden parity checks in the gate report', async () => {
    const report = await buildSotaReleaseGateReport(
      path.join(import.meta.dirname, '..', 'benchmark-artifacts')
    );

    expect(report.profile).toBe('pdf_sota_release_gate');
    expect(report.checks.some((check) => check.id === 'mcp:rust_web_http_transport')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:http_transport_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:read_pdf_golden_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:rmcp_read_pdf_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:read_pdf_cross_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:http_authority_rust')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:stdio_transport_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:stdio_deletion_prep_gate')).toBe(true);
  });
});
