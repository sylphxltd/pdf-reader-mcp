import { beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rustServerBin = path.join(repoRoot, 'target/release/pdf-reader-mcp-server');
const rustCliBin = path.join(repoRoot, 'target/release/pdf-reader-cli');
const stagedRustBin = path.join(repoRoot, 'bin/native/pdf-reader-mcp-server');
const tsEntry = path.join(repoRoot, 'dist/index.js');
const binWrapper = path.join(repoRoot, 'bin/pdf-reader-mcp');
const samplePdf = path.join(repoRoot, 'test/fixtures/sample.pdf');

describe('MCP transport boundary', () => {
  beforeAll(() => {
    execSync('bun run build:rust', { cwd: repoRoot, stdio: 'pipe', timeout: 300_000 });
    execSync('bun run build', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  }, 300_000);

  it('defaults the published bin wrapper to the TypeScript MCP adapter', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('dist/index.js');
    const dryRun = execFileSync(
      'bash',
      ['-c', `grep -v '^#' "${binWrapper}" | tail -n 3`],
      { encoding: 'utf8' }
    );
    expect(dryRun).toContain('exec node');
    expect(dryRun).toContain('$TS_ENTRY');
  });

  it('builds the opt-in rmcp stdio server binary for Phase 4 preview', () => {
    expect(existsSync(rustServerBin)).toBe(true);
    expect(existsSync(stagedRustBin)).toBe(true);
    expect(existsSync(rustCliBin)).toBe(true);
  });

  it('does not ship a TypeScript engine-invoke bridge on the default MCP path', () => {
    expect(existsSync(path.join(repoRoot, 'src/engine-invoke.ts'))).toBe(false);
    expect(existsSync(tsEntry)).toBe(true);
  });

  it('delegates Rust core engine work through pdf-reader-cli JSON boundary', () => {
    const cliProbe = spawnSync(rustCliBin, [], {
      cwd: repoRoot,
      encoding: 'utf8',
      input: JSON.stringify({
        tool: 'pdf_hash',
        input: { path: samplePdf },
      }),
    });
    expect(cliProbe.status).toBe(0);
    const cliEnvelope = JSON.parse(cliProbe.stdout) as {
      status?: string;
      hash?: { sourceHash?: string };
    };
    expect(cliEnvelope.status).toBe('ok');
    expect(cliEnvelope.hash?.sourceHash?.length).toBe(64);
  });

  it('launches the Rust MCP server only when rust transport is requested', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('PDF_READER_MCP_TRANSPORT');
    expect(script).toContain('pdf-reader-mcp-server');
    expect(script).toContain('use_rust_transport');
  });

  it('reports doctor diagnostics from the opt-in Rust MCP entrypoint', () => {
    const result = spawnSync(rustServerBin, ['doctor'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(output).toContain('Rust MCP server');
    expect(output).toContain('engine cli');
  });
});