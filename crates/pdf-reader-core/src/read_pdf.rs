//! Rust-native read_pdf extraction for pdf-reader-mcp.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::text_index::{extract_page_texts, TextIndexError, TextIndexErrorCode};
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
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineInfo {
    pub name: &'static str,
    pub version: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadPdfData {
    pub num_pages: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub info: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_text: Option<String>,
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

fn validate_source(source: &ReadPdfSource) -> Result<&str, ReadPdfError> {
    let has_path = source.path.as_ref().is_some_and(|value| !value.is_empty());
    let has_url = source.url.as_ref().is_some_and(|value| !value.is_empty());
    match (has_path, has_url) {
        (true, false) => Ok(source.path.as_ref().expect("path")),
        (false, true) => Err(ReadPdfError::invalid_request(
            "Rust read_pdf route requires a local path source today; remote URLs are not supported on the Rust engine path.",
        )),
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

fn read_local_pdf(
    path: &Path,
    input: &ReadPdfInput,
    source_label: &str,
) -> Result<ReadPdfSourceResult, ReadPdfError> {
    let _hash: FileHash = hash_file(path, DEFAULT_MAX_FILE_BYTES)?;
    let pages = extract_page_texts(path, DEFAULT_MAX_FILE_BYTES)?;
    let num_pages = pages.len().max(1) as u32;
    let full_text = join_page_text(&pages);
    let text_chars = full_text.chars().count();

    let mut data = ReadPdfData {
        num_pages,
        info: None,
        full_text: None,
        route: READ_PDF_ROUTE.into(),
        engine: EngineInfo {
            name: ENGINE_NAME,
            version: ENGINE_VERSION,
        },
    };

    if input.include_metadata {
        data.info = Some(json!({
            "Title": path.file_name().and_then(|name| name.to_str()).unwrap_or("document"),
            "Producer": "pdf-reader-core",
            "PDFFormatVersion": "unknown",
            "route": READ_PDF_ROUTE,
        }));
    }

    if input.include_full_text {
        data.full_text = Some(full_text);
    }

    if !input.include_page_count && !input.include_metadata && !input.include_full_text {
        data.info = Some(json!({
            "route": READ_PDF_ROUTE,
            "text_chars": text_chars,
        }));
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

    let mut results = Vec::new();
    for source in &input.sources {
        let path_value = validate_source(source)?;
        let path = PathBuf::from(path_value);
        let label = path_value.to_string();
        match read_local_pdf(path.as_path(), input, &label) {
            Ok(result) => results.push(result),
            Err(error) => results.push(ReadPdfSourceResult {
                source: label,
                success: false,
                error: Some(error.message),
                data: None,
            }),
        }
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
    fn reads_fixture_without_legacy_runtime() {
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
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
            include_full_text: false,
        })
        .expect("read fixture");

        assert_eq!(response.profile, "pdf_read_results");
        let first = response.results.first().expect("result");
        assert!(first.success);
        let data = first.data.as_ref().expect("data");
        assert_eq!(data.route, READ_PDF_ROUTE);
        assert!(data.num_pages >= 1);
        assert!(data.info.is_some());
    }


    #[test]
    fn bulk_validate_source_path_url_matrix() {
        assert!(validate_source(&ReadPdfSource {
            path: Some("/tmp/a.pdf".into()),
            url: None,
            pages: None,
        })
        .is_ok());
        assert!(validate_source(&ReadPdfSource {
            path: None,
            url: Some("https://x".into()),
            pages: None,
        })
        .is_err());
        assert!(validate_source(&ReadPdfSource {
            path: None,
            url: None,
            pages: None,
        })
        .is_err());
        assert!(validate_source(&ReadPdfSource {
            path: Some("/tmp/a.pdf".into()),
            url: Some("https://x".into()),
            pages: None,
        })
        .is_err());
        assert!(validate_source(&ReadPdfSource {
            path: Some("".into()),
            url: None,
            pages: None,
        })
        .is_err());
    }

    #[test]
    fn bulk_join_page_text_skips_empty() {
        assert_eq!(join_page_text(&[]), "");
        assert_eq!(
            join_page_text(&["".into(), "a".into(), "".into(), "b".into()]),
            "a\n\nb"
        );
    }
}
