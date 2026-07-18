use pdf_reader_core::text_index::extract_page_texts;
use pdf_reader_core::url_fetch::{cleanup_temp_file, fetch_url_to_temp_file};
use pdf_reader_core::{hash_file, ENGINE_NAME, ENGINE_VERSION};
use rmcp::model::CallToolResult;
use serde_json::{json, Value};
use std::path::PathBuf;

use crate::evidence::attach_evidence;
use crate::ocr_evidence;
use crate::schema::PdfSource;
use crate::visual_evidence;

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
const INSPECT_ROUTE: &str = "rust-pdf-inspect-v1";

pub fn pdf_evidence(args: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let operation = args
        .get("operation")
        .and_then(Value::as_str)
        .ok_or_else(|| rmcp::ErrorData::invalid_params("operation is required", None))?;

    match operation {
        "inspect" => inspect(args),
        "render_page" => visual_evidence::render_pages(args),
        "extract_regions" => visual_evidence::extract_regions(args),
        "ocr_pages" => ocr_evidence::ocr_pages(args),
        "analyze_regions" => {
            // Pure-Rust v1: return structured, non-crashing guidance rather than silent no-op.
            // inspect covers the default agent routing path; visual ops need providers/native render.
            Err(rmcp::ErrorData::invalid_request(
                format!(
                    "pdf_evidence operation '{operation}' is not available in the pure-Rust engine yet. \
                     Use operation=inspect, render_page, or extract_regions, or use read_pdf for text extraction."
                ),
                None,
            ))
        }
        other => Err(rmcp::ErrorData::invalid_params(
            format!("Unsupported pdf_evidence operation: {other}"),
            None,
        )),
    }
}

fn inspect(args: Value) -> Result<CallToolResult, rmcp::ErrorData> {
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
    let mut temps = Vec::new();
    for source in &parsed_sources {
        let path_owned: PathBuf = if let Some(path) = source.path.as_ref() {
            PathBuf::from(path)
        } else if let Some(url) = source.url.as_ref() {
            match fetch_url_to_temp_file(url) {
                Ok(temp) => {
                    temps.push(temp.clone());
                    temp
                }
                Err(message) => {
                    results.push(json!({
                        "source": source.label(),
                        "success": false,
                        "error": message,
                    }));
                    continue;
                }
            }
        } else {
            results.push(json!({
                "source": source.label(),
                "success": false,
                "error": "Provide exactly one of path or url for each PDF source.",
            }));
            continue;
        };

        match extract_page_texts(path_owned.as_path(), DEFAULT_MAX_FILE_BYTES) {
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
                            "read_pdf_arguments": {
                                "include_full_text": true,
                                "include_markdown": true,
                                "include_document_map": true,
                            }
                        },
                        "route": INSPECT_ROUTE,
                        "engine": {
                            "name": ENGINE_NAME,
                            "version": ENGINE_VERSION,
                        },
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

    for temp in temps {
        cleanup_temp_file(temp.as_path());
    }

    let source_hash = parsed_sources
        .iter()
        .find_map(|source| source.path.as_ref())
        .and_then(|path| hash_file(PathBuf::from(path).as_path(), DEFAULT_MAX_FILE_BYTES).ok())
        .map(|hash| hash.source_hash);

    let structured = attach_evidence(
        "pdf_evidence",
        Some("inspect"),
        &parsed_sources,
        INSPECT_ROUTE,
        source_hash,
        Vec::new(),
        json!({ "results": results }),
    );

    Ok(CallToolResult::structured(structured))
}
