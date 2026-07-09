import { beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rustServerBin = path.join(repoRoot, 'target/release/pdf-reader-mcp-server');
const stagedRustBin = path.join(repoRoot, 'bin/native/pdf-reader-mcp-server');
const engineInvoke = path.join(repoRoot, 'dist/engine-invoke.js');
const tsEntry = path.join(repoRoot, 'dist/index.js');
const binWrapper = path.join(repoRoot, 'bin/pdf-reader-mcp');

describe('MCP transport boundary', () => {
  beforeAll(() => {
    execSync('bun run build:rust', { cwd: repoRoot, stdio: 'pipe', timeout: 300_000 });
    execSync('bun run build', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  }, 300_000);

  it('defaults the published bin wrapper to the Rust rmcp MCP server', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('pdf-reader-mcp-server');
    expect(script).toContain('bin/native/pdf-reader-mcp-server');
    const dryRun = execFileSync(
      'bash',
      ['-c', `grep -v '^#' "${binWrapper}" | tail -n 6`],
      { encoding: 'utf8' }
    );
    expect(dryRun).toContain('resolve_rust_bin');
    expect(dryRun).not.toMatch(/^\s*exec node "\$TS_ENTRY"/m);
  });

  it('builds and stages the rmcp stdio server binary for npm publish', () => {
    expect(existsSync(rustServerBin)).toBe(true);
    expect(existsSync(stagedRustBin)).toBe(true);
  });

  it('ships the engine bridge for read_pdf and pdf_evidence delegation', () => {
    expect(existsSync(engineInvoke)).toBe(true);
    expect(existsSync(tsEntry)).toBe(true);
  });

  it('reports doctor diagnostics from the default Rust MCP entrypoint', () => {
    const result = spawnSync(rustServerBin, ['doctor'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PDF_READER_ENGINE_SCRIPT: engineInvoke,
      },
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(output).toContain('Rust MCP server');
    expect(output).toContain('engine bridge');
  });

  it('keeps the legacy TypeScript MCP adapter available via ts transport', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('PDF_READER_MCP_TRANSPORT');
    expect(script).toContain('dist/index.js');
    expect(script).toContain('use_ts_transport');
  });
});