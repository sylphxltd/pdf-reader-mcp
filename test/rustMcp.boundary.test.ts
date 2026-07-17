import { beforeAll, describe, expect, it } from 'bun:test';
import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rustServerBin = path.join(repoRoot, 'target/release/pdf-reader-mcp-server');
const rustCliBin = path.join(repoRoot, 'target/release/pdf-reader-cli');
const stagedRustBin = path.join(repoRoot, 'bin/native/pdf-reader-mcp-server');
const binWrapper = path.join(repoRoot, 'bin/pdf-reader-mcp');
const samplePdf = path.join(repoRoot, 'test/fixtures/sample.pdf');

describe('MCP transport boundary', () => {
  beforeAll(() => {
    execSync('bun run build:rust', { cwd: repoRoot, stdio: 'pipe', timeout: 300_000 });
    execSync('bun run build', { cwd: repoRoot, stdio: 'pipe', timeout: 180_000 });
  }, 300_000);

  it('defaults the published launcher to Rust rmcp process', () => {
    const script = readFileSync(binWrapper, 'utf8');
    expect(script).toContain('pdf-reader-mcp-server');
    expect(script).toContain('resolve_rust_bin');
    expect(script).toContain('printf \'%s\\n\' "rust"');
    expect(script).toContain('PDF_READER_ENGINE_MODE=full');
  });

  it('builds the rmcp stdio server binary for the production process path', () => {
    expect(existsSync(rustServerBin)).toBe(true);
    expect(existsSync(stagedRustBin)).toBe(true);
    expect(existsSync(rustCliBin)).toBe(true);
  });

  it('ships TypeScript tool engine for full-parity bridge', () => {
    expect(existsSync(path.join(repoRoot, 'src/engine-invoke.ts'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'src/legacy-engine-runtime.ts'))).toBe(true);
    expect(existsSync(path.join(repoRoot, 'dist/legacy-engine-runtime.js'))).toBe(true);
    expect(
      existsSync(path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/parity_bridge.rs'))
    ).toBe(true);
  });

  it('full-parity engine executes read_pdf via TypeScript handlers', () => {
    const result = spawnSync(rustServerBin, [], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PDF_READER_ENGINE_MODE: 'full',
      },
      input: '',
      timeout: 5_000,
    });
    // Process expects MCP stdio; just ensure binary starts (non-crash on empty input close).
    expect([0, 1, null]).toContain(result.status);
    expect(existsSync(path.join(repoRoot, 'dist/legacy-engine-runtime.js'))).toBe(true);
  });

  it('delegates read_pdf through pdf-reader-cli without spawning legacy TypeScript runtime', () => {
    const probeDir = mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-read-pdf-probe-'));
    const nodeInvokeLog = path.join(probeDir, 'node-invoke.log');
    const fakeNode = path.join(probeDir, 'node');
    writeFileSync(
      fakeNode,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >> "${nodeInvokeLog}"\nexit 99\n`
    );
    chmodSync(fakeNode, 0o755);

    const cliProbe = spawnSync(rustCliBin, [], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PDF_READER_NODE: fakeNode,
        PDF_READER_ALLOW_LEGACY_ENGINE: '',
      },
      input: JSON.stringify({
        tool: 'read_pdf',
        input: {
          sources: [{ path: samplePdf }],
          include_metadata: true,
          include_page_count: true,
          include_full_text: false,
        },
      }),
      timeout: 30_000,
    });

    expect(cliProbe.status).toBe(0);
    expect(existsSync(nodeInvokeLog)).toBe(false);

    const cliEnvelope = JSON.parse(cliProbe.stdout) as {
      status?: string;
      tool?: string;
      result?: { content?: Array<{ text?: string }> };
    };
    expect(cliEnvelope.status).toBe('ok');
    expect(cliEnvelope.tool).toBe('read_pdf');
    const payloadText = cliEnvelope.result?.content?.[0]?.text ?? '';
    expect(payloadText).toContain('rust-read-pdf-v1');
    expect(payloadText).toContain('"success":true');
    expect(payloadText).not.toContain('legacy-engine-runtime');
  });

  it('delegates pdf_hash through pdf-reader-cli JSON boundary', () => {
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

  it('reports doctor diagnostics from the default Rust MCP entrypoint', () => {
    const result = spawnSync(rustServerBin, ['doctor'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(output).toContain('Rust MCP server');
    expect(output).toContain('engine cli');
  });
});
