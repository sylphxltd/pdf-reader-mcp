#!/usr/bin/env bun
/**
 * Controlled same-host TypeScript 3.0.14 vs exact Rust candidate A/B harness.
 *
 * Requirements (ADR-0006 / showhand bar):
 * - same host, corpus, inputs, configuration, task semantics
 * - verify semantic task outcomes before timing
 * - interleave/randomize engine order
 * - separate cold start and warm execution
 * - record median, p95, throughput, peak memory, startup, package/install size
 * - bind source SHA, binaries, fixtures, toolchains, environment
 * - do not emit marketing claims from historical cross-run data
 *
 * This is a scaffold. It fails closed until engines, corpus, and measurement
 * backends are fully wired for the exact candidate.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../..');
const outDir = process.env['MCP_PDF_PERF_OUTPUT_DIR'] || join(root, 'benchmark-artifacts/same-host-ab');
mkdirSync(outDir, { recursive: true });

const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const report = {
  profile: 'same_host_ts_rust_ab',
  status: 'scaffold_not_admissible',
  generatedAt: new Date().toISOString(),
  candidateSha: head.status === 0 ? head.stdout.trim() : null,
  historicalBaseline: '@sylphx/pdf-reader-mcp@3.0.14',
  requirements: [
    'same-host controlled A/B only',
    'semantic equivalence gate before timing',
    'cold and warm separation',
    'median/p95/throughput/peak-memory/startup/package-size',
    'raw samples retained and bound to SHA/binaries/fixtures/toolchains',
    'no marketing claims until status=admissible_pass',
  ],
  engines: {
    typescriptLkg: {
      package: '@sylphx/pdf-reader-mcp@3.0.14',
      role: 'immutable external oracle / baseline',
      installed: false,
    },
    rustCandidate: {
      binaryEnv: 'PDF_READER_MCP_RUST_BIN',
      role: 'exact sole-Rust candidate under test',
      present: Boolean(process.env['PDF_READER_MCP_RUST_BIN'] && existsSync(process.env['PDF_READER_MCP_RUST_BIN'])),
    },
  },
  corpus: {
    status: 'not_wired',
    note: 'Wire representative small/medium/large/scanned/table-heavy/structured/hostile fixtures next.',
  },
  claimPolicy:
    'Any speedup claim requires status=admissible_pass with raw samples. Historical cross-run numbers are not claims.',
};

const outPath = join(outDir, 'same-host-ab-scaffold.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
console.log(`[same-host-ab] wrote ${outPath}`);
if (process.argv.includes('--require-admissible')) {
  console.error('[same-host-ab] scaffold is not admissible; refuse --require-admissible');
  process.exit(2);
}
