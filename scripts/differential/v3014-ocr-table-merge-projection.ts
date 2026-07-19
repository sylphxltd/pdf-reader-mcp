#!/usr/bin/env bun

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const FIXTURES = [
  'v3014-selectable-table-v1.pdf',
  'v3014-visual-v1.pdf',
] as const;

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
  const n = number(value, context);
  if (!Number.isInteger(n)) throw new Error(`${context} must be integer`);
  return n;
};
const round = (value: number): number => Math.round(value * 1000) / 1000;

const normalizeSource = (value: string): string => {
  const normalized = value.replaceAll('\\', '/');
  for (const marker of FIXTURES) {
    if (normalized === marker || normalized.endsWith(`/${marker}`)) {
      return `<fixture>/test/fixtures/differential/${marker}`;
    }
    const index = normalized.lastIndexOf(marker);
    if (index >= 0) {
      return `<fixture>/test/fixtures/differential/${marker}${normalized.slice(index + marker.length)}`;
    }
  }
  return normalized;
};

const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
  if (Object.hasOwn(response, 'result') && response.result && typeof response.result === 'object') {
    const result = response.result as Record<string, unknown>;
    if (Array.isArray(result.content)) {
      const textPart = result.content.find(
        (entry) => entry && typeof entry === 'object' && (entry as { type?: string }).type === 'text'
      ) as { text?: string } | undefined;
      if (textPart?.text) return record(JSON.parse(textPart.text), 'content text json');
    }
    if (result.structuredContent && typeof result.structuredContent === 'object') {
      return result.structuredContent as Record<string, unknown>;
    }
  }
  return response;
};

const canonicalTableInfo = (value: unknown, context: string): Json => {
  const table = record(value, context);
  const provenance = record(table.provenance, `${context}.provenance`);
  const box = record(table.bounding_box, `${context}.bounding_box`);
  const projected: Record<string, Json> = {
    page: integer(table.page, `${context}.page`),
    tableIndex: integer(table.tableIndex, `${context}.tableIndex`),
    rowCount: integer(table.rowCount, `${context}.rowCount`),
    colCount: integer(table.colCount, `${context}.colCount`),
    bounding_box: {
      left: round(number(box.left, `${context}.bounding_box.left`)),
      bottom: round(number(box.bottom, `${context}.bounding_box.bottom`)),
      right: round(number(box.right, `${context}.bounding_box.right`)),
      top: round(number(box.top, `${context}.bounding_box.top`)),
    },
    provenance: {
      source: string(provenance.source, `${context}.provenance.source`),
      // Cross-runtime engine labels differ truthfully (pdfjs vs pdf-reader-core).
      // Claim selectable vs OCR source identity, not exact engine strings.
      engine:
        string(provenance.source, `${context}.provenance.source`) === 'selectable_text'
          ? 'selectable-runtime'
          : string(provenance.engine, `${context}.provenance.engine`),
    },
  };
  if (Object.hasOwn(provenance, 'ocr_source_render_evidence_id')) {
    (projected.provenance as Record<string, Json>).ocr_source_render_evidence_id = string(
      provenance.ocr_source_render_evidence_id,
      `${context}.provenance.ocr_source_render_evidence_id`
    );
  }
  if (Object.hasOwn(table, 'continuation') && table.continuation) {
    const continuation = record(table.continuation, `${context}.continuation`);
    const cont: Record<string, Json> = {
      role: string(continuation.role, `${context}.continuation.role`),
      groupId: string(continuation.groupId, `${context}.continuation.groupId`),
    };
    if (Object.hasOwn(continuation, 'previousTableId')) {
      cont.previousTableId = string(
        continuation.previousTableId,
        `${context}.continuation.previousTableId`
      );
    }
    if (Object.hasOwn(continuation, 'nextTableId')) {
      cont.nextTableId = string(continuation.nextTableId, `${context}.continuation.nextTableId`);
    }
    projected.continuation = cont;
  }
  return projected;
};

const canonicalMap = (value: unknown, context: string): Json => {
  const map = record(value, context);
  const summary = record(map.summary ?? {}, `${context}.summary`);
  const routing = record(map.routing ?? {}, `${context}.routing`);
  const layers = array(map.layers ?? [], `${context}.layers`).map((layer, index) =>
    string(layer, `${context}.layers[${String(index)}]`)
  );
  return {
    has_ocr_layer: layers.includes('ocr_text_layer'),
    table_element_count: integer(
      summary.table_element_count ?? 0,
      `${context}.summary.table_element_count`
    ),
    ocr_page_count: integer(summary.ocr_page_count ?? 0, `${context}.summary.ocr_page_count`),
    ocr_applied_pages: array(
      routing.ocr_applied_pages ?? [],
      `${context}.routing.ocr_applied_pages`
    ).map((page, index) => integer(page, `${context}.routing.ocr_applied_pages[${String(index)}]`)),
  };
};

export const canonicalOcrTableMergeResult = (response: unknown): Json => {
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
      const tableInfo = Object.hasOwn(data, 'table_info')
        ? array(data.table_info, `results[${String(index)}].data.table_info`).map((table, tableIndex) =>
            canonicalTableInfo(
              table,
              `results[${String(index)}].data.table_info[${String(tableIndex)}]`
            )
          )
        : [];
      const dataProjected: Record<string, Json> = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
        has_ocr_text_layer: Object.hasOwn(data, 'ocr_text_layer'),
        table_count: tableInfo.length,
        table_info: tableInfo,
        table_provenance_sources: tableInfo.map(
          (table) => (table as Record<string, Json>).provenance as Record<string, Json>
        ).map((prov) => string(prov.source, 'prov.source')),
      };
      if (Object.hasOwn(data, 'document_map')) {
        dataProjected.document_map = canonicalMap(
          data.document_map,
          `results[${String(index)}].data.document_map`
        );
      }
      projected.data = dataProjected;
      return projected;
    }
  );
  return {
    profile: string(
      record(resultsSource, 'profile source').profile ?? 'pdf_read_results',
      'profile'
    ),
    results,
  };
};
