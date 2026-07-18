import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSotaReleaseGateReport } from '../scripts/sota-release-gate.js';

describe('pdf reader SOTA release gate golden probes', () => {
  it('includes read_pdf golden parity checks in the gate report', async () => {
    const report = await buildSotaReleaseGateReport(
      path.join(import.meta.dirname, '..', 'benchmark-artifacts')
    );

    expect(report.profile).toBe('pdf_sota_release_gate');
    expect(report.checks.some((check) => check.id === 'mcp:rust_opt_in_boundary')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:production_contract_suite')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:rust_web_http_transport')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:http_transport_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:read_pdf_golden_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:rmcp_read_pdf_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:read_pdf_cross_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:http_gate_script_present')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:stdio_transport_parity')).toBe(true);
    expect(report.checks.some((check) => check.id === 'mcp:stdio_gate_script_present')).toBe(true);
  });

  it('hard-fails the release workflow before changesets can publish', () => {
    const workflow = readFileSync(
      path.join(import.meta.dirname, '..', '.github/workflows/release.yml'),
      'utf8'
    );
    const freeze = workflow.indexOf('- name: Enforce Rust replacement publish freeze');
    const changesets = workflow.indexOf('uses: changesets/action@v1');

    expect(freeze).toBeGreaterThan(-1);
    expect(workflow.slice(freeze, changesets)).toContain('exit 1');
    expect(freeze).toBeLessThan(changesets);
    expect(workflow).not.toContain('publish:');
  });
});
