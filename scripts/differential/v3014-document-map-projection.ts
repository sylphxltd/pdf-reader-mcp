export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const MAP_KEYS = [
  'version', 'profile', 'layers', 'pages', 'elements', 'chunks',
  'visual_enrichment_candidates', 'visual_enrichments', 'layout_diagnostics',
  'safety_findings', 'routing', 'summary', 'warnings',
] as const;
const PAGE_KEYS = [
  'page', 'geometry', 'layout', 'element_ids', 'chunk_ids', 'safety_finding_indexes',
  'visual_candidate_indexes', 'visual_enrichment_indexes', 'text_layer_page_index',
  'text_layer_run_count', 'text_layer_line_count', 'text_layer_word_count',
  'text_layer_char_count', 'text_layer_runs_with_bounding_boxes',
  'text_layer_lines_with_bounding_boxes', 'text_layer_words_with_bounding_boxes',
  'text_layer_chars_with_bounding_boxes', 'text_layer_runs_with_font_metadata',
  'text_layer_runs_with_direction_metadata', 'text_layer_runs_with_transform_metadata',
  'text_layer_runs_with_eol_metadata', 'text_chars', 'text_item_count', 'ocr_text_chars',
  'ocr_word_count', 'ocr_confidence', 'ocr_source_render_evidence_id', 'image_count',
  'table_count', 'visual_candidate_count', 'visual_enrichment_count',
  'accessibility_report_page_index', 'accessibility_issue_indexes',
  'accessibility_high_issue_indexes', 'accessibility_medium_issue_indexes',
  'accessibility_low_issue_indexes', 'accessibility_grade', 'accessibility_score',
  'accessibility_issue_count', 'accessibility_high_issue_count',
  'accessibility_medium_issue_count', 'accessibility_low_issue_count',
  'trust_report_page_index', 'trust_signal_indexes', 'trust_high_signal_indexes',
  'trust_medium_signal_indexes', 'trust_low_signal_indexes', 'trust_risk', 'trust_score',
  'trust_signal_count', 'trust_high_signal_count', 'trust_medium_signal_count',
  'trust_low_signal_count', 'warnings',
] as const;
const ROUTING_KEYS = [
  'low_confidence_pages', 'image_or_sparse_pages', 'needs_ocr_pages',
  'ocr_applied_pages', 'visual_candidate_pages', 'accessibility_review_pages',
  'accessibility_high_issue_pages', 'accessibility_medium_issue_pages',
  'accessibility_low_issue_pages', 'trust_review_pages', 'trust_high_signal_pages',
  'trust_high_risk_pages', 'trust_medium_risk_pages',
] as const;
const SUMMARY_KEYS = [
  'total_pages', 'selected_pages', 'processed_page_count', 'element_count',
  'text_element_count', 'text_layer_page_count', 'text_layer_run_count',
  'text_layer_line_count', 'text_layer_word_count', 'text_layer_char_count',
  'text_layer_runs_with_bounding_boxes', 'text_layer_lines_with_bounding_boxes',
  'text_layer_words_with_bounding_boxes', 'text_layer_chars_with_bounding_boxes',
  'text_layer_runs_with_font_metadata', 'text_layer_runs_with_direction_metadata',
  'text_layer_runs_with_transform_metadata', 'text_layer_runs_with_eol_metadata',
  'ocr_page_count', 'ocr_text_chars', 'image_element_count', 'table_element_count',
  'visual_enrichment_candidate_count', 'visual_enrichment_candidate_kind_counts',
  'visual_enrichment_count', 'visual_enrichment_kind_counts', 'chunk_count',
  'safety_finding_count', 'accessibility_report_page_count', 'accessibility_score',
  'accessibility_grade', 'accessibility_issue_count', 'accessibility_document_issue_count',
  'accessibility_page_issue_count', 'accessibility_high_issue_count',
  'accessibility_medium_issue_count', 'accessibility_low_issue_count',
  'accessibility_pages_with_issues_count', 'accessibility_pages_with_high_issues_count',
  'accessibility_page_grade_counts', 'trust_report_page_count', 'trust_risk',
  'trust_score', 'trust_signal_count', 'trust_high_signal_count',
  'trust_medium_signal_count', 'trust_low_signal_count', 'trust_pages_with_signals',
  'trust_high_risk_page_count', 'trust_medium_risk_page_count',
  'trust_signal_type_counts', 'average_layout_confidence', 'lowest_layout_confidence',
] as const;
const ELEMENT_KEYS = [
  'id', 'type', 'page', 'bounding_box', 'confidence', 'provenance', 'content',
  'semantic_hint', 'image', 'table',
] as const;
const CHUNK_KEYS = [
  'id', 'page_start', 'page_end', 'text', 'element_ids', 'strategy', 'heading', 'bounding_boxes',
] as const;
const LAYOUT_KEYS = [
  'page', 'profile', 'reading_order', 'confidence', 'item_count', 'text_item_count',
  'image_item_count', 'positioned_item_ratio', 'column_count', 'columns', 'signals', 'warnings',
] as const;
const SAFETY_KEYS = [
  'type', 'severity', 'page', 'message', 'element_id', 'snippet', 'bounding_box',
] as const;
const PROVENANCE_KEYS = ['engine', 'source', 'ocr_source_render_evidence_id', 'bounding_box_level'] as const;
const TEXT_LAYER_KEYS = ['version', 'profile', 'pages', 'summary', 'warnings'] as const;
const TEXT_LAYER_PAGE_KEYS = ['page', 'text', 'char_count', 'line_count', 'word_count', 'lines'] as const;
const TEXT_LAYER_LINE_KEYS = [
  'id', 'index', 'text', 'char_start', 'char_end', 'bounding_box', 'runs', 'words', 'chars', 'provenance',
] as const;
const TEXT_LAYER_RUN_KEYS = [
  'index', 'text', 'char_start', 'char_end', 'bounding_box', 'font_name', 'direction',
  'transform', 'has_eol', 'chars', 'provenance',
] as const;
const TEXT_LAYER_WORD_KEYS = [
  'index', 'text', 'char_start', 'char_end', 'bounding_box', 'bounding_box_level', 'confidence',
] as const;
const TEXT_LAYER_CHAR_KEYS = [
  'index', 'text', 'char_start', 'char_end', 'run_index', 'is_whitespace',
  'bounding_box', 'bounding_box_level', 'confidence',
] as const;
const TEXT_LAYER_SUMMARY_KEYS = [
  'selected_pages', 'page_count', 'run_count', 'line_count', 'word_count', 'char_count',
  'chars_with_bounding_boxes', 'runs_with_bounding_boxes', 'lines_with_bounding_boxes',
  'words_with_bounding_boxes', 'runs_with_font_metadata', 'runs_with_direction_metadata',
  'runs_with_transform_metadata', 'runs_with_eol_metadata',
] as const;
const RUNTIME_SPECIFIC_TEXT_COUNTERS = new Set([
  'text_layer_run_count', 'text_layer_runs_with_bounding_boxes',
  'text_layer_runs_with_font_metadata', 'text_layer_runs_with_direction_metadata',
  'text_layer_runs_with_transform_metadata', 'text_layer_runs_with_eol_metadata',
]);
export const DOCUMENT_MAP_DEPENDENCY_SURFACES = [
  'elements', 'chunks', 'text_layer', 'layout_diagnostics', 'safety_findings',
  'page_geometry', 'document_ast', 'tables', 'visual_enrichments', 'ocr_text_layer',
  'trust_report', 'accessibility_report', '_internal', 'internal',
] as const;

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
};
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], context: string) => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) throw new Error(`${context} has unexpected keys: ${unexpected.join(',')}`);
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be a finite number`);
  return Math.round(value * 1e9) / 1e9;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be a boolean`);
  return value;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const strings = (value: unknown, context: string): string[] =>
  array(value, context).map((entry, index) => string(entry, `${context}[${index}]`));
const numbers = (value: unknown, context: string): number[] =>
  array(value, context).map((entry, index) => number(entry, `${context}[${index}]`));
const json = (value: unknown, context: string): Json => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return number(value, context);
  if (Array.isArray(value)) return value.map((entry, index) => json(entry, `${context}[${index}]`));
  const source = record(value, context);
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, json(entry, `${context}.${key}`)]));
};
const strictObject = (
  value: unknown,
  allowed: readonly string[],
  requiredKeys: readonly string[],
  context: string
): Record<string, unknown> => {
  const source = record(value, context);
  exactKeys(source, allowed, context);
  for (const key of requiredKeys) required(source, key, context);
  return source;
};
const boundingBox = (value: unknown, context: string): Json => {
  const source = strictObject(value, ['left', 'bottom', 'right', 'top'], ['left', 'bottom', 'right', 'top'], context);
  return Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, number(entry, `${context}.${key}`)]));
};
const geometryProjection = (value: unknown, context: string): Json => {
  const source = strictObject(value, ['page', 'width', 'height', 'rotation', 'user_unit', 'view_box'],
    ['page', 'width', 'height', 'rotation'], context);
  for (const key of ['page', 'width', 'height', 'rotation', 'user_unit'] as const) {
    if (Object.hasOwn(source, key)) number(source[key], `${context}.${key}`);
  }
  if (Object.hasOwn(source, 'view_box')) boundingBox(source.view_box, `${context}.view_box`);
  return json(source, context);
};
const layoutProjection = (value: unknown, context: string): Json => {
  const source = strictObject(value, LAYOUT_KEYS,
    ['page', 'profile', 'reading_order', 'confidence', 'item_count', 'text_item_count',
      'image_item_count', 'positioned_item_ratio', 'column_count', 'signals'], context);
  for (const key of ['page', 'confidence', 'item_count', 'text_item_count', 'image_item_count', 'positioned_item_ratio', 'column_count'] as const) {
    number(source[key], `${context}.${key}`);
  }
  string(source.profile, `${context}.profile`);
  string(source.reading_order, `${context}.reading_order`);
  strings(source.signals, `${context}.signals`);
  if (Object.hasOwn(source, 'warnings')) strings(source.warnings, `${context}.warnings`);
  if (Object.hasOwn(source, 'columns')) {
    array(source.columns, `${context}.columns`).forEach((columnValue, index) => {
      const column = strictObject(columnValue, ['index', 'left', 'right', 'item_count'],
        ['index', 'left', 'right', 'item_count'], `${context}.columns[${index}]`);
      for (const [key, entry] of Object.entries(column)) number(entry, `${context}.columns[${index}].${key}`);
    });
  }
  return json(source, context);
};
const safetyProjection = (value: unknown, context: string): Json => {
  const source = strictObject(value, SAFETY_KEYS, ['type', 'severity', 'page', 'message'], context);
  for (const key of ['type', 'severity', 'message', 'element_id', 'snippet'] as const) {
    if (Object.hasOwn(source, key)) string(source[key], `${context}.${key}`);
  }
  number(source.page, `${context}.page`);
  if (Object.hasOwn(source, 'bounding_box')) boundingBox(source.bounding_box, `${context}.bounding_box`);
  return json(source, context);
};
const mapPage = (value: unknown, context: string): Json => {
  const source = strictObject(value, PAGE_KEYS, [
    'page', 'element_ids', 'chunk_ids', 'safety_finding_indexes',
    'visual_candidate_indexes', 'visual_enrichment_indexes', 'text_chars',
    'text_item_count', 'image_count', 'table_count', 'visual_candidate_count',
    'visual_enrichment_count',
  ], context);
  number(source.page, `${context}.page`);
  for (const key of ['element_ids', 'chunk_ids', 'warnings'] as const) {
    if (Object.hasOwn(source, key)) strings(source[key], `${context}.${key}`);
  }
  for (const key of PAGE_KEYS) {
    if (!Object.hasOwn(source, key) || ['geometry', 'layout', 'element_ids', 'chunk_ids', 'warnings', 'ocr_source_render_evidence_id', 'accessibility_grade', 'trust_risk'].includes(key)) continue;
    if (key.endsWith('_indexes')) numbers(source[key], `${context}.${key}`);
    else number(source[key], `${context}.${key}`);
  }
  for (const key of ['ocr_source_render_evidence_id', 'accessibility_grade', 'trust_risk'] as const) {
    if (Object.hasOwn(source, key)) string(source[key], `${context}.${key}`);
  }
  if (Object.hasOwn(source, 'geometry')) geometryProjection(source.geometry, `${context}.geometry`);
  if (Object.hasOwn(source, 'layout')) layoutProjection(source.layout, `${context}.layout`);
  const output = json(source, context) as Record<string, Json>;
  for (const key of RUNTIME_SPECIFIC_TEXT_COUNTERS) {
    if (Object.hasOwn(source, key)) output[key] = '<runtime-specific-number>';
  }
  return output;
};

const provenanceSchema = (value: unknown, context: string): Json => {
  const source = strictObject(value, PROVENANCE_KEYS, ['engine', 'source'], context);
  string(source.engine, `${context}.engine`);
  string(source.source, `${context}.source`);
  for (const key of ['ocr_source_render_evidence_id', 'bounding_box_level'] as const) {
    if (Object.hasOwn(source, key)) string(source[key], `${context}.${key}`);
  }
  return {
    keys: Object.keys(source).sort(),
    engine_type: 'string',
    source_type: 'string',
    ...(Object.hasOwn(source, 'ocr_source_render_evidence_id')
      ? { ocr_source_render_evidence_id_type: 'string' }
      : {}),
    ...(Object.hasOwn(source, 'bounding_box_level') ? { bounding_box_level_type: 'string' } : {}),
  };
};
const elementProjection = (value: unknown, context: string): Json => {
  const source = strictObject(value, ELEMENT_KEYS, ['id', 'type', 'page', 'provenance'], context);
  string(source.id, `${context}.id`);
  string(source.type, `${context}.type`);
  number(source.page, `${context}.page`);
  if (Object.hasOwn(source, 'content')) string(source.content, `${context}.content`);
  if (Object.hasOwn(source, 'confidence')) number(source.confidence, `${context}.confidence`);
  if (Object.hasOwn(source, 'bounding_box')) boundingBox(source.bounding_box, `${context}.bounding_box`);
  if (Object.hasOwn(source, 'semantic_hint')) {
    const hint = strictObject(source.semantic_hint, ['role', 'confidence', 'signals', 'level'],
      ['role', 'confidence', 'signals'], `${context}.semantic_hint`);
    string(hint.role, `${context}.semantic_hint.role`);
    number(hint.confidence, `${context}.semantic_hint.confidence`);
    strings(hint.signals, `${context}.semantic_hint.signals`);
    if (Object.hasOwn(hint, 'level')) number(hint.level, `${context}.semantic_hint.level`);
  }
  const output = json(source, context) as Record<string, Json>;
  output.provenance = provenanceSchema(source.provenance, `${context}.provenance`);
  return output;
};
const chunkProjection = (value: unknown, context: string): Json => {
  const source = strictObject(value, CHUNK_KEYS,
    ['id', 'page_start', 'page_end', 'text', 'element_ids'], context);
  string(source.id, `${context}.id`);
  number(source.page_start, `${context}.page_start`);
  number(source.page_end, `${context}.page_end`);
  string(source.text, `${context}.text`);
  strings(source.element_ids, `${context}.element_ids`);
  for (const key of ['strategy', 'heading'] as const) {
    if (Object.hasOwn(source, key)) string(source[key], `${context}.${key}`);
  }
  if (Object.hasOwn(source, 'bounding_boxes')) {
    array(source.bounding_boxes, `${context}.bounding_boxes`).forEach((entry, index) =>
      boundingBox(entry, `${context}.bounding_boxes[${index}]`));
  }
  return json(source, context);
};
const validateTextLeaf = (
  value: unknown,
  allowed: readonly string[],
  requiredKeys: readonly string[],
  context: string
): Record<string, unknown> => {
  const source = strictObject(value, allowed, requiredKeys, context);
  json(source, context);
  return source;
};
const textLayerProjection = (value: unknown, context: string): Json => {
  const source = strictObject(value, TEXT_LAYER_KEYS, ['version', 'profile', 'pages', 'summary'], context);
  string(source.version, `${context}.version`);
  string(source.profile, `${context}.profile`);
  if (Object.hasOwn(source, 'warnings')) strings(source.warnings, `${context}.warnings`);
  const pages = array(source.pages, `${context}.pages`).map((pageValue, pageIndex) => {
    const pageContext = `${context}.pages[${pageIndex}]`;
    const page = strictObject(pageValue, TEXT_LAYER_PAGE_KEYS, TEXT_LAYER_PAGE_KEYS, pageContext);
    number(page.page, `${pageContext}.page`);
    string(page.text, `${pageContext}.text`);
    for (const key of ['char_count', 'line_count', 'word_count'] as const) number(page[key], `${pageContext}.${key}`);
    array(page.lines, `${pageContext}.lines`).forEach((lineValue, lineIndex) => {
      const lineContext = `${pageContext}.lines[${lineIndex}]`;
      const line = validateTextLeaf(lineValue, TEXT_LAYER_LINE_KEYS,
        ['id', 'index', 'text', 'char_start', 'char_end', 'runs', 'words', 'chars', 'provenance'], lineContext);
      provenanceSchema(line.provenance, `${lineContext}.provenance`);
      string(line.id, `${lineContext}.id`);
      string(line.text, `${lineContext}.text`);
      for (const key of ['index', 'char_start', 'char_end'] as const) number(line[key], `${lineContext}.${key}`);
      if (Object.hasOwn(line, 'bounding_box')) boundingBox(line.bounding_box, `${lineContext}.bounding_box`);
      array(line.runs, `${lineContext}.runs`).forEach((runValue, runIndex) => {
        const runContext = `${lineContext}.runs[${runIndex}]`;
        const run = validateTextLeaf(runValue, TEXT_LAYER_RUN_KEYS,
          ['index', 'text', 'char_start', 'char_end', 'chars', 'provenance'], runContext);
        provenanceSchema(run.provenance, `${runContext}.provenance`);
        string(run.text, `${runContext}.text`);
        for (const key of ['index', 'char_start', 'char_end'] as const) number(run[key], `${runContext}.${key}`);
        if (Object.hasOwn(run, 'bounding_box')) boundingBox(run.bounding_box, `${runContext}.bounding_box`);
        for (const key of ['font_name', 'direction'] as const) {
          if (Object.hasOwn(run, key)) string(run[key], `${runContext}.${key}`);
        }
        if (Object.hasOwn(run, 'transform')) numbers(run.transform, `${runContext}.transform`);
        if (Object.hasOwn(run, 'has_eol')) boolean(run.has_eol, `${runContext}.has_eol`);
        array(run.chars, `${runContext}.chars`).forEach((charValue, charIndex) => {
          const charContext = `${runContext}.chars[${charIndex}]`;
          const char = validateTextLeaf(charValue, TEXT_LAYER_CHAR_KEYS,
            ['index', 'text', 'char_start', 'char_end', 'run_index', 'is_whitespace'],
            charContext);
          string(char.text, `${charContext}.text`);
          for (const key of ['index', 'char_start', 'char_end', 'run_index'] as const) number(char[key], `${charContext}.${key}`);
          boolean(char.is_whitespace, `${charContext}.is_whitespace`);
          if (Object.hasOwn(char, 'bounding_box')) boundingBox(char.bounding_box, `${charContext}.bounding_box`);
          if (Object.hasOwn(char, 'bounding_box_level')) string(char.bounding_box_level, `${charContext}.bounding_box_level`);
          if (Object.hasOwn(char, 'confidence')) number(char.confidence, `${charContext}.confidence`);
        });
      });
      array(line.words, `${lineContext}.words`).forEach((wordValue, wordIndex) => {
        const wordContext = `${lineContext}.words[${wordIndex}]`;
        const word = validateTextLeaf(wordValue, TEXT_LAYER_WORD_KEYS, ['index', 'text', 'char_start', 'char_end'], wordContext);
        string(word.text, `${wordContext}.text`);
        for (const key of ['index', 'char_start', 'char_end'] as const) number(word[key], `${wordContext}.${key}`);
        if (Object.hasOwn(word, 'bounding_box')) boundingBox(word.bounding_box, `${wordContext}.bounding_box`);
        if (Object.hasOwn(word, 'bounding_box_level')) string(word.bounding_box_level, `${wordContext}.bounding_box_level`);
        if (Object.hasOwn(word, 'confidence')) number(word.confidence, `${wordContext}.confidence`);
      });
      array(line.chars, `${lineContext}.chars`).forEach((charValue, charIndex) => {
        const charContext = `${lineContext}.chars[${charIndex}]`;
        const char = validateTextLeaf(charValue, TEXT_LAYER_CHAR_KEYS,
          ['index', 'text', 'char_start', 'char_end', 'run_index', 'is_whitespace'],
          charContext);
        string(char.text, `${charContext}.text`);
        for (const key of ['index', 'char_start', 'char_end', 'run_index'] as const) number(char[key], `${charContext}.${key}`);
        boolean(char.is_whitespace, `${charContext}.is_whitespace`);
        if (Object.hasOwn(char, 'bounding_box')) boundingBox(char.bounding_box, `${charContext}.bounding_box`);
        if (Object.hasOwn(char, 'bounding_box_level')) string(char.bounding_box_level, `${charContext}.bounding_box_level`);
        if (Object.hasOwn(char, 'confidence')) number(char.confidence, `${charContext}.confidence`);
      });
    });
    return {
      page: number(page.page, `${pageContext}.page`),
      text: string(page.text, `${pageContext}.text`),
      char_count: number(page.char_count, `${pageContext}.char_count`),
      line_count: number(page.line_count, `${pageContext}.line_count`),
      word_count: number(page.word_count, `${pageContext}.word_count`),
    };
  });
  const summary = strictObject(source.summary, TEXT_LAYER_SUMMARY_KEYS, TEXT_LAYER_SUMMARY_KEYS, `${context}.summary`);
  numbers(summary.selected_pages, `${context}.summary.selected_pages`);
  for (const key of TEXT_LAYER_SUMMARY_KEYS) {
    if (key !== 'selected_pages') number(summary[key], `${context}.summary.${key}`);
  }
  return {
    version: string(source.version, `${context}.version`),
    profile: string(source.profile, `${context}.profile`),
    pages,
    summary: Object.fromEntries(Object.entries(summary).map(([key, entry]) => [
      key,
      key === 'run_count' || key === 'runs_with_bounding_boxes' || key.startsWith('runs_with_')
        ? '<runtime-specific-number>'
        : json(entry, `${context}.summary.${key}`),
    ])),
    ...(Object.hasOwn(source, 'warnings') ? { warnings: strings(source.warnings, `${context}.warnings`) } : {}),
  };
};

export const canonicalDocumentMapResult = (dataValue: unknown): Json => {
  const data = record(dataValue, 'result.data');
  const map = strictObject(required(data, 'document_map', 'result.data'), MAP_KEYS, [
    'version', 'profile', 'layers', 'pages', 'elements', 'chunks',
    'visual_enrichment_candidates', 'visual_enrichments', 'layout_diagnostics',
    'safety_findings', 'routing', 'summary',
  ], 'document_map');
  string(map.version, 'document_map.version');
  string(map.profile, 'document_map.profile');
  strings(map.layers, 'document_map.layers');
  const pages = array(map.pages, 'document_map.pages').map((entry, index) =>
    mapPage(entry, `document_map.pages[${index}]`)
  );
  for (const [key, allowed] of [
    ['elements', ELEMENT_KEYS], ['chunks', CHUNK_KEYS], ['layout_diagnostics', LAYOUT_KEYS],
    ['safety_findings', SAFETY_KEYS],
  ] as const) {
    array(map[key], `document_map.${key}`).forEach((entry, index) => {
      exactKeys(record(entry, `document_map.${key}[${index}]`), allowed, `document_map.${key}[${index}]`);
    });
  }
  array(map.elements, 'document_map.elements').forEach((entry, index) =>
    elementProjection(entry, `document_map.elements[${index}]`)
  );
  array(map.chunks, 'document_map.chunks').forEach((entry, index) =>
    chunkProjection(entry, `document_map.chunks[${index}]`)
  );
  array(map.layout_diagnostics, 'document_map.layout_diagnostics').forEach((entry, index) =>
    layoutProjection(entry, `document_map.layout_diagnostics[${index}]`)
  );
  array(map.safety_findings, 'document_map.safety_findings').forEach((entry, index) =>
    safetyProjection(entry, `document_map.safety_findings[${index}]`)
  );
  const routing = strictObject(map.routing, ROUTING_KEYS, ROUTING_KEYS, 'document_map.routing');
  for (const key of ROUTING_KEYS) numbers(routing[key], `document_map.routing.${key}`);
  const summary = strictObject(map.summary, SUMMARY_KEYS, [
    'selected_pages', 'processed_page_count', 'element_count', 'text_element_count',
    'text_layer_page_count', 'text_layer_run_count', 'text_layer_line_count',
    'text_layer_word_count', 'text_layer_char_count', 'text_layer_runs_with_bounding_boxes',
    'text_layer_lines_with_bounding_boxes', 'text_layer_words_with_bounding_boxes',
    'text_layer_chars_with_bounding_boxes', 'text_layer_runs_with_font_metadata',
    'text_layer_runs_with_direction_metadata', 'text_layer_runs_with_transform_metadata',
    'text_layer_runs_with_eol_metadata', 'ocr_page_count', 'ocr_text_chars',
    'image_element_count', 'table_element_count', 'visual_enrichment_candidate_count',
    'visual_enrichment_candidate_kind_counts', 'visual_enrichment_count',
    'visual_enrichment_kind_counts', 'chunk_count', 'safety_finding_count',
  ], 'document_map.summary');
  numbers(summary.selected_pages, 'document_map.summary.selected_pages');
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'selected_pages') continue;
    if (key.endsWith('_counts')) record(value, `document_map.summary.${key}`);
    else if (['accessibility_grade', 'trust_risk'].includes(key)) string(value, `document_map.summary.${key}`);
    else number(value, `document_map.summary.${key}`);
  }
  if (Object.hasOwn(map, 'warnings')) strings(map.warnings, 'document_map.warnings');
  const canonicalMap = json(map, 'document_map') as Record<string, Json>;
  canonicalMap.pages = pages;
  canonicalMap.elements = array(map.elements, 'document_map.elements').map((entry, index) =>
    elementProjection(entry, `document_map.elements[${index}]`)
  );
  canonicalMap.chunks = array(map.chunks, 'document_map.chunks').map((entry, index) =>
    chunkProjection(entry, `document_map.chunks[${index}]`)
  );
  const canonicalSummary = canonicalMap.summary as Record<string, Json>;
  for (const key of RUNTIME_SPECIFIC_TEXT_COUNTERS) {
    if (Object.hasOwn(summary, key)) canonicalSummary[key] = '<runtime-specific-number>';
  }
  const exposedDependencies = Object.fromEntries(
    DOCUMENT_MAP_DEPENDENCY_SURFACES
      .filter((key) => Object.hasOwn(data, key))
      .map((key) => {
        if (key === 'elements') {
          return [key, array(data[key], 'result.data.elements').map((entry, index) =>
            elementProjection(entry, `result.data.elements[${index}]`))];
        }
        if (key === 'chunks') {
          return [key, array(data[key], 'result.data.chunks').map((entry, index) =>
            chunkProjection(entry, `result.data.chunks[${index}]`))];
        }
        if (key === 'text_layer') return [key, textLayerProjection(data[key], 'result.data.text_layer')];
        if (key === 'layout_diagnostics') {
          return [key, array(data[key], 'result.data.layout_diagnostics').map((entry, index) =>
            layoutProjection(entry, `result.data.layout_diagnostics[${index}]`))];
        }
        if (key === 'safety_findings') {
          return [key, array(data[key], 'result.data.safety_findings').map((entry, index) =>
            safetyProjection(entry, `result.data.safety_findings[${index}]`))];
        }
        if (key === 'page_geometry') {
          return [key, array(data[key], 'result.data.page_geometry').map((entry, index) =>
            geometryProjection(entry, `result.data.page_geometry[${index}]`))];
        }
        return [key, json(data[key], `result.data.${key}`)];
      })
  );
  return {
    top_level_warnings: Object.hasOwn(data, 'warnings') ? strings(data.warnings, 'result.data.warnings') : null,
    dependency_surfaces: Object.fromEntries(
      DOCUMENT_MAP_DEPENDENCY_SURFACES.map((key) => [key, Object.hasOwn(data, key)])
    ),
    exposed_dependencies: exposedDependencies,
    document_map: canonicalMap,
  };
};

export const DOCUMENT_MAP_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: [
    'document_map.version', 'document_map.pages[0].page',
    'document_map.pages[0].element_ids[0]', 'document_map.routing.low_confidence_pages[0]',
    'document_map.summary.processed_page_count', 'document_map.summary.selected_pages[0]',
  ],
  unexpectedFields: [
    'document_map', 'document_map.pages[0]', 'document_map.routing',
    'document_map.summary', 'document_map.elements[0]', 'document_map.chunks[0]',
    'document_map.layout_diagnostics[0]', 'document_map.safety_findings[0]',
  ],
  requiredOmissions: [
    'document_map.version', 'document_map.pages', 'document_map.pages[0].page',
    'document_map.pages[0].element_ids', 'document_map.routing.needs_ocr_pages',
    'document_map.summary.processed_page_count',
  ],
  privateLeakage: ['document_ast', 'tables', 'visual_enrichments', 'ocr_text_layer', '_internal', 'internal'],
  dependencyPresence: [...DOCUMENT_MAP_DEPENDENCY_SURFACES],
  hostileChunkSpan: { pageStart: 1, pageEnd: 2147483647, selectedPages: [1, 3] },
} as const;
