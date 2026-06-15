import type {
  BoundingBox,
  PdfChunk,
  PdfDocumentAst,
  PdfDocumentAstCaptionLink,
  PdfDocumentAstCaptionRelation,
  PdfDocumentAstNode,
  PdfDocumentAstNodeType,
  PdfDocumentAstSectionRef,
  PdfDocumentElement,
  PdfRegionAnalysisKind,
  PdfVisualEnrichment,
} from '../types/pdf.js';
import { type SemanticCaptionKind, semanticCaptionKind } from './semanticPatterns.js';

const DOCUMENT_AST_VERSION = '2026-06-15' as const;
const CAPTION_TARGET_MAX_VERTICAL_GAP = 96;
const CAPTION_TARGET_MIN_HORIZONTAL_OVERLAP_RATIO = 0.2;

interface BuildDocumentAstInput {
  selectedPages: number[];
  elements: PdfDocumentElement[];
  chunks: PdfChunk[];
  visualEnrichments?: PdfVisualEnrichment[] | undefined;
  warnings?: string[] | undefined;
}

interface AstStats {
  nodeCount: number;
  sectionCount: number;
  paragraphCount: number;
  listItemCount: number;
  captionCount: number;
  headerCount: number;
  footerCount: number;
  sectionContextNodeCount: number;
  crossPageSectionContextCount: number;
  captionLinkCount: number;
  tableCount: number;
  imageCount: number;
  figureCount: number;
  chartCount: number;
  formulaCount: number;
  diagramCount: number;
  visualEnrichmentCount: number;
  visualEnrichmentKindCounts: Partial<Record<PdfRegionAnalysisKind, number>>;
  maxDepth: number;
}

const unique = <TValue>(values: TValue[]): TValue[] => [...new Set(values)];

const sectionRef = (node: PdfDocumentAstNode): PdfDocumentAstSectionRef => ({
  id: node.id,
  title: node.title ?? node.text ?? node.id,
  level: node.level ?? 1,
  page_start: node.page_start,
});

const continuedFromSectionId = (
  path: PdfDocumentAstSectionRef[],
  page: number
): string | undefined => {
  const priorPageSection = path.findLast((section) => section.page_start < page);
  return priorPageSection?.id;
};

const captionKind = (text: string | undefined): SemanticCaptionKind | undefined =>
  semanticCaptionKind(text);

const pageRangeForElements = (elements: PdfDocumentElement[]): { start: number; end: number } => {
  if (elements.length === 0) return { start: 0, end: 0 };
  const pages = elements.map((element) => element.page);
  return {
    start: Math.min(...pages),
    end: Math.max(...pages),
  };
};

const chunksByElementId = (chunks: PdfChunk[]): Map<string, string[]> => {
  const index = new Map<string, string[]>();

  for (const chunk of chunks) {
    for (const elementId of chunk.element_ids) {
      const ids = index.get(elementId) ?? [];
      ids.push(chunk.id);
      index.set(elementId, ids);
    }
  }

  return index;
};

const visualEnrichmentType = (kind: PdfRegionAnalysisKind): PdfDocumentAstNodeType | undefined => {
  if (kind === 'figure' || kind === 'chart' || kind === 'formula' || kind === 'diagram') {
    return kind;
  }

  return undefined;
};

const visualKindForNode = (node: PdfDocumentAstNode): PdfRegionAnalysisKind | undefined => {
  if (node.visual_enrichment) return node.visual_enrichment.kind;
  if (
    node.type === 'table' ||
    node.type === 'figure' ||
    node.type === 'chart' ||
    node.type === 'formula' ||
    node.type === 'image' ||
    node.type === 'diagram'
  ) {
    return node.type;
  }

  return undefined;
};

const captionKindMatchesNode = (
  kind: ReturnType<typeof captionKind>,
  node: PdfDocumentAstNode
): boolean => {
  if (!kind) return true;
  const nodeKind = visualKindForNode(node);
  if (kind === 'figure') return nodeKind === 'figure' || nodeKind === 'image';

  return nodeKind === kind;
};

const isCaptionTargetNode = (node: PdfDocumentAstNode): boolean =>
  node.type === 'table' ||
  node.type === 'image' ||
  node.type === 'figure' ||
  node.type === 'chart' ||
  node.type === 'formula' ||
  node.type === 'diagram' ||
  node.type === 'visual_region';

const visualText = (enrichment: PdfVisualEnrichment): string | undefined =>
  enrichment.markdown ??
  enrichment.text ??
  enrichment.description ??
  enrichment.formula?.latex ??
  enrichment.formula?.text ??
  enrichment.chart?.summary;

const visualEnrichmentsByTargetElementId = (
  enrichments: PdfVisualEnrichment[]
): Map<string, PdfVisualEnrichment> => {
  const index = new Map<string, PdfVisualEnrichment>();

  for (const enrichment of enrichments) {
    if (!index.has(enrichment.target_element_id)) {
      index.set(enrichment.target_element_id, enrichment);
    }
  }

  return index;
};

const visualEnrichmentsByPage = (
  enrichments: PdfVisualEnrichment[]
): Map<number, PdfVisualEnrichment[]> => {
  const index = new Map<number, PdfVisualEnrichment[]>();

  for (const enrichment of enrichments) {
    const values = index.get(enrichment.page) ?? [];
    values.push(enrichment);
    index.set(enrichment.page, values);
  }

  return index;
};

const nodeForVisualEnrichment = (enrichment: PdfVisualEnrichment): PdfDocumentAstNode => {
  const visualType = visualEnrichmentType(enrichment.kind) ?? 'visual_region';

  return {
    id: enrichment.id,
    type: visualType,
    page_start: enrichment.page,
    page_end: enrichment.page,
    element_ids: [enrichment.target_element_id],
    visual_enrichment_ids: [enrichment.id],
    bounding_boxes: [enrichment.source_bounding_box],
    ...(enrichment.confidence !== undefined ? { confidence: enrichment.confidence } : {}),
    ...(visualText(enrichment) ? { text: visualText(enrichment) } : {}),
    ...(enrichment.formula ? { formula: enrichment.formula } : {}),
    ...(enrichment.chart ? { chart: enrichment.chart } : {}),
    visual_enrichment: enrichment,
  };
};

const nodeForElement = (
  element: PdfDocumentElement,
  chunkIndex: Map<string, string[]>,
  visualEnrichment?: PdfVisualEnrichment | undefined
): PdfDocumentAstNode => {
  const base = {
    page_start: element.page,
    page_end: element.page,
    element_ids: [element.id],
    ...(visualEnrichment ? { visual_enrichment_ids: [visualEnrichment.id] } : {}),
    ...(chunkIndex.get(element.id) ? { chunk_ids: chunkIndex.get(element.id) } : {}),
    ...(element.bounding_box ? { bounding_boxes: [element.bounding_box] } : {}),
    ...(visualEnrichment?.confidence !== undefined || element.confidence !== undefined
      ? { confidence: visualEnrichment?.confidence ?? element.confidence }
      : {}),
    ...(visualEnrichment ? { visual_enrichment: visualEnrichment } : {}),
  };

  if (element.type === 'text') {
    const role = element.semantic_hint?.role ?? 'paragraph';
    const type: PdfDocumentAstNodeType =
      role === 'heading'
        ? 'section'
        : role === 'list_item'
          ? 'list_item'
          : role === 'caption' || role === 'header' || role === 'footer'
            ? role
            : 'paragraph';

    return {
      ...base,
      id: type === 'section' ? `${element.id}-section` : element.id,
      type,
      text: element.content,
      ...(type === 'section'
        ? { title: element.content, level: element.semantic_hint?.level ?? 1 }
        : {}),
      semantic_role: role,
      ...(type === 'section' ? { children: [] } : {}),
    };
  }

  if (element.type === 'table') {
    return {
      ...base,
      id: element.id,
      type: 'table',
      text: element.table.rows.map((row) => row.join(' | ')).join('\n'),
      table: {
        rows: element.table.rows,
        rowCount: element.table.rowCount,
        colCount: element.table.colCount,
        confidence: element.table.confidence,
        ...(element.table.quality ? { quality: element.table.quality } : {}),
        ...(element.table.continuation ? { continuation: element.table.continuation } : {}),
        ...(element.table.provenance ? { provenance: element.table.provenance } : {}),
      },
    };
  }

  const visualType = visualEnrichment ? visualEnrichmentType(visualEnrichment.kind) : undefined;

  return {
    ...base,
    id: element.id,
    type: visualType ?? 'image',
    ...(visualEnrichment && visualText(visualEnrichment)
      ? { text: visualText(visualEnrichment) }
      : {}),
    image: {
      index: element.image.index,
      width: element.image.width,
      height: element.image.height,
      format: element.image.format,
    },
    ...(visualEnrichment?.formula ? { formula: visualEnrichment.formula } : {}),
    ...(visualEnrichment?.chart ? { chart: visualEnrichment.chart } : {}),
  };
};

const appendToPageTree = (
  pageNode: PdfDocumentAstNode,
  sectionStack: PdfDocumentAstNode[],
  node: PdfDocumentAstNode
) => {
  if (node.type === 'header' || node.type === 'footer') {
    pageNode.children ??= [];
    pageNode.children.push(node);
    return;
  }

  if (node.type === 'section') {
    const level = node.level ?? 1;
    while (sectionStack.length > 0) {
      const parent = sectionStack[sectionStack.length - 1];
      if (parent && (parent.level ?? 1) < level) break;
      sectionStack.pop();
    }

    const parent = sectionStack[sectionStack.length - 1] ?? pageNode;
    parent.children ??= [];
    parent.children.push(node);
    sectionStack.push(node);
    return;
  }

  const parent = sectionStack[sectionStack.length - 1] ?? pageNode;
  parent.children ??= [];
  parent.children.push(node);
};

const collectPageNodes = (node: PdfDocumentAstNode): PdfDocumentAstNode[] => {
  const children = node.children ?? [];
  return [node, ...children.flatMap(collectPageNodes)];
};

const primaryBox = (node: PdfDocumentAstNode): BoundingBox | undefined => node.bounding_boxes?.[0];

const horizontalOverlapRatio = (left: BoundingBox, right: BoundingBox): number => {
  const overlap = Math.min(left.right, right.right) - Math.max(left.left, right.left);
  if (overlap <= 0) return 0;

  const leftWidth = left.right - left.left;
  const rightWidth = right.right - right.left;
  const denominator = Math.min(leftWidth, rightWidth);
  if (denominator <= 0) return 0;

  return overlap / denominator;
};

const captionTargetRelation = (
  captionBox: BoundingBox,
  targetBox: BoundingBox
): { relation: PdfDocumentAstCaptionRelation; gap: number } => {
  if (captionBox.top <= targetBox.bottom) {
    return { relation: 'below', gap: targetBox.bottom - captionBox.top };
  }

  if (captionBox.bottom >= targetBox.top) {
    return { relation: 'above', gap: captionBox.bottom - targetBox.top };
  }

  return { relation: 'overlapping', gap: 0 };
};

const captionTargetSignals = (
  kind: ReturnType<typeof captionKind>,
  relation: PdfDocumentAstCaptionRelation,
  kindMatched: boolean
): string[] => [
  'same-page',
  'horizontal-overlap',
  `caption-${relation}`,
  ...(kind ? [`caption-prefix-${kind}`] : []),
  ...(kindMatched ? ['caption-kind-match'] : []),
];

const buildCaptionLink = (
  caption: PdfDocumentAstNode,
  target: PdfDocumentAstNode,
  kind: ReturnType<typeof captionKind>
): PdfDocumentAstCaptionLink | undefined => {
  const captionBox = primaryBox(caption);
  const targetBox = primaryBox(target);
  if (!captionBox || !targetBox) return undefined;

  const overlapRatio = horizontalOverlapRatio(captionBox, targetBox);
  if (overlapRatio < CAPTION_TARGET_MIN_HORIZONTAL_OVERLAP_RATIO) return undefined;

  const { relation, gap } = captionTargetRelation(captionBox, targetBox);
  if (gap > CAPTION_TARGET_MAX_VERTICAL_GAP) return undefined;

  const kindMatched = kind !== undefined && captionKindMatchesNode(kind, target);
  const visualEnrichmentId = target.visual_enrichment_ids?.[0];
  const confidence = Math.max(
    0.5,
    Math.min(0.95, 0.62 + overlapRatio * 0.18 + (kindMatched ? 0.12 : 0) - gap / 480)
  );

  return {
    node_id: target.id,
    element_id: target.element_ids[0] ?? target.id,
    type: target.type,
    relation,
    confidence: Number(confidence.toFixed(2)),
    signals: captionTargetSignals(kind, relation, kindMatched),
    ...(visualEnrichmentId ? { visual_enrichment_id: visualEnrichmentId } : {}),
  };
};

const linkCaptionsOnPage = (pageNode: PdfDocumentAstNode) => {
  const pageNodes = collectPageNodes(pageNode);
  const captions = pageNodes.filter((node) => node.type === 'caption');
  const targets = pageNodes.filter(isCaptionTargetNode);

  for (const caption of captions) {
    const kind = captionKind(caption.text);
    const matchingTargets = targets.filter((target) => captionKindMatchesNode(kind, target));
    if (kind && matchingTargets.length === 0) continue;
    const candidateTargets = matchingTargets.length > 0 ? matchingTargets : targets;
    const links = candidateTargets
      .map((target) => buildCaptionLink(caption, target, kind))
      .filter((link) => link !== undefined)
      .sort((left, right) => right.confidence - left.confidence);
    const bestLink = links[0];
    if (!bestLink) continue;

    caption.caption_links = [bestLink];
    const target = targets.find((candidate) => candidate.id === bestLink.node_id);
    if (target) {
      target.caption_ids = unique([...(target.caption_ids ?? []), caption.id]);
    }
  }
};

const syncSectionContext = (
  documentSectionStack: PdfDocumentAstNode[],
  node: PdfDocumentAstNode
) => {
  if (node.type === 'header' || node.type === 'footer') return;

  if (node.type === 'section') {
    const level = node.level ?? 1;
    while (documentSectionStack.length > 0) {
      const parent = documentSectionStack[documentSectionStack.length - 1];
      if (parent && (parent.level ?? 1) < level) break;
      documentSectionStack.pop();
    }

    const path = [...documentSectionStack.map(sectionRef), sectionRef(node)];
    if (path.length > 0) {
      node.section_path = path;
    }
    const continuedFrom = continuedFromSectionId(path, node.page_start);
    if (continuedFrom) {
      node.continued_from_section_id = continuedFrom;
    }
    documentSectionStack.push(node);
    return;
  }

  if (documentSectionStack.length === 0) return;

  const path = documentSectionStack.map(sectionRef);
  node.section_path = path;
  const continuedFrom = continuedFromSectionId(path, node.page_start);
  if (continuedFrom) {
    node.continued_from_section_id = continuedFrom;
  }
};

const aggregateNode = (node: PdfDocumentAstNode, depth: number): AstStats => {
  const children = node.children ?? [];
  const childStats = children.map((child) => aggregateNode(child, depth + 1));

  const childElementIds = children.flatMap((child) => child.element_ids);
  node.element_ids = unique([...node.element_ids, ...childElementIds]);

  const childVisualEnrichmentIds = children.flatMap((child) => child.visual_enrichment_ids ?? []);
  const visualEnrichmentIds = unique([
    ...(node.visual_enrichment_ids ?? []),
    ...childVisualEnrichmentIds,
  ]);
  if (visualEnrichmentIds.length > 0) {
    node.visual_enrichment_ids = visualEnrichmentIds;
  }

  const childChunkIds = children.flatMap((child) => child.chunk_ids ?? []);
  const chunkIds = unique([...(node.chunk_ids ?? []), ...childChunkIds]);
  if (chunkIds.length > 0) {
    node.chunk_ids = chunkIds;
  }

  const childBoxes = children.flatMap((child) => child.bounding_boxes ?? []);
  const boxes = uniqueBoundingBoxes([...(node.bounding_boxes ?? []), ...childBoxes]);
  if (boxes.length > 0) {
    node.bounding_boxes = boxes;
  }

  if (children.length > 0) {
    node.page_start = Math.min(node.page_start, ...children.map((child) => child.page_start));
    node.page_end = Math.max(node.page_end, ...children.map((child) => child.page_end));
  }

  return childStats.reduce<AstStats>(
    (stats, child) => ({
      nodeCount: stats.nodeCount + child.nodeCount,
      sectionCount: stats.sectionCount + child.sectionCount,
      paragraphCount: stats.paragraphCount + child.paragraphCount,
      listItemCount: stats.listItemCount + child.listItemCount,
      captionCount: stats.captionCount + child.captionCount,
      headerCount: stats.headerCount + child.headerCount,
      footerCount: stats.footerCount + child.footerCount,
      sectionContextNodeCount: stats.sectionContextNodeCount + child.sectionContextNodeCount,
      crossPageSectionContextCount:
        stats.crossPageSectionContextCount + child.crossPageSectionContextCount,
      captionLinkCount: stats.captionLinkCount + child.captionLinkCount,
      tableCount: stats.tableCount + child.tableCount,
      imageCount: stats.imageCount + child.imageCount,
      figureCount: stats.figureCount + child.figureCount,
      chartCount: stats.chartCount + child.chartCount,
      formulaCount: stats.formulaCount + child.formulaCount,
      diagramCount: stats.diagramCount + child.diagramCount,
      visualEnrichmentCount: stats.visualEnrichmentCount + child.visualEnrichmentCount,
      visualEnrichmentKindCounts: mergeVisualKindCounts(
        stats.visualEnrichmentKindCounts,
        child.visualEnrichmentKindCounts
      ),
      maxDepth: Math.max(stats.maxDepth, child.maxDepth),
    }),
    {
      nodeCount: 1,
      sectionCount: node.type === 'section' ? 1 : 0,
      paragraphCount: node.type === 'paragraph' ? 1 : 0,
      listItemCount: node.type === 'list_item' ? 1 : 0,
      captionCount: node.type === 'caption' ? 1 : 0,
      headerCount: node.type === 'header' ? 1 : 0,
      footerCount: node.type === 'footer' ? 1 : 0,
      sectionContextNodeCount: node.section_path ? 1 : 0,
      crossPageSectionContextCount: node.continued_from_section_id ? 1 : 0,
      captionLinkCount: node.caption_links?.length ?? 0,
      tableCount: node.type === 'table' ? 1 : 0,
      imageCount: node.image !== undefined ? 1 : 0,
      figureCount: node.type === 'figure' ? 1 : 0,
      chartCount: node.type === 'chart' ? 1 : 0,
      formulaCount: node.type === 'formula' ? 1 : 0,
      diagramCount: node.type === 'diagram' ? 1 : 0,
      visualEnrichmentCount: node.visual_enrichment ? 1 : 0,
      visualEnrichmentKindCounts: node.visual_enrichment
        ? { [node.visual_enrichment.kind]: 1 }
        : {},
      maxDepth: depth,
    }
  );
};

const mergeVisualKindCounts = (
  left: Partial<Record<PdfRegionAnalysisKind, number>>,
  right: Partial<Record<PdfRegionAnalysisKind, number>>
): Partial<Record<PdfRegionAnalysisKind, number>> => {
  const merged: Partial<Record<PdfRegionAnalysisKind, number>> = { ...left };

  for (const [kind, count] of Object.entries(right) as Array<[PdfRegionAnalysisKind, number]>) {
    merged[kind] = (merged[kind] ?? 0) + count;
  }

  return merged;
};

const uniqueBoundingBoxes = (boxes: BoundingBox[]): BoundingBox[] => {
  const seen = new Set<string>();
  const uniqueBoxes: BoundingBox[] = [];

  for (const box of boxes) {
    const key = `${box.left}:${box.bottom}:${box.right}:${box.top}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueBoxes.push(box);
  }

  return uniqueBoxes;
};

export const buildDocumentAst = (input: BuildDocumentAstInput): PdfDocumentAst => {
  const selectedPages = [...new Set(input.selectedPages)].sort((a, b) => a - b);
  const visualEnrichments = input.visualEnrichments ?? [];
  const range = pageRangeForElements(input.elements);
  const chunkIndex = chunksByElementId(input.chunks);
  const visualByTargetElementId = visualEnrichmentsByTargetElementId(visualEnrichments);
  const visualByPage = visualEnrichmentsByPage(visualEnrichments);
  const documentSectionStack: PdfDocumentAstNode[] = [];

  const root: PdfDocumentAstNode = {
    id: 'document',
    type: 'document',
    page_start: range.start,
    page_end: range.end,
    element_ids: [],
    children: [],
  };

  const elementsByPage = new Map<number, PdfDocumentElement[]>();
  for (const element of input.elements) {
    const pageElements = elementsByPage.get(element.page) ?? [];
    pageElements.push(element);
    elementsByPage.set(element.page, pageElements);
  }

  for (const page of selectedPages) {
    const pageElements = elementsByPage.get(page) ?? [];
    const pageElementIds = new Set(pageElements.map((element) => element.id));
    const pageNode: PdfDocumentAstNode = {
      id: `p${page}`,
      type: 'page',
      page_start: page,
      page_end: page,
      element_ids: [],
      children: [],
    };
    const sectionStack: PdfDocumentAstNode[] = [];

    for (const element of pageElements) {
      const node = nodeForElement(element, chunkIndex, visualByTargetElementId.get(element.id));
      syncSectionContext(documentSectionStack, node);
      appendToPageTree(pageNode, sectionStack, node);
    }

    for (const enrichment of visualByPage.get(page) ?? []) {
      if (pageElementIds.has(enrichment.target_element_id)) continue;
      const node = nodeForVisualEnrichment(enrichment);
      syncSectionContext(documentSectionStack, node);
      appendToPageTree(pageNode, sectionStack, node);
    }

    linkCaptionsOnPage(pageNode);
    root.children?.push(pageNode);
  }

  const stats = aggregateNode(root, 1);
  const warnings = [...(input.warnings ?? [])];
  if (
    !input.elements.some(
      (element) => element.type === 'text' && element.semantic_hint?.role === 'heading'
    )
  ) {
    warnings.push('No heading hierarchy detected; document_ast uses page-level leaf nodes.');
  }

  return {
    version: DOCUMENT_AST_VERSION,
    profile: 'document_ast',
    root,
    summary: {
      selected_pages: selectedPages,
      page_count: selectedPages.length,
      node_count: stats.nodeCount,
      section_count: stats.sectionCount,
      paragraph_count: stats.paragraphCount,
      list_item_count: stats.listItemCount,
      caption_count: stats.captionCount,
      header_count: stats.headerCount,
      footer_count: stats.footerCount,
      section_context_node_count: stats.sectionContextNodeCount,
      cross_page_section_context_count: stats.crossPageSectionContextCount,
      caption_link_count: stats.captionLinkCount,
      table_count: stats.tableCount,
      image_count: stats.imageCount,
      figure_count: stats.figureCount,
      chart_count: stats.chartCount,
      formula_count: stats.formulaCount,
      diagram_count: stats.diagramCount,
      visual_enrichment_count: stats.visualEnrichmentCount,
      visual_enrichment_kind_counts: stats.visualEnrichmentKindCounts,
      max_depth: stats.maxDepth,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
};
