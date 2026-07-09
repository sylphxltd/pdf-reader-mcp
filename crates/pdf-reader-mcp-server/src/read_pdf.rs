use pdf_reader_core::read_pdf_from_value;
use pdf_reader_core::{hash_file, ReadPdfErrorCode, READ_PDF_ROUTE};
use rmcp::model::CallToolResult;
use serde_json::Value;
use std::path::PathBuf;

use crate::evidence::attach_evidence;
use crate::schema::PdfSource;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;

pub fn read_pdf(args: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let sources = args
        .get("sources")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let parsed_sources: Vec<PdfSource> = sources
        .iter()
        .filter_map(|source| serde_json::from_value(source.clone()).ok())
        .collect();

    for source in &parsed_sources {
        if let Err(message) = source.validate() {
            return Err(rmcp::ErrorData::invalid_params(message, None));
        }
    }

    let payload = read_pdf_from_value(&args).map_err(|error| match error.code {
        ReadPdfErrorCode::InvalidParams => {
            rmcp::ErrorData::invalid_params(error.message, None)
        }
        ReadPdfErrorCode::InvalidRequest | ReadPdfErrorCode::ExtractionFailed => {
            rmcp::ErrorData::invalid_request(error.message, None)
        }
    })?;

    let source_hash = parsed_sources
        .iter()
        .find_map(|source| source.path.as_ref())
        .and_then(|path| hash_file(PathBuf::from(path).as_path(), DEFAULT_MAX_FILE_BYTES).ok())
        .map(|hash| hash.source_hash);

    let structured = attach_evidence(
        "read_pdf",
        None,
        &parsed_sources,
        READ_PDF_ROUTE,
        source_hash,
        Vec::new(),
        serde_json::to_value(payload).map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to serialize read_pdf: {error}"), None)
        })?,
    );

    Ok(CallToolResult::structured(structured))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn reads_fixture_through_rust_core_route() {
        let fixture = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }

        let result = read_pdf(serde_json::json!({
            "sources": [{ "path": fixture }],
            "include_metadata": true,
            "include_page_count": true,
            "include_full_text": false
        }))
        .expect("read_pdf");

        let structured = result.structured_content.expect("structured");
        let results = structured
            .get("results")
            .and_then(Value::as_array)
            .expect("results");
        assert!(results[0].get("success").and_then(Value::as_bool).unwrap_or(false));
        let route = results[0]
            .pointer("/data/route")
            .and_then(Value::as_str)
            .unwrap_or("");
        assert_eq!(route, READ_PDF_ROUTE);
        let engine = structured
            .pointer("/results/0/data/engine/name")
            .and_then(Value::as_str)
            .unwrap_or("");
        assert_eq!(engine, "pdf-reader-core");
    }
}