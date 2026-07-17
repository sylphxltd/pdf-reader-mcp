use pdf_reader_core::search_pdf_from_value;
use pdf_reader_core::{hash_file, SearchPdfErrorCode, SEARCH_PDF_ROUTE};
use rmcp::model::CallToolResult;
use serde_json::Value;
use std::path::PathBuf;

use crate::evidence::attach_evidence;
use crate::schema::SearchPdfArgs;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;

pub fn search_pdf(args_value: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let args: SearchPdfArgs = serde_json::from_value(args_value.clone()).map_err(|error| {
        rmcp::ErrorData::invalid_params(format!("Invalid search_pdf arguments: {error}"), None)
    })?;

    for source in &args.sources {
        source
            .validate()
            .map_err(|message| rmcp::ErrorData::invalid_params(message, None))?;
    }

    if args.include_ocr_text_layer.unwrap_or(false) {
        return Err(rmcp::ErrorData::invalid_request(
            "search_pdf include_ocr_text_layer requires an OCR provider; pure-Rust search uses the embedded text layer only.",
            None,
        ));
    }

    // Resolve URL sources to temp files via core search which currently expects paths.
    // URL support: rewrite args for path-only search after fetch in core if needed later.
    let response = search_pdf_from_value(&args_value).map_err(|error| match error.code {
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
