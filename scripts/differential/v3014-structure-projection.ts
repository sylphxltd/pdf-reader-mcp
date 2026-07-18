type JsonRecord = Record<string, any>;

export const canonicalReadStructure = (data: JsonRecord) => ({
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
        pages: data.document_map.pages.map((page: JsonRecord) => ({
          page: page.page,
          accessibility_report_page_index: page.accessibility_report_page_index,
          accessibility_issue_indexes: page.accessibility_issue_indexes,
          accessibility_high_issue_indexes:
            page.accessibility_high_issue_indexes,
          accessibility_medium_issue_indexes:
            page.accessibility_medium_issue_indexes,
          accessibility_low_issue_indexes: page.accessibility_low_issue_indexes,
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
          ].map((key) => [key, data.document_map.summary[key]])
        ),
      }
    : null,
});

const normalizeSource = (source: JsonRecord) => ({
  ...(source.path ? { path: String(source.path).split(/[\\/]/).at(-1) } : {}),
  ...(source.url ? { url: source.url } : {}),
  ...(source.pages ? { pages: source.pages } : {}),
});

export const canonicalInspect = (data: JsonRecord) => ({
  profile: data.profile,
  num_pages: data.num_pages,
  sampled_pages: data.sampled_pages,
  page_signals: data.page_signals,
  document_signals: data.document_signals,
  recommendation: {
    workflow: data.recommendation.workflow,
    needs_ocr: data.recommendation.needs_ocr,
    reason: data.recommendation.reason,
    read_pdf_arguments: {
      ...data.recommendation.read_pdf_arguments,
      sources: (data.recommendation.read_pdf_arguments.sources ?? []).map(
        normalizeSource
      ),
    },
  },
});

const sort = (value: any): any =>
  Array.isArray(value)
    ? value.map(sort)
    : value && typeof value === "object"
    ? Object.fromEntries(
        Object.entries(value)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, sort(entry)])
      )
    : value;

export const canonicalEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(sort(left)) === JSON.stringify(sort(right));

export const assertStructureMutationSensitivity = (
  expected: JsonRecord
): void => {
  const mutations: Array<[string, (copy: JsonRecord) => void]> = [
    [
      "role",
      (copy) =>
        (copy["manual-tagged-all"].structure_trees[0].tree.children[0].role =
          "P"),
    ],
    [
      "order",
      (copy) =>
        copy["manual-tagged-all"].structure_trees[0].tree.children.reverse(),
    ],
    [
      "id",
      (copy) =>
        (copy[
          "manual-tagged-all"
        ].structure_trees[0].tree.children[0].children[0].id = "mutated"),
    ],
    [
      "tagged",
      (copy) =>
        (copy["accessibility-private"].accessibility_report.tagged = false),
    ],
    [
      "inspect-signal",
      (copy) => (copy["inspect-tagged"].document_signals.has_mark_info = false),
    ],
  ];
  for (const [name, mutate] of mutations) {
    const copy = structuredClone(expected);
    mutate(copy);
    if (canonicalEqual(copy, expected)) {
      throw new Error(`canonical projection ignored ${name} mutation`);
    }
  }
};
