#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const corpusPath = join(scriptDir, 'fixtures/v3014-document-ast-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-document-ast-oracle.json');
const fixtureManifestPath = join(scriptDir, 'fixtures/v3014-document-ast-fixture.json');
const runnerPath = join(scriptDir, 'v3014-document-ast-baseline-runner.ts');
const generatorPath = join(scriptDir, 'generate-v3014-document-ast-fixture.ts');
const rustCliPath = join(repoRoot, 'target/release/pdf-reader-cli');
const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Case = { id: string; input: Record<string, unknown> };
type Oracle = {
  baseline: {
    tag: string;
    commit: string;
    tree: string;
    bunLockSha256: string;
    runnerSha256: string;
    generatorSha256: string;
    corpusSha256: string;
    fixtureManifestSha256: string;
    fixtureSha256: string;
    entrypointSha256: Record<string, string>;
  };
  expectations: Record<string, Json>;
};

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { cases: Case[] };
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8')) as Oracle;
const fixtureManifest = JSON.parse(readFileSync(fixtureManifestPath, 'utf8')) as {
  fixture: { path: string; bytes: number; sha256: string };
};
const sha256 = (value: Uint8Array | string): string =>
  createHash('sha256').update(value).digest('hex');
const git = (...args: string[]): Buffer => {
  const result = spawnSync('git', args, { cwd: repoRoot });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
};
const coordinate = (value: unknown): number => Math.round(Number(value) * 1e9) / 1e9;
const box = (value: unknown): Json => {
  const record = value as Record<string, unknown>;
  return {
    left: coordinate(record.left),
    bottom: coordinate(record.bottom),
    right: coordinate(record.right),
    top: coordinate(record.top),
  };
};
const hint = (value: unknown): Json => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    role: String(record.role),
    confidence: Number(record.confidence),
    signals: (record.signals ?? []) as Json,
    ...(record.level === undefined ? {} : { level: Number(record.level) }),
  };
};
const node = (value: Record<string, unknown>): Json => ({
  id: String(value.id),
  type: String(value.type),
  page_start: Number(value.page_start),
  page_end: Number(value.page_end),
  element_ids: (value.element_ids ?? []) as Json,
  ...(value.chunk_ids === undefined ? {} : { chunk_ids: value.chunk_ids as Json }),
  ...(value.bounding_boxes === undefined
    ? {}
    : { bounding_boxes: (value.bounding_boxes as unknown[]).map(box) }),
  ...(value.title === undefined ? {} : { title: String(value.title) }),
  ...(value.text === undefined ? {} : { text: String(value.text) }),
  ...(value.level === undefined ? {} : { level: Number(value.level) }),
  ...(value.semantic_role === undefined ? {} : { semantic_role: String(value.semantic_role) }),
  ...(value.section_path === undefined
    ? {}
    : {
        section_path: (value.section_path as Array<Record<string, unknown>>).map((entry) => ({
          id: String(entry.id),
          title: String(entry.title),
          level: Number(entry.level),
          page_start: Number(entry.page_start),
        })),
      }),
  ...(value.continued_from_section_id === undefined
    ? {}
    : { continued_from_section_id: String(value.continued_from_section_id) }),
  ...(value.children === undefined
    ? {}
    : { children: (value.children as Array<Record<string, unknown>>).map(node) }),
});
const canonical = (data: Record<string, unknown>): Json => {
  const ast = data.document_ast as Record<string, unknown> | undefined;
  return {
    has_document_ast: Object.hasOwn(data, 'document_ast'),
    has_elements: Object.hasOwn(data, 'elements'),
    has_chunks: Object.hasOwn(data, 'chunks'),
    elements: ((data.elements ?? []) as Array<Record<string, unknown>>).map((element) => ({
      id: String(element.id),
      type: String(element.type),
      page: Number(element.page),
      content: String(element.content),
      ...(element.bounding_box === undefined ? {} : { bounding_box: box(element.bounding_box) }),
      semantic_hint: hint(element.semantic_hint),
    })),
    chunks: ((data.chunks ?? []) as Array<Record<string, unknown>>).map((chunk) => ({
      id: String(chunk.id),
      page_start: Number(chunk.page_start),
      page_end: Number(chunk.page_end),
      text: String(chunk.text),
      element_ids: (chunk.element_ids ?? []) as Json,
      ...(chunk.strategy === undefined ? {} : { strategy: String(chunk.strategy) }),
      ...(chunk.heading === undefined ? {} : { heading: String(chunk.heading) }),
      ...(chunk.bounding_boxes === undefined
        ? {}
        : { bounding_boxes: (chunk.bounding_boxes as unknown[]).map(box) }),
    })),
    document_ast:
      ast === undefined
        ? null
        : {
            version: String(ast.version),
            profile: String(ast.profile),
            root: node(ast.root as Record<string, unknown>),
            summary: ast.summary as Json,
            ...(ast.warnings === undefined ? {} : { warnings: ast.warnings as Json }),
          },
  };
};
const canonicalJson = (value: Json): Json => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalJson(entry)])
    );
  }
  return value;
};
const same = (left: Json, right: Json): boolean =>
  JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));

function verifyAuthority(): Record<string, string> {
  const commit = git('rev-list', '-n', '1', oracle.baseline.tag).toString().trim();
  if (commit !== oracle.baseline.commit) throw new Error('baseline tag moved');
  const tree = git('rev-parse', `${commit}^{tree}`).toString().trim();
  if (tree !== oracle.baseline.tree) throw new Error('baseline tree mismatch');
  if (sha256(git('show', `${commit}:bun.lock`)) !== oracle.baseline.bunLockSha256) {
    throw new Error('baseline lock mismatch');
  }
  const localBindings: Array<[string, string, string]> = [
    [runnerPath, oracle.baseline.runnerSha256, 'runner'],
    [generatorPath, oracle.baseline.generatorSha256, 'generator'],
    [corpusPath, oracle.baseline.corpusSha256, 'corpus'],
    [fixtureManifestPath, oracle.baseline.fixtureManifestSha256, 'fixture manifest'],
  ];
  for (const [path, expected, label] of localBindings) {
    if (sha256(readFileSync(path)) !== expected) throw new Error(`document-AST ${label} mismatch`);
  }
  for (const [sourceFile, expected] of Object.entries(oracle.baseline.entrypointSha256)) {
    if (sha256(git('show', `${commit}:${sourceFile}`)) !== expected) {
      throw new Error(`baseline entrypoint mismatch: ${sourceFile}`);
    }
  }
  const fixturePath = join(repoRoot, fixtureManifest.fixture.path);
  if (!existsSync(fixturePath)) throw new Error('missing document-AST fixture');
  const fixtureBytes = readFileSync(fixturePath);
  if (
    fixtureBytes.length !== fixtureManifest.fixture.bytes ||
    sha256(fixtureBytes) !== fixtureManifest.fixture.sha256 ||
    fixtureManifest.fixture.sha256 !== oracle.baseline.fixtureSha256
  ) {
    throw new Error('document-AST fixture digest mismatch');
  }
  const expectedIds = [
    'ast-only-hidden-semantic-chunk-dependencies',
    'ast-reuses-exposed-plain-chunks',
    'ast-reuses-exposed-semantic-elements-and-chunks',
    'ast-selected-pages-dedupe-sort-and-gap-context',
    'ast-no-heading-warning',
  ];
  if (
    JSON.stringify(corpus.cases.map((entry) => entry.id)) !== JSON.stringify(expectedIds) ||
    JSON.stringify(Object.keys(oracle.expectations).sort()) !== JSON.stringify([...expectedIds].sort())
  ) {
    throw new Error('document-AST corpus and oracle must contain the exact five case IDs');
  }
  const oracleText = JSON.stringify(oracle.expectations);
  for (const required of [
    'version', 'profile', 'root', 'summary', 'warnings', 'id', 'type', 'page_start', 'page_end',
    'element_ids', 'chunk_ids', 'bounding_boxes', 'title', 'text', 'level', 'semantic_role',
    'section_path', 'continued_from_section_id', 'children', 'selected_pages', 'page_count',
    'node_count', 'section_count', 'paragraph_count', 'list_item_count', 'caption_count',
    'header_count', 'footer_count', 'section_context_node_count',
    'cross_page_section_context_count', 'caption_link_count', 'table_count', 'image_count',
    'figure_count', 'chart_count', 'formula_count', 'diagram_count', 'visual_enrichment_count',
    'visual_enrichment_kind_counts', 'max_depth',
  ]) {
    if (!oracleText.includes(`"${required}"`)) throw new Error(`oracle lacks claimed AST field: ${required}`);
  }
  return {
    baselineCommit: commit,
    baselineTree: tree,
    corpusSha256: sha256(readFileSync(corpusPath)),
    oracleSha256: sha256(readFileSync(oraclePath)),
    runnerSha256: sha256(readFileSync(runnerPath)),
    generatorSha256: sha256(readFileSync(generatorPath)),
    fixtureManifestSha256: sha256(readFileSync(fixtureManifestPath)),
    fixtureSha256: fixtureManifest.fixture.sha256,
  };
}

function materialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key === 'fixture' ? 'path' : key,
        key === 'fixture' && typeof entry === 'string' ? join(fixtureDir, entry) : materialize(entry),
      ])
    );
  }
  return value;
}

function leafPaths(value: Json, prefix: Array<string | number> = []): Array<Array<string | number>> {
  if (Array.isArray(value)) return value.flatMap((entry, index) => leafPaths(entry, [...prefix, index]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => leafPaths(entry, [...prefix, key]));
  }
  return [prefix];
}

function mutateAt(value: Json, path: Array<string | number>): Json {
  const mutated = structuredClone(value);
  let cursor = mutated as Json;
  for (const segment of path.slice(0, -1)) cursor = (cursor as never)[segment as never];
  const key = path.at(-1)!;
  const original = (cursor as never)[key as never] as Json;
  const replacement: Json =
    typeof original === 'string'
      ? `${original}-mutated`
      : typeof original === 'number'
        ? original + 1
        : typeof original === 'boolean'
          ? !original
          : original === null
            ? 'mutated'
            : 'mutated';
  (cursor as never)[key as never] = replacement as never;
  return mutated;
}

const authority = verifyAuthority();
if (!existsSync(rustCliPath)) throw new Error('missing release Rust CLI');
const requireSuccessfulSubprocess = (
  result: ReturnType<typeof spawnSync>,
  label: string
): void => {
  if (result.status !== 0) throw new Error(result.stderr?.toString() || `${label} exited nonzero`);
};
let subprocessNonzeroRejected = false;
try {
  requireSuccessfulSubprocess(
    spawnSync(process.execPath, ['-e', 'process.exit(17)'], { encoding: 'utf8' }),
    'nonzero rejection probe'
  );
} catch {
  subprocessNonzeroRejected = true;
}
if (!subprocessNonzeroRejected) throw new Error('nonzero subprocess was not rejected');
const failures: Array<{ id: string; expected: Json; actual: Json }> = [];
const observations: Record<string, Json> = {};
for (const entry of corpus.cases) {
  const result = spawnSync(rustCliPath, [], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: JSON.stringify({ tool: 'read_pdf', input: materialize(entry.input) }),
    maxBuffer: 80 * 1024 * 1024,
  });
  requireSuccessfulSubprocess(result, `Rust document-AST case: ${entry.id}`);
  if (!result.stdout) throw new Error(result.stderr || 'Rust CLI produced no JSON');
  const envelope = JSON.parse(result.stdout) as Record<string, unknown>;
  const text = (envelope.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text;
  if (!text) throw new Error('Rust CLI response lacks structured text');
  const payload = JSON.parse(text) as {
    results: Array<{ success: boolean; data: Record<string, unknown> }>;
  };
  if (!payload.results[0]?.success) throw new Error(`Rust document-AST case failed: ${entry.id}`);
  const actual = canonical(payload.results[0].data);
  const expected = oracle.expectations[entry.id]!;
  observations[entry.id] = actual;
  if (!same(actual, expected)) failures.push({ id: entry.id, expected, actual });
}

let probedPathCount = 0;
for (const [caseId, expectation] of Object.entries(oracle.expectations)) {
  const documentAst = (expectation as { document_ast?: Json }).document_ast;
  if (!documentAst) throw new Error(`oracle lacks document-AST mutation source: ${caseId}`);
  const paths = leafPaths(documentAst);
  const missedPaths = paths.filter((path) => same(mutateAt(documentAst, path), documentAst));
  if (missedPaths.length > 0) {
    throw new Error(`AST canonical comparison missed ${missedPaths.length} leaf mutations in ${caseId}`);
  }
  probedPathCount += paths.length;
}
const mutationSensitive = { allClaimedFields: true, probedPathCount };

const candidateSha = git('rev-parse', 'HEAD').toString().trim();
if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== candidateSha) {
  throw new Error(
    `candidate SHA assertion mismatch: expected ${process.env.CANDIDATE_SHA}, executed ${candidateSha}`
  );
}
const report = {
  schemaVersion: 1,
  profile: 'pdf_reader_v3014_document_ast_result',
  candidateSha,
  ...authority,
  caseCount: corpus.cases.length,
  passed: corpus.cases.length - failures.length,
  skipped: 0,
  subprocessNonzeroRejected,
  mutationSensitive,
  pass: failures.length === 0,
  observations,
  failures,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await Bun.write(outputPath, serialized);
console.log(serialized.trimEnd());
if (failures.length > 0) process.exit(1);
