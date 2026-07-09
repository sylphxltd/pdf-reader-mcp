import { describe, expect, it } from 'bun:test';
import { runDoctor } from '../src/doctor.js';

describe('pdf reader doctor', () => {
  it('reports install diagnostics with pdfjs resources and sample probe', async () => {
    const report = await runDoctor('test');
    expect(report.profile).toBe('pdf_reader_doctor');
    expect(report.checks.some((check) => check.id === 'pdfjs_resources')).toBe(true);
    expect(report.checks.some((check) => check.id === 'sample_probe')).toBe(true);
    expect(report.checks.find((check) => check.id === 'pdfjs_resources')?.status).toBe('ok');
    expect(report.checks.find((check) => check.id === 'sample_probe')?.status).toBe('ok');
    expect(['ready', 'degraded']).toContain(report.status);
  });
});