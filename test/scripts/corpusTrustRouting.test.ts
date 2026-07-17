import { describe, expect, test } from 'bun:test';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const corpusScript = path.join(repoRoot, 'scripts/benchmark-pdf-corpus.ts');

/**
 * Handler suites mock `pdfjs-dist` process-wide via `vi.mock`. Under
 * `bun test --coverage` that mock leaks into later files in the same process
 * and collapses this real-PDF.js trust-routing probe. Run the probe in an
 * isolated subprocess so the check always sees the real loader.
 */
describe('corpus trust-routing archetypes', () => {
  test('covers malformed and encrypted PDF failure envelopes', async () => {
    const evalSource = `
        import { buildCorpusBenchmarkReport } from ${JSON.stringify(corpusScript)};
        const report = await buildCorpusBenchmarkReport();
        const malformed = report.cases.find((entry) => entry.id === 'runtime-malformed-pdf-trust-routing');
        const encrypted = report.cases.find((entry) => entry.id === 'runtime-encrypted-pdf-trust-routing');
        const trust = report.capability_summary.find((entry) => entry.tag === 'trust_routing');
        console.log(JSON.stringify({
          malformedScore: malformed?.score ?? null,
          encryptedScore: encrypted?.score ?? null,
          trustStatus: trust?.status ?? null,
        }));
      `;

    const proc = Bun.spawn(['bun', '--eval', evalSource], {
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode, `corpus probe failed:\n${stderr}\n${stdout}`).toBe(0);

    const lines = stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('{'));
    const lastLine = lines[lines.length - 1];
    expect(lastLine, `missing probe JSON in stdout:\n${stdout}`).toBeDefined();

    const payload = JSON.parse(lastLine as string) as {
      malformedScore: number | null;
      encryptedScore: number | null;
      trustStatus: string | null;
    };

    expect(payload.malformedScore).toBe(1);
    expect(payload.encryptedScore).toBe(1);
    expect(payload.trustStatus).toBe('passed');
  }, 60_000);
});
