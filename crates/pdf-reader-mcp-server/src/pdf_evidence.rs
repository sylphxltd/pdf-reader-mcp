use pdf_reader_core::text_index::extract_page_texts;
use pdf_reader_core::{hash_file, READ_PDF_ROUTE, ENGINE_NAME, ENGINE_VERSION};
use rmcp::model::CallToolResult;
use serde_json::{json, Value};
use std::path::PathBuf;

use crate::evidence::attach_evidence;
use crate::schema::PdfSource;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const INSPECT_ROUTE: &str = "rust-pdf-inspect-v1";

pub fn pdf_evidence(args: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let operation = args
        .get("operation")
        .and_then(Value::as_str)
        .ok_or_else(|| rmcp::ErrorData::invalid_params("operation is required", None))?;

    if operation != "inspect" {
        return Err(rmcp::ErrorData::invalid_request(
            format!(
                "Rust pdf_evidence supports operation=inspect on the default engine path. \
                 Use PDF_READER_MCP_TRANSPORT=ts for {operation} until the Rust visual pipeline lands."
            ),
            None,
        ));
    }

    let sources_value = args
        .get("sources")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| rmcp::ErrorData::invalid_params("sources is required", None))?;

    let parsed_sources: Vec<PdfSource> = sources_value
        .iter()
        .filter_map(|source| serde_json::from_value(source.clone()).ok())
        .collect();

    if parsed_sources.is_empty() {
        return Err(rmcp::ErrorData::invalid_params(
            "sources must include at least one PDF source",
            None,
        ));
    }

    for source in &parsed_sources {
        source
            .validate()
            .map_err(|message| rmcp::ErrorData::invalid_params(message, None))?;
    }

    let mut results = Vec::new();
    for source in &parsed_sources {
        let path = source.path.as_ref().ok_or_else(|| {
            rmcp::ErrorData::invalid_request(
                "Rust pdf_evidence inspect requires a local path source.",
                None,
            )
        })?;
        let path_buf = PathBuf::from(path);
        match extract_page_texts(path_buf.as_path(), DEFAULT_MAX_FILE_BYTES) {
            Ok(pages) => {
                let num_pages = pages.len().max(1) as u32;
                let text_chars: u32 = pages.iter().map(|page| page.chars().count() as u32).sum();
                results.push(json!({
                    "source": source.label(),
                    "success": true,
                    "data": {
                        "profile": "pdf_inspection",
                        "num_pages": num_pages,
                        "page_signals": pages.iter().enumerate().map(|(index, page)| json!({
                            "page": index as u32 + 1,
                            "text_chars": page.chars().count(),
                            "has_selectable_text": !page.trim().is_empty(),
                        })).collect::<Vec<_>>(),
                        "recommendation": {
                            "workflow": if text_chars > 80 { "text_extract" } else { "ocr_render" },
                            "needs_ocr": text_chars <= 80,
                            "reason": "Rust inspection derived from pdf-reader-core text extraction",
                            "route": INSPECT_ROUTE,
                        },
                        "route": INSPECT_ROUTE,
                        "engine": {
                            "name": ENGINE_NAME,
                            "version": ENGINE_VERSION,
                        }
                    }
                }));
            }
            Err(error) => {
                results.push(json!({
                    "source": source.label(),
                    "success": false,
                    "error": error.message,
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
            format!("All PDF sources failed inspection: {errors}"),
            None,
        ));
    }

    let source_hash = parsed_sources
        .iter()
        .find_map(|source| source.path.as_ref())
        .and_then(|path| hash_file(PathBuf::from(path).as_path(), DEFAULT_MAX_FILE_BYTES).ok())
        .map(|hash| hash.source_hash);

    let payload = json!({
        "profile": "pdf_inspection_results",
        "operation": "inspect",
        "results": results,
    });

    let structured = attach_evidence(
        "pdf_evidence",
        Some("inspect"),
        &parsed_sources,
        INSPECT_ROUTE,
        source_hash,
        Vec::new(),
        payload,
    );

    let _ = READ_PDF_ROUTE;
    Ok(CallToolResult::structured(structured))
}