#!/usr/bin/env bun
/**
 * Controlled same-host TypeScript 3.0.14 vs exact Rust candidate A/B harness.
 *
 * ADR-0006 / showhand bar:
 * - same host/corpus/inputs/config/task semantics
 * - semantic gate before timing
 * - interleave engine order
 * - cold + warm
 * - raw samples bound to SHA/binaries/fixtures
 * - no marketing claim unless status=admissible_pass
 */
import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  NATIVE_PLATFORM_PACKAGES,
  resolveNativePlatformId,
} from '../../src/native/platform-package-map.ts';

const root = join(import.meta.dirname, '../..');
const outDir =
  process.env['MCP_PDF_PERF_OUTPUT_DIR'] || join(root, 'benchmark-artifacts/same-host-ab');
mkdirSync(outDir, { recursive: true });

const requireAdmissible = process.argv.includes('--require-admissible');
const iterationsWarm = Number(process.env['MCP_PDF_PERF_WARM_ITERS'] || 5);
const fixture =
  process.env['MCP_PDF_PERF_FIXTURE'] || join(root, 'test/fixtures/sample.pdf');

type EngineId = 'typescript-3.0.14' | 'rust-candidate';

type Sample = {
  engine: EngineId;
  phase: 'cold' | 'warm';
  ok: boolean;
  latencyMs: number;
  semanticPass: boolean;
  error?: string;
  textChars?: number;
};

const gitHead = (): string | null => {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

const resolveRustBinary = (): string | null => {
  const forced = process.env['PDF_READER_MCP_RUST_BIN'];
  if (forced && existsSync(forced)) return forced;
  const platformId = resolveNativePlatformId();
  if (!platformId) return null;
  const meta = NATIVE_PLATFORM_PACKAGES[platformId];
  const candidates = [
    join(root, 'target/release/pdf-reader-mcp-server'),
    join(root, 'bin/native', platformId, meta.binaryName),
    join(root, meta.packageDir, 'bin', meta.binaryName),
    join(root, 'node_modules', meta.npmName, 'bin', meta.binaryName),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
};

const ensureTypescriptLkg = (): { command: string; args: string[]; installRoot: string } | null => {
  const installRoot = join(outDir, 'ts-lkg-install');
  mkdirSync(installRoot, { recursive: true });
  const entry = join(
    installRoot,
    'node_modules/@sylphx/pdf-reader-mcp/dist/index.js'
  );
  if (!existsSync(entry)) {
    const install = spawnSync(
      'npm',
      ['install', '@sylphx/pdf-reader-mcp@3.0.14', '--prefix', installRoot, '--no-save'],
      { encoding: 'utf8', cwd: root }
    );
    if (install.status !== 0) {
      console.error('[same-host-ab] failed to install TS 3.0.14 LKG');
      console.error(install.stderr || install.stdout);
      return null;
    }
  }
  if (!existsSync(entry)) return null;
  return { command: process.execPath, args: [entry], installRoot };
};

const mcpCall = async (
  command: string,
  args: string[],
  request: unknown,
  timeoutMs = 20_000
): Promise<{ ok: boolean; latencyMs: number; body: string; error?: string }> => {
  const start = performance.now();
  return await new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_TRANSPORT: 'stdio',
        PDF_READER_ENGINE_MODE: 'pure-rust',
      },
    });
    let out = '';
    let err = '';
    let settled = false;
    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve({ ok, latencyMs: performance.now() - start, body: out, error });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
    child.stdout.on('data', (d) => {
      out += d.toString('utf8');
      // first JSON-RPC response line is enough for initialize/tools call
      if (out.includes('"result"') || out.includes('"error"')) {
        clearTimeout(timer);
        finish(true);
      }
    });
    child.stderr.on('data', (d) => {
      err += d.toString('utf8');
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      finish(false, String(e));
    });
    child.on('exit', (code) => {
      if (!settled) {
        clearTimeout(timer);
        finish(code === 0, err || `exit ${code}`);
      }
    });
    child.stdin.write(`${JSON.stringify(request)}\n`);
    // For tools/call we may need initialize first in same process; keep simple one-shot initialize for startup,
    // and a second mode for read_pdf via initialize+tools/call sequence.
  });
};

const mcpInitializeAndRead = async (
  command: string,
  args: string[],
  pdfPath: string,
  timeoutMs = 30_000
): Promise<{ ok: boolean; latencyMs: number; body: string; error?: string; textChars?: number }> => {
  const start = performance.now();
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_TRANSPORT: 'stdio' },
    });
    let out = '';
    let err = '';
    let stage: 'init' | 'read' | 'done' = 'init';
    let settled = false;
    const finish = (ok: boolean, error?: string, textChars?: number) => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve({ ok, latencyMs: performance.now() - start, body: out, error, textChars });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
    const write = (msg: unknown) => child.stdin.write(`${JSON.stringify(msg)}\n`);
    child.stdout.on('data', (d) => {
      out += d.toString('utf8');
      const lines = out
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as {
            id?: number;
            result?: { content?: Array<{ text?: string }> };
            error?: unknown;
          };
          if (stage === 'init' && msg.id === 1) {
            if (msg.error) {
              clearTimeout(timer);
              finish(false, `initialize error: ${JSON.stringify(msg.error)}`);
              return;
            }
            // MCP lifecycle: client must emit notifications/initialized before tools/call.
            write({
              jsonrpc: '2.0',
              method: 'notifications/initialized',
              params: {},
            });
            stage = 'read';
            write({
              jsonrpc: '2.0',
              id: 2,
              method: 'tools/call',
              params: {
                name: 'read_pdf',
                arguments: {
                  sources: [{ path: pdfPath }],
                  include_full_text: true,
                  pages: [1],
                },
              },
            });
          } else if (stage === 'read' && msg.id === 2) {
            clearTimeout(timer);
            if (msg.error) {
              finish(false, `read_pdf error: ${JSON.stringify(msg.error)}`);
              return;
            }
            const text = msg.result?.content?.map((c) => c.text || '').join('\n') || '';
            // semantic floor: non-empty payload
            const textChars = text.length;
            finish(textChars > 20, textChars > 20 ? undefined : 'semantic text too short', textChars);
          }
        } catch {
          // partial line
        }
      }
    });
    child.stderr.on('data', (d) => {
      err += d.toString('utf8');
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      finish(false, String(e));
    });
    child.on('exit', (code) => {
      if (!settled) {
        clearTimeout(timer);
        finish(false, err || `exit ${code}`);
      }
    });
    write({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'same-host-ab', version: '0.0.0' },
      },
    });
  });
};

const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
};

const summarize = (samples: Sample[], engine: EngineId, phase: 'cold' | 'warm') => {
  const xs = samples.filter((s) => s.engine === engine && s.phase === phase && s.ok);
  const lat = xs.map((s) => s.latencyMs);
  return {
    n: xs.length,
    medianMs: percentile(lat, 50),
    p95Ms: percentile(lat, 95),
    meanMs: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null,
    semanticPassRate: samples.filter((s) => s.engine === engine && s.phase === phase).length
      ? xs.filter((s) => s.semanticPass).length /
        samples.filter((s) => s.engine === engine && s.phase === phase).length
      : 0,
  };
};

const main = async () => {
  const candidateSha = gitHead();
  const rustBin = resolveRustBinary();
  const ts = ensureTypescriptLkg();
  const samples: Sample[] = [];
  const blockers: string[] = [];

  if (!existsSync(fixture)) blockers.push(`fixture missing: ${fixture}`);
  if (!rustBin) blockers.push('rust candidate binary not found (build:rust or set PDF_READER_MCP_RUST_BIN)');
  if (!ts) blockers.push('typescript 3.0.14 LKG install failed');

  const packageSizeBytes = (() => {
  const sizes: Record<string, number | null> = { typescriptTarball: null, rustBinary: null, candidatePack: null };
  try {
    const pack = spawnSync('npm', ['pack', '@sylphx/pdf-reader-mcp@3.0.14', '--pack-destination', outDir, '--json'], {
      encoding: 'utf8',
      cwd: root,
    });
    if (pack.status === 0) {
      const arr = JSON.parse(pack.stdout || '[]') as Array<{ filename?: string; size?: number }>;
      const first = arr[0];
      if (first?.filename) {
        const fp = join(outDir, first.filename);
        if (existsSync(fp)) sizes.typescriptTarball = Number(first.size ?? 0) || null;
      }
    }
  } catch {
    // ignore
  }
  try {
    const packCand = spawnSync('bun', ['pm', 'pack', '--destination', outDir], { encoding: 'utf8', cwd: root });
    // parse tarball path from output
    const m = (packCand.stdout || '').match(/([\w@./-]+\.tgz)/);
    if (m) {
      const fp = join(outDir, m[1].split('/').pop() || m[1]);
      if (existsSync(fp)) {
        const st = spawnSync('stat', ['-c', '%s', fp], { encoding: 'utf8' });
        if (st.status === 0) sizes.candidatePack = Number(st.stdout.trim());
      }
    }
  } catch {
    // ignore
  }
  if (rustBin && existsSync(rustBin)) {
    const st = spawnSync('stat', ['-c', '%s', rustBin], { encoding: 'utf8' });
    if (st.status === 0) sizes.rustBinary = Number(st.stdout.trim());
  }
  return sizes;
})();

  const engines: Array<{ id: EngineId; command: string; args: string[] }> = [];
  if (ts) engines.push({ id: 'typescript-3.0.14', command: ts.command, args: ts.args });
  if (rustBin) engines.push({ id: 'rust-candidate', command: rustBin, args: [] });

  // cold: one run each, order randomized
  const coldOrder = [...engines].sort(() => Math.random() - 0.5);
  for (const eng of coldOrder) {
    const result = await mcpInitializeAndRead(eng.command, eng.args, fixture);
    samples.push({
      engine: eng.id,
      phase: 'cold',
      ok: result.ok,
      latencyMs: result.latencyMs,
      semanticPass: result.ok,
      error: result.error,
      textChars: result.textChars,
    });
  }

  // warm interleaved
  for (let i = 0; i < iterationsWarm; i++) {
    const order = [...engines].sort(() => Math.random() - 0.5);
    for (const eng of order) {
      const result = await mcpInitializeAndRead(eng.command, eng.args, fixture);
      samples.push({
        engine: eng.id,
        phase: 'warm',
        ok: result.ok,
        latencyMs: result.latencyMs,
        semanticPass: result.ok,
        error: result.error,
        textChars: result.textChars,
      });
    }
  }

  const bothSemantic =
    samples.some((s) => s.engine === 'typescript-3.0.14' && s.semanticPass) &&
    samples.some((s) => s.engine === 'rust-candidate' && s.semanticPass);

  const tsWarm = summarize(samples, 'typescript-3.0.14', 'warm');
  const rustWarm = summarize(samples, 'rust-candidate', 'warm');
  const speedup =
    tsWarm.medianMs && rustWarm.medianMs && rustWarm.medianMs > 0
      ? tsWarm.medianMs / rustWarm.medianMs
      : null;

  let status:
    | 'scaffold_not_admissible'
    | 'measured_draft_not_admissible'
    | 'admissible_pass'
    | 'failed' = 'measured_draft_not_admissible';

  if (blockers.length) status = 'failed';
  else if (!bothSemantic) {
    status = 'failed';
    blockers.push('semantic gate failed for one or both engines');
  } else {
    // Admissible pass requires broader corpus + more iterations; keep draft until then.
    status = 'measured_draft_not_admissible';
    blockers.push(
      'broader multi-fixture corpus, memory/startup/package-size, and independent review still required for admissible_pass'
    );
  }

  const report = {
    profile: 'same_host_ts_rust_ab',
    status,
    generatedAt: new Date().toISOString(),
    candidateSha,
    historicalBaseline: '@sylphx/pdf-reader-mcp@3.0.14',
    fixture,
    iterationsWarm,
    packageSizeBytes,
    host: {
      platform: process.platform,
      arch: process.arch,
      node: process.version,
    },
    engines: {
      typescriptLkg: {
        package: '@sylphx/pdf-reader-mcp@3.0.14',
        command: ts ? [ts.command, ...ts.args].join(' ') : null,
        installed: Boolean(ts),
      },
      rustCandidate: {
        binary: rustBin,
        present: Boolean(rustBin),
      },
    },
    summary: {
      typescriptCold: summarize(samples, 'typescript-3.0.14', 'cold'),
      rustCold: summarize(samples, 'rust-candidate', 'cold'),
      typescriptWarm: tsWarm,
      rustWarm,
      warmMedianSpeedupTsOverRust: speedup,
    },
    samples,
    blockers,
    claimPolicy:
      'No marketing or showhand performance claim is authorized unless status=admissible_pass and independent review authorizes performance claims. Draft measurements are diagnostic only.',
  };

  const outPath = join(outDir, 'same-host-ab-report.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`[same-host-ab] wrote ${outPath}`);

  if (requireAdmissible && status !== 'admissible_pass') {
    process.exit(2);
  }
  if (status === 'failed') process.exit(1);
};

await main();
