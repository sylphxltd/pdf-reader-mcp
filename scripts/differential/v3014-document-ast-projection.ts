export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const AST_KEYS = ['version', 'profile', 'root', 'summary', 'warnings'] as const;
const NODE_KEYS = [
  'id',
  'type',
  'page_start',
  'page_end',
  'element_ids',
  'chunk_ids',
  'bounding_boxes',
  'title',
  'text',
  'level',
  'semantic_role',
  'section_path',
  'continued_from_section_id',
  'children',
] as const;
const SUMMARY_KEYS = [
  'selected_pages',
  'page_count',
  'node_count',
  'section_count',
  'paragraph_count',
  'list_item_count',
  'caption_count',
  'header_count',
  'footer_count',
  'section_context_node_count',
  'cross_page_section_context_count',
  'caption_link_count',
  'table_count',
  'image_count',
  'figure_count',
  'chart_count',
  'formula_count',
  'diagram_count',
  'visual_enrichment_count',
  'visual_enrichment_kind_counts',
  'max_depth',
] as const;
const ELEMENT_KEYS = [
  'id', 'type', 'page', 'content', 'bounding_box', 'provenance', 'semantic_hint',
] as const;
const CHUNK_KEYS = [
  'id', 'page_start', 'page_end', 'text', 'element_ids', 'strategy', 'heading', 'bounding_boxes',
] as const;
export const DOCUMENT_AST_DEPENDENCY_SURFACES = [
  'elements',
  'chunks',
  'page_geometry',
  'text_layer',
  'document_map',
  'tables',
  'visual_enrichments',
  'ocr_text_layer',
  '_internal',
  'internal',
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
  return value;
};
const coordinate = (value: unknown, context: string): number =>
  Math.round(number(value, context) * 1e9) / 1e9;
const array = (value: unknown, context: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value;
};
const stringArray = (value: unknown, context: string): string[] =>
  array(value, context).map((entry, index) => string(entry, `${context}[${index}]`));
const numberArray = (value: unknown, context: string): number[] =>
  array(value, context).map((entry, index) => number(entry, `${context}[${index}]`));

const boundingBox = (value: unknown, context: string): Json => {
  const box = record(value, context);
  exactKeys(box, ['left', 'bottom', 'right', 'top'], context);
  return {
    left: coordinate(required(box, 'left', context), `${context}.left`),
    bottom: coordinate(required(box, 'bottom', context), `${context}.bottom`),
    right: coordinate(required(box, 'right', context), `${context}.right`),
    top: coordinate(required(box, 'top', context), `${context}.top`),
  };
};
const sectionRef = (value: unknown, context: string): Json => {
  const ref = record(value, context);
  exactKeys(ref, ['id', 'title', 'level', 'page_start'], context);
  return {
    id: string(required(ref, 'id', context), `${context}.id`),
    title: string(required(ref, 'title', context), `${context}.title`),
    level: number(required(ref, 'level', context), `${context}.level`),
    page_start: number(required(ref, 'page_start', context), `${context}.page_start`),
  };
};
const node = (value: unknown, context: string): Json => {
  const source = record(value, context);
  exactKeys(source, NODE_KEYS, context);
  const output: Record<string, Json> = {
    id: string(required(source, 'id', context), `${context}.id`),
    type: string(required(source, 'type', context), `${context}.type`),
    page_start: number(required(source, 'page_start', context), `${context}.page_start`),
    page_end: number(required(source, 'page_end', context), `${context}.page_end`),
    element_ids: stringArray(required(source, 'element_ids', context), `${context}.element_ids`),
  };
  if (Object.hasOwn(source, 'chunk_ids')) output.chunk_ids = stringArray(source.chunk_ids, `${context}.chunk_ids`);
  if (Object.hasOwn(source, 'bounding_boxes')) {
    output.bounding_boxes = array(source.bounding_boxes, `${context}.bounding_boxes`).map((entry, index) =>
      boundingBox(entry, `${context}.bounding_boxes[${index}]`)
    );
  }
  for (const key of ['title', 'text', 'semantic_role', 'continued_from_section_id'] as const) {
    if (Object.hasOwn(source, key)) output[key] = string(source[key], `${context}.${key}`);
  }
  if (Object.hasOwn(source, 'level')) output.level = number(source.level, `${context}.level`);
  if (Object.hasOwn(source, 'section_path')) {
    output.section_path = array(source.section_path, `${context}.section_path`).map((entry, index) =>
      sectionRef(entry, `${context}.section_path[${index}]`)
    );
  }
  if (Object.hasOwn(source, 'children')) {
    output.children = array(source.children, `${context}.children`).map((entry, index) =>
      node(entry, `${context}.children[${index}]`)
    );
  }
  return output;
};
const summary = (value: unknown): Json => {
  const source = record(value, 'document_ast.summary');
  exactKeys(source, SUMMARY_KEYS, 'document_ast.summary');
  const output: Record<string, Json> = {
    selected_pages: numberArray(required(source, 'selected_pages', 'document_ast.summary'), 'document_ast.summary.selected_pages'),
  };
  for (const key of SUMMARY_KEYS.filter(
    (entry) => entry !== 'selected_pages' && entry !== 'visual_enrichment_kind_counts'
  )) {
    output[key] = number(required(source, key, 'document_ast.summary'), `document_ast.summary.${key}`);
  }
  const kinds = record(
    required(source, 'visual_enrichment_kind_counts', 'document_ast.summary'),
    'document_ast.summary.visual_enrichment_kind_counts'
  );
  output.visual_enrichment_kind_counts = Object.fromEntries(
    Object.entries(kinds).map(([key, count]) => [
      key,
      number(count, `document_ast.summary.visual_enrichment_kind_counts.${key}`),
    ])
  );
  return output;
};
const semanticHint = (value: unknown, context: string): Json => {
  if (value === undefined) return null;
  const source = record(value, context);
  exactKeys(source, ['role', 'confidence', 'signals', 'level'], context);
  return {
    role: string(required(source, 'role', context), `${context}.role`),
    confidence: number(required(source, 'confidence', context), `${context}.confidence`),
    signals: stringArray(required(source, 'signals', context), `${context}.signals`),
    ...(Object.hasOwn(source, 'level') ? { level: number(source.level, `${context}.level`) } : {}),
  };
};
const elementProvenance = (value: unknown, context: string): void => {
  const source = record(value, context);
  exactKeys(source, ['engine', 'source', 'ocr_source_render_evidence_id'], context);
  string(required(source, 'engine', context), `${context}.engine`);
  string(required(source, 'source', context), `${context}.source`);
  if (Object.hasOwn(source, 'ocr_source_render_evidence_id')) {
    string(source.ocr_source_render_evidence_id, `${context}.ocr_source_render_evidence_id`);
  }
};

export const canonicalDocumentAstResult = (value: unknown): Json => {
  const data = record(value, 'result.data');
  const ast = record(required(data, 'document_ast', 'result.data'), 'document_ast');
  exactKeys(ast, AST_KEYS, 'document_ast');
  const elements = Object.hasOwn(data, 'elements')
    ? array(data.elements, 'result.data.elements').map((entry, index) => {
        const element = record(entry, `elements[${index}]`);
        exactKeys(element, ELEMENT_KEYS, `elements[${index}]`);
        elementProvenance(
          required(element, 'provenance', `elements[${index}]`),
          `elements[${index}].provenance`
        );
        return {
          id: string(required(element, 'id', `elements[${index}]`), `elements[${index}].id`),
          type: string(required(element, 'type', `elements[${index}]`), `elements[${index}].type`),
          page: number(required(element, 'page', `elements[${index}]`), `elements[${index}].page`),
          content: string(required(element, 'content', `elements[${index}]`), `elements[${index}].content`),
          ...(Object.hasOwn(element, 'bounding_box')
            ? { bounding_box: boundingBox(element.bounding_box, `elements[${index}].bounding_box`) }
            : {}),
          semantic_hint: semanticHint(element.semantic_hint, `elements[${index}].semantic_hint`),
        };
      })
    : [];
  const chunks = Object.hasOwn(data, 'chunks')
    ? array(data.chunks, 'result.data.chunks').map((entry, index) => {
        const chunk = record(entry, `chunks[${index}]`);
        exactKeys(chunk, CHUNK_KEYS, `chunks[${index}]`);
        return {
          id: string(required(chunk, 'id', `chunks[${index}]`), `chunks[${index}].id`),
          page_start: number(required(chunk, 'page_start', `chunks[${index}]`), `chunks[${index}].page_start`),
          page_end: number(required(chunk, 'page_end', `chunks[${index}]`), `chunks[${index}].page_end`),
          text: string(required(chunk, 'text', `chunks[${index}]`), `chunks[${index}].text`),
          element_ids: stringArray(required(chunk, 'element_ids', `chunks[${index}]`), `chunks[${index}].element_ids`),
          ...(Object.hasOwn(chunk, 'strategy') ? { strategy: string(chunk.strategy, `chunks[${index}].strategy`) } : {}),
          ...(Object.hasOwn(chunk, 'heading') ? { heading: string(chunk.heading, `chunks[${index}].heading`) } : {}),
          ...(Object.hasOwn(chunk, 'bounding_boxes')
            ? {
                bounding_boxes: array(chunk.bounding_boxes, `chunks[${index}].bounding_boxes`).map(
                  (boxValue, boxIndex) =>
                    boundingBox(boxValue, `chunks[${index}].bounding_boxes[${boxIndex}]`)
                ),
              }
            : {}),
        };
      })
    : [];
  return {
    top_level_warnings: Object.hasOwn(data, 'warnings')
      ? stringArray(data.warnings, 'result.data.warnings')
      : null,
    dependency_surfaces: Object.fromEntries(
      DOCUMENT_AST_DEPENDENCY_SURFACES.map((key) => [key, Object.hasOwn(data, key)])
    ),
    elements,
    chunks,
    document_ast: {
      version: string(required(ast, 'version', 'document_ast'), 'document_ast.version'),
      profile: string(required(ast, 'profile', 'document_ast'), 'document_ast.profile'),
      root: node(required(ast, 'root', 'document_ast'), 'document_ast.root'),
      summary: summary(required(ast, 'summary', 'document_ast')),
      ...(Object.hasOwn(ast, 'warnings')
        ? { warnings: stringArray(ast.warnings, 'document_ast.warnings') }
        : {}),
    },
  };
};

export const DOCUMENT_AST_MUTATION_MANIFEST = {
  version: 1,
  wrongPrimitiveTypes: [
    'document_ast.version',
    'document_ast.root.id',
    'document_ast.root.page_start',
    'document_ast.root.element_ids[0]',
    'document_ast.summary.page_count',
    'document_ast.summary.selected_pages[0]',
    'top_level_warnings[0]',
    'document_ast.warnings[0]',
  ],
  unexpectedFields: [
    'document_ast', 'document_ast.root', 'document_ast.summary', 'elements[0]', 'chunks[0]',
  ],
  requiredOmissions: [
    'document_ast.version',
    'document_ast.root.id',
    'document_ast.root.element_ids',
    'document_ast.summary.page_count',
  ],
  privateLeakage: ['page_geometry', 'document_map', 'text_layer', '_internal', 'internal'],
  dependencyPresence: [...DOCUMENT_AST_DEPENDENCY_SURFACES],
} as const;
