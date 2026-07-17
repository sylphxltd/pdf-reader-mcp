//! Pure-Rust read_pdf for pdf-reader-mcp (local path + SSRF-safe URL).

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::text_index::{extract_page_texts, TextIndexError, TextIndexErrorCode};
use crate::url_fetch::{cleanup_temp_file, fetch_url_to_temp_file};
use crate::{hash_file, FileHash, HashError, ENGINE_NAME, ENGINE_VERSION};

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
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineInfo {
    pub name: &'static str,
    pub version: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ReadPdfData {
    pub num_pages: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_text: Option<String>,
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
    pub ocr_text_layer: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_enrichments: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visual_enrichment_candidates: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
    pub route: String,
    pub engine: EngineInfo,
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

fn join_page_text(pages: &[String]) -> String {
    pages
        .iter()
        .map(String::as_str)
        .filter(|page| !page.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn select_pages(pages: &[String], pages_spec: &Option<Value>) -> Vec<(u32, String)> {
    let all: Vec<(u32, String)> = pages
        .iter()
        .enumerate()
        .map(|(i, t)| ((i + 1) as u32, t.clone()))
        .collect();
    let Some(spec) = pages_spec else {
        return all;
    };
    if let Some(arr) = spec.as_array() {
        let wanted: Vec<u32> = arr.iter().filter_map(|v| v.as_u64().map(|n| n as u32)).collect();
        if wanted.is_empty() {
            return all;
        }
        return all.into_iter().filter(|(p, _)| wanted.contains(p)).collect();
    }
    if let Some(s) = spec.as_str() {
        let mut wanted = Vec::new();
        for part in s.split(',') {
            let part = part.trim();
            if let Some((a, b)) = part.split_once('-') {
                if let (Ok(start), Ok(end)) = (a.trim().parse::<u32>(), b.trim().parse::<u32>()) {
                    if start <= end {
                        wanted.extend(start..=end);
                    }
                }
            } else if let Ok(n) = part.parse::<u32>() {
                wanted.push(n);
            }
        }
        if wanted.is_empty() {
            return all;
        }
        return all.into_iter().filter(|(p, _)| wanted.contains(p)).collect();
    }
    all
}

fn build_data(pages: &[String], input: &ReadPdfInput, source_label: &str) -> ReadPdfData {
    use crate::document_twin::{
        build_accessibility_report, build_document_ast, build_document_map, build_elements,
        build_layout_diagnostics, build_page_geometry, build_page_labels, build_safety_findings,
        build_tables, build_trust_report, empty_structure_arrays,
    };

    let num_pages = pages.len().max(1) as u32;
    let full_text = join_page_text(pages);
    let text_chars = full_text.chars().count();
    let mut warnings = Vec::new();

    let auto = input.auto.unwrap_or(true);
    let detail = input.auto_detail.as_deref().unwrap_or("balanced");
    let auto_full = auto && detail == "full";
    let auto_balanced = auto && (detail == "balanced" || detail == "full");
    let auto_fast = auto; // any auto enables core twin layers

    let want_meta = input.include_metadata || input.include_page_count || auto_fast;
    let want_text = input.include_full_text || auto_fast;
    let want_md = input.include_markdown || auto_fast;
    let want_chunks = input.include_chunks || auto_fast;
    let want_elements = input.include_elements || auto_balanced || auto_full;
    let want_semantic = input.include_semantic_hints || auto_balanced || auto_full;
    let want_text_layer = input.include_text_layer || auto_full;
    let want_map = input.include_document_map || auto_fast;
    let want_tables = input.include_tables || auto_balanced || auto_full;
    let want_html = input.include_html || auto_full;
    let want_safety = input.include_safety_findings || auto_balanced || auto_full;
    let want_layout = input.include_layout_diagnostics || auto_balanced || auto_full;
    let want_ast = input.include_document_ast || auto_full;
    let want_trust = input.include_trust_report || auto_balanced || auto_full;
    let want_a11y = input.include_accessibility_report || auto_balanced || auto_full;
    let want_outline = input.include_outline || auto_full;
    let want_annotations = input.include_annotations || auto_full;
    let want_labels = input.include_page_labels || auto_full;
    let want_geometry = input.include_page_geometry || auto_full;
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
        warnings.push(
            "include_ocr_text_layer: no OCR provider configured on pure-Rust path; ocr_text_layer is empty. Configure an external OCR provider for scanned pages."
                .into(),
        );
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
    let tables = if want_tables || want_ast || want_map {
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
            .enumerate()
            .filter(|(_, t)| !t.trim().is_empty())
            .map(|(i, t)| json!({
                "id": format!("chunk-p{}", i + 1),
                "page": i + 1,
                "text": t,
                "element_ids": elements
                    .as_ref()
                    .and_then(|e| e.as_array())
                    .into_iter()
                    .flatten()
                    .filter(|el| el.get("page").and_then(Value::as_u64) == Some((i + 1) as u64))
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

    let (outline, annotations, form_fields, attachments, structure_trees) =
        empty_structure_arrays();

    let mut data = ReadPdfData {
        num_pages,
        info: None,
        metadata: None,
        full_text: None,
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
        ocr_text_layer: None,
        visual_enrichments: None,
        visual_enrichment_candidates: None,
        warnings: None,
        route: READ_PDF_ROUTE.into(),
        engine: EngineInfo {
            name: ENGINE_NAME,
            version: ENGINE_VERSION,
        },
    };

    if want_meta {
        let info = json!({
            "Title": Path::new(source_label).file_name().and_then(|n| n.to_str()).unwrap_or("document"),
            "Producer": "pdf-reader-core",
            "PDFFormatVersion": "unknown",
            "num_pages": num_pages,
            "text_chars": text_chars,
            "route": READ_PDF_ROUTE,
        });
        data.info = Some(info.clone());
        data.metadata = Some(json!({
            "info": info,
            "num_pages": num_pages,
            "text_chars": text_chars,
        }));
    }
    if want_text {
        data.full_text = Some(full_text.clone());
    }
    if want_md {
        let mut md_parts = pages
            .iter()
            .enumerate()
            .filter(|(_, t)| !t.trim().is_empty())
            .map(|(i, t)| format!("## Page {}\n\n{}", i + 1, t.trim()))
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
                                        cells_s.iter().map(|_| "---").collect::<Vec<_>>().join(" | ")
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
                .enumerate()
                .map(|(i, t)| {
                    format!(
                        "<section data-page=\"{}\"><pre>{}</pre></section>",
                        i + 1,
                        html_escape(t)
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
            "pages": pages.iter().enumerate().map(|(i, t)| json!({
                "page": i + 1,
                "text": t,
                "char_count": t.chars().count(),
                "runs": t.lines().filter(|l| !l.trim().is_empty()).enumerate().map(|(j, line)| json!({
                    "id": format!("run-{}-{}", i + 1, j + 1),
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
        data.outline = Some(outline);
        warnings.push(
            "include_outline: outline entries are empty until COS outline parsing is enabled."
                .into(),
        );
    }
    if want_annotations {
        data.annotations = Some(annotations);
        warnings.push(
            "include_annotations: annotation records are empty on the pure-Rust text path.".into(),
        );
    }
    if want_forms {
        data.form_fields = Some(form_fields);
    }
    if want_attachments {
        data.attachments = Some(attachments);
    }
    if want_structure {
        data.structure_trees = Some(structure_trees);
        warnings.push(
            "include_structure_tree: structure trees are empty without tagged-PDF COS parsing."
                .into(),
        );
    }
    if want_labels {
        data.page_labels = Some(build_page_labels(num_pages));
    }
    if want_geometry {
        data.page_geometry = Some(build_page_geometry(num_pages));
    }
    if want_permissions {
        data.permissions = Some(json!([]));
    }
    if want_ocr {
        data.ocr_text_layer = Some(json!({
            "profile": "pdf_ocr_text_layer",
            "pages": [],
            "provider": null,
            "note": "No OCR provider configured.",
        }));
    }
    if want_visual {
        data.visual_enrichments = Some(json!([]));
        data.visual_enrichment_candidates = Some(json!([]));
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
    let _hash: FileHash = hash_file(path, DEFAULT_MAX_FILE_BYTES)?;
    let pages = extract_page_texts(path, DEFAULT_MAX_FILE_BYTES)?;
    let selected = select_pages(&pages, pages_spec);
    let selected_texts: Vec<String> = selected.into_iter().map(|(_, t)| t).collect();
    // Keep full page count from original document
    let mut data = build_data(&selected_texts, input, source_label);
    data.num_pages = pages.len().max(1) as u32;
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

pub fn read_pdf_from_value(input: &Value) -> Result<ReadPdfResponse, ReadPdfError> {
    let parsed: ReadPdfInput = serde_json::from_value(input.clone()).map_err(|error| {
        ReadPdfError::invalid_params(format!("Invalid read_pdf input: {error}"))
    })?;
    read_pdf(&parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

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
            Err(e) => assert!(e.message.to_lowercase().contains("non-public") || e.message.to_lowercase().contains("failed")),
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
        assert!(data.outline.is_some());
        assert!(data.annotations.is_some());
        assert!(data.page_labels.is_some());
        assert!(data.page_geometry.is_some());
        assert!(data.permissions.is_some());
        assert!(data.form_fields.is_some());
        assert!(data.attachments.is_some());
        assert!(data.structure_trees.is_some());
        assert!(data.ocr_text_layer.is_some());
        assert!(data.visual_enrichments.is_some());
        assert_eq!(data.trust_report.as_ref().unwrap()["profile"], "pdf_trust_report");
        assert_eq!(
            data.accessibility_report.as_ref().unwrap()["profile"],
            "pdf_accessibility_report"
        );
    }
}
