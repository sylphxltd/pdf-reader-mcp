#!/usr/bin/env bun
/**
 * Controlled same-host TypeScript 3.0.14 vs Rust candidate A/B harness.
 *
 * Product performance bar (ADR-0006 / same-host-ab-contract.md):
 * - same host/corpus/inputs/config/task semantics
 * - semantic gate before timing is admitted
 * - interleave/randomize engine order
 * - cold + warm
 * - median/p95, memory, startup, package sizes
 * - no marketing claim unless status=admissible_pass + independent review
 */
import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
const iterationsWarm = Number(process.env['MCP_PDF_PERF_WARM_ITERS'] || 7);
const fixture =
  process.env['MCP_PDF_PERF_FIXTURE'] || join(root, 'test/fixtures/sample.pdf');
const fixtureClass = process.env['MCP_PDF_PERF_FIXTURE_CLASS'] || 'unclassified';

// Material advantage thresholds for a single-fixture draft (suite decides overall).
const MIN_WARM_SPEEDUP = Number(process.env['MCP_PDF_PERF_MIN_WARM_SPEEDUP'] || 1.5);
const MAX_P95_REGRESSION = Number(process.env['MCP_PDF_PERF_MAX_P95_REGRESSION'] || 1.15);

type EngineId = 'typescript-3.0.14' | 'rust-candidate';

type Sample = {
  engine: EngineId;
  phase: 'cold' | 'warm' | 'startup';
  ok: boolean;
  latencyMs: number;
  semanticPass: boolean;
  error?: string;
  textChars?: number;
  peakRssKb?: number | null;
};

const gitHead = (): string | null => {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

const fileSize = (path: string | null | undefined): number | null => {
  if (!path || !existsSync(path)) return null;
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
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
  const entry = join(installRoot, 'node_modules/@sylphx/pdf-reader-mcp/dist/index.js');
  if (!existsSync(entry)) {
    const install = spawnSync(
      'npm',
      ['install', '@sylphx/pdf-reader-mcp@3.0.14', '--prefix', installRoot, '--no-save', '--no-fund', '--no-audit'],
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

const measurePeakRssKb = (command: string, args: string[]): number | null => {
  // Prefer /usr/bin/time -v if available.
  const timeBin = existsSync('/usr/bin/time') ? '/usr/bin/time' : null;
  if (!timeBin) return null;
  const r = spawnSync(timeBin, ['-v', command, ...args], {
    encoding: 'utf8',
    input: '',
    timeout: 15_000,
  });
  const text = `${r.stderr || ''}\n${r.stdout || ''}`;
  const m = text.match(/Maximum resident set size \(kbytes\):\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

const mcpInitializeOnly = async (
  command: string,
  args: string[],
  timeoutMs = 15_000
): Promise<{ ok: boolean; latencyMs: number; error?: string }> => {
  const start = performance.now();
  return await new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_TRANSPORT: 'stdio' },
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
      resolve({ ok, latencyMs: performance.now() - start, error });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
    child.stdout.on('data', (d) => {
      out += d.toString('utf8');
      for (const line of out.split('\n').map((l) => l.trim()).filter(Boolean)) {
        try {
          const msg = JSON.parse(line) as { id?: number; error?: unknown };
          if (msg.id === 1) {
            clearTimeout(timer);
            finish(!msg.error, msg.error ? JSON.stringify(msg.error) : undefined);
            return;
          }
        } catch {
          // partial
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
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'same-host-ab-startup', version: '0' },
        },
      })}\n`
    );
  });
};

const mcpInitializeAndRead = async (
  command: string,
  args: string[],
  pdfPath: string,
  timeoutMs = 45_000
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
            result?: { content?: Array<{ text?: string }>; isError?: boolean };
            error?: unknown;
          };
          if (stage === 'init' && msg.id === 1) {
            if (msg.error) {
              clearTimeout(timer);
              finish(false, `initialize error: ${JSON.stringify(msg.error)}`);
              return;
            }
            write({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
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
            if (msg.error || msg.result?.isError) {
              finish(false, `read_pdf error: ${JSON.stringify(msg.error ?? msg.result)}`);
              return;
            }
            const text = msg.result?.content?.map((c) => c.text || '').join('\n') || '';
            // Semantic floor for agent task: successful non-trivial payload.
            // Capability-first: not byte-identical to TS representation.
            const textChars = text.length;
            finish(textChars > 40, textChars > 40 ? undefined : 'semantic text too short', textChars);
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
        clientInfo: { name: 'same-host-ab', version: '0.1.0' },
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

const summarize = (samples: Sample[], engine: EngineId, phase: Sample['phase']) => {
  const xs = samples.filter((s) => s.engine === engine && s.phase === phase && s.ok);
  const lat = xs.map((s) => s.latencyMs);
  return {
    n: xs.length,
    medianMs: percentile(lat, 50),
    p95Ms: percentile(lat, 95),
    meanMs: lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null,
    semanticPassRate: samples.filter((s) => s.engine === engine && s.phase === phase).length
      ? xs.length / samples.filter((s) => s.engine === engine && s.phase === phase).length
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

  const packageSizeBytes: Record<string, number | null> = {
    typescriptTarball: null,
    rustBinary: null,
    candidatePack: null,
  };
  try {
    const pack = spawnSync(
      'npm',
      ['pack', '@sylphx/pdf-reader-mcp@3.0.14', '--pack-destination', outDir, '--json'],
      { encoding: 'utf8', cwd: root }
    );
    if (pack.status === 0) {
      const arr = JSON.parse(pack.stdout || '[]') as Array<{ filename?: string; size?: number }>;
      const first = arr[0];
      if (first?.filename) {
        packageSizeBytes.typescriptTarball =
          fileSize(join(outDir, first.filename)) ?? (Number(first.size ?? 0) || null);
      }
    }
  } catch {
    // ignore
  }
  try {
    const packCand = spawnSync('npm', ['pack', '--pack-destination', outDir, '--json'], {
      encoding: 'utf8',
      cwd: root,
    });
    if (packCand.status === 0) {
      const arr = JSON.parse(packCand.stdout || '[]') as Array<{ filename?: string; size?: number }>;
      const first = arr[0];
      if (first?.filename) {
        packageSizeBytes.candidatePack =
          fileSize(join(outDir, first.filename)) ?? (Number(first.size ?? 0) || null);
      }
    }
  } catch {
    // ignore
  }
  packageSizeBytes.rustBinary = fileSize(rustBin);

  const engines: Array<{ id: EngineId; command: string; args: string[] }> = [];
  if (ts) engines.push({ id: 'typescript-3.0.14', command: ts.command, args: ts.args });
  if (rustBin) engines.push({ id: 'rust-candidate', command: rustBin, args: [] });

  const memory: Record<string, number | null> = {
    typescriptPeakRssKb: ts ? measurePeakRssKb(ts.command, ts.args) : null,
    rustPeakRssKb: rustBin ? measurePeakRssKb(rustBin, []) : null,
  };

  // Startup cost (initialize only), interleaved
  const startupOrder = [...engines].sort(() => Math.random() - 0.5);
  for (const eng of startupOrder) {
    const result = await mcpInitializeOnly(eng.command, eng.args);
    samples.push({
      engine: eng.id,
      phase: 'startup',
      ok: result.ok,
      latencyMs: result.latencyMs,
      semanticPass: result.ok,
      error: result.error,
    });
  }

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
    samples.some((s) => s.engine === 'typescript-3.0.14' && s.phase === 'warm' && s.semanticPass) &&
    samples.some((s) => s.engine === 'rust-candidate' && s.phase === 'warm' && s.semanticPass);

  const tsWarm = summarize(samples, 'typescript-3.0.14', 'warm');
  const rustWarm = summarize(samples, 'rust-candidate', 'warm');
  const tsStartup = summarize(samples, 'typescript-3.0.14', 'startup');
  const rustStartup = summarize(samples, 'rust-candidate', 'startup');
  const speedup =
    tsWarm.medianMs && rustWarm.medianMs && rustWarm.medianMs > 0
      ? tsWarm.medianMs / rustWarm.medianMs
      : null;
  const p95Ratio =
    tsWarm.p95Ms && rustWarm.p95Ms && tsWarm.p95Ms > 0 ? rustWarm.p95Ms / tsWarm.p95Ms : null;

  let status:
    | 'scaffold_not_admissible'
    | 'measured_draft_not_admissible'
    | 'fixture_pass'
    | 'admissible_pass'
    | 'failed' = 'measured_draft_not_admissible';

  if (blockers.length) status = 'failed';
  else if (!bothSemantic) {
    status = 'failed';
    blockers.push('semantic gate failed for one or both engines on warm runs');
  } else if (
    speedup !== null &&
    speedup >= MIN_WARM_SPEEDUP &&
    (p95Ratio === null || p95Ratio <= MAX_P95_REGRESSION) &&
    tsWarm.semanticPassRate === 1 &&
    rustWarm.semanticPassRate === 1 &&
    iterationsWarm >= 5
  ) {
    // Single-fixture material advantage with no p95 regression vs TS.
    // Suite aggregator decides overall admissible_pass across fixture classes.
    status = 'fixture_pass';
  } else {
    status = 'measured_draft_not_admissible';
    if (speedup === null || speedup < MIN_WARM_SPEEDUP) {
      blockers.push(
        `warm median speedup ${speedup ?? 'n/a'} < required ${MIN_WARM_SPEEDUP}x (or unmeasurable)`
      );
    }
    if (p95Ratio !== null && p95Ratio > MAX_P95_REGRESSION) {
      blockers.push(`rust warm p95 regression ratio ${p95Ratio} > ${MAX_P95_REGRESSION}`);
    }
    if (iterationsWarm < 5) blockers.push(`warm iterations ${iterationsWarm} < 5`);
  }

  const report = {
    profile: 'same_host_ts_rust_ab',
    status,
    generatedAt: new Date().toISOString(),
    candidateSha,
    historicalBaseline: '@sylphx/pdf-reader-mcp@3.0.14',
    fixture,
    fixtureClass,
    iterationsWarm,
    thresholds: {
      minWarmMedianSpeedup: MIN_WARM_SPEEDUP,
      maxRustP95OverTsP95: MAX_P95_REGRESSION,
    },
    packageSizeBytes,
    memory,
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
        sizeBytes: packageSizeBytes.rustBinary,
      },
    },
    summary: {
      typescriptStartup: tsStartup,
      rustStartup,
      typescriptCold: summarize(samples, 'typescript-3.0.14', 'cold'),
      rustCold: summarize(samples, 'rust-candidate', 'cold'),
      typescriptWarm: tsWarm,
      rustWarm,
      warmMedianSpeedupTsOverRust: speedup,
      warmP95RustOverTs: p95Ratio,
      memoryRssRatioRustOverTs:
        memory.typescriptPeakRssKb && memory.rustPeakRssKb && memory.typescriptPeakRssKb > 0
          ? memory.rustPeakRssKb / memory.typescriptPeakRssKb
          : null,
      packageSizeRatioCandidatePackOverTsTarball:
        packageSizeBytes.candidatePack &&
        packageSizeBytes.typescriptTarball &&
        packageSizeBytes.typescriptTarball > 0
          ? packageSizeBytes.candidatePack / packageSizeBytes.typescriptTarball
          : null,
    },
    samples,
    blockers,
    claimPolicy:
      'No marketing performance claim is authorized unless suite status=admissible_pass and independent review sets performanceClaimsAuthorized=true. Fixture_pass is an intermediate gate only.',
  };

  const outPath = join(outDir, 'same-host-ab-report.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`[same-host-ab] wrote ${outPath}`);

  if (requireAdmissible && status !== 'admissible_pass' && status !== 'fixture_pass') {
    process.exit(2);
  }
  if (status === 'failed') process.exit(1);
};

await main();
