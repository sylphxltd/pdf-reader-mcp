import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(__dirname, '../../scripts/reference-region-analysis-provider.mjs');

const withInputImage = async <T>(run: (inputPath: string) => T): Promise<T> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-reference-provider-'));
  try {
    const inputPath = path.join(tempDir, 'crop.png');
    fs.writeFileSync(inputPath, Buffer.from([0]));
    return run(inputPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const runReferenceProvider = async (regionId: string): Promise<Record<string, unknown>> =>
  withInputImage((inputPath) => {
    const result = Bun.spawnSync([process.execPath, scriptPath, inputPath, '1', regionId, 'eng']);
    expect(result.exitCode).toBe(0);
    return JSON.parse(result.stdout.toString()) as Record<string, unknown>;
  });

describe('reference region analysis provider', () => {
  test('emits visual certification evidence for every final-bar fixture kind', async () => {
    const table = await runReferenceProvider('cert-table');
    const formula = await runReferenceProvider('cert-formula');
    const chart = await runReferenceProvider('cert-chart');
    const figure = await runReferenceProvider('cert-figure');
    const image = await runReferenceProvider('cert-image');

    expect(table).toMatchObject({
      kind: 'table',
      table: {
        row_count: 3,
        column_count: 2,
      },
    });
    expect(
      Array.isArray((table.table as { cells?: unknown[] }).cells) &&
        ((table.table as { cells: unknown[] }).cells?.length ?? 0) >= 4
    ).toBe(true);
    expect(formula).toMatchObject({
      kind: 'formula',
      formula: {
        latex: 'E = mc^2',
        asciimath: 'E = mc^2',
      },
    });
    expect(chart).toMatchObject({
      kind: 'chart',
      chart: {
        x_axis: { label: 'Quarter' },
        y_axis: { label: 'Revenue' },
      },
    });
    expect(figure).toMatchObject({
      kind: 'figure',
      text: expect.stringContaining('Pipeline figure'),
    });
    expect(image).toMatchObject({
      kind: 'image',
      text: expect.stringContaining('Office image'),
    });
  });
});
