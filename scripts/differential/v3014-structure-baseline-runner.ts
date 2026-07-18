#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAutoDetailOptions,
  buildReadOptions,
} from "./src/pdf/autoReadPolicy.ts";
import { PdfSessionScope } from "./src/pdf/pdfSession.ts";
import { processSingleSource } from "./src/pdf/readCoordinator.ts";

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
  output[entry.id] = {
    num_pages: data.num_pages,
    structure_trees: data.structure_trees ?? null,
    accessibility_report: data.accessibility_report ?? null,
    private_surface_absence: {
      annotations: data.annotations === undefined,
      form_fields: data.form_fields === undefined,
      permissions: data.permissions === undefined,
      mark_info: data.mark_info === undefined,
      outline: data.outline === undefined,
    },
    accessibility_map: data.document_map
      ? {
          pages: data.document_map.pages.map((page) => ({
            page: page.page,
            accessibility_report_page_index:
              page.accessibility_report_page_index,
            accessibility_issue_indexes: page.accessibility_issue_indexes,
            accessibility_high_issue_indexes:
              page.accessibility_high_issue_indexes,
            accessibility_medium_issue_indexes:
              page.accessibility_medium_issue_indexes,
            accessibility_low_issue_indexes:
              page.accessibility_low_issue_indexes,
            accessibility_grade: page.accessibility_grade,
            accessibility_score: page.accessibility_score,
            accessibility_issue_count: page.accessibility_issue_count,
          })),
          routing: {
            accessibility_review_pages:
              data.document_map.routing.accessibility_review_pages,
            accessibility_high_issue_pages:
              data.document_map.routing.accessibility_high_issue_pages,
            accessibility_medium_issue_pages:
              data.document_map.routing.accessibility_medium_issue_pages,
            accessibility_low_issue_pages:
              data.document_map.routing.accessibility_low_issue_pages,
          },
          summary: Object.fromEntries(
            [
              "accessibility_report_page_count",
              "accessibility_score",
              "accessibility_grade",
              "accessibility_issue_count",
              "accessibility_document_issue_count",
              "accessibility_page_issue_count",
              "accessibility_high_issue_count",
              "accessibility_medium_issue_count",
              "accessibility_low_issue_count",
              "accessibility_pages_with_issues_count",
              "accessibility_pages_with_high_issues_count",
              "accessibility_page_grade_counts",
            ].map((key) => [key, data.document_map!.summary[key]])
          ),
        }
      : null,
  };
}
console.log(JSON.stringify(output));
