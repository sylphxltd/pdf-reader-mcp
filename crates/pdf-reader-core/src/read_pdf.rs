//! Pure-Rust read_pdf for pdf-reader-mcp (local path + SSRF-safe URL).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::text_index::{
    extract_pdf_text_from_document, PdfInfo, TextIndexError, TextIndexErrorCode,
};
use crate::url_fetch::{cleanup_temp_file, fetch_url_to_temp_file};
use crate::{HashError, ENGINE_NAME, ENGINE_VERSION};

pub const READ_PDF_ROUTE: &str = "rust-read-pdf-v1";

#[derive(Debug, Clone, Deserialize)]
pub struct ReadPdfSource {
    pub path: Option<String>,
    pub url: Option<String>,
    #[serde(default)]
    pub pages: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct ReadPdfInput {
    pub sources: Vec<ReadPdfSource>,
    pub include_metadata: bool,
    pub include_page_count: bool,
    pub include_full_text: bool,
    pub include_markdown: bool,
    pub include_chunks: bool,
    pub include_elements: bool,
    pub include_text_layer: bool,
    pub include_document_map: bool,
    pub auto: Option<bool>,
    pub auto_detail: Option<String>,
    pub sample_pages: Option<u32>,
    pub include_images: bool,
    pub include_tables: bool,
    pub include_html: bool,
    pub include_semantic_hints: bool,
    pub include_outline: bool,
    pub include_annotations: bool,
    pub include_page_labels: bool,
    pub include_page_geometry: bool,
    pub include_permissions: bool,
    pub include_form_fields: bool,
    pub include_attachments: bool,
    pub include_structure_tree: bool,
    pub include_safety_findings: bool,
    pub include_layout_diagnostics: bool,
    pub include_document_ast: bool,
    pub include_ocr_text_layer: bool,
    pub include_visual_enrichments: bool,
    pub include_trust_report: bool,
    pub include_accessibility_report: bool,
    pub trust_report_redaction: Option<String>,
    pub max_visual_enrichments: Option<u32>,
    #[serde(skip)]
    auto_policy_resolved: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineInfo {
    pub name: &'static str,
    pub version: &'static str,
}

/// Non-serialized source material needed to deterministically rebuild
/// table-derived surfaces after an optional OCR provider returns.
#[derive(Debug, Clone)]
pub struct StructuredFusionContext {
    pub pages: Vec<crate::document_twin::PageText>,
    pub selectable_tables: Value,
    pub semantic_hints: bool,
    pub emit_markdown: bool,
    pub emit_html: bool,
    pub emit_chunks: bool,
    pub emit_elements: bool,
    pub emit_tables: bool,
    pub emit_document_ast: bool,
    pub emit_document_map: bool,
    pub safety: Value,
    pub layout: Value,
    pub trust: Option<Value>,
    pub accessibility: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ReadPdfData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_pages: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_texts: Option<Vec<crate::document_twin::PageText>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub markdown: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunks: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elements: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_layer: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tables: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safety_findings: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout_diagnostics: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_map: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_ast: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trust_report: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accessibility_report: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outline: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotations: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub form_fields: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structure_trees: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_labels: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_geometry: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permissions: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mark_info: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ocr_text_layer: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_enrichments: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_enrichment_candidates: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
    pub route: String,
    pub engine: EngineInfo,
    /// Selected OCR candidates used by the server-side provider boundary.
    #[serde(skip)]
    pub ocr_candidate_pages: Vec<u32>,
    /// Provider-neutral inputs for the post-OCR structured reconstruction pass.
    #[serde(skip)]
    pub structured_fusion_context: Option<StructuredFusionContext>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReadPdfSourceResult {
    pub source: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<ReadPdfData>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReadPdfResponse {
    pub profile: &'static str,
    pub results: Vec<ReadPdfSourceResult>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReadPdfErrorCode {
    InvalidParams,
    InvalidRequest,
    ExtractionFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadPdfError {
    pub code: ReadPdfErrorCode,
    pub message: String,
}

impl ReadPdfError {
    fn invalid_params(message: impl Into<String>) -> Self {
        Self {
            code: ReadPdfErrorCode::InvalidParams,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: ReadPdfErrorCode::InvalidRequest,
            message: message.into(),
        }
    }
}

impl From<HashError> for ReadPdfError {
    fn from(error: HashError) -> Self {
        match error.code {
            crate::HashErrorCode::InvalidParams => Self::invalid_params(error.message),
            crate::HashErrorCode::InvalidRequest => Self::invalid_request(error.message),
        }
    }
}

impl From<TextIndexError> for ReadPdfError {
    fn from(error: TextIndexError) -> Self {
        match error.code {
            TextIndexErrorCode::InvalidParams => Self::invalid_params(error.message),
            TextIndexErrorCode::InvalidRequest => Self::invalid_request(error.message),
            TextIndexErrorCode::ExtractionFailed => Self {
                code: ReadPdfErrorCode::ExtractionFailed,
                message: error.message,
            },
        }
    }
}

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const MAX_SELECTED_PAGES: usize = 10_001;

fn validate_source(source: &ReadPdfSource) -> Result<(), ReadPdfError> {
    let has_path = source.path.as_ref().is_some_and(|value| !value.is_empty());
    let has_url = source.url.as_ref().is_some_and(|value| !value.is_empty());
    match (has_path, has_url) {
        (true, false) | (false, true) => Ok(()),
        (false, false) => Err(ReadPdfError::invalid_params(
            "Provide exactly one of path or url for each PDF source.",
        )),
        (true, true) => Err(ReadPdfError::invalid_params(
            "Provide exactly one of path or url for each PDF source.",
        )),
    }
}

fn join_page_text(pages: &[crate::document_twin::PageText]) -> String {
    pages
        .iter()
        .map(|page| page.text.as_str())
        .filter(|page| !page.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn parse_page_spec(pages_spec: &Option<Value>) -> Result<Option<Vec<u32>>, ReadPdfError> {
    let Some(spec) = pages_spec else {
        return Ok(None);
    };
    let mut wanted = Vec::new();
    if let Some(arr) = spec.as_array() {
        if arr.is_empty() {
            return Err(ReadPdfError::invalid_params(
                "Page specification resulted in an empty set of pages.",
            ));
        }
        for value in arr {
            let page = value
                .as_u64()
                .filter(|page| *page > 0 && *page <= u64::from(u32::MAX));
            let Some(page) = page else {
                return Err(ReadPdfError::invalid_params(
                    "Page numbers in array must be positive integers.",
                ));
            };
            wanted.push(page as u32);
            if wanted.len() > MAX_SELECTED_PAGES {
                return Err(ReadPdfError::invalid_params(
                    "Page specification exceeds the maximum of 10001 selected pages.",
                ));
            }
        }
    } else if let Some(ranges) = spec.as_str() {
        if ranges.is_empty() {
            return Err(ReadPdfError::invalid_params("Invalid page number: "));
        }
        for raw_part in ranges.split(',') {
            let part = raw_part.trim();
            if let Some((start_text, end_text)) = part.split_once('-') {
                let start = parse_ts_positive_page(start_text);
                let end = if end_text.trim().is_empty() {
                    start.map(|page| page.saturating_add(10_000))
                } else {
                    parse_ts_positive_page(end_text)
                };
                let (Some(start), Some(end)) = (start, end) else {
                    return Err(ReadPdfError::invalid_params(format!(
                        "Invalid page range values: {part}"
                    )));
                };
                if start > end {
                    return Err(ReadPdfError::invalid_params(format!(
                        "Invalid page range values: {part}"
                    )));
                }
                wanted.extend(start..=end.min(start.saturating_add(10_000)));
            } else {
                let Some(page) = parse_ts_positive_page(part) else {
                    return Err(ReadPdfError::invalid_params(format!(
                        "Invalid page number: {part}"
                    )));
                };
                wanted.push(page);
            }
            if wanted.len() > MAX_SELECTED_PAGES {
                return Err(ReadPdfError::invalid_params(
                    "Page specification exceeds the maximum of 10001 selected pages.",
                ));
            }
        }
    } else {
        return Err(ReadPdfError::invalid_params(
            "Page specification must be a non-empty range string or array of positive integers.",
        ));
    }
    wanted.sort_unstable();
    wanted.dedup();
    if wanted.is_empty() {
        return Err(ReadPdfError::invalid_params(
            "Page specification resulted in an empty set of pages.",
        ));
    }
    Ok(Some(wanted))
}

fn parse_ts_positive_page(value: &str) -> Option<u32> {
    let value = value.trim_start();
    let value = value.strip_prefix('+').unwrap_or(value);
    let digits: String = value.chars().take_while(char::is_ascii_digit).collect();
    (!digits.is_empty())
        .then(|| digits.parse::<u32>().ok())
        .flatten()
        .filter(|page| *page > 0)
}

fn evenly_sample_pages(total_pages: u32, max_samples: u32) -> Vec<u32> {
    let max_samples = max_samples.clamp(1, 20).min(total_pages.max(1));
    if total_pages <= max_samples {
        return (1..=total_pages).collect();
    }
    if max_samples == 1 {
        return vec![1];
    }
    let mut selected = Vec::with_capacity(max_samples as usize);
    for index in 0..max_samples {
        let numerator = u64::from(index) * u64::from(total_pages - 1);
        let denominator = u64::from(max_samples - 1);
        // Math.round for non-negative values.
        let offset = (numerator + denominator / 2) / denominator;
        selected.push(1 + offset as u32);
    }
    selected.sort_unstable();
    selected.dedup();
    selected
}

fn select_pages(
    pages: &[String],
    requested_pages: Option<&[u32]>,
) -> (Vec<crate::document_twin::PageText>, Vec<u32>) {
    let all: Vec<crate::document_twin::PageText> = pages
        .iter()
        .enumerate()
        .map(|(i, text)| crate::document_twin::PageText {
            page: (i + 1) as u32,
            text: text.clone(),
        })
        .collect();
    let Some(wanted) = requested_pages else {
        return (all, Vec::new());
    };
    let total_pages = pages.len() as u32;
    let invalid = wanted
        .iter()
        .copied()
        .filter(|page| *page > total_pages)
        .collect();
    let selected = all
        .into_iter()
        .filter(|page| wanted.binary_search(&page.page).is_ok())
        .collect();
    (selected, invalid)
}

fn build_structured_chunks(pages: &[crate::document_twin::PageText], elements: &Value) -> Value {
    let mut chunks = pages
        .iter()
        .filter(|page| !page.text.trim().is_empty())
        .map(|page| {
            json!({
                "id": format!("chunk-p{}", page.page),
                "page": page.page,
                "text": page.text,
                "element_ids": elements.as_array().into_iter().flatten()
                    .filter(|element| element.get("page").and_then(Value::as_u64) == Some(u64::from(page.page)))
                    .filter(|element| element.get("type").and_then(Value::as_str) != Some("table"))
                    .filter_map(|element| element.get("id").cloned())
                    .collect::<Vec<_>>(),
            })
        })
        .collect::<Vec<_>>();
    for element in elements
        .as_array()
        .into_iter()
        .flatten()
        .filter(|element| element.get("type").and_then(Value::as_str) == Some("table"))
    {
        let id = element.get("id").and_then(Value::as_str).unwrap_or("table");
        let text = element
            .pointer("/table/rows")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .map(|row| {
                row.as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>()
                    .join(" | ")
            })
            .collect::<Vec<_>>()
            .join("\n");
        let mut chunk = json!({
            "id": format!("chunk-{id}"),
            "page": element.get("page"),
            "text": text,
            "element_ids": [id],
            "strategy": "table",
        });
        if let Some(box_) = element.get("bounding_box").cloned() {
            chunk["bounding_box"] = box_;
        }
        chunks.push(chunk);
    }
    json!(chunks)
}

fn render_structured_markdown(pages: &[crate::document_twin::PageText], tables: &Value) -> String {
    let mut parts = pages
        .iter()
        .filter(|page| !page.text.trim().is_empty())
        .map(|page| format!("## Page {}\n\n{}", page.page, page.text.trim()))
        .collect::<Vec<_>>();
    for table in tables.as_array().into_iter().flatten() {
        let mut lines = Vec::new();
        for (row_index, row) in table
            .get("rows")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .enumerate()
        {
            let cells = row
                .as_array()
                .into_iter()
                .flatten()
                .map(|cell| cell.as_str().unwrap_or("").to_string())
                .collect::<Vec<_>>();
            lines.push(format!("| {} |", cells.join(" | ")));
            if row_index == 0 {
                lines.push(format!(
                    "| {} |",
                    cells.iter().map(|_| "---").collect::<Vec<_>>().join(" | ")
                ));
            }
        }
        if !lines.is_empty() {
            parts.push(format!(
                "### Table (page {})\n\n{}",
                table.get("page").and_then(Value::as_u64).unwrap_or(0),
                lines.join("\n")
            ));
        }
    }
    parts.join("\n\n")
}

fn render_structured_html(pages: &[crate::document_twin::PageText], tables: &Value) -> String {
    let mut parts = pages
        .iter()
        .map(|page| {
            format!(
                "<section data-page=\"{}\"><pre>{}</pre></section>",
                page.page,
                html_escape(&page.text)
            )
        })
        .collect::<Vec<_>>();
    for table in tables.as_array().into_iter().flatten() {
        let rows = table
            .get("rows")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .map(|row| {
                let cells = row
                    .as_array()
                    .into_iter()
                    .flatten()
                    .map(|cell| format!("<td>{}</td>", html_escape(cell.as_str().unwrap_or(""))))
                    .collect::<String>();
                format!("<tr>{cells}</tr>")
            })
            .collect::<String>();
        parts.push(format!(
            "<table data-page=\"{}\">{rows}</table>",
            table.get("page").and_then(Value::as_u64).unwrap_or(0)
        ));
    }
    parts.join("\n")
}

pub(crate) fn rebuild_structured_outputs(
    data: &mut ReadPdfData,
    context: &StructuredFusionContext,
    tables: &Value,
) {
    use crate::document_twin::{
        build_document_ast, build_document_map, build_elements_with_tables,
    };

    let elements = build_elements_with_tables(&context.pages, tables, context.semantic_hints);
    let chunks = build_structured_chunks(&context.pages, &elements);
    if context.emit_markdown {
        data.markdown = Some(render_structured_markdown(&context.pages, tables));
    }
    if context.emit_html {
        data.html = Some(render_structured_html(&context.pages, tables));
    }
    if context.emit_chunks {
        data.chunks = Some(chunks.clone());
    }
    if context.emit_elements {
        data.elements = Some(elements.clone());
    }
    if context.emit_tables {
        data.tables = Some(tables.clone());
    }
    if context.emit_document_ast {
        data.document_ast = Some(build_document_ast(&context.pages, &elements, tables));
    }
    if context.emit_document_map {
        data.document_map = Some(build_document_map(
            &context.pages,
            &elements,
            &chunks,
            tables,
            &context.safety,
            &context.layout,
            context.trust.as_ref(),
            context.accessibility.as_ref(),
        ));
    }
}

#[derive(Default)]
struct BuildSignals {
    page_geometry: Option<Value>,
    annotations: Option<Value>,
    page_labels: Option<Value>,
    permissions: Option<Value>,
    mark_info: Option<Value>,
    outline: Option<Value>,
    form_fields: Option<Value>,
    attachments: Option<Value>,
    warnings: Vec<String>,
}

fn has_any_include(input: &ReadPdfInput) -> bool {
    input.include_metadata
        || input.include_page_count
        || input.include_full_text
        || input.include_markdown
        || input.include_chunks
        || input.include_elements
        || input.include_text_layer
        || input.include_document_map
        || input.include_images
        || input.include_tables
        || input.include_html
        || input.include_semantic_hints
        || input.include_outline
        || input.include_annotations
        || input.include_page_labels
        || input.include_page_geometry
        || input.include_permissions
        || input.include_form_fields
        || input.include_attachments
        || input.include_structure_tree
        || input.include_safety_findings
        || input.include_layout_diagnostics
        || input.include_document_ast
        || input.include_ocr_text_layer
        || input.include_visual_enrichments
        || input.include_trust_report
        || input.include_accessibility_report
}

fn auto_enabled(input: &ReadPdfInput) -> bool {
    if input.auto_policy_resolved {
        false
    } else {
        input.auto.unwrap_or_else(|| !has_any_include(input))
    }
}

fn requires_text_extraction(input: &ReadPdfInput) -> bool {
    auto_enabled(input)
        || input.include_full_text
        || input.include_markdown
        || input.include_chunks
        || input.include_elements
        || input.include_text_layer
        || input.include_document_map
        || input.include_images
        || input.include_tables
        || input.include_html
        || input.include_semantic_hints
        || input.include_safety_findings
        || input.include_layout_diagnostics
        || input.include_document_ast
        || input.include_ocr_text_layer
        || input.include_visual_enrichments
        || input.include_trust_report
        || input.include_accessibility_report
}

fn build_data(
    pages: &[crate::document_twin::PageText],
    total_pages: u32,
    input: &ReadPdfInput,
    pdf_info: Option<&PdfInfo>,
    explicit_page_selection: bool,
    signals: BuildSignals,
) -> ReadPdfData {
    use crate::document_twin::{
        build_accessibility_report, build_document_ast, build_document_map, build_elements,
        build_layout_diagnostics, build_safety_findings, build_tables, build_trust_report,
        empty_structure_arrays,
    };

    let BuildSignals {
        page_geometry,
        annotations,
        page_labels,
        permissions,
        mark_info,
        outline,
        form_fields,
        attachments,
        mut warnings,
    } = signals;
    let full_text = join_page_text(pages);
    let text_chars = full_text.chars().count();

    // auto is resolved in read_pdf_from_value for JSON callers; programmatic callers
    // should set auto explicitly. Default remains true only when auto is None and no
    // include flags are set (bool defaults are false, so all-false means sources-only).
    // Presence of true include flags implies manual mode when auto is omitted.
    // (JSON path resolves preset flags before reaching this function.)
    let auto = auto_enabled(input);
    let detail = input.auto_detail.as_deref().unwrap_or("balanced");
    let auto_full = auto && detail == "full";
    let auto_balanced = auto && matches!(detail, "balanced" | "full");
    let auto_fast = auto;

    let want_meta = input.include_metadata || auto_fast;
    let want_page_count = input.include_page_count || auto_fast;
    let want_text = input.include_full_text || auto_full;
    let want_md = input.include_markdown || auto_fast;
    let want_chunks = input.include_chunks || auto_fast;
    let want_elements = input.include_elements || auto_full;
    let want_semantic = input.include_semantic_hints || auto_fast;
    let want_text_layer = input.include_text_layer || auto_full;
    let want_map = input.include_document_map || auto_fast;
    let want_tables = input.include_tables || auto_fast;
    let want_html = input.include_html || auto_full;
    let want_safety = input.include_safety_findings || auto_balanced || auto_full;
    let want_layout = input.include_layout_diagnostics || auto_fast;
    let want_ast = input.include_document_ast || auto_full;
    let want_trust = input.include_trust_report || auto_balanced || auto_full;
    let want_a11y = input.include_accessibility_report || auto_balanced || auto_full;
    let want_outline = input.include_outline || auto_full;
    let want_annotations = input.include_annotations || auto_full;
    let want_labels = input.include_page_labels || auto_full;
    let want_geometry = input.include_page_geometry || auto_fast;
    let want_permissions = input.include_permissions || auto_full;
    let want_forms = input.include_form_fields || auto_full;
    let want_attachments = input.include_attachments || auto_full;
    let want_structure = input.include_structure_tree || auto_full;
    let want_images = input.include_images;
    let want_ocr = input.include_ocr_text_layer;
    let want_visual = input.include_visual_enrichments;

    if want_images {
        warnings.push(
            "include_images: pure-Rust engine returns image_info empty without a visual decoder; use pdf_evidence render when a render backend is configured."
                .into(),
        );
    }
    if want_ocr {
        warnings.push(crate::ocr_fusion::OCR_STUB_WARNING.into());
    }
    if want_visual {
        warnings.push(
            "include_visual_enrichments: no visual-region provider configured; visual_enrichments is empty."
                .into(),
        );
    }

    let elements = if want_elements || want_semantic || want_ast || want_map || want_trust {
        Some(build_elements(pages, want_semantic || want_elements))
    } else {
        None
    };
    let tables = if want_tables || want_ast || want_map || want_visual || want_trust {
        Some(build_tables(pages))
    } else {
        None
    };
    let safety = if want_safety || want_trust || want_map {
        Some(build_safety_findings(pages))
    } else {
        None
    };
    let layout = if want_layout || want_trust || want_map {
        Some(build_layout_diagnostics(pages))
    } else {
        None
    };
    let redaction = input
        .trust_report_redaction
        .as_deref()
        .unwrap_or("standard");
    let trust = if want_trust {
        Some(build_trust_report(
            pages,
            safety.as_ref().unwrap_or(&json!([])),
            layout.as_ref().unwrap_or(&json!([])),
            redaction,
        ))
    } else {
        None
    };
    let a11y = if want_a11y {
        Some(build_accessibility_report(pages))
    } else {
        None
    };

    let chunks = if want_chunks || want_map {
        Some(json!(pages
            .iter()
            .filter(|page| !page.text.trim().is_empty())
            .map(|page| json!({
                "id": format!("chunk-p{}", page.page),
                "page": page.page,
                "text": page.text,
                "element_ids": elements
                    .as_ref()
                    .and_then(|e| e.as_array())
                    .into_iter()
                    .flatten()
                    .filter(|el| el.get("page").and_then(Value::as_u64) == Some(u64::from(page.page)))
                    .filter_map(|el| el.get("id").cloned())
                    .collect::<Vec<_>>(),
            }))
            .collect::<Vec<_>>()))
    } else {
        None
    };

    let document_ast = if want_ast {
        Some(build_document_ast(
            pages,
            elements.as_ref().unwrap_or(&json!([])),
            tables.as_ref().unwrap_or(&json!([])),
        ))
    } else {
        None
    };

    let document_map = if want_map {
        Some(build_document_map(
            pages,
            elements.as_ref().unwrap_or(&json!([])),
            chunks.as_ref().unwrap_or(&json!([])),
            tables.as_ref().unwrap_or(&json!([])),
            safety.as_ref().unwrap_or(&json!([])),
            layout.as_ref().unwrap_or(&json!([])),
            trust.as_ref(),
            a11y.as_ref(),
        ))
    } else {
        None
    };

    let (_, _, _, _, structure_trees) = empty_structure_arrays();

    let mut data = ReadPdfData {
        num_pages: want_page_count.then_some(total_pages),
        info: None,
        metadata: None,
        full_text: None,
        page_texts: None,
        markdown: None,
        html: None,
        chunks: None,
        elements: None,
        text_layer: None,
        tables: None,
        images: None,
        safety_findings: None,
        layout_diagnostics: None,
        document_map: None,
        document_ast: None,
        trust_report: None,
        accessibility_report: None,
        outline: None,
        annotations: None,
        form_fields: None,
        attachments: None,
        structure_trees: None,
        page_labels: None,
        page_geometry: None,
        permissions: None,
        mark_info: None,
        ocr_text_layer: None,
        visual_enrichments: None,
        visual_enrichment_candidates: None,
        warnings: None,
        route: READ_PDF_ROUTE.into(),
        engine: EngineInfo {
            name: ENGINE_NAME,
            version: ENGINE_VERSION,
        },
        ocr_candidate_pages: if want_ocr {
            let empty = pages
                .iter()
                .filter(|page| page.text.trim().is_empty())
                .map(|page| page.page)
                .collect::<Vec<_>>();
            if empty.is_empty() {
                pages.iter().map(|page| page.page).collect()
            } else {
                empty
            }
        } else {
            Vec::new()
        },
        structured_fusion_context: (want_ocr
            && (want_tables || want_ast || want_map || want_visual || want_trust))
            .then(|| StructuredFusionContext {
                pages: pages.to_vec(),
                selectable_tables: tables.clone().unwrap_or_else(|| json!([])),
                semantic_hints: want_semantic || want_elements,
                emit_markdown: want_md,
                emit_html: want_html,
                emit_chunks: want_chunks,
                emit_elements: want_elements || want_semantic,
                emit_tables: want_tables,
                emit_document_ast: want_ast,
                emit_document_map: want_map,
                safety: safety.clone().unwrap_or_else(|| json!([])),
                layout: layout.clone().unwrap_or_else(|| json!([])),
                trust: trust.clone(),
                accessibility: a11y.clone(),
            }),
    };

    if want_meta {
        let mut info = pdf_info
            .map(|pdf_info| {
                let mut values = serde_json::Map::new();
                values.insert("PDFFormatVersion".into(), json!(pdf_info.format_version));
                for (key, value) in &pdf_info.fields {
                    values.insert(key.clone(), json!(value));
                }
                Value::Object(values)
            })
            .unwrap_or_else(|| json!({}));
        info.as_object_mut()
            .expect("info object")
            .insert("text_chars".into(), json!(text_chars));
        info.as_object_mut()
            .expect("info object")
            .insert("route".into(), json!(READ_PDF_ROUTE));
        if want_page_count {
            info.as_object_mut()
                .expect("info object")
                .insert("num_pages".into(), json!(total_pages));
        }
        data.info = Some(info.clone());
        let mut metadata = json!({
            "info": info,
            "text_chars": text_chars,
        });
        if want_page_count {
            metadata
                .as_object_mut()
                .expect("metadata object")
                .insert("num_pages".into(), json!(total_pages));
        }
        data.metadata = Some(metadata);
    }
    if explicit_page_selection {
        data.page_texts = Some(pages.to_vec());
    } else if want_text {
        data.full_text = Some(full_text.clone());
    }
    if want_md {
        let mut md_parts = pages
            .iter()
            .filter(|page| !page.text.trim().is_empty())
            .map(|page| format!("## Page {}\n\n{}", page.page, page.text.trim()))
            .collect::<Vec<_>>();
        if let Some(tables_val) = tables.as_ref() {
            if let Some(arr) = tables_val.as_array() {
                for table in arr {
                    if let Some(rows) = table.get("rows").and_then(Value::as_array) {
                        let mut lines = Vec::new();
                        for (ri, row) in rows.iter().enumerate() {
                            if let Some(cells) = row.as_array() {
                                let cells_s: Vec<String> = cells
                                    .iter()
                                    .map(|c| c.as_str().unwrap_or("").to_string())
                                    .collect();
                                lines.push(format!("| {} |", cells_s.join(" | ")));
                                if ri == 0 {
                                    lines.push(format!(
                                        "| {} |",
                                        cells_s
                                            .iter()
                                            .map(|_| "---")
                                            .collect::<Vec<_>>()
                                            .join(" | ")
                                    ));
                                }
                            }
                        }
                        if !lines.is_empty() {
                            md_parts.push(format!(
                                "### Table (page {})\n\n{}",
                                table.get("page").and_then(Value::as_u64).unwrap_or(0),
                                lines.join("\n")
                            ));
                        }
                    }
                }
            }
        }
        data.markdown = Some(md_parts.join("\n\n"));
    }
    if want_html {
        data.html = Some(
            pages
                .iter()
                .map(|page| {
                    format!(
                        "<section data-page=\"{}\"><pre>{}</pre></section>",
                        page.page,
                        html_escape(&page.text)
                    )
                })
                .collect::<Vec<_>>()
                .join("\n"),
        );
    }
    if want_chunks {
        data.chunks = chunks.clone();
    }
    if want_elements || want_semantic {
        data.elements = elements.clone();
    }
    if want_text_layer {
        data.text_layer = Some(json!({
            "profile": "pdf_text_layer",
            "pages": pages.iter().map(|page| json!({
                "page": page.page,
                "text": page.text,
                "char_count": page.text.chars().count(),
                "runs": page.text.lines().filter(|l| !l.trim().is_empty()).enumerate().map(|(j, line)| json!({
                    "id": format!("run-{}-{}", page.page, j + 1),
                    "text": line,
                })).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        }));
    }
    if want_tables {
        data.tables = tables.clone();
    }
    if want_images {
        data.images = Some(json!([]));
    }
    if want_safety {
        data.safety_findings = safety.clone();
    }
    if want_layout {
        data.layout_diagnostics = layout.clone();
    }
    if want_map {
        data.document_map = document_map;
    }
    if want_ast {
        data.document_ast = document_ast;
    }
    if want_trust {
        data.trust_report = trust;
    }
    if want_a11y {
        data.accessibility_report = a11y;
    }
    if want_outline {
        data.outline = outline;
    }
    if want_annotations {
        data.annotations = annotations;
    }
    if want_forms {
        data.form_fields = form_fields;
    }
    if want_attachments {
        data.attachments = attachments;
    }
    if want_structure {
        data.structure_trees = Some(structure_trees);
        warnings.push(
            "include_structure_tree: structure trees are empty without tagged-PDF COS parsing."
                .into(),
        );
    }
    if want_labels {
        data.page_labels = page_labels;
    }
    if want_geometry {
        data.page_geometry = page_geometry;
    }
    if want_permissions {
        data.permissions = permissions;
        data.mark_info = mark_info;
    }
    if want_visual {
        data.visual_enrichments = Some(json!([]));
        data.visual_enrichment_candidates = Some(json!([]));
    }

    if let Some(context) = data.structured_fusion_context.clone() {
        rebuild_structured_outputs(&mut data, &context, &context.selectable_tables);
    }

    if !warnings.is_empty() {
        data.warnings = Some(warnings);
    }
    data
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn read_source(source: &ReadPdfSource, input: &ReadPdfInput) -> ReadPdfSourceResult {
    if let Err(error) = validate_source(source) {
        return ReadPdfSourceResult {
            source: source
                .path
                .clone()
                .or_else(|| source.url.clone())
                .unwrap_or_else(|| "unknown".into()),
            success: false,
            error: Some(error.message),
            data: None,
        };
    }

    if let Some(path) = source.path.as_ref().filter(|p| !p.is_empty()) {
        let path_buf = PathBuf::from(path);
        return match read_local_pdf_filtered(path_buf.as_path(), input, &source.pages, path) {
            Ok(result) => result,
            Err(error) => ReadPdfSourceResult {
                source: path.clone(),
                success: false,
                error: Some(error.message),
                data: None,
            },
        };
    }

    if let Some(url) = source.url.as_ref().filter(|u| !u.is_empty()) {
        match fetch_url_to_temp_file(url) {
            Ok(temp) => {
                let result = read_local_pdf_filtered(temp.as_path(), input, &source.pages, url);
                cleanup_temp_file(temp.as_path());
                match result {
                    Ok(mut ok) => {
                        ok.source = url.clone();
                        ok
                    }
                    Err(error) => ReadPdfSourceResult {
                        source: url.clone(),
                        success: false,
                        error: Some(error.message),
                        data: None,
                    },
                }
            }
            Err(message) => ReadPdfSourceResult {
                source: url.clone(),
                success: false,
                error: Some(message),
                data: None,
            },
        }
    } else {
        ReadPdfSourceResult {
            source: "unknown".into(),
            success: false,
            error: Some("Provide exactly one of path or url for each PDF source.".into()),
            data: None,
        }
    }
}

fn read_local_pdf_filtered(
    path: &Path,
    input: &ReadPdfInput,
    pages_spec: &Option<Value>,
    source_label: &str,
) -> Result<ReadPdfSourceResult, ReadPdfError> {
    let parsed = crate::cos_document::ParsedPdf::load(path, DEFAULT_MAX_FILE_BYTES)?;
    let requires_text = requires_text_extraction(input);
    let (pages, pdf_info) = if requires_text {
        let extracted = extract_pdf_text_from_document(&parsed.document)?;
        (
            extracted
                .pages
                .into_iter()
                .map(|page| page.text)
                .collect::<Vec<_>>(),
            extracted.info,
        )
    } else {
        (
            vec![String::new(); parsed.pages.len().max(1)],
            crate::text_index::read_pdf_info(&parsed.document),
        )
    };
    let total_pages = parsed.pages.len().max(1) as u32;
    let explicit_pages = parse_page_spec(pages_spec)?;
    let auto_pages = if explicit_pages.is_none()
        && auto_enabled(input)
        && input.auto_detail.as_deref().unwrap_or("balanced") != "full"
    {
        Some(evenly_sample_pages(
            total_pages,
            input.sample_pages.unwrap_or(5),
        ))
    } else {
        None
    };
    let requested_pages = explicit_pages.as_deref().or(auto_pages.as_deref());
    let (selected, invalid_pages) = select_pages(&pages, requested_pages);
    let selected_page_numbers = selected.iter().map(|page| page.page).collect::<Vec<_>>();
    let auto = auto_enabled(input);
    let want_geometry = input.include_page_geometry || auto;
    let want_annotations =
        input.include_annotations || (auto && input.auto_detail.as_deref() == Some("full"));
    let signals = crate::page_signals::extract_page_signals(
        &parsed.document,
        &parsed.pages,
        &selected_page_numbers,
        want_geometry,
        want_annotations,
    );
    let geometry = (!signals.geometry.is_empty()).then(|| json!(signals.geometry));
    let annotations = (!signals.annotations.is_empty()).then(|| json!(signals.annotations));
    let auto_full = auto && input.auto_detail.as_deref() == Some("full");
    let catalog_signals = crate::catalog_signals::extract_catalog_signals(
        &parsed.document,
        parsed.encryption_facts,
        total_pages,
        crate::catalog_signals::CatalogSignalRequest {
            page_labels: input.include_page_labels || auto_full,
            permissions: input.include_permissions || auto_full,
            outline: input.include_outline || auto_full,
        },
    );
    let form_attachment_signals = crate::form_attachment_signals::extract_form_attachment_signals(
        &parsed.document,
        &parsed.pages,
        input.include_form_fields || auto_full,
        input.include_attachments || auto_full,
    );
    let mut signal_warnings = signals.warnings;
    signal_warnings.extend(form_attachment_signals.warnings);
    let mut data = build_data(
        &selected,
        total_pages,
        input,
        Some(&pdf_info),
        explicit_pages.is_some(),
        BuildSignals {
            page_geometry: geometry,
            annotations,
            page_labels: catalog_signals.page_labels.map(|value| json!(value)),
            permissions: catalog_signals.permissions.map(|value| json!(value)),
            mark_info: catalog_signals.mark_info.map(|value| json!(value)),
            outline: catalog_signals.outline.map(|value| json!(value)),
            form_fields: form_attachment_signals
                .form_fields
                .map(|value| json!(value)),
            attachments: form_attachment_signals
                .attachments
                .map(|value| json!(value)),
            warnings: signal_warnings,
        },
    );
    if !invalid_pages.is_empty() {
        data.warnings.get_or_insert_with(Vec::new).push(format!(
            "Requested pages {} exceed document page count {total_pages} and were skipped.",
            invalid_pages
                .iter()
                .map(u32::to_string)
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    Ok(ReadPdfSourceResult {
        source: source_label.to_string(),
        success: true,
        error: None,
        data: Some(data),
    })
}

pub fn read_pdf(input: &ReadPdfInput) -> Result<ReadPdfResponse, ReadPdfError> {
    if input.sources.is_empty() {
        return Err(ReadPdfError::invalid_params(
            "sources must include at least one PDF source.",
        ));
    }

    if let Some(detail) = input.auto_detail.as_deref() {
        if !matches!(detail, "fast" | "balanced" | "full") {
            return Err(ReadPdfError::invalid_params(
                "auto_detail must be one of: fast, balanced, full",
            ));
        }
    }
    if let Some(sample) = input.sample_pages {
        if !(1..=20).contains(&sample) {
            return Err(ReadPdfError::invalid_params(
                "sample_pages must be an integer between 1 and 20",
            ));
        }
    }
    if let Some(max_vis) = input.max_visual_enrichments {
        if max_vis < 1 {
            return Err(ReadPdfError::invalid_params(
                "max_visual_enrichments must be >= 1 when provided",
            ));
        }
    }
    for source in &input.sources {
        parse_page_spec(&source.pages)?;
    }

    let mut results = Vec::new();
    for source in &input.sources {
        results.push(read_source(source, input));
    }

    if results.iter().all(|result| !result.success) {
        let errors = results
            .iter()
            .filter_map(|result| result.error.as_deref())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(ReadPdfError::invalid_request(format!(
            "All PDF sources failed to process: {errors}"
        )));
    }

    Ok(ReadPdfResponse {
        profile: "pdf_read_results",
        results,
    })
}

fn json_has_explicit_read_options(input: &Value) -> bool {
    const KEYS: &[&str] = &[
        "include_full_text",
        "include_metadata",
        "include_page_count",
        "include_images",
        "include_tables",
        "include_elements",
        "include_semantic_hints",
        "include_markdown",
        "include_html",
        "include_chunks",
        "include_text_layer",
        "include_ocr_text_layer",
        "include_outline",
        "include_annotations",
        "include_page_labels",
        "include_page_geometry",
        "include_permissions",
        "include_form_fields",
        "include_attachments",
        "include_structure_tree",
        "include_safety_findings",
        "include_layout_diagnostics",
        "include_document_map",
        "include_document_ast",
        "include_visual_enrichments",
        "max_visual_enrichments",
        "include_trust_report",
        "trust_report_redaction",
        "include_accessibility_report",
    ];
    if KEYS.iter().any(|key| input.get(*key).is_some()) {
        return true;
    }
    input
        .get("sources")
        .and_then(Value::as_array)
        .map(|sources| sources.iter().any(|source| source.get("pages").is_some()))
        .unwrap_or(false)
}

pub fn read_pdf_from_value(input: &Value) -> Result<ReadPdfResponse, ReadPdfError> {
    let mut parsed: ReadPdfInput = serde_json::from_value(input.clone()).map_err(|error| {
        ReadPdfError::invalid_params(format!("Invalid read_pdf input: {error}"))
    })?;

    // TypeScript-compatible auto default: omit auto => true only without explicit options.
    if input.get("auto").is_none() {
        parsed.auto = Some(!json_has_explicit_read_options(input));
    }

    // TS v3.0.14 defaults these two independent metadata surfaces to true.
    if input.get("include_metadata").is_none() {
        parsed.include_metadata = true;
    }
    if input.get("include_page_count").is_none() {
        parsed.include_page_count = true;
    }

    if parsed.auto.unwrap_or(false) {
        let detail = parsed.auto_detail.as_deref().unwrap_or("balanced");
        let enable = |key: &str, field: &mut bool| {
            if input.get(key).is_none() {
                *field = true;
            }
        };
        enable("include_metadata", &mut parsed.include_metadata);
        enable("include_page_count", &mut parsed.include_page_count);
        enable("include_page_geometry", &mut parsed.include_page_geometry);
        enable("include_document_map", &mut parsed.include_document_map);
        enable("include_chunks", &mut parsed.include_chunks);
        enable("include_markdown", &mut parsed.include_markdown);
        enable("include_tables", &mut parsed.include_tables);
        enable("include_semantic_hints", &mut parsed.include_semantic_hints);
        enable(
            "include_layout_diagnostics",
            &mut parsed.include_layout_diagnostics,
        );
        if matches!(detail, "balanced" | "full") {
            enable(
                "include_safety_findings",
                &mut parsed.include_safety_findings,
            );
            enable("include_trust_report", &mut parsed.include_trust_report);
            enable(
                "include_accessibility_report",
                &mut parsed.include_accessibility_report,
            );
        }
        if detail == "full" {
            enable("include_full_text", &mut parsed.include_full_text);
            enable("include_html", &mut parsed.include_html);
            enable("include_elements", &mut parsed.include_elements);
            enable("include_text_layer", &mut parsed.include_text_layer);
            enable("include_document_ast", &mut parsed.include_document_ast);
            enable("include_outline", &mut parsed.include_outline);
            enable("include_annotations", &mut parsed.include_annotations);
            enable("include_page_labels", &mut parsed.include_page_labels);
            enable("include_permissions", &mut parsed.include_permissions);
            enable("include_form_fields", &mut parsed.include_form_fields);
            enable("include_attachments", &mut parsed.include_attachments);
            enable("include_structure_tree", &mut parsed.include_structure_tree);
        }
        parsed.auto_policy_resolved = true;
    }

    read_pdf(&parsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{EncryptionState, EncryptionVersion, Permissions};

    #[test]
    fn reads_fixture() {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }
        let response = read_pdf(&ReadPdfInput {
            sources: vec![ReadPdfSource {
                path: Some(fixture.to_string_lossy().to_string()),
                url: None,
                pages: None,
            }],
            include_metadata: true,
            include_page_count: true,
            include_full_text: true,
            include_markdown: true,
            ..Default::default()
        })
        .expect("read");
        assert!(response.results[0].success);
        assert!(response.results[0]
            .data
            .as_ref()
            .unwrap()
            .full_text
            .is_some());
    }

    #[test]
    fn encrypted_pdf_permissions_are_captured_before_blank_password_decrypt() {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }
        let mut document = lopdf::Document::load(&fixture).expect("load source fixture");
        let permissions = Permissions::PRINTABLE
            | Permissions::COPYABLE
            | Permissions::FILLABLE
            | Permissions::COPYABLE_FOR_ACCESSIBILITY;
        let state = EncryptionState::try_from(EncryptionVersion::V2 {
            document: &document,
            owner_password: "catalog-test-owner",
            user_password: "",
            key_length: 128,
            permissions,
        })
        .expect("build deterministic standard-security state");
        document.encrypt(&state).expect("encrypt fixture");
        let temp = tempfile::tempdir().expect("tempdir");
        let encrypted = temp.path().join("catalog-permissions.pdf");
        document.save(&encrypted).expect("save encrypted fixture");
        let parsed = crate::cos_document::ParsedPdf::load(&encrypted, DEFAULT_MAX_FILE_BYTES)
            .expect("parse encrypted fixture");
        assert_eq!(
            parsed.encryption_facts.and_then(|facts| facts.permissions),
            Some(permissions.p_value() as i64)
        );

        let response = read_pdf(&ReadPdfInput {
            sources: vec![ReadPdfSource {
                path: Some(encrypted.to_string_lossy().to_string()),
                url: None,
                pages: None,
            }],
            auto: Some(false),
            include_permissions: true,
            ..Default::default()
        })
        .expect("read encrypted fixture");
        let data = response.results[0].data.as_ref().expect("data");
        assert_eq!(
            data.permissions,
            Some(json!([
                "print",
                "copy",
                "fill_forms",
                "copy_for_accessibility"
            ]))
        );
    }

    #[test]
    fn rejects_dual_locator() {
        let err = validate_source(&ReadPdfSource {
            path: Some("/tmp/a.pdf".into()),
            url: Some("https://x".into()),
            pages: None,
        })
        .unwrap_err();
        assert!(err.message.contains("exactly one"));
    }

    #[test]
    fn blocks_private_url() {
        let response = read_pdf(&ReadPdfInput {
            sources: vec![ReadPdfSource {
                path: None,
                url: Some("http://127.0.0.1/secret.pdf".into()),
                pages: None,
            }],
            ..Default::default()
        });
        // either all-fail error or per-source error
        match response {
            Err(e) => assert!(
                e.message.to_lowercase().contains("non-public")
                    || e.message.to_lowercase().contains("failed")
            ),
            Ok(ok) => assert!(!ok.results[0].success),
        }
    }

    #[test]
    fn capability_matrix_populates_document_twin_fields() {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }
        let response = read_pdf(&ReadPdfInput {
            sources: vec![ReadPdfSource {
                path: Some(fixture.to_string_lossy().to_string()),
                url: None,
                pages: None,
            }],
            auto: Some(false),
            include_metadata: true,
            include_page_count: true,
            include_full_text: true,
            include_markdown: true,
            include_html: true,
            include_chunks: true,
            include_elements: true,
            include_semantic_hints: true,
            include_text_layer: true,
            include_tables: true,
            include_document_map: true,
            include_document_ast: true,
            include_safety_findings: true,
            include_layout_diagnostics: true,
            include_trust_report: true,
            include_accessibility_report: true,
            include_outline: true,
            include_annotations: true,
            include_page_labels: true,
            include_page_geometry: true,
            include_permissions: true,
            include_form_fields: true,
            include_attachments: true,
            include_structure_tree: true,
            include_images: true,
            include_ocr_text_layer: true,
            include_visual_enrichments: true,
            ..Default::default()
        })
        .expect("read");
        let data = response.results[0].data.as_ref().expect("data");
        assert!(data.full_text.is_some());
        assert!(data.markdown.is_some());
        assert!(data.html.is_some());
        assert!(data.chunks.is_some());
        assert!(data.elements.is_some());
        assert!(data.text_layer.is_some());
        assert!(data.tables.is_some());
        assert!(data.images.is_some());
        assert!(data.safety_findings.is_some());
        assert!(data.layout_diagnostics.is_some());
        assert!(data.document_map.is_some());
        assert!(data.document_ast.is_some());
        assert!(data.trust_report.is_some());
        assert!(data.accessibility_report.is_some());
        assert!(data.outline.is_none());
        // TS 3.0.14 omits optional page-signal fields when the document has no
        // qualifying records; an empty placeholder is not capability parity.
        assert!(data.annotations.is_none());
        assert!(data.page_labels.is_none());
        assert!(data.page_geometry.is_some());
        assert!(data.permissions.is_none());
        assert!(data.mark_info.is_none());
        assert!(data.form_fields.is_none());
        assert!(data.attachments.is_none());
        assert!(data.structure_trees.is_some());
        // Provider-backed fields remain absent until the server fuses a
        // normalized outcome; returning an empty placeholder would diverge
        // from the TypeScript v3.0.14 failure semantics.
        assert!(data.ocr_text_layer.is_none());
        assert!(!data.ocr_candidate_pages.is_empty());
        assert!(data.visual_enrichments.is_some());
        assert_eq!(
            data.trust_report.as_ref().unwrap()["profile"],
            "pdf_trust_report"
        );
        assert_eq!(
            data.accessibility_report.as_ref().unwrap()["profile"],
            "pdf_accessibility_report"
        );
    }

    #[test]
    fn ocr_candidates_prefer_empty_selected_pages_then_fall_back_to_all() {
        let input = ReadPdfInput {
            include_ocr_text_layer: true,
            ..ReadPdfInput::default()
        };
        let mixed = build_data(
            &[
                crate::document_twin::PageText {
                    page: 2,
                    text: "selectable".into(),
                },
                crate::document_twin::PageText {
                    page: 4,
                    text: String::new(),
                },
                crate::document_twin::PageText {
                    page: 7,
                    text: "  \n".into(),
                },
            ],
            7,
            &input,
            None,
            true,
            BuildSignals::default(),
        );
        assert_eq!(mixed.ocr_candidate_pages, vec![4, 7]);

        let selectable = build_data(
            &[
                crate::document_twin::PageText {
                    page: 2,
                    text: "first".into(),
                },
                crate::document_twin::PageText {
                    page: 5,
                    text: "second".into(),
                },
            ],
            5,
            &input,
            None,
            true,
            BuildSignals::default(),
        );
        assert_eq!(selectable.ocr_candidate_pages, vec![2, 5]);
        assert!(serde_json::to_value(selectable)
            .expect("serialize")
            .get("ocr_candidate_pages")
            .is_none());
    }

    #[test]
    fn metadata_only_does_not_auto_enable_twin_layers() {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }
        let response = read_pdf_from_value(&json!({
            "sources": [{"path": fixture.to_string_lossy()}],
            "include_metadata": true,
            "include_page_count": true
        }))
        .expect("read");
        let data = response.results[0].data.as_ref().unwrap();
        assert!(data.info.is_some());
        assert!(
            data.full_text.is_none(),
            "metadata-only must not force full_text"
        );
        assert!(
            data.markdown.is_none(),
            "metadata-only must not force markdown"
        );
        assert!(data.tables.is_none(), "metadata-only must not force tables");
        assert!(
            data.trust_report.is_none(),
            "metadata-only must not force trust_report"
        );
    }

    #[test]
    fn rejects_invalid_auto_detail() {
        let err = read_pdf_from_value(&json!({
            "sources": [{"path": "/tmp/x.pdf"}],
            "auto_detail": "garbage"
        }))
        .expect_err("invalid auto_detail");
        assert_eq!(err.code, ReadPdfErrorCode::InvalidParams);
    }

    #[test]
    fn rejects_invalid_page_specifications_instead_of_falling_back_to_all_pages() {
        for pages in [
            json!("5-3"),
            json!("0"),
            json!(""),
            json!([]),
            json!([1, 0]),
        ] {
            let error = parse_page_spec(&Some(pages)).expect_err("invalid page spec");
            assert_eq!(error.code, ReadPdfErrorCode::InvalidParams);
        }
        assert_eq!(
            parse_page_spec(&Some(json!("1x"))).expect("TS parseInt-compatible page"),
            Some(vec![1])
        );
    }

    #[test]
    fn selected_pages_keep_original_page_numbers() {
        let pages = vec!["one".into(), "two".into(), "three".into()];
        let (selected, invalid) = select_pages(&pages, Some(&[2, 4]));
        assert_eq!(
            selected,
            vec![crate::document_twin::PageText {
                page: 2,
                text: "two".into(),
            }]
        );
        assert_eq!(invalid, vec![4]);
    }

    #[test]
    fn explicit_page_selection_returns_page_texts_instead_of_full_text() {
        let pages = vec![crate::document_twin::PageText {
            page: 2,
            text: "selected".into(),
        }];
        let data = build_data(
            &pages,
            3,
            &ReadPdfInput {
                auto: Some(false),
                include_full_text: true,
                ..Default::default()
            },
            None,
            true,
            BuildSignals::default(),
        );
        assert!(data.full_text.is_none());
        assert_eq!(data.page_texts, Some(pages));
    }

    #[test]
    fn auto_sampling_matches_ts_evenly_spaced_policy() {
        assert_eq!(evenly_sample_pages(10, 5), vec![1, 3, 6, 8, 10]);
        assert_eq!(evenly_sample_pages(3, 5), vec![1, 2, 3]);
        assert_eq!(evenly_sample_pages(10, 1), vec![1]);
    }

    #[test]
    fn catalog_only_flags_do_not_require_text_extraction() {
        let input = ReadPdfInput {
            auto: Some(false),
            include_outline: true,
            include_page_labels: true,
            include_permissions: true,
            ..Default::default()
        };
        assert!(!requires_text_extraction(&input));
    }

    #[test]
    fn include_page_count_false_omits_num_pages() {
        let pages = vec![crate::document_twin::PageText {
            page: 1,
            text: "text".into(),
        }];
        let data = build_data(
            &pages,
            4,
            &ReadPdfInput {
                auto: Some(false),
                include_metadata: true,
                include_page_count: false,
                ..Default::default()
            },
            None,
            false,
            BuildSignals::default(),
        );
        let serialized = serde_json::to_value(data).expect("serialize data");
        assert!(serialized.get("num_pages").is_none());
        assert!(serialized["metadata"].get("num_pages").is_none());
    }

    #[test]
    fn fast_auto_policy_does_not_enable_full_only_layers() {
        let pages = vec![crate::document_twin::PageText {
            page: 1,
            text: "Heading\nBody".into(),
        }];
        let data = build_data(
            &pages,
            1,
            &ReadPdfInput {
                auto: Some(true),
                auto_detail: Some("fast".into()),
                ..Default::default()
            },
            None,
            false,
            BuildSignals {
                page_geometry: Some(json!([])),
                ..BuildSignals::default()
            },
        );
        assert!(data.markdown.is_some());
        assert!(data.tables.is_some());
        assert!(data.document_map.is_some());
        assert!(data.layout_diagnostics.is_some());
        assert!(data.page_geometry.is_some());
        assert!(data.full_text.is_none());
        assert!(data.html.is_none());
        assert!(data.text_layer.is_none());
        assert!(data.trust_report.is_none());
    }
}
