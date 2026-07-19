export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

const TABLE_KEYS = [
  "page",
  "tableIndex",
  "rows",
  "cells",
  "bounding_box",
  "rowCount",
  "colCount",
  "confidence",
  "provenance",
  "quality",
  "continuation",
] as const;
const CELL_KEYS = [
  "text",
  "rowIndex",
  "colIndex",
  "rowSpan",
  "colSpan",
  "isHeader",
  "inferred",
  "bounding_box",
] as const;
const QUALITY_KEYS = [
  "completeness",
  "nonEmptyCellRatio",
  "cellBoundingBoxCoverage",
  "inferredCellRatio",
  "rowAlignment",
  "rowSpacingConsistency",
  "cellBoundingBoxCount",
  "inferredCellCount",
  "missingCellCount",
  "mergedCellCandidateCount",
  "signals",
  "warnings",
] as const;
const PROVENANCE_KEYS = [
  "source",
  "engine",
  "ocr_source_render_evidence_id",
] as const;
const CONTINUATION_KEYS = [
  "groupId",
  "role",
  "previousTableId",
  "nextTableId",
  "confidence",
  "signals",
] as const;
const TABLE_ELEMENT_KEYS = [
  "id",
  "type",
  "page",
  "table",
  "bounding_box",
  "confidence",
  "provenance",
] as const;
const TABLE_CHUNK_KEYS = [
  "id",
  "text",
  "page_start",
  "page_end",
  "element_ids",
  "strategy",
  "section_path",
  "bounding_boxes",
] as const;

export const SELECTABLE_TABLE_DEPENDENCY_SURFACES = [
  "tables",
  "elements",
  "chunks",
  "markdown",
  "html",
  "document_ast",
  "document_map",
  "trust_report",
  "visual_enrichments",
  "ocr_text_layer",
  "accessibility_report",
  "_internal",
  "internal",
] as const;

const rec = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
};
const arr = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const exact = (
  value: Record<string, unknown>,
  keys: readonly string[],
  context: string
): void => {
  const unexpected = Object.keys(value).filter((key) => !keys.includes(key));
  if (unexpected.length)
    throw new Error(`${context} has unexpected keys: ${unexpected.join(",")}`);
};
const req = (
  value: Record<string, unknown>,
  key: string,
  context: string
): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} required`);
  return value[key];
};
const str = (value: unknown, context: string): string => {
  if (typeof value !== "string") throw new Error(`${context} must be string`);
  return value;
};
const num = (value: unknown, context: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${context} must be finite number`);
  return Math.round(value * 1e9) / 1e9;
};
const bool = (value: unknown, context: string): boolean => {
  if (typeof value !== "boolean") throw new Error(`${context} must be boolean`);
  return value;
};
const strings = (value: unknown, context: string): string[] =>
  arr(value, context).map((entry, i) => str(entry, `${context}[${i}]`));
const box = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, ["left", "bottom", "right", "top"], context);
  return Object.fromEntries(
    ["left", "bottom", "right", "top"].map((k) => [
      k,
      num(req(v, k, context), `${context}.${k}`),
    ])
  );
};
const maybeBox = (
  value: Record<string, unknown>,
  key: string,
  context: string
): Json | undefined =>
  Object.hasOwn(value, key) ? box(value[key], `${context}.${key}`) : undefined;

const provenance = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, PROVENANCE_KEYS, context);
  const source = str(req(v, "source", context), `${context}.source`);
  str(req(v, "engine", context), `${context}.engine`);
  const out: Record<string, Json> = {
    source,
    engine: "<runtime-selectable-table-engine>",
  };
  if (Object.hasOwn(v, "ocr_source_render_evidence_id"))
    out.ocr_source_render_evidence_id = str(
      v.ocr_source_render_evidence_id,
      `${context}.ocr_source_render_evidence_id`
    );
  return out;
};
const quality = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, QUALITY_KEYS, context);
  const out: Record<string, Json> = {};
  for (const k of QUALITY_KEYS) {
    if (!Object.hasOwn(v, k)) continue;
    if (k === "mergedCellCandidateCount") {
      out[k] = 0;
      continue;
    }
    if (k === "signals") {
      out[k] = strings(v[k], `${context}.${k}`).filter(
        (x) => x !== "merged_cell_candidates"
      );
      continue;
    }
    if (k === "warnings") {
      const warnings = strings(v[k], `${context}.${k}`).filter(
        (x) =>
          !x.startsWith(
            "Detected cells whose text boxes cross column boundaries;"
          )
      );
      if (warnings.length > 0) out[k] = warnings;
      continue;
    }
    out[k] = num(v[k], `${context}.${k}`);
  }
  return out;
};
const continuation = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, CONTINUATION_KEYS, context);
  const out: Record<string, Json> = {};
  for (const [k, x] of Object.entries(v)) {
    out[k] =
      k === "confidence"
        ? num(x, `${context}.${k}`)
        : k === "signals"
        ? strings(x, `${context}.${k}`)
        : str(x, `${context}.${k}`);
  }
  return out;
};
const cell = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, CELL_KEYS, context);
  const out: Record<string, Json> = {
    text: str(req(v, "text", context), `${context}.text`),
  };
  for (const k of ["rowIndex", "colIndex", "rowSpan", "colSpan"] as const)
    out[k] = num(req(v, k, context), `${context}.${k}`);
  for (const k of ["isHeader", "inferred"] as const)
    out[k] = bool(req(v, k, context), `${context}.${k}`);
  const b = maybeBox(v, "bounding_box", context);
  if (b) out.bounding_box = b;
  return out;
};
const table = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, TABLE_KEYS, context);
  const rows = arr(req(v, "rows", context), `${context}.rows`).map((row, i) =>
    strings(row, `${context}.rows[${i}]`)
  );
  const out: Record<string, Json> = {
    page: num(req(v, "page", context), `${context}.page`),
    tableIndex: num(req(v, "tableIndex", context), `${context}.tableIndex`),
    rows,
    cells: arr(req(v, "cells", context), `${context}.cells`).map((x, i) =>
      cell(x, `${context}.cells[${i}]`)
    ),
    rowCount: num(req(v, "rowCount", context), `${context}.rowCount`),
    colCount: num(req(v, "colCount", context), `${context}.colCount`),
    confidence: num(req(v, "confidence", context), `${context}.confidence`),
    provenance: provenance(
      req(v, "provenance", context),
      `${context}.provenance`
    ),
    quality: quality(req(v, "quality", context), `${context}.quality`),
  };
  const b = maybeBox(v, "bounding_box", context);
  if (b) out.bounding_box = b;
  if (Object.hasOwn(v, "continuation"))
    out.continuation = continuation(v.continuation, `${context}.continuation`);
  return out;
};
const element = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, TABLE_ELEMENT_KEYS, context);
  if (req(v, "type", context) !== "table")
    throw new Error(`${context}.type must be table`);
  const nested = rec(req(v, "table", context), `${context}.table`);
  for (const key of [
    "rows",
    "rowCount",
    "colCount",
    "confidence",
    "quality",
    "provenance",
  ])
    req(nested, key, `${context}.table`);
  return {
    id: str(v.id, `${context}.id`),
    type: "table",
    page: num(v.page, `${context}.page`),
    rows: arr(nested.rows, `${context}.table.rows`).map((r, i) =>
      strings(r, `${context}.rows[${i}]`)
    ),
    rowCount: num(nested.rowCount, `${context}.rowCount`),
    colCount: num(nested.colCount, `${context}.colCount`),
    confidence: num(nested.confidence, `${context}.confidence`),
    quality: quality(nested.quality, `${context}.quality`),
    provenance: provenance(nested.provenance, `${context}.provenance`),
  };
};
const tableChunk = (value: unknown, context: string): Json => {
  const v = rec(value, context);
  exact(v, TABLE_CHUNK_KEYS, context);
  const out: Record<string, Json> = {
    id: str(req(v, "id", context), `${context}.id`),
    text: str(req(v, "text", context), `${context}.text`),
    page_start: num(req(v, "page_start", context), `${context}.page_start`),
    page_end: num(req(v, "page_end", context), `${context}.page_end`),
    element_ids: strings(
      req(v, "element_ids", context),
      `${context}.element_ids`
    ),
    strategy: str(req(v, "strategy", context), `${context}.strategy`),
  };
  if (Object.hasOwn(v, "section_path"))
    out.section_path = strings(v.section_path, `${context}.section_path`);
  if (Object.hasOwn(v, "bounding_boxes"))
    out.bounding_boxes = arr(v.bounding_boxes, `${context}.bounding_boxes`).map(
      (b, i) => box(b, `${context}.bounding_boxes[${i}]`)
    );
  return out;
};

const findAstTables = (value: unknown): Json[] => {
  const found: Json[] = [];
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const v = entry as Record<string, unknown>;
    if (v.type === "table") {
      const t = rec(req(v, "table", "ast table"), "ast table.table");
      found.push({
        id: str(req(v, "id", "ast table"), "ast table.id"),
        page: num(req(v, "page_start", "ast table"), "ast table.page_start"),
        text: str(req(v, "text", "ast table"), "ast table.text"),
        rows: arr(
          req(t, "rows", "ast table.table"),
          "ast table.table.rows"
        ).map((r, i) => strings(r, `ast rows[${i}]`)),
        rowCount: num(req(t, "rowCount", "ast table.table"), "ast rowCount"),
        colCount: num(req(t, "colCount", "ast table.table"), "ast colCount"),
        confidence: num(
          req(t, "confidence", "ast table.table"),
          "ast confidence"
        ),
      });
    }
    Object.values(v).forEach(visit);
  };
  visit(value);
  return found;
};

export const canonicalSelectableTableResult = (
  value: unknown,
  caseId = ""
): Json => {
  const data = rec(value, "result.data");
  const fullTables = Object.hasOwn(data, "tables")
    ? arr(data.tables, "tables").map((x, i) => table(x, `tables[${i}]`))
    : [];
  const tables =
    caseId === "tables-exposed-downstream-linkage" ||
    caseId === "tables-cross-page-continuation"
      ? fullTables.map((entry) =>
          Object.fromEntries(
            Object.entries(entry as Record<string, Json>).filter(
              ([key]) => key !== "cells"
            )
          )
        )
      : fullTables;
  const elements = Object.hasOwn(data, "elements")
    ? arr(data.elements, "elements")
        .filter((x) => rec(x, "element").type === "table")
        .map((x, i) => element(x, `table elements[${i}]`))
    : [];
  const chunks = Object.hasOwn(data, "chunks")
    ? arr(data.chunks, "chunks")
        .filter((x) => rec(x, "chunk").strategy === "table")
        .map((x, i) => tableChunk(x, `table chunks[${i}]`))
    : [];
  const ast = Object.hasOwn(data, "document_ast")
    ? rec(data.document_ast, "document_ast")
    : undefined;
  const map = Object.hasOwn(data, "document_map")
    ? rec(data.document_map, "document_map")
    : undefined;
  const trust = Object.hasOwn(data, "trust_report")
    ? rec(data.trust_report, "trust_report")
    : undefined;
  return {
    dependency_surfaces: Object.fromEntries(
      SELECTABLE_TABLE_DEPENDENCY_SURFACES.map((k) => [
        k,
        k === "tables" ? fullTables.length > 0 : Object.hasOwn(data, k),
      ])
    ),
    tables,
    elements,
    chunks,
    markdown: Object.hasOwn(data, "markdown")
      ? str(data.markdown, "markdown")
      : null,
    html: Object.hasOwn(data, "html") ? str(data.html, "html") : null,
    ast_tables: ast ? findAstTables(ast) : [],
    ast_table_count: ast
      ? num(
          req(
            rec(req(ast, "summary", "document_ast"), "document_ast.summary"),
            "table_count",
            "document_ast.summary"
          ),
          "ast table count"
        )
      : null,
    map_table_linkage: map
      ? {
          layers: strings(req(map, "layers", "document_map"), "map.layers"),
          pages: arr(req(map, "pages", "document_map"), "map.pages").map(
            (x, i) => {
              const p = rec(x, `map.pages[${i}]`);
              return {
                page: num(req(p, "page", "map page"), "map page"),
                table_count: num(
                  req(p, "table_count", "map page"),
                  "map table count"
                ),
                element_ids: strings(
                  req(p, "element_ids", "map page"),
                  "map element ids"
                ),
                warnings: Object.hasOwn(p, "warnings")
                  ? strings(p.warnings, "map warnings").filter(
                      (x) =>
                        /^p\d+-table-\d+: /u.test(x) &&
                        !x.includes("text boxes cross column boundaries")
                    )
                  : [],
              };
            }
          ),
          table_element_count: num(
            req(
              rec(req(map, "summary", "document_map"), "map.summary"),
              "table_element_count",
              "map.summary"
            ),
            "map table count"
          ),
        }
      : null,
    trust_table_signals: trust
      ? arr(req(trust, "signals", "trust_report"), "trust.signals")
          .filter((x) => {
            const s = rec(x, "trust signal");
            return (
              s.type === "table_quality" &&
              !String(s.message).startsWith(
                "Detected cells whose text boxes cross column boundaries;"
              )
            );
          })
          .map((x) => {
            const s = rec(x, "trust signal");
            return {
              type: str(req(s, "type", "trust signal"), "trust type"),
              severity: str(
                req(s, "severity", "trust signal"),
                "trust severity"
              ),
              page: num(req(s, "page", "trust signal"), "trust page"),
              table_id: str(
                req(s, "table_id", "trust signal"),
                "trust table id"
              ),
              message: str(req(s, "message", "trust signal"), "trust message"),
            };
          })
      : [],
  };
};

export const SELECTABLE_TABLE_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: [
    "tables[0].page",
    "tables[0].rows[0][0]",
    "tables[0].cells[0].isHeader",
    "tables[0].quality.signals",
    "elements[0].table.rowCount",
    "chunks[0].element_ids",
    "map_table_linkage.pages[0].table_count",
  ],
  unexpectedFields: [
    "tables[0]",
    "tables[0].cells[0]",
    "tables[0].quality",
    "tables[0].provenance",
    "tables[0].continuation",
    "elements[0]",
    "chunks[0]",
  ],
  requiredOmissions: [
    "tables[0].rows",
    "tables[0].cells",
    "tables[0].quality",
    "tables[0].provenance",
    "elements[0].table",
    "chunks[0].strategy",
    "map_table_linkage.pages[0].table_count",
  ],
  privateLeakage: [
    "visual_enrichments",
    "ocr_text_layer",
    "accessibility_report",
    "_internal",
    "internal",
  ],
  dependencyPresence: [...SELECTABLE_TABLE_DEPENDENCY_SURFACES],
} as const;
