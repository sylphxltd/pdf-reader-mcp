import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSotaReleaseGateReport } from '../scripts/sota-release-gate.js';

describe('pdf reader SOTA release gate golden probes', () => {
  it(
    'includes read_pdf golden parity checks in the gate report',
    async () => {
      const report = await buildSotaReleaseGateReport(
        path.join(import.meta.dirname, '..', 'benchmark-artifacts')
      );

      expect(report.profile).toBe('pdf_sota_release_gate');
      expect(report.checks.some((check) => check.id === 'mcp:sole_rust_launcher_boundary')).toBe(
        true
      );
      expect(report.checks.some((check) => check.id === 'mcp:production_contract_suite')).toBe(
        true
      );
      expect(report.checks.some((check) => check.id === 'mcp:rust_web_http_transport')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:http_transport_parity')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:read_pdf_golden_parity')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:rmcp_read_pdf_parity')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:read_pdf_cross_parity')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:http_gate_script_present')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:stdio_transport_parity')).toBe(true);
      expect(report.checks.some((check) => check.id === 'mcp:stdio_gate_script_present')).toBe(
        true
      );
    },
    { timeout: 120_000 }
  );

  it('enforces verified-candidate admission before changesets can publish', () => {
    const workflow = readFileSync(
      path.join(import.meta.dirname, '..', '.github/workflows/release.yml'),
      'utf8'
    );
    const publishNpm = readFileSync(
      path.join(import.meta.dirname, '..', '.github/workflows/publish-npm.yml'),
      'utf8'
    );
    // Trunk Release is post-merge (often squash); do not require exact PR tip SHA.
    const admission = workflow.indexOf('- name: Enforce verified-candidate admission (trunk)');
    const changesets = workflow.indexOf('uses: changesets/action@v1');

    expect(admission).toBeGreaterThan(-1);
    expect(workflow.slice(admission, changesets)).toContain(
      'bun scripts/check-verified-candidate-admission.ts'
    );
    expect(workflow.slice(admission, changesets)).not.toContain('--require-exact-head');
    expect(admission).toBeLessThan(changesets);
    // Intentional package publish still pins exact reviewed head.
    expect(publishNpm).toContain(
      'bun scripts/check-verified-candidate-admission.ts --require-exact-head'
    );
    // Stage A authorizes registry publish under admission; keep TS default by not
    // wiring a direct npm publish step into the release workflow.
    expect(workflow).not.toContain('publish:');
    expect(workflow).not.toContain('Enforce Rust replacement publish freeze');
  });
});
