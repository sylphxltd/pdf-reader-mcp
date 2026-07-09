use pdf_reader_core::legacy_engine_allowed;
use pdf_reader_core::search_pdf_from_value;
use pdf_reader_core::{hash_file, SearchPdfErrorCode, SEARCH_PDF_ROUTE};
use rmcp::model::CallToolResult;
use std::path::PathBuf;

use crate::cli_bridge::invoke_cli_tool;
use crate::evidence::attach_evidence;
use crate::schema::SearchPdfArgs;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;

pub fn should_use_legacy_search(args: &SearchPdfArgs) -> bool {
    if !legacy_engine_allowed() {
        return false;
    }
    if args.include_ocr_text_layer.unwrap_or(false) {
        return true;
    }
    if args.sources.iter().any(|source| source.url.is_some()) {
        return true;
    }
    false
}

pub fn search_pdf(args: SearchPdfArgs) -> Result<CallToolResult, rmcp::ErrorData> {
    if should_use_legacy_search(&args) {
        let arguments = serde_json::to_value(&args).map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to serialize search args: {error}"), None)
        })?;
        return invoke_cli_tool("search_pdf", arguments);
    }

    let arguments = serde_json::to_value(&args).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Failed to serialize search args: {error}"), None)
    })?;

    let response = search_pdf_from_value(&arguments).map_err(|error| match error.code {
        SearchPdfErrorCode::InvalidParams => rmcp::ErrorData::invalid_params(error.message, None),
        SearchPdfErrorCode::InvalidRequest | SearchPdfErrorCode::ExtractionFailed => {
            rmcp::ErrorData::invalid_request(error.message, None)
        }
    })?;

    let source_hash = args
        .sources
        .iter()
        .find_map(|source| source.path.as_ref())
        .and_then(|path| hash_file(PathBuf::from(path).as_path(), DEFAULT_MAX_FILE_BYTES).ok())
        .map(|hash| hash.source_hash);

    let structured = attach_evidence(
        "search_pdf",
        None,
        &args.sources,
        SEARCH_PDF_ROUTE,
        source_hash,
        Vec::new(),
        serde_json::to_value(response).map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to serialize search_pdf: {error}"), None)
        })?,
    );

    Ok(CallToolResult::structured(structured))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::PdfSource;

    #[test]
    fn defaults_to_rust_search_without_legacy_flag() {
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
        assert!(!should_use_legacy_search(&args));
    }

    #[test]
    fn uses_legacy_only_when_opt_in_and_ocr_layer_requested() {
        let mut args = SearchPdfArgs {
            sources: vec![PdfSource {
                path: Some("/tmp/sample.pdf".into()),
                url: None,
                pages: None,
            }],
            query: "sample".into(),
            case_sensitive: None,
            whole_word: None,
            include_ocr_text_layer: Some(true),
            max_pages: None,
            max_matches_per_source: None,
            context_chars: None,
            prefer_speed: None,
        };
        assert!(!should_use_legacy_search(&args));
        std::env::set_var("PDF_READER_ALLOW_LEGACY_ENGINE", "1");
        assert!(should_use_legacy_search(&args));
        args.include_ocr_text_layer = Some(false);
        assert!(!should_use_legacy_search(&args));
        std::env::remove_var("PDF_READER_ALLOW_LEGACY_ENGINE");
    }
}