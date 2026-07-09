use std::path::PathBuf;

use pdf_reader_core::text_index::{search_pdf_text, TextIndexErrorCode};
use pdf_reader_core::{hash_file, ENGINE_NAME, ENGINE_VERSION};
use rmcp::model::CallToolResult;
use serde_json::{json, Value};

use crate::engine_bridge::invoke_ts_engine;
use crate::evidence::attach_evidence;
use crate::schema::SearchPdfArgs;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const DEFAULT_MAX_PAGES: u32 = 100;
const DEFAULT_MAX_MATCHES: u32 = 50;
const DEFAULT_CONTEXT_CHARS: u32 = 120;

pub fn should_use_rust_search(args: &SearchPdfArgs) -> bool {
    if args.include_ocr_text_layer.unwrap_or(false) {
        return false;
    }
    if !args.prefer_speed.unwrap_or(false) {
        return false;
    }
    args.sources
        .iter()
        .all(|source| source.path.is_some() && source.url.is_none())
}

pub fn search_via_rust_core(args: &SearchPdfArgs) -> Result<Value, rmcp::ErrorData> {
    for source in &args.sources {
        source
            .validate()
            .map_err(|message| rmcp::ErrorData::invalid_params(message, None))?;
    }

    if args.query.trim().is_empty() {
        return Err(rmcp::ErrorData::invalid_params(
            "query must not be empty",
            None,
        ));
    }

    let case_sensitive = args.case_sensitive.unwrap_or(false);
    let whole_word = args.whole_word.unwrap_or(false);
    let max_pages = args.max_pages.unwrap_or(DEFAULT_MAX_PAGES);
    let max_matches = args.max_matches_per_source.unwrap_or(DEFAULT_MAX_MATCHES);
    let context_chars = args.context_chars.unwrap_or(DEFAULT_CONTEXT_CHARS);

    let mut results = Vec::new();
    for source in &args.sources {
        let path = source.path.as_ref().ok_or_else(|| {
            rmcp::ErrorData::invalid_params(
                format!(
                    "Rust search route requires a local path for {}",
                    source.label()
                ),
                None,
            )
        })?;

        match search_pdf_text(
            PathBuf::from(path).as_path(),
            DEFAULT_MAX_FILE_BYTES,
            &args.query,
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
                    "source": source.label(),
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
                let message = match error.code {
                    TextIndexErrorCode::InvalidParams => error.message,
                    TextIndexErrorCode::InvalidRequest => error.message,
                    TextIndexErrorCode::ExtractionFailed => error.message,
                };
                results.push(json!({
                    "source": source.label(),
                    "success": false,
                    "error": message,
                }));
            }
        }
    }

    if results.iter().all(|result| result.get("success") == Some(&Value::Bool(false))) {
        let errors = results
            .iter()
            .filter_map(|result| result.get("error").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("; ");
        return Err(rmcp::ErrorData::invalid_request(
            format!("All PDF sources failed search: {errors}"),
            None,
        ));
    }

    let source_hash = args
        .sources
        .iter()
        .find_map(|source| source.path.as_ref())
        .and_then(|path| hash_file(PathBuf::from(path).as_path(), DEFAULT_MAX_FILE_BYTES).ok())
        .map(|hash| hash.source_hash);

    let payload = json!({
        "profile": "pdf_search_results",
        "search_options": {
            "query": args.query,
            "case_sensitive": case_sensitive,
            "whole_word": whole_word,
            "max_pages": max_pages,
            "max_matches_per_source": max_matches,
            "context_chars": context_chars,
            "include_ocr_text_layer": args.include_ocr_text_layer.unwrap_or(false),
            "prefer_speed": args.prefer_speed.unwrap_or(false),
        },
        "results": results,
    });

    Ok(attach_evidence(
        "search_pdf",
        None,
        &args.sources,
        "pdf-text-index-v3",
        source_hash,
        Vec::new(),
        payload,
    ))
}

pub fn search_pdf(args: SearchPdfArgs) -> Result<CallToolResult, rmcp::ErrorData> {
    if should_use_rust_search(&args) {
        let payload = search_via_rust_core(&args)?;
        return Ok(CallToolResult::structured(payload));
    }

    let arguments = serde_json::to_value(&args).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Failed to serialize search args: {error}"), None)
    })?;
    invoke_ts_engine("search_pdf", arguments)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::PdfSource;

    #[test]
    fn selects_rust_route_only_when_prefer_speed_is_enabled() {
        let args = SearchPdfArgs {
            sources: vec![PdfSource {
                path: Some("/tmp/sample.pdf".into()),
                url: None,
                pages: None,
            }],
            query: "sample".into(),
            case_sensitive: None,
            whole_word: None,
            include_ocr_text_layer: None,
            max_pages: None,
            max_matches_per_source: None,
            context_chars: None,
            prefer_speed: None,
        };
        assert!(!should_use_rust_search(&args));

        let mut prefer_speed = args;
        prefer_speed.prefer_speed = Some(true);
        assert!(should_use_rust_search(&prefer_speed));
    }
}