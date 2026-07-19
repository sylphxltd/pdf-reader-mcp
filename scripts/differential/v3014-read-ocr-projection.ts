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
  const n = number(value, context);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${context} must be nonnegative integer`);
  return n;
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
  const marker = 'v3014-visual-v1.pdf';
  if (normalized === marker || normalized.endsWith(`/${marker}`)) {
    return '<fixture>/test/fixtures/differential/v3014-visual-v1.pdf';
  }
  return normalized;
};

const normalizeWarning = (value: string): string => {
  let warning = value;
  const prefixes = [
    'OCR text layer unavailable: ',
    'include_ocr_text_layer: ',
  ];
  for (const prefix of prefixes) {
    if (warning.startsWith(prefix)) {
      // keep message body; strip source paths if embedded
      warning = warning.replaceAll('\\', '/');
      const fixture = 'test/fixtures/differential/v3014-visual-v1.pdf';
      const idx = warning.lastIndexOf(fixture);
      if (idx >= 0) {
        warning =
          warning.slice(0, idx) +
          '<fixture>/' +
          fixture +
          warning.slice(idx + fixture.length);
      }
      return warning;
    }
  }
  // invalid page warnings
  return warning;
};

const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
  if (Object.hasOwn(response, 'result')) {
    const result = record(response.result, 'tools/call result');
    if (result.isError === true) {
      return { isError: true, content: result.content as Json };
    }
    if (Object.hasOwn(result, 'structuredContent')) {
      return record(result.structuredContent, 'structuredContent');
    }
    const content = array(result.content, 'content');
    const text = content
      .map((entry) => record(entry, 'content item'))
      .find((entry) => entry.type === 'text');
    if (!text) throw new Error('missing text content');
    return record(JSON.parse(string(text.text, 'content text')), 'parsed content');
  }
  return response;
};

const canonicalWord = (value: unknown, context: string): Json => {
  const word = record(value, context);
  const box = record(word.bounding_box, `${context}.bounding_box`);
  return {
    text: string(word.text, `${context}.text`),
    confidence: number(word.confidence, `${context}.confidence`),
    bounding_box: {
      left: number(box.left, `${context}.bounding_box.left`),
      bottom: number(box.bottom, `${context}.bounding_box.bottom`),
      right: number(box.right, `${context}.bounding_box.right`),
      top: number(box.top, `${context}.bounding_box.top`),
    },
  };
};

const canonicalOcrPage = (value: unknown, context: string): Json => {
  const page = record(value, context);
  const projected: Record<string, Json> = {
    page: integer(page.page, `${context}.page`),
    text: string(page.text, `${context}.text`),
    provider: string(page.provider, `${context}.provider`),
    source_render_evidence_id: string(
      page.source_render_evidence_id,
      `${context}.source_render_evidence_id`
    ),
    provenance: {
      engine: string(
        record(page.provenance, `${context}.provenance`).engine,
        `${context}.provenance.engine`
      ),
      source: string(
        record(page.provenance, `${context}.provenance`).source,
        `${context}.provenance.source`
      ),
    },
  };
  const confidence = optional(page, 'confidence', (entry) => number(entry, `${context}.confidence`));
  if (confidence !== undefined) projected.confidence = confidence;
  const scale = optional(page, 'source_render_scale', (entry) =>
    number(entry, `${context}.source_render_scale`)
  );
  if (scale !== undefined) projected.source_render_scale = scale;
  const width = optional(page, 'source_render_width', (entry) =>
    integer(entry, `${context}.source_render_width`)
  );
  if (width !== undefined) projected.source_render_width = width;
  const height = optional(page, 'source_render_height', (entry) =>
    integer(entry, `${context}.source_render_height`)
  );
  if (height !== undefined) projected.source_render_height = height;
  if (Object.hasOwn(page, 'words')) {
    projected.words = array(page.words, `${context}.words`).map((word, index) =>
      canonicalWord(word, `${context}.words[${String(index)}]`)
    );
  }
  if (Object.hasOwn(page, 'language')) {
    projected.language = string(page.language, `${context}.language`);
  }
  if (Object.hasOwn(page, 'warnings')) {
    projected.warnings = array(page.warnings, `${context}.warnings`).map((warning, index) =>
      normalizeWarning(string(warning, `${context}.warnings[${String(index)}]`))
    );
  }
  return projected;
};

const canonicalOcrLayer = (value: unknown, context: string): Json => {
  const layer = record(value, context);
  const summary = record(layer.summary, `${context}.summary`);
  const projected: Record<string, Json> = {
    profile: string(layer.profile, `${context}.profile`),
    pages: array(layer.pages, `${context}.pages`).map((page, index) =>
      canonicalOcrPage(page, `${context}.pages[${String(index)}]`)
    ),
    summary: {
      page_count: integer(summary.page_count, `${context}.summary.page_count`),
      text_chars: integer(summary.text_chars, `${context}.summary.text_chars`),
      word_count: integer(summary.word_count, `${context}.summary.word_count`),
      words_with_bounding_boxes: integer(
        summary.words_with_bounding_boxes,
        `${context}.summary.words_with_bounding_boxes`
      ),
      source_render_count: integer(
        summary.source_render_count,
        `${context}.summary.source_render_count`
      ),
    },
  };
  const average = optional(summary, 'average_confidence', (entry) =>
    number(entry, `${context}.summary.average_confidence`)
  );
  if (average !== undefined) {
    (projected.summary as Record<string, Json>).average_confidence = average;
  }
  if (Object.hasOwn(layer, 'warnings')) {
    projected.warnings = array(layer.warnings, `${context}.warnings`).map((warning, index) =>
      normalizeWarning(string(warning, `${context}.warnings[${String(index)}]`))
    );
  }
  return projected;
};

const canonicalDocumentMapOcr = (value: unknown, context: string): Json => {
  const map = record(value, context);
  const layers = array(map.layers ?? [], `${context}.layers`).map((layer, index) =>
    string(layer, `${context}.layers[${String(index)}]`)
  );
  const routing = record(map.routing ?? {}, `${context}.routing`);
  const summary = record(map.summary ?? {}, `${context}.summary`);
  return {
    has_ocr_layer: layers.includes('ocr_text_layer'),
    needs_ocr_pages: array(routing.needs_ocr_pages ?? [], `${context}.routing.needs_ocr_pages`).map(
      (page, index) => integer(page, `${context}.routing.needs_ocr_pages[${String(index)}]`)
    ),
    ocr_applied_pages: array(
      routing.ocr_applied_pages ?? [],
      `${context}.routing.ocr_applied_pages`
    ).map((page, index) =>
      integer(page, `${context}.routing.ocr_applied_pages[${String(index)}]`)
    ),
    ocr_page_count: integer(summary.ocr_page_count ?? 0, `${context}.summary.ocr_page_count`),
    ocr_text_chars: integer(summary.ocr_text_chars ?? 0, `${context}.summary.ocr_text_chars`),
  };
};

export const canonicalReadOcrResult = (response: unknown): Json => {
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
      if (!result.success) {
        if (Object.hasOwn(result, 'error')) {
          projected.error = string(result.error, `results[${String(index)}].error`);
        }
        return projected;
      }
      const data = record(result.data, `results[${String(index)}].data`);
      const dataProjected: Record<string, Json> = {
        num_pages: integer(data.num_pages, `results[${String(index)}].data.num_pages`),
        has_ocr_text_layer: Object.hasOwn(data, 'ocr_text_layer'),
      };
      if (Object.hasOwn(data, 'ocr_text_layer')) {
        dataProjected.ocr_text_layer = canonicalOcrLayer(
          data.ocr_text_layer,
          `results[${String(index)}].data.ocr_text_layer`
        );
      }
      if (Object.hasOwn(data, 'document_map')) {
        dataProjected.document_map = canonicalDocumentMapOcr(
          data.document_map,
          `results[${String(index)}].data.document_map`
        );
      }
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
  });
};
