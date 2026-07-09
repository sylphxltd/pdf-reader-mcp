import { beforeAll, describe, expect, it } from 'bun:test';
import { execFileSync, execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rustServerBin = path.join(repoRoot, 'target/release/pdf-reader-mcp-server');
const engineInvoke = path.join(repoRoot, 'dist/engine-invoke.js');
describe('Rust MCP transport boundary', () => {
  beforeAll(() => {
    execSync('cargo build -q --release -p pdf-reader-mcp-server', {
      cwd: repoRoot,
      stdio: 'pipe',
      timeout: 180_000,
    });
    execSync('bun run build', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  }, 180_000);

  it('builds the rmcp stdio server binary', () => {
    expect(existsSync(rustServerBin)).toBe(true);
  });

  it('ships the TypeScript engine bridge for unmigrated pdfjs routes', () => {
    expect(existsSync(engineInvoke)).toBe(true);
  });

  it('reports doctor diagnostics from the Rust MCP entrypoint', () => {
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

  it('keeps the TypeScript MCP adapter out of the default bin wrapper', () => {
    const wrapper = path.join(repoRoot, 'bin/pdf-reader-mcp');
    const script = execFileSync('bash', ['-c', `grep -v '^#' "${wrapper}" | head -n 40`], {
      encoding: 'utf8',
    });
    expect(script).toContain('pdf-reader-mcp-server');
    expect(script).toContain('legacy TypeScript MCP transport');
  });
});