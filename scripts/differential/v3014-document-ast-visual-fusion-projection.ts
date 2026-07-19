#!/usr/bin/env bun

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be finite`);
  }
  return value;
};
const integer = (value: unknown, context: string): number => {
  const valueNumber = number(value, context);
  if (!Number.isInteger(valueNumber) || valueNumber < 0) {
    throw new Error(`${context} must be a nonnegative integer`);
  }
  return valueNumber;
};
const optional = <T>(
  value: Record<string, unknown>,
  key: string,
  map: (entry: unknown) => T
): T | undefined => (Object.hasOwn(value, key) ? map(value[key]) : undefined);

const stableJson = (value: Json): Json => {
  if (Array.isArray(value)) return value.map((entry) => stableJson(entry as Json));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson((value as Record<string, Json>)[key])])
    );
  }
  return value;
};

const normalizeSource = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  const marker = 'v3014-visual-candidate-v1.pdf';
  if (normalized === marker || normalized.endsWith(`/${marker}`)) {
    return '<fixture>/test/fixtures/differential/v3014-visual-candidate-v1.pdf';
  }
  return normalized;
};

const normalizeWarning = (value: string): string => {
  const unavailable = 'Visual enrichment unavailable for ';
  if (!value.startsWith(unavailable)) return value;
  const detailIndex = value.indexOf(': ', unavailable.length);
  if (detailIndex < 0) return value;
  const source = value.slice(unavailable.length, detailIndex);
  const detail = value.slice(detailIndex + 2);
  return `${unavailable}${normalizeSource(source)}: ${detail}`;
};

const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
  if (Object.hasOwn(response, 'result')) {
    const result = record(response.result, 'tools/call result');
    if (result.isError === true) {
      return {
        isError: true,
        content: array(result.content, 'error content') as unknown as unknown[],
      };
    }
    if (Object.hasOwn(result, 'structuredContent')) {
      return record(result.structuredContent, 'structuredContent');
    }
    const content = array(result.content, 'content');
    const text = content
      .map((entry) => record(entry, 'content item'))
      .find((entry) => entry.type === 'text');
    if (!text) throw new Error('tools/call result missing text content');
    return record(JSON.parse(string(text.text, 'content text')), 'parsed content');
  }
  return response;
};

const canonicalNode = (value: unknown, context: string): Json => {
  const node = record(value, context);
  const projected: Record<string, Json> = {
    id: string(node.id, `${context}.id`),
    type: string(node.type, `${context}.type`),
    page_start: integer(node.page_start, `${context}.page_start`),
    page_end: integer(node.page_end, `${context}.page_end`),
    element_ids: array(node.element_ids, `${context}.element_ids`).map((entry, index) =>
      string(entry, `${context}.element_ids[${String(index)}]`)
    ),
  };
  const visualIds = optional(node, 'visual_enrichment_ids', (entry) =>
    array(entry, `${context}.visual_enrichment_ids`).map((item, index) =>
      string(item, `${context}.visual_enrichment_ids[${String(index)}]`)
    )
  );
  if (visualIds) projected.visual_enrichment_ids = visualIds;
  const text = optional(node, 'text', (entry) => string(entry, `${context}.text`));
  if (text !== undefined) projected.text = text;
  const confidence = optional(node, 'confidence', (entry) => number(entry, `${context}.confidence`));
  if (confidence !== undefined) projected.confidence = confidence;
  if (Object.hasOwn(node, 'visual_enrichment')) {
    const enrichment = record(node.visual_enrichment, `${context}.visual_enrichment`);
    projected.visual_enrichment = {
      id: string(enrichment.id, `${context}.visual_enrichment.id`),
      region_id: string(enrichment.region_id, `${context}.visual_enrichment.region_id`),
      page: integer(enrichment.page, `${context}.visual_enrichment.page`),
      kind: string(enrichment.kind, `${context}.visual_enrichment.kind`),
      target_element_id: string(
        enrichment.target_element_id,
        `${context}.visual_enrichment.target_element_id`
      ),
      target_element_type: string(
        enrichment.target_element_type,
        `${context}.visual_enrichment.target_element_type`
      ),
    };
  }
  if (Object.hasOwn(node, 'children')) {
    projected.children = array(node.children, `${context}.children`).map((child, index) =>
      canonicalNode(child, `${context}.children[${String(index)}]`)
    );
  }
  return projected;
};

const collectVisualNodes = (node: Record<string, unknown>): Json[] => {
  const out: Json[] = [];
  // Only nodes that own a visual enrichment payload are claimed. Parent
  // aggregation of visual_enrichment_ids is intentionally ignored here.
  if (Object.hasOwn(node, 'visual_enrichment')) {
    const projected = canonicalNode(node, 'visual-node') as Record<string, Json>;
    delete projected.children;
    out.push(projected);
  }
  for (const child of array(node.children ?? [], 'children')) {
    out.push(...collectVisualNodes(record(child, 'child')));
  }
  return out;
};

export const canonicalDocumentAstVisualFusionResult = (
  response: unknown,
  providerInvocations: string[] = []
): Json => {
  const payload = publicPayload(record(response, 'response'));
  const resultsSource = Object.hasOwn(payload, 'results')
    ? payload
    : Object.hasOwn(payload, 'data')
      ? record(payload.data, 'data')
      : payload;
  const results = array(record(resultsSource, 'results source').results, 'results').map(
    (entry, index) => {
      const result = record(entry, `results[${String(index)}]`);
      const projected: Record<string, Json> = {
        source: normalizeSource(string(result.source, `results[${String(index)}].source`)),
        success: result.success === true,
      };
      if (!result.success) return projected;
      const data = record(result.data, `results[${String(index)}].data`);
      const dataProjected: Record<string, Json> = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
        visual_enrichment_count: array(
          data.visual_enrichments ?? [],
          `results[${String(index)}].data.visual_enrichments`
        ).length,
      };
      if (Object.hasOwn(data, 'warnings')) {
        dataProjected.warnings = array(
          data.warnings,
          `results[${String(index)}].data.warnings`
        ).map((warning, warningIndex) =>
          normalizeWarning(
            string(warning, `results[${String(index)}].data.warnings[${String(warningIndex)}]`)
          )
        );
      }
      const documentAst = record(data.document_ast, `results[${String(index)}].data.document_ast`);
      const summary = record(documentAst.summary, `results[${String(index)}].data.document_ast.summary`);
      const root = record(documentAst.root, `results[${String(index)}].data.document_ast.root`);
      dataProjected.document_ast = {
        version: string(documentAst.version, 'document_ast.version'),
        profile: string(documentAst.profile, 'document_ast.profile'),
        summary: {
          selected_pages: array(summary.selected_pages, 'summary.selected_pages').map((page, pageIndex) =>
            integer(page, `summary.selected_pages[${String(pageIndex)}]`)
          ),
          visual_enrichment_count: integer(
            summary.visual_enrichment_count,
            'summary.visual_enrichment_count'
          ),
          visual_enrichment_kind_counts: record(
            summary.visual_enrichment_kind_counts,
            'summary.visual_enrichment_kind_counts'
          ) as Json,
          figure_count: integer(summary.figure_count, 'summary.figure_count'),
          chart_count: integer(summary.chart_count, 'summary.chart_count'),
          table_count: integer(summary.table_count, 'summary.table_count'),
          node_count: integer(summary.node_count, 'summary.node_count'),
        },
        visual_nodes: collectVisualNodes(root),
      };
      if (Object.hasOwn(documentAst, 'warnings')) {
        (dataProjected.document_ast as Record<string, Json>).warnings = array(
          documentAst.warnings,
          'document_ast.warnings'
        ).map((warning, warningIndex) =>
          normalizeWarning(string(warning, `document_ast.warnings[${String(warningIndex)}]`))
        );
      }
      projected.data = dataProjected;
      return projected;
    }
  );

  return stableJson({
    profile: string(
      record(resultsSource, 'profile source').profile ?? 'pdf_read_results',
      'profile'
    ),
    results,
    provider_invocations: providerInvocations,
  });
};
