import { beforeAll, describe, expect, it } from 'bun:test';
import { execSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const rustCliBin = path.join(repoRoot, 'target/release/pdf-reader-cli');
const samplePdf = path.join(repoRoot, 'test/fixtures/sample.pdf');

type CliEnvelope = {
  status?: string;
  code?: string;
  message?: string;
  tool?: string;
  hash?: { sourceHash?: string };
  search?: { route?: string };
  result?: { content?: Array<{ text?: string }> };
};

const invokeCli = (tool: string, input: Record<string, unknown>, env: NodeJS.ProcessEnv) => {
  const probe = spawnSync(rustCliBin, [], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    input: JSON.stringify({ tool, input }),
    timeout: 30_000,
  });
  expect(probe.status).toBe(0);
  return JSON.parse(probe.stdout) as CliEnvelope;
};

describe('shipped path matrix (Rust core, no legacy flags)', () => {
  let fakeNodeEnv: NodeJS.ProcessEnv;
  let nodeInvokeLog: string;

  beforeAll(() => {
    execSync('bun run build:rust', { cwd: repoRoot, stdio: 'pipe', timeout: 300_000 });

    const probeDir = mkdtempSync(path.join(os.tmpdir(), 'pdf-reader-matrix-probe-'));
    nodeInvokeLog = path.join(probeDir, 'node-invoke.log');
    const fakeNode = path.join(probeDir, 'node');
    writeFileSync(
      fakeNode,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >> "${nodeInvokeLog}"\nexit 99\n`
    );
    chmodSync(fakeNode, 0o755);

    fakeNodeEnv = {
      ...process.env,
      PDF_READER_NODE: fakeNode,
      PDF_READER_ALLOW_LEGACY_ENGINE: '',
      PDF_READER_MCP_TRANSPORT: '',
    };
  }, 300_000);

  it('pdf_hash returns deterministic Rust provenance', () => {
    const envelope = invokeCli('pdf_hash', { path: samplePdf }, fakeNodeEnv);
    expect(envelope.status).toBe('ok');
    expect(envelope.hash?.sourceHash?.length).toBe(64);
    expect(existsSync(nodeInvokeLog)).toBe(false);
  });

  it('pdf_text_search returns rust-text-index route', () => {
    const envelope = invokeCli('pdf_text_search', { path: samplePdf, query: 'Lorem' }, fakeNodeEnv);
    expect(envelope.status).toBe('ok');
    expect(envelope.search?.route).toBe('rust-text-index');
    expect(existsSync(nodeInvokeLog)).toBe(false);
  });

  it('read_pdf returns rust-read-pdf-v1 without legacy runtime', () => {
    const envelope = invokeCli(
      'read_pdf',
      {
        sources: [{ path: samplePdf }],
        include_metadata: true,
        include_page_count: true,
        include_full_text: false,
      },
      fakeNodeEnv
    );
    expect(envelope.status).toBe('ok');
    expect(envelope.tool).toBe('read_pdf');
    const payload = envelope.result?.content?.[0]?.text ?? '';
    expect(payload).toContain('rust-read-pdf-v1');
    expect(payload).not.toContain('LEGACY_ENGINE_DISABLED');
    expect(existsSync(nodeInvokeLog)).toBe(false);
  });

  it('search_pdf defaults to rust-text-index without legacy runtime', () => {
    const envelope = invokeCli(
      'search_pdf',
      {
        sources: [{ path: samplePdf }],
        query: 'Lorem',
      },
      fakeNodeEnv
    );
    expect(envelope.status).toBe('ok');
    expect(envelope.tool).toBe('search_pdf');
    const payload = envelope.result?.content?.[0]?.text ?? '';
    expect(payload).toContain('rust-text-index');
    expect(payload).toContain('"success":true');
    expect(payload).not.toContain('LEGACY_ENGINE_DISABLED');
    expect(existsSync(nodeInvokeLog)).toBe(false);
  });

  it('pdf_evidence inspect returns rust-pdf-inspect-v1 without legacy runtime', () => {
    const envelope = invokeCli(
      'pdf_evidence',
      {
        operation: 'inspect',
        sources: [{ path: samplePdf }],
      },
      fakeNodeEnv
    );
    expect(envelope.status).toBe('ok');
    expect(envelope.tool).toBe('pdf_evidence');
    const payload = envelope.result?.content?.[0]?.text ?? '';
    expect(payload).toContain('rust-pdf-inspect-v1');
    expect(payload).not.toContain('LEGACY_ENGINE_DISABLED');
    expect(existsSync(nodeInvokeLog)).toBe(false);
  });

  it('documents explicit shipped routing table in mcp-server sources', () => {
    const routes = readFileSync(
      path.join(repoRoot, 'crates/pdf-reader-mcp-server/src/tool_routes.rs'),
      'utf8'
    );
    expect(routes).toContain('read_pdf');
    expect(routes).toContain('search_pdf');
    expect(routes).toContain('RustCore');
    expect(routes).not.toContain('FullParity');
    expect(routes).not.toContain('PureRust');
  });
});
