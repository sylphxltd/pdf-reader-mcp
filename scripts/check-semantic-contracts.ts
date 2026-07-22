#!/usr/bin/env bun
/** Validate semantic capability contracts against schema and matrix paths. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dir = join(root, 'docs/specs/semantic-contracts');
const schemaPath = join(dir, 'schema.json');
const matrixPath = join(root, 'docs/specs/pure-rust-capability-matrix.json');
const failures: string[] = [];

const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
  required: string[];
  properties: Record<string, unknown>;
};
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as {
  tools: Record<string, Record<string, string>>;
  admissionProgram?: { mode?: string };
};

if (matrix.admissionProgram?.mode !== 'capability-first-semantic-compatibility') {
  failures.push('matrix admissionProgram.mode must remain capability-first-semantic-compatibility');
}

const required = new Set(schema.required ?? []);
const contractFiles = readdirSync(dir)
  .filter((name) => name.endsWith('.json') && name !== 'schema.json')
  .sort();
if (contractFiles.length < 4) {
  failures.push('expected at least four semantic contracts');
}

const ids = new Set<string>();
for (const file of contractFiles) {
  const contract = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>;
  for (const key of required) {
    if (!(key in contract)) failures.push(`${file} missing required field ${key}`);
  }
  if (contract.schemaVersion !== 1) failures.push(`${file} schemaVersion must be 1`);
  const id = String(contract.id ?? '');
  if (!id) failures.push(`${file} missing id`);
  if (ids.has(id)) failures.push(`duplicate contract id ${id}`);
  ids.add(id);
  if (contract.status !== 'active' && contract.status !== 'draft' && contract.status !== 'superseded') {
    failures.push(`${file} has invalid status`);
  }
  const tools = contract.tools;
  if (!Array.isArray(tools) || tools.length === 0) failures.push(`${file} tools must be non-empty`);
  for (const tool of tools as string[]) {
    if (!matrix.tools[tool]) failures.push(`${file} references unknown tool ${tool}`);
  }
  const matrixPaths = (contract.matrixPaths as string[] | undefined) ?? [];
  for (const path of matrixPaths) {
    const [tool, capability] = path.replace(/^tools\./, '').split('.');
    if (!tool || !capability) {
      // tools.read_pdf alone is allowed as family pointer
      if (!matrix.tools[path.replace(/^tools\./, '')] && !matrix.tools[tool]) {
        failures.push(`${file} matrixPath not parseable: ${path}`);
      }
      continue;
    }
    if (!matrix.tools[tool] || matrix.tools[tool][capability] === undefined) {
      failures.push(`${file} matrixPath missing in matrix: ${path}`);
    }
  }
  const mustHold = contract.mustHold;
  if (!Array.isArray(mustHold) || mustHold.length === 0) {
    failures.push(`${file} mustHold must be non-empty`);
  }
  const evidence = contract.evidence as { suites?: string[] } | undefined;
  for (const suite of evidence?.suites ?? []) {
    // suite may be a script or test path
    if (!existsSync(join(root, suite)) && !suite.startsWith('test/')) {
      // allow bun test path prefixes that exist as files only when present
      if (!existsSync(join(root, suite))) {
        failures.push(`${file} evidence suite missing: ${suite}`);
      }
    } else if (!existsSync(join(root, suite))) {
      failures.push(`${file} evidence suite missing: ${suite}`);
    }
  }
}

for (const requiredId of [
  'interface-mcp-surface',
  'semantic-read-text-citation',
  'semantic-table-structure',
  'semantic-search-relevance',
  'security-resource-bounds',
]) {
  if (!ids.has(requiredId)) failures.push(`missing required semantic contract id: ${requiredId}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `[check-semantic-contracts] PASS ${contractFiles.length} contracts under capability-first admission`
);
