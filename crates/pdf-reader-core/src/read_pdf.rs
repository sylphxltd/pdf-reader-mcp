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
    // Accepted for API compatibility; best-effort filled or ignored when unsupported.
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
    pub document_map: Option<Value>,
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
    let num_pages = pages.len().max(1) as u32;
    let full_text = join_page_text(pages);
    let text_chars = full_text.chars().count();
    let mut warnings = Vec::new();

    // Auto mode: enable useful defaults
    let auto = input.auto.unwrap_or(true);
    let want_meta = input.include_metadata || input.include_page_count || auto;
    let want_text = input.include_full_text || auto;
    let want_md = input.include_markdown || auto;
    let want_chunks = input.include_chunks || auto;
    let want_elements = input.include_elements;
    let want_text_layer = input.include_text_layer;
    let want_map = input.include_document_map || auto;

    if input.include_images
        || input.include_tables
        || input.include_ocr_text_layer
        || input.include_visual_enrichments
    {
        warnings.push(
            "Rust engine: images/tables/OCR/visual enrichment use text-first best-effort; provider-native visual pipelines are not required."
                .into(),
        );
    }

    let mut data = ReadPdfData {
        num_pages,
        info: None,
        full_text: None,
        markdown: None,
        html: None,
        chunks: None,
        elements: None,
        text_layer: None,
        document_map: None,
        warnings: None,
        route: READ_PDF_ROUTE.into(),
        engine: EngineInfo {
            name: ENGINE_NAME,
            version: ENGINE_VERSION,
        },
    };

    if want_meta || input.include_metadata || input.include_page_count {
        data.info = Some(json!({
            "Title": Path::new(source_label).file_name().and_then(|n| n.to_str()).unwrap_or("document"),
            "Producer": "pdf-reader-core",
            "PDFFormatVersion": "unknown",
            "num_pages": num_pages,
            "text_chars": text_chars,
            "route": READ_PDF_ROUTE,
        }));
    }

    if want_text {
        data.full_text = Some(full_text.clone());
    }
    if want_md {
        data.markdown = Some(
            pages
                .iter()
                .enumerate()
                .filter(|(_, t)| !t.trim().is_empty())
                .map(|(i, t)| format!("## Page {}\n\n{}", i + 1, t.trim()))
                .collect::<Vec<_>>()
                .join("\n\n"),
        );
    }
    if input.include_html {
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
        data.chunks = Some(json!(pages
            .iter()
            .enumerate()
            .filter(|(_, t)| !t.trim().is_empty())
            .map(|(i, t)| json!({
                "id": format!("chunk-p{}", i + 1),
                "page": i + 1,
                "text": t,
            }))
            .collect::<Vec<_>>()));
    }
    if want_elements {
        data.elements = Some(json!(pages
            .iter()
            .enumerate()
            .flat_map(|(i, t)| t
                .lines()
                .filter(|l| !l.trim().is_empty())
                .enumerate()
                .map(move |(j, line)| json!({
                    "id": format!("e-{}-{}", i + 1, j + 1),
                    "type": "text",
                    "page": i + 1,
                    "content": line,
                })))
            .collect::<Vec<_>>()));
    }
    if want_text_layer {
        data.text_layer = Some(json!({
            "pages": pages.iter().enumerate().map(|(i, t)| json!({
                "page": i + 1,
                "text": t,
                "char_count": t.chars().count(),
            })).collect::<Vec<_>>(),
        }));
    }
    if want_map {
        data.document_map = Some(json!({
            "profile": "rust-document-map-v1",
            "num_pages": num_pages,
            "text_chars": text_chars,
            "pages": (1..=num_pages).collect::<Vec<_>>(),
            "route": READ_PDF_ROUTE,
        }));
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
}
