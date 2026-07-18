#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAutoDetailOptions,
  buildReadOptions,
} from "./src/pdf/autoReadPolicy.ts";
import { PdfSessionScope } from "./src/pdf/pdfSession.ts";
import { processSingleSource } from "./src/pdf/readCoordinator.ts";
import { inspectPdfSource } from "./src/pdf/inspector.ts";
import {
  canonicalInspect,
  canonicalReadStructure,
} from "./v3014-structure-projection.ts";

const [corpusPath, fixtureDir] = process.argv.slice(2);
const corpus = JSON.parse(readFileSync(corpusPath!, "utf8")) as {
  cases: Array<{ id: string; input: Record<string, unknown> }>;
};
const materialize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key === "fixture" ? "path" : key,
        key === "fixture"
          ? join(fixtureDir!, String(entry))
          : materialize(entry),
      ])
    );
  return value;
};
const output: Record<string, unknown> = {};
const pdfjsPackage = JSON.parse(
  readFileSync(
    join(process.cwd(), "node_modules/pdfjs-dist/package.json"),
    "utf8"
  )
);
if (pdfjsPackage.version !== "6.0.227") {
  throw new Error(`unexpected pdfjs-dist runtime ${pdfjsPackage.version}`);
}
for (const entry of corpus.cases) {
  const input = materialize(entry.input) as Record<string, unknown>;
  const effective =
    input.auto === true
      ? {
          ...buildAutoDetailOptions((input.auto_detail ?? "balanced") as never),
          ...input,
        }
      : input;
  const source = (effective.sources as Array<Record<string, unknown>>)[0]!;
  const result = await processSingleSource(
    source,
    buildReadOptions(effective as never),
    new PdfSessionScope()
  );
  if (!result.success) throw new Error(result.error);
  const data = result.data!;
  output[entry.id] = canonicalReadStructure(data);
}
const inspectSource = { path: join(fixtureDir!, "v3014-structure-v1.pdf") };
const inspected = await inspectPdfSource(
  inspectSource,
  { sample_pages: 2, include_metadata: true },
  new PdfSessionScope()
);
if (!inspected.success) throw new Error(inspected.error);
output["inspect-tagged"] = canonicalInspect(inspected.data!);
console.log(JSON.stringify(output));
