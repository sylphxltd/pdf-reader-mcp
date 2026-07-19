#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildReadOptions } from "./src/pdf/autoReadPolicy.ts";
import { PdfSessionScope } from "./src/pdf/pdfSession.ts";
import { processSingleSource } from "./src/pdf/readCoordinator.ts";
import { canonicalSelectableTableResult } from "./v3014-selectable-table-projection.ts";

const [corpusPath, fixtureDir] = process.argv.slice(2);
if (!corpusPath || !fixtureDir)
  throw new Error("usage: runner <corpus.json> <fixture-dir>");
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};
const expectations: Record<string, unknown> = {};
for (const entry of corpus.cases) {
  const input = structuredClone(entry.input);
  const sources = input.sources as Array<Record<string, unknown>>;
  for (const source of sources) {
    if (typeof source.fixture === "string") {
      source.path = join(fixtureDir, source.fixture);
      delete source.fixture;
    }
  }
  const result = await processSingleSource(
    sources[0]!,
    buildReadOptions(input as never),
    new PdfSessionScope()
  );
  if (!result.success || !result.data)
    throw new Error(result.error ?? `${entry.id} failed`);
  // The public read_pdf handler strips the internal full-row table dependency unless
  // include_tables was explicitly requested. Keep that visibility contract while
  // retaining full tables for the exact selectable-table semantic projection.
  if (input.include_tables !== true) delete result.data.tables;
  expectations[entry.id] = canonicalSelectableTableResult(
    result.data,
    entry.id
  );
}
console.log(JSON.stringify(expectations));
