import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';

interface OracleLock {
  profile: string;
  tag: string;
  commit: string;
  files: Record<string, string>;
  schemaFacts: Array<{ tool: string; pointer: string; expected: unknown }>;
  enumFacts: Array<{ tool: string; values: string[] }>;
  absentProperties: Array<{ tool: string; property: string }>;
  cases: Array<{ id: string; tool: string; accept: boolean; args: unknown }>;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(
  readFileSync(resolve(repoRoot, 'test/fixtures/v3.0.14-input-schema-oracle.json'), 'utf8')
) as OracleLock;

const git = (...args: string[]): string => {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
};

if (lock.profile !== 'pdf_reader_v3_0_14_input_schema_oracle') {
  throw new Error(`Unexpected oracle profile: ${lock.profile}`);
}

const resolvedCommit = git('rev-list', '-n', '1', lock.tag).trim();
if (resolvedCommit !== lock.commit) {
  throw new Error(`${lock.tag} moved: expected ${lock.commit}, got ${resolvedCommit}`);
}

for (const [path, expectedDigest] of Object.entries(lock.files)) {
  const source = git('show', `${lock.commit}:${path}`);
  const actualDigest = createHash('sha256').update(source).digest('hex');
  if (actualDigest !== expectedDigest) {
    throw new Error(`${lock.commit}:${path} digest mismatch: ${actualDigest}`);
  }
}

const sandbox = mkdtempSync(resolve(repoRoot, '.v3014-input-oracle-'));
try {
  for (const path of Object.keys(lock.files)) {
    const destination = resolve(sandbox, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, git('show', `${lock.commit}:${path}`));
  }

  const readModule = await import(pathToFileURL(resolve(sandbox, 'src/schemas/readPdf.ts')).href);
  const searchModule = await import(
    pathToFileURL(resolve(sandbox, 'src/schemas/searchPdf.ts')).href
  );
  const evidenceModule = await import(
    pathToFileURL(resolve(sandbox, 'src/schemas/pdfEvidence.ts')).href
  );
  const schemas: Record<string, z.ZodType> = {
    read_pdf: readModule.readPdfArgsSchema,
    search_pdf: searchModule.searchPdfArgsSchema,
    pdf_evidence: evidenceModule.pdfEvidenceArgsSchema,
  };
  const jsonSchemas = Object.fromEntries(
    Object.entries(schemas).map(([tool, schema]) => [tool, z.toJSONSchema(schema)])
  ) as Record<string, Record<string, unknown>>;
  const atPointer = (value: unknown, pointer: string): unknown =>
    pointer
      .split('/')
      .slice(1)
      .reduce<unknown>((current, key) => {
        if (typeof current !== 'object' || current === null) return undefined;
        return (current as Record<string, unknown>)[key.replaceAll('~1', '/').replaceAll('~0', '~')];
      }, value);

  for (const fact of lock.schemaFacts) {
    const actual = atPointer(jsonSchemas[fact.tool], fact.pointer);
    if (!Object.is(actual, fact.expected)) {
      throw new Error(
        `Normalized TS schema mismatch ${fact.tool}${fact.pointer}: expected ${String(fact.expected)}, got ${String(actual)}`
      );
    }
  }
  for (const fact of lock.enumFacts) {
    const serialized = JSON.stringify(jsonSchemas[fact.tool]);
    for (const value of fact.values) {
      if (!serialized.includes(JSON.stringify(value))) {
        throw new Error(`Normalized TS schema ${fact.tool} missing enum ${value}`);
      }
    }
  }
  for (const fact of lock.absentProperties) {
    if (atPointer(jsonSchemas[fact.tool], `/properties/${fact.property}`) !== undefined) {
      throw new Error(`Normalized TS schema ${fact.tool} unexpectedly exposes ${fact.property}`);
    }
  }
  for (const testCase of lock.cases) {
    const actual = schemas[testCase.tool]?.safeParse(testCase.args).success ?? false;
    if (actual !== testCase.accept) {
      throw new Error(
        `Immutable TS ${testCase.tool} case ${testCase.id}: expected accept=${testCase.accept}, got ${actual}`
      );
    }
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

console.log(
  `v3.0.14 input schema oracle: OK (${lock.commit}, files=${Object.keys(lock.files).length}, facts=${lock.schemaFacts.length}, cases=${lock.cases.length})`
);
