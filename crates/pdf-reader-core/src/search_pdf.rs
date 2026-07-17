//! Rust-native search_pdf extraction for pdf-reader-mcp.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::text_index::{search_pdf_text, TextIndexError, TextIndexErrorCode, TEXT_INDEX_ROUTE};
use crate::url_fetch::{cleanup_temp_file, fetch_url_to_temp_file};
use crate::{ENGINE_NAME, ENGINE_VERSION};

pub const SEARCH_PDF_ROUTE: &str = TEXT_INDEX_ROUTE;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const DEFAULT_MAX_PAGES: u32 = 100;
const DEFAULT_MAX_MATCHES: u32 = 50;
const DEFAULT_CONTEXT_CHARS: u32 = 120;

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SearchPdfSource {
    pub path: Option<String>,
    pub url: Option<String>,
    #[serde(default)]
    pub pages: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct SearchPdfInput {
    pub sources: Vec<SearchPdfSource>,
    pub query: String,
    pub case_sensitive: Option<bool>,
    pub whole_word: Option<bool>,
    pub include_ocr_text_layer: Option<bool>,
    pub max_pages: Option<u32>,
    pub max_matches_per_source: Option<u32>,
    pub context_chars: Option<u32>,
    pub prefer_speed: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchPdfResponse {
    pub profile: &'static str,
    pub search_options: Value,
    pub results: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SearchPdfErrorCode {
    InvalidParams,
    InvalidRequest,
    ExtractionFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchPdfError {
    pub code: SearchPdfErrorCode,
    pub message: String,
}

impl SearchPdfError {
    fn invalid_params(message: impl Into<String>) -> Self {
        Self {
            code: SearchPdfErrorCode::InvalidParams,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: SearchPdfErrorCode::InvalidRequest,
            message: message.into(),
        }
    }
}

impl From<TextIndexError> for SearchPdfError {
    fn from(error: TextIndexError) -> Self {
        match error.code {
            TextIndexErrorCode::InvalidParams => Self::invalid_params(error.message),
            TextIndexErrorCode::InvalidRequest => Self::invalid_request(error.message),
            TextIndexErrorCode::ExtractionFailed => Self {
                code: SearchPdfErrorCode::ExtractionFailed,
                message: error.message,
            },
        }
    }
}

fn validate_source(source: &SearchPdfSource) -> Result<(), SearchPdfError> {
    let has_path = source.path.as_ref().is_some_and(|value| !value.is_empty());
    let has_url = source.url.as_ref().is_some_and(|value| !value.is_empty());
    match (has_path, has_url) {
        (true, false) | (false, true) => Ok(()),
        (false, false) => Err(SearchPdfError::invalid_params(
            "Provide exactly one of path or url for each PDF source.",
        )),
        (true, true) => Err(SearchPdfError::invalid_params(
            "Provide exactly one of path or url for each PDF source.",
        )),
    }
}

fn source_label(source: &SearchPdfSource) -> String {
    source
        .path
        .clone()
        .or_else(|| source.url.clone())
        .unwrap_or_else(|| "unknown".into())
}

pub fn search_pdf(input: &SearchPdfInput) -> Result<SearchPdfResponse, SearchPdfError> {
    if input.sources.is_empty() {
        return Err(SearchPdfError::invalid_params(
            "sources must include at least one PDF source.",
        ));
    }
    if input.query.trim().is_empty() {
        return Err(SearchPdfError::invalid_params("query must not be empty"));
    }
    if input.include_ocr_text_layer.unwrap_or(false) {
        return Err(SearchPdfError::invalid_request(
            "search_pdf include_ocr_text_layer requires an OCR provider; pure-Rust search uses the embedded text layer only.",
        ));
    }

    for source in &input.sources {
        validate_source(source)?;
    }

    let case_sensitive = input.case_sensitive.unwrap_or(false);
    let whole_word = input.whole_word.unwrap_or(false);
    let max_pages = input.max_pages.unwrap_or(DEFAULT_MAX_PAGES);
    let max_matches = input.max_matches_per_source.unwrap_or(DEFAULT_MAX_MATCHES);
    let context_chars = input.context_chars.unwrap_or(DEFAULT_CONTEXT_CHARS);

    let mut results = Vec::new();
    let mut temps = Vec::new();
    for source in &input.sources {
        let label = source_label(source);
        let resolved: Result<PathBuf, String> = if let Some(path) = source
            .path
            .as_ref()
            .filter(|value| !value.is_empty())
        {
            Ok(PathBuf::from(path))
        } else if let Some(url) = source.url.as_ref().filter(|value| !value.is_empty()) {
            match fetch_url_to_temp_file(url) {
                Ok(temp) => {
                    temps.push(temp.clone());
                    Ok(temp)
                }
                Err(message) => Err(message),
            }
        } else {
            Err("Provide exactly one of path or url for each PDF source.".into())
        };

        let path = match resolved {
            Ok(path) => path,
            Err(message) => {
                results.push(json!({
                    "source": label,
                    "success": false,
                    "error": message,
                }));
                continue;
            }
        };

        match search_pdf_text(
            path.as_path(),
            DEFAULT_MAX_FILE_BYTES,
            &input.query,
            case_sensitive,
            whole_word,
            max_pages,
            max_matches,
            context_chars,
        ) {
            Ok(search) => {
                let matches: Vec<Value> = search
                    .matches
                    .iter()
                    .map(|item| {
                        json!({
                            "id": item.id,
                            "page": item.page,
                            "text": item.text,
                            "snippet": item.snippet,
                            "matchStart": item.match_start,
                            "matchEnd": item.match_end,
                            "provenance": {
                                "engine": item.route,
                                "route": item.route,
                            }
                        })
                    })
                    .collect();

                results.push(json!({
                    "source": label,
                    "success": true,
                    "num_pages": search.num_pages,
                    "searched_pages": search.searched_pages,
                    "total_matches": search.total_matches,
                    "matches": matches,
                    "truncated": search.truncated,
                    "warnings": [],
                    "route": search.route,
                    "page_cache": search.page_cache,
                    "engine": {
                        "name": ENGINE_NAME,
                        "version": ENGINE_VERSION,
                    }
                }));
            }
            Err(error) => {
                results.push(json!({
                    "source": label,
                    "success": false,
                    "error": error.message,
                }));
            }
        }
    }

    for temp in temps {
        cleanup_temp_file(temp.as_path());
    }

    if results.iter().all(|result| result.get("success") == Some(&Value::Bool(false))) {
        let errors = results
            .iter()
            .filter_map(|result| result.get("error").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(SearchPdfError::invalid_request(format!(
            "All PDF sources failed search: {errors}"
        )));
    }

    Ok(SearchPdfResponse {
        profile: "pdf_search_results",
        search_options: json!({
            "query": input.query,
            "case_sensitive": case_sensitive,
            "whole_word": whole_word,
            "max_pages": max_pages,
            "max_matches_per_source": max_matches,
            "context_chars": context_chars,
            "include_ocr_text_layer": input.include_ocr_text_layer.unwrap_or(false),
            "prefer_speed": input.prefer_speed.unwrap_or(false),
        }),
        results,
    })
}

pub fn search_pdf_from_value(input: &Value) -> Result<SearchPdfResponse, SearchPdfError> {
    let parsed: SearchPdfInput = serde_json::from_value(input.clone()).map_err(|error| {
        SearchPdfError::invalid_params(format!("Invalid search_pdf input: {error}"))
    })?;
    search_pdf(&parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn searches_fixture_without_legacy_runtime() {
        let fixture = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }

        let response = search_pdf(&SearchPdfInput {
            sources: vec![SearchPdfSource {
                path: Some(fixture.to_string_lossy().to_string()),
                url: None,
                pages: None,
            }],
            query: "Lorem".into(),
            ..SearchPdfInput::default()
        })
        .expect("search fixture");

        assert_eq!(response.profile, "pdf_search_results");
        assert!(response.results[0].get("success").and_then(Value::as_bool).unwrap_or(false));
        assert_eq!(
            response.results[0].get("route").and_then(Value::as_str),
            Some(SEARCH_PDF_ROUTE)
        );
    }
}