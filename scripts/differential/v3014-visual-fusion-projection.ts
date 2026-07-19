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
    throw new Error(`${context} must be a finite number`);
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

const optional = <T>(
  value: Record<string, unknown>,
  key: string,
  map: (entry: unknown) => T
): T | undefined => (Object.hasOwn(value, key) ? map(value[key]) : undefined);

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

const canonicalBoundingBox = (value: unknown, context: string): Json => {
  const box = record(value, context);
  return {
    left: number(box.left, `${context}.left`),
    bottom: number(box.bottom, `${context}.bottom`),
    right: number(box.right, `${context}.right`),
    top: number(box.top, `${context}.top`),
  };
};

const canonicalCandidate = (value: unknown, context: string): Json => {
  const candidate = record(value, context);
  const region = record(candidate.region, `${context}.region`);
  const projected: Record<string, Json> = {
    id: string(candidate.id, `${context}.id`),
    page: integer(candidate.page, `${context}.page`),
    region: {
      id: string(region.id, `${context}.region.id`),
      page: integer(region.page, `${context}.region.page`),
      bounding_box: canonicalBoundingBox(region.bounding_box, `${context}.region.bounding_box`),
    },
    target_element_id: string(candidate.target_element_id, `${context}.target_element_id`),
    target_element_type: string(candidate.target_element_type, `${context}.target_element_type`),
    candidate_signals: array(candidate.candidate_signals, `${context}.candidate_signals`).map(
      (entry, index) => string(entry, `${context}.candidate_signals[${String(index)}]`)
    ),
  };
  const sourceElementId = optional(candidate, 'source_element_id', (entry) =>
    string(entry, `${context}.source_element_id`)
  );
  if (sourceElementId !== undefined) projected.source_element_id = sourceElementId;
  const captionId = optional(candidate, 'source_caption_element_id', (entry) =>
    string(entry, `${context}.source_caption_element_id`)
  );
  if (captionId !== undefined) projected.source_caption_element_id = captionId;
  const captionText = optional(candidate, 'source_caption_text', (entry) =>
    string(entry, `${context}.source_caption_text`)
  );
  if (captionText !== undefined) projected.source_caption_text = captionText;
  return projected;
};

const canonicalCropPixels = (value: unknown, context: string): Json => {
  const pixels = record(value, context);
  return {
    left: integer(pixels.left, `${context}.left`),
    top: integer(pixels.top, `${context}.top`),
    width: integer(pixels.width, `${context}.width`),
    height: integer(pixels.height, `${context}.height`),
  };
};

const canonicalEnrichment = (value: unknown, context: string): Json => {
  const enrichment = record(value, context);
  const projected: Record<string, Json> = {
    id: string(enrichment.id, `${context}.id`),
    region_id: string(enrichment.region_id, `${context}.region_id`),
    page: integer(enrichment.page, `${context}.page`),
    kind: string(enrichment.kind, `${context}.kind`),
    provider: string(enrichment.provider, `${context}.provider`),
    source_crop_evidence_id: string(
      enrichment.source_crop_evidence_id,
      `${context}.source_crop_evidence_id`
    ),
    source_bounding_box: canonicalBoundingBox(
      enrichment.source_bounding_box,
      `${context}.source_bounding_box`
    ),
    crop_pixels: canonicalCropPixels(enrichment.crop_pixels, `${context}.crop_pixels`),
    scale: number(enrichment.scale, `${context}.scale`),
    provenance: {
      engine: string(
        record(enrichment.provenance, `${context}.provenance`).engine,
        `${context}.provenance.engine`
      ),
      source: string(
        record(enrichment.provenance, `${context}.provenance`).source,
        `${context}.provenance.source`
      ),
    },
    target_element_id: string(enrichment.target_element_id, `${context}.target_element_id`),
    target_element_type: string(enrichment.target_element_type, `${context}.target_element_type`),
  };
  for (const key of ['description', 'text', 'markdown'] as const) {
    const value = optional(enrichment, key, (entry) => string(entry, `${context}.${key}`));
    if (value !== undefined) projected[key] = value;
  }
  const confidence = optional(enrichment, 'confidence', (entry) =>
    number(entry, `${context}.confidence`)
  );
  if (confidence !== undefined) projected.confidence = confidence;
  const captionId = optional(enrichment, 'source_caption_element_id', (entry) =>
    string(entry, `${context}.source_caption_element_id`)
  );
  if (captionId !== undefined) projected.source_caption_element_id = captionId;
  const captionText = optional(enrichment, 'source_caption_text', (entry) =>
    string(entry, `${context}.source_caption_text`)
  );
  if (captionText !== undefined) projected.source_caption_text = captionText;
  const signals = optional(enrichment, 'candidate_signals', (entry) =>
    array(entry, `${context}.candidate_signals`).map((item, index) =>
      string(item, `${context}.candidate_signals[${String(index)}]`)
    )
  );
  if (signals !== undefined) projected.candidate_signals = signals;
  const warnings = optional(enrichment, 'warnings', (entry) =>
    array(entry, `${context}.warnings`).map((item, index) =>
      string(item, `${context}.warnings[${String(index)}]`)
    )
  );
  if (warnings !== undefined) projected.warnings = warnings;
  // Keep structured payloads as canonical JSON for mutation sensitivity, without
  // over-constraining nested provider optional shapes beyond presence.
  for (const key of ['table', 'formula', 'chart'] as const) {
    if (Object.hasOwn(enrichment, key)) projected[key] = stableJson(enrichment[key] as Json);
  }
  return projected;
};

const canonicalDocumentMap = (value: unknown, context: string): Json => {
  const map = record(value, context);
  const pages = array(map.pages, `${context}.pages`).map((pageValue, index) => {
    const page = record(pageValue, `${context}.pages[${String(index)}]`);
    return {
      page: integer(page.page, `${context}.pages[${String(index)}].page`),
      visual_candidate_indexes: array(
        page.visual_candidate_indexes,
        `${context}.pages[${String(index)}].visual_candidate_indexes`
      ).map((entry, entryIndex) =>
        integer(
          entry,
          `${context}.pages[${String(index)}].visual_candidate_indexes[${String(entryIndex)}]`
        )
      ),
      visual_candidate_count: integer(
        page.visual_candidate_count,
        `${context}.pages[${String(index)}].visual_candidate_count`
      ),
      visual_enrichment_indexes: array(
        page.visual_enrichment_indexes,
        `${context}.pages[${String(index)}].visual_enrichment_indexes`
      ).map((entry, entryIndex) =>
        integer(
          entry,
          `${context}.pages[${String(index)}].visual_enrichment_indexes[${String(entryIndex)}]`
        )
      ),
      visual_enrichment_count: integer(
        page.visual_enrichment_count,
        `${context}.pages[${String(index)}].visual_enrichment_count`
      ),
    };
  });
  const summary = record(map.summary, `${context}.summary`);
  const projected: Record<string, Json> = {
    layers: array(map.layers, `${context}.layers`).map((entry, index) =>
      string(entry, `${context}.layers[${String(index)}]`)
    ),
    pages,
    visual_enrichment_candidates: array(
      map.visual_enrichment_candidates,
      `${context}.visual_enrichment_candidates`
    ).map((entry, index) =>
      canonicalCandidate(entry, `${context}.visual_enrichment_candidates[${String(index)}]`)
    ),
    visual_enrichments: array(map.visual_enrichments, `${context}.visual_enrichments`).map(
      (entry, index) =>
        canonicalEnrichment(entry, `${context}.visual_enrichments[${String(index)}]`)
    ),
    summary: {
      visual_enrichment_candidate_count: integer(
        summary.visual_enrichment_candidate_count,
        `${context}.summary.visual_enrichment_candidate_count`
      ),
      visual_enrichment_count: integer(
        summary.visual_enrichment_count,
        `${context}.summary.visual_enrichment_count`
      ),
      visual_enrichment_kind_counts: record(
        summary.visual_enrichment_kind_counts,
        `${context}.summary.visual_enrichment_kind_counts`
      ) as Json,
    },
  };
  if (Object.hasOwn(map, 'warnings')) {
    projected.warnings = array(map.warnings, `${context}.warnings`).map((entry, index) =>
      normalizeWarning(string(entry, `${context}.warnings[${String(index)}]`))
    );
  }
  return projected;
};

const publicPayload = (response: Record<string, unknown>): Record<string, unknown> => {
  if (Object.hasOwn(response, 'result')) {
    const result = record(response.result, 'tools/call result');
    if (result.isError === true) {
      return {
        isError: true,
        content: array(result.content, 'error content').map((entry, index) => {
          const item = record(entry, `error content[${String(index)}]`);
          return {
            type: string(item.type, `error content[${String(index)}].type`),
            text: string(item.text, `error content[${String(index)}].text`),
          };
        }),
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

export const canonicalVisualFusionResult = (
  response: unknown,
  providerInvocations: string[] = []
): Json => {
  const payload = publicPayload(record(response, 'response'));
  if (payload.isError === true) {
    return {
      isError: true,
      content: payload.content as Json,
      provider_invocations: providerInvocations,
    };
  }

  // structured content is attach_evidence envelope
  const data = Object.hasOwn(payload, 'data')
    ? record(payload.data, 'evidence data')
    : payload;
  const resultsSource = Object.hasOwn(data, 'results')
    ? data
    : Object.hasOwn(payload, 'results')
      ? payload
      : data;
  const results = array(
    record(resultsSource, 'results source').results,
    'results'
  ).map((entry, index) => {
    const result = record(entry, `results[${String(index)}]`);
    const projected: Record<string, Json> = {
      source: normalizeSource(string(result.source, `results[${String(index)}].source`)),
      success: result.success === true,
    };
    if (Object.hasOwn(result, 'error')) {
      projected.error = string(result.error, `results[${String(index)}].error`);
      return projected;
    }
    const resultData = record(result.data, `results[${String(index)}].data`);
    const dataProjected: Record<string, Json> = {
      num_pages: integer(resultData.num_pages, `results[${String(index)}].data.num_pages`),
      visual_enrichment_candidates: array(
        resultData.visual_enrichment_candidates ?? [],
        `results[${String(index)}].data.visual_enrichment_candidates`
      ).map((candidate, candidateIndex) =>
        canonicalCandidate(
          candidate,
          `results[${String(index)}].data.visual_enrichment_candidates[${String(candidateIndex)}]`
        )
      ),
      visual_enrichments: array(
        resultData.visual_enrichments ?? [],
        `results[${String(index)}].data.visual_enrichments`
      ).map((enrichment, enrichmentIndex) =>
        canonicalEnrichment(
          enrichment,
          `results[${String(index)}].data.visual_enrichments[${String(enrichmentIndex)}]`
        )
      ),
    };
    if (Object.hasOwn(resultData, 'warnings')) {
      dataProjected.warnings = array(
        resultData.warnings,
        `results[${String(index)}].data.warnings`
      ).map((warning, warningIndex) =>
        normalizeWarning(
          string(warning, `results[${String(index)}].data.warnings[${String(warningIndex)}]`)
        )
      );
    }
    if (Object.hasOwn(resultData, 'document_map')) {
      dataProjected.document_map = canonicalDocumentMap(
        resultData.document_map,
        `results[${String(index)}].data.document_map`
      );
    }
    projected.data = dataProjected;
    return projected;
  });

  return stableJson({
    profile: string(
      record(resultsSource, 'profile source').profile ?? 'pdf_read_results',
      'profile'
    ),
    results,
    provider_invocations: providerInvocations,
  });
};
