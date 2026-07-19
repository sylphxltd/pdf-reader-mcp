export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export const SELECTABLE_TEXT_SEGMENTATION_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: ['line.char_start', 'run.bounding_box.left', 'document_map.page.text_item_count', 'search.match.bounding_box.right', 'search.total_matches'],
  unexpectedFields: ['line', 'run', 'document_map.page', 'search.match'],
  requiredOmissions: ['line.text', 'run.text', 'char.bounding_box', 'document_map.page.element_ids', 'search.match.bounding_box'],
  publicOmissions: ['map-only.elements', 'map-only.chunks', 'map-only.text_layer', 'map-only.page_contents'],
  dependencyPresence: ['elements', 'chunks', 'text_layer', 'page_contents', 'document_map'],
} as const;

const record = (value: unknown, context: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
};
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const required = (value: Record<string, unknown>, key: string, context: string): unknown => {
  if (!Object.hasOwn(value, key)) throw new Error(`${context}.${key} is required`);
  return value[key];
};
const exact = (value: Record<string, unknown>, keys: readonly string[], context: string): void => {
  const extras = Object.keys(value).filter((key) => !keys.includes(key));
  if (extras.length > 0) throw new Error(`${context} has unexpected keys: ${extras.join(',')}`);
};
const string = (value: unknown, context: string): string => {
  if (typeof value !== 'string') throw new Error(`${context} must be a string`);
  return value;
};
const number = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${context} must be finite`);
  // The fixture's declared semantic coordinate quantum is 0.001 PDF points.
  // Normalize parser-specific f32/f64 expansion without erasing the 48.000
  // versus 48.001 segmentation boundary this family exists to prove.
  return Math.round(value * 1e3) / 1e3;
};
const integer = (value: unknown, context: string): number => {
  const result = number(value, context);
  if (!Number.isInteger(result) || result < 0) throw new Error(`${context} must be a nonnegative integer`);
  return result;
};
const boolean = (value: unknown, context: string): boolean => {
  if (typeof value !== 'boolean') throw new Error(`${context} must be boolean`);
  return value;
};
const strings = (value: unknown, context: string): string[] => array(value, context).map((entry, index) => string(entry, `${context}[${String(index)}]`));
const integers = (value: unknown, context: string): number[] => array(value, context).map((entry, index) => integer(entry, `${context}[${String(index)}]`));
const DOCUMENT_MAP_PAGE_KEYS = [
  'page', 'geometry', 'layout', 'element_ids', 'chunk_ids', 'safety_finding_indexes',
  'visual_candidate_indexes', 'visual_enrichment_indexes', 'text_layer_page_index',
  'text_layer_run_count', 'text_layer_line_count', 'text_layer_word_count', 'text_layer_char_count',
  'text_layer_runs_with_bounding_boxes', 'text_layer_lines_with_bounding_boxes',
  'text_layer_words_with_bounding_boxes', 'text_layer_chars_with_bounding_boxes',
  'text_layer_runs_with_font_metadata', 'text_layer_runs_with_direction_metadata',
  'text_layer_runs_with_transform_metadata', 'text_layer_runs_with_eol_metadata',
  'text_chars', 'text_item_count', 'ocr_text_chars', 'ocr_word_count', 'ocr_confidence',
  'ocr_source_render_evidence_id', 'image_count', 'table_count', 'visual_candidate_count',
  'visual_enrichment_count', 'accessibility_report_page_index', 'accessibility_issue_indexes',
  'accessibility_high_issue_indexes', 'accessibility_medium_issue_indexes',
  'accessibility_low_issue_indexes', 'accessibility_grade', 'accessibility_score',
  'accessibility_issue_count', 'accessibility_high_issue_count', 'accessibility_medium_issue_count',
  'accessibility_low_issue_count', 'trust_report_page_index', 'trust_signal_indexes',
  'trust_high_signal_indexes', 'trust_medium_signal_indexes', 'trust_low_signal_indexes',
  'trust_risk', 'trust_score', 'trust_signal_count', 'trust_high_signal_count',
  'trust_medium_signal_count', 'trust_low_signal_count', 'warnings',
] as const;

const box = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['left', 'bottom', 'right', 'top'], context);
  return {
    left: number(required(source, 'left', context), `${context}.left`),
    bottom: number(required(source, 'bottom', context), `${context}.bottom`),
    right: number(required(source, 'right', context), `${context}.right`),
    top: number(required(source, 'top', context), `${context}.top`),
  };
};

const character = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['index', 'text', 'char_start', 'char_end', 'run_index', 'is_whitespace', 'bounding_box', 'bounding_box_level', 'confidence'], context);
  return {
    text: string(required(source, 'text', context), `${context}.text`),
    char_start: integer(required(source, 'char_start', context), `${context}.char_start`),
    char_end: integer(required(source, 'char_end', context), `${context}.char_end`),
    run_index: integer(required(source, 'run_index', context), `${context}.run_index`),
    is_whitespace: boolean(required(source, 'is_whitespace', context), `${context}.is_whitespace`),
    bounding_box: box(required(source, 'bounding_box', context), `${context}.bounding_box`),
    bounding_box_level: string(required(source, 'bounding_box_level', context), `${context}.bounding_box_level`),
  };
};
const run = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['index', 'text', 'char_start', 'char_end', 'bounding_box', 'font_name', 'direction', 'transform', 'has_eol', 'chars', 'provenance'], context);
  return {
    text: string(required(source, 'text', context), `${context}.text`),
    char_start: integer(required(source, 'char_start', context), `${context}.char_start`),
    char_end: integer(required(source, 'char_end', context), `${context}.char_end`),
    bounding_box: box(required(source, 'bounding_box', context), `${context}.bounding_box`),
    chars: array(required(source, 'chars', context), `${context}.chars`).map((entry, index) => character(entry, `${context}.chars[${String(index)}]`)),
  };
};
const word = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['index', 'text', 'char_start', 'char_end', 'bounding_box', 'bounding_box_level', 'confidence'], context);
  return {
    text: string(required(source, 'text', context), `${context}.text`),
    char_start: integer(required(source, 'char_start', context), `${context}.char_start`),
    char_end: integer(required(source, 'char_end', context), `${context}.char_end`),
    bounding_box: box(required(source, 'bounding_box', context), `${context}.bounding_box`),
    bounding_box_level: string(required(source, 'bounding_box_level', context), `${context}.bounding_box_level`),
  };
};
const line = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['id', 'index', 'text', 'char_start', 'char_end', 'bounding_box', 'runs', 'words', 'chars', 'provenance'], context);
  return {
    text: string(required(source, 'text', context), `${context}.text`),
    char_start: integer(required(source, 'char_start', context), `${context}.char_start`),
    char_end: integer(required(source, 'char_end', context), `${context}.char_end`),
    bounding_box: box(required(source, 'bounding_box', context), `${context}.bounding_box`),
    runs: array(required(source, 'runs', context), `${context}.runs`).map((entry, index) => run(entry, `${context}.runs[${String(index)}]`)),
    words: array(required(source, 'words', context), `${context}.words`).map((entry, index) => word(entry, `${context}.words[${String(index)}]`)),
    chars: array(required(source, 'chars', context), `${context}.chars`).map((entry, index) => character(entry, `${context}.chars[${String(index)}]`)),
  };
};

const textLayer = (value: unknown): Json => {
  const source = record(value, 'text_layer');
  const pages = array(required(source, 'pages', 'text_layer'), 'text_layer.pages').map((entry, index) => {
    const page = record(entry, `text_layer.pages[${String(index)}]`);
    exact(page, ['page', 'text', 'char_count', 'line_count', 'word_count', 'lines'], `text_layer.pages[${String(index)}]`);
    return {
      page: integer(required(page, 'page', 'text_layer page'), 'text_layer page.page'),
      text: string(required(page, 'text', 'text_layer page'), 'text_layer page.text'),
      char_count: integer(required(page, 'char_count', 'text_layer page'), 'text_layer page.char_count'),
      line_count: integer(required(page, 'line_count', 'text_layer page'), 'text_layer page.line_count'),
      word_count: integer(required(page, 'word_count', 'text_layer page'), 'text_layer page.word_count'),
      lines: array(required(page, 'lines', 'text_layer page'), 'text_layer page.lines').map((value, lineIndex) => line(value, `text_layer.pages[${String(index)}].lines[${String(lineIndex)}]`)),
    };
  });
  const summary = record(required(source, 'summary', 'text_layer'), 'text_layer.summary');
  return {
    version: string(required(source, 'version', 'text_layer'), 'text_layer.version'),
    profile: string(required(source, 'profile', 'text_layer'), 'text_layer.profile'),
    pages,
    summary: {
      selected_pages: integers(required(summary, 'selected_pages', 'text_layer.summary'), 'text_layer.summary.selected_pages'),
      page_count: integer(required(summary, 'page_count', 'text_layer.summary'), 'text_layer.summary.page_count'),
      run_count: integer(required(summary, 'run_count', 'text_layer.summary'), 'text_layer.summary.run_count'),
      line_count: integer(required(summary, 'line_count', 'text_layer.summary'), 'text_layer.summary.line_count'),
      word_count: integer(required(summary, 'word_count', 'text_layer.summary'), 'text_layer.summary.word_count'),
      char_count: integer(required(summary, 'char_count', 'text_layer.summary'), 'text_layer.summary.char_count'),
      chars_with_bounding_boxes: integer(required(summary, 'chars_with_bounding_boxes', 'text_layer.summary'), 'text_layer.summary.chars_with_bounding_boxes'),
      runs_with_bounding_boxes: integer(required(summary, 'runs_with_bounding_boxes', 'text_layer.summary'), 'text_layer.summary.runs_with_bounding_boxes'),
      lines_with_bounding_boxes: integer(required(summary, 'lines_with_bounding_boxes', 'text_layer.summary'), 'text_layer.summary.lines_with_bounding_boxes'),
      words_with_bounding_boxes: integer(required(summary, 'words_with_bounding_boxes', 'text_layer.summary'), 'text_layer.summary.words_with_bounding_boxes'),
    },
  };
};

const element = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['id', 'type', 'page', 'bounding_box', 'confidence', 'provenance', 'content', 'semantic_hint'], context);
  return { id: string(required(source, 'id', context), `${context}.id`), page: integer(required(source, 'page', context), `${context}.page`), content: string(required(source, 'content', context), `${context}.content`), bounding_box: box(required(source, 'bounding_box', context), `${context}.bounding_box`) };
};
const chunk = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['id', 'page_start', 'page_end', 'text', 'element_ids', 'strategy', 'heading', 'bounding_boxes'], context);
  return { id: string(required(source, 'id', context), `${context}.id`), page_start: integer(required(source, 'page_start', context), `${context}.page_start`), page_end: integer(required(source, 'page_end', context), `${context}.page_end`), text: string(required(source, 'text', context), `${context}.text`), element_ids: strings(required(source, 'element_ids', context), `${context}.element_ids`), bounding_boxes: array(required(source, 'bounding_boxes', context), `${context}.bounding_boxes`).map((entry, index) => box(entry, `${context}.bounding_boxes[${String(index)}]`)) };
};

const documentMap = (value: unknown): Json => {
  const source = record(value, 'document_map');
  const pages = array(required(source, 'pages', 'document_map'), 'document_map.pages').map((entry, index) => {
    const page = record(entry, `document_map.pages[${String(index)}]`);
    exact(page, DOCUMENT_MAP_PAGE_KEYS, `document_map.pages[${String(index)}]`);
    return {
      page: integer(required(page, 'page', 'document_map page'), 'document_map page.page'),
      element_ids: strings(required(page, 'element_ids', 'document_map page'), 'document_map page.element_ids'),
      chunk_ids: strings(required(page, 'chunk_ids', 'document_map page'), 'document_map page.chunk_ids'),
      text_layer_page_index: integer(required(page, 'text_layer_page_index', 'document_map page'), 'document_map page.text_layer_page_index'),
      text_layer_run_count: integer(required(page, 'text_layer_run_count', 'document_map page'), 'document_map page.text_layer_run_count'),
      text_layer_line_count: integer(required(page, 'text_layer_line_count', 'document_map page'), 'document_map page.text_layer_line_count'),
      text_layer_char_count: integer(required(page, 'text_layer_char_count', 'document_map page'), 'document_map page.text_layer_char_count'),
      text_chars: integer(required(page, 'text_chars', 'document_map page'), 'document_map page.text_chars'),
      text_item_count: integer(required(page, 'text_item_count', 'document_map page'), 'document_map page.text_item_count'),
    };
  });
  const summary = record(required(source, 'summary', 'document_map'), 'document_map.summary');
  return {
    layers: strings(required(source, 'layers', 'document_map'), 'document_map.layers').filter((layer) => ['selectable_text', 'text_layer', 'semantic_hints', 'citation_chunks', 'layout_diagnostics', 'page_geometry'].includes(layer)),
    pages,
    summary: {
      selected_pages: integers(required(summary, 'selected_pages', 'document_map.summary'), 'document_map.summary.selected_pages'),
      processed_page_count: integer(required(summary, 'processed_page_count', 'document_map.summary'), 'document_map.summary.processed_page_count'),
      element_count: integer(required(summary, 'element_count', 'document_map.summary'), 'document_map.summary.element_count'),
      text_element_count: integer(required(summary, 'text_element_count', 'document_map.summary'), 'document_map.summary.text_element_count'),
      text_layer_page_count: integer(required(summary, 'text_layer_page_count', 'document_map.summary'), 'document_map.summary.text_layer_page_count'),
      text_layer_run_count: integer(required(summary, 'text_layer_run_count', 'document_map.summary'), 'document_map.summary.text_layer_run_count'),
      text_layer_line_count: integer(required(summary, 'text_layer_line_count', 'document_map.summary'), 'document_map.summary.text_layer_line_count'),
      text_layer_char_count: integer(required(summary, 'text_layer_char_count', 'document_map.summary'), 'document_map.summary.text_layer_char_count'),
      chunk_count: integer(required(summary, 'chunk_count', 'document_map.summary'), 'document_map.summary.chunk_count'),
    },
  };
};

export const canonicalSelectableReadResult = (value: unknown): Json => {
  const outer = record(value, 'read result');
  let data = outer;
  if (Object.hasOwn(outer, 'content')) {
    const content = array(required(outer, 'content', 'tool result'), 'tool result.content');
    const first = record(content[0], 'tool result.content[0]');
    const payload = record(JSON.parse(string(required(first, 'text', 'tool result.content[0]'), 'tool result.content[0].text')), 'tool payload');
    const source = record(array(required(payload, 'results', 'tool payload'), 'tool payload.results')[0], 'tool source');
    if (required(source, 'success', 'tool source') !== true) throw new Error('read source must succeed');
    data = record(required(source, 'data', 'tool source'), 'tool source.data');
  }
  const result: Record<string, Json> = {
    num_pages: integer(required(data, 'num_pages', 'read result'), 'read result.num_pages'),
    dependency_surfaces: Object.fromEntries(SELECTABLE_TEXT_SEGMENTATION_MUTATION_MANIFEST.dependencyPresence.map((key) => [key, Object.hasOwn(data, key)])),
  };
  if (Object.hasOwn(data, 'elements')) result.elements = array(data.elements, 'elements').map((entry, index) => element(entry, `elements[${String(index)}]`));
  if (Object.hasOwn(data, 'chunks')) result.chunks = array(data.chunks, 'chunks').map((entry, index) => chunk(entry, `chunks[${String(index)}]`));
  if (Object.hasOwn(data, 'text_layer')) result.text_layer = textLayer(data.text_layer);
  if (Object.hasOwn(data, 'document_map')) result.document_map = documentMap(data.document_map);
  return result;
};

const searchMatch = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exact(source, ['id', 'page', 'text', 'snippet', 'match_start', 'match_end', 'text_item_index', 'bounding_box', 'bounding_box_level', 'provenance'], context);
  return { page: integer(required(source, 'page', context), `${context}.page`), text: string(required(source, 'text', context), `${context}.text`), snippet: string(required(source, 'snippet', context), `${context}.snippet`), match_start: integer(required(source, 'match_start', context), `${context}.match_start`), match_end: integer(required(source, 'match_end', context), `${context}.match_end`), text_item_index: integer(required(source, 'text_item_index', context), `${context}.text_item_index`), bounding_box: box(required(source, 'bounding_box', context), `${context}.bounding_box`), bounding_box_level: string(required(source, 'bounding_box_level', context), `${context}.bounding_box_level`) };
};
export const canonicalSelectableSearchResult = (value: unknown): Json => {
  const source = record(value, 'search result');
  if (required(source, 'success', 'search result') !== true) throw new Error('search result must succeed');
  return {
    success: true,
    num_pages: integer(required(source, 'num_pages', 'search result'), 'search result.num_pages'),
    searched_pages: integers(required(source, 'searched_pages', 'search result'), 'search result.searched_pages'),
    total_matches: integer(required(source, 'total_matches', 'search result'), 'search result.total_matches'),
    matches: array(required(source, 'matches', 'search result'), 'search result.matches').map((entry, index) => searchMatch(entry, `search result.matches[${String(index)}]`)),
  };
};
