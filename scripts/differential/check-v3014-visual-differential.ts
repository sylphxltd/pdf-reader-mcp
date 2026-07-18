#!/usr/bin/env bun

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Content = { type: string; text?: string; data?: string; mimeType?: string };
type ToolResult = { content: Content[]; isError?: boolean };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../..');
const fixtureDir = join(repoRoot, 'test/fixtures/differential');
const corpusPath = join(scriptDir, 'fixtures/v3014-visual-corpus.json');
const oraclePath = join(scriptDir, 'fixtures/v3014-visual-oracle.json');
const fixtureManifestPath = join(scriptDir, 'fixtures/v3014-visual-fixtures.json');
const serverPath = join(repoRoot, 'target/release/pdf-reader-mcp-server');
const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : undefined;

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8')) as {
  baseline: {
    tag: string;
    commit: string;
    tree: string;
    bunLockSha256: string;
    entrypointSha256: Record<string, string>;
  };
  expectations: Record<string, Json>;
};
const fixtureManifest = JSON.parse(readFileSync(fixtureManifestPath, 'utf8')) as {
  fixtures: Array<{ path: string; bytes: number; sha256: string }>;
};
const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');
const git = (...args: string[]): Buffer => {
  const result = spawnSync('git', args, { cwd: repoRoot });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
};

function verifyAuthority(): Record<string, string> {
  const commit = git('rev-list', '-n', '1', oracle.baseline.tag).toString().trim();
  if (commit !== oracle.baseline.commit) throw new Error('v3.0.14 visual baseline tag moved');
  const tree = git('rev-parse', `${commit}^{tree}`).toString().trim();
  if (tree !== oracle.baseline.tree) throw new Error('v3.0.14 visual baseline tree mismatch');
  if (sha256(git('show', `${commit}:bun.lock`)) !== oracle.baseline.bunLockSha256) {
    throw new Error('v3.0.14 visual baseline lock mismatch');
  }
  for (const [path, expected] of Object.entries(oracle.baseline.entrypointSha256)) {
    if (sha256(git('show', `${commit}:${path}`)) !== expected) {
      throw new Error(`v3.0.14 visual baseline entrypoint mismatch: ${path}`);
    }
  }
  for (const fixture of fixtureManifest.fixtures) {
    const path = join(repoRoot, fixture.path);
    const bytes = readFileSync(path);
    if (bytes.length !== fixture.bytes || sha256(bytes) !== fixture.sha256) {
      throw new Error(`visual fixture mismatch: ${fixture.path}`);
    }
  }
  const ids = corpus.cases.map((entry) => entry.id);
  if (ids.length !== 7 || new Set(ids).size !== ids.length) {
    throw new Error(`visual corpus must contain 7 unique cases (got ${ids.length})`);
  }
  if (JSON.stringify(ids.sort()) !== JSON.stringify(Object.keys(oracle.expectations).sort())) {
    throw new Error('visual corpus and oracle IDs differ');
  }
  return {
    baselineCommit: commit,
    baselineTree: tree,
    corpusSha256: sha256(readFileSync(corpusPath)),
    oracleSha256: sha256(readFileSync(oraclePath)),
    fixtureManifestSha256: sha256(readFileSync(fixtureManifestPath)),
  };
}

function materialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key === 'fixture' ? 'path' : key] =
        key === 'fixture' && typeof entry === 'string' ? join(fixtureDir, entry) : materialize(entry);
    }
    return output;
  }
  return value;
}

function stable(value: Json): Json {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stable(entry)])
    );
  }
  return value;
}

function errorCategory(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('right > left') || lower.includes('top > bottom')) {
    return 'invalid_bounding_box';
  }
  if (
    lower.includes('not found') ||
    lower.includes('no such file') ||
    lower.includes('unable to access')
  ) {
    return 'file_not_found';
  }
  return 'unknown_error';
}

function imageFacts(content: Content): Record<string, Json> {
  const bytes = Buffer.from(content.data ?? '', 'base64');
  const png = PNG.sync.read(bytes);
  const sample = (x: number, y: number): number[] => {
    const offset = (y * png.width + x) * 4;
    return Array.from(png.data.subarray(offset, offset + 4));
  };
  return {
    mime_type: content.mimeType ?? null,
    raw_base64: !(content.data ?? '').startsWith('data:'),
    png_signature: bytes.subarray(0, 8).equals(Buffer.from('\x89PNG\r\n\x1a\n', 'binary')),
    width: png.width,
    height: png.height,
    byte_length: bytes.length,
    samples: [
      sample(Math.floor(png.width / 4), Math.floor(png.height / 4)),
      sample(Math.floor((png.width * 3) / 4), Math.floor(png.height / 4)),
      sample(Math.floor(png.width / 4), Math.floor((png.height * 3) / 4)),
      sample(Math.floor((png.width * 3) / 4), Math.floor((png.height * 3) / 4)),
    ],
  } as Record<string, Json>;
}

function canonicalize(result: ToolResult): Json {
  if (result.isError) {
    return {
      outcome: 'error',
      category: errorCategory(result.content[0]?.text ?? ''),
    };
  }
  const payload = JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
  const images = result.content.filter((content) => content.type === 'image').map(imageFacts);
  const results = ((payload.results ?? []) as Array<Record<string, unknown>>).map((source) => {
    if (!source.success) {
      return {
        source: basename(String(source.source ?? '')),
        success: false,
        category: errorCategory(String(source.error ?? '')),
      };
    }
    const output: Record<string, unknown> = {
      source: basename(String(source.source ?? '')),
      success: true,
      num_pages: source.num_pages,
      warnings: source.warnings ?? [],
    };
    if (Array.isArray(source.rendered_pages)) {
      output.rendered_pages = source.rendered_pages.map((page: Record<string, unknown>) => {
        const provenance = page.provenance as Record<string, unknown>;
        if (provenance?.engine !== 'hayro' || provenance?.renderer !== 'hayro/vello_cpu') {
          throw new Error('Rust render provenance is not truthful');
        }
        const index = page.image_content_index as number | undefined;
        const image = index === undefined ? undefined : images[index - 1];
        const facts = image
          ? {
              ...image,
              byte_length_consistent: image.byte_length === page.byte_length,
              byte_length: undefined,
            }
          : null;
        return {
          page: page.page,
          evidence_id: page.evidence_id,
          width: page.width,
          height: page.height,
          scale: page.scale,
          pixel_count: page.pixel_count,
          format: page.format,
          mime_type: page.mime_type,
          rotation: page.rotation,
          provenance_source: provenance.source,
          image_content_index: index ?? null,
          inline_data_absent: !('data' in page),
          image: facts,
        };
      });
    }
    if (Array.isArray(source.regions)) {
      output.regions = source.regions.map((region: Record<string, unknown>) => {
        const provenance = region.provenance as Record<string, unknown>;
        if (provenance?.engine !== 'hayro' || provenance?.renderer !== 'hayro/vello_cpu') {
          throw new Error('Rust crop provenance is not truthful');
        }
        const index = region.image_content_index as number | undefined;
        const image = index === undefined ? undefined : images[index - 1];
        const facts = image
          ? {
              ...image,
              byte_length_consistent: image.byte_length === region.byte_length,
              byte_length: undefined,
            }
          : null;
        return {
          region_id: region.region_id,
          page: region.page,
          evidence_id: region.evidence_id,
          source_bounding_box: region.source_bounding_box,
          crop_pixels: region.crop_pixels,
          scale: region.scale,
          format: region.format,
          mime_type: region.mime_type,
          provenance_source: provenance.source,
          page_render_evidence_id: provenance.page_render_evidence_id,
          image_content_index: index ?? null,
          inline_data_absent: !('data' in region),
          image: facts,
        };
      });
    }
    return output;
  });
  return {
    outcome: 'success',
    profile: (payload.profile ?? null) as Json,
    options: (payload.render_options ?? payload.crop_options ?? null) as Json,
    content_count: result.content.length,
    results: results as Json,
  };
}

async function main() {
  if (!existsSync(serverPath)) throw new Error(`missing Rust server: ${serverPath}`);
  const authority = verifyAuthority();
  const child = spawn(serverPath, [], {
    cwd: repoRoot,
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, PDF_READER_MCP_TRANSPORT: '', MCP_TRANSPORT: '' },
  });
  let buffer = '';
  const pending = new Map<number, (value: Record<string, unknown>) => void>();
  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n');
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const response = JSON.parse(line) as Record<string, unknown>;
      const id = Number(response.id);
      pending.get(id)?.(response);
      pending.delete(id);
    }
  });
  const request = (id: number, method: string, params: unknown) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Rust MCP request ${id} timed out`));
      }, 30_000);
      pending.set(id, (value) => {
        clearTimeout(timeout);
        resolve(value);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  try {
    await request(1, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'visual-differential', version: '1' },
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
    const observations: Record<string, Json> = {};
    const failures: Array<{ id: string; expected: Json; actual: Json }> = [];
    for (const [index, entry] of corpus.cases.entries()) {
      const response = await request(index + 10, 'tools/call', {
        name: 'pdf_evidence',
        arguments: materialize(entry.input),
      });
      if (response.error) throw new Error(`Rust MCP error for ${entry.id}: ${JSON.stringify(response.error)}`);
      const actual = stable(canonicalize(response.result as ToolResult));
      const expected = stable(oracle.expectations[entry.id]!);
      observations[entry.id] = actual;
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push({ id: entry.id, expected, actual });
      }
    }
    const report = {
      schemaVersion: 1,
      profile: 'pdf_reader_v3014_visual_result',
      candidateSha:
        process.env.CANDIDATE_SHA ?? git('rev-parse', 'HEAD').toString().trim(),
      ...authority,
      caseCount: corpus.cases.length,
      passed: corpus.cases.length - failures.length,
      skipped: 0,
      pass: failures.length === 0,
      observations,
      failures,
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (outputPath) await Bun.write(outputPath, serialized);
    console.log(serialized.trimEnd());
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
  }
}

await main();
