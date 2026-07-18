use pdf_reader_core::{
    fuse_ocr_outcomes, hash_file, read_pdf_from_value, ReadPdfErrorCode, ReadPdfResponse,
    ReadPdfSourceResult, READ_PDF_ROUTE,
};
use rmcp::model::{CallToolResult, Content};
use serde_json::{json, Value};

use crate::evidence::attach_evidence;
use crate::ocr_evidence::{run_read_ocr, ReadOcrOptions};
use crate::schema::PdfSource;
use crate::visual_evidence::{materialize_read_source, MaterializedSource};

const DEFAULT_MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;

pub fn read_pdf(args: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let ocr_requested = args.get("include_ocr_text_layer").and_then(Value::as_bool) == Some(true);
    let sources = args
        .get("sources")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let parsed_sources: Vec<PdfSource> = sources
        .iter()
        .enumerate()
        .map(|(source_index, source)| {
            serde_json::from_value(source.clone()).map_err(|error| {
                rmcp::ErrorData::invalid_params(
                    format!("Invalid sources[{source_index}]: {error}"),
                    None,
                )
            })
        })
        .collect::<Result<_, _>>()?;
    if parsed_sources.is_empty() {
        return Err(rmcp::ErrorData::invalid_params(
            "sources must include at least one PDF source.",
            None,
        ));
    }

    for source in &parsed_sources {
        if let Err(message) = source.validate() {
            return Err(rmcp::ErrorData::invalid_params(message, None));
        }
    }

    let mut materialized: Vec<Option<MaterializedSource>> =
        (0..parsed_sources.len()).map(|_| None).collect();
    let mut results = Vec::with_capacity(parsed_sources.len());
    for (source_index, source) in parsed_sources.iter().enumerate() {
        let original_label = source.label();
        let owner = match materialize_read_source(source_index, source) {
            Ok(owner) => owner,
            Err(error) => {
                results.push(ReadPdfSourceResult {
                    source: original_label,
                    success: false,
                    error: Some(error),
                    data: None,
                });
                continue;
            }
        };
        let mut source_args = args.clone();
        source_args["sources"] = json!([{
            "path": owner.path().to_string_lossy(),
            "pages": sources[source_index].get("pages").cloned().unwrap_or(Value::Null),
        }]);
        match read_pdf_from_value(&source_args) {
            Ok(mut response) => {
                let mut result = response.results.remove(0);
                result.source = original_label;
                results.push(result);
                materialized[source_index] = Some(owner);
            }
            Err(error) if error.code == ReadPdfErrorCode::InvalidParams => {
                return Err(rmcp::ErrorData::invalid_params(error.message, None));
            }
            Err(error) => {
                results.push(ReadPdfSourceResult {
                    source: original_label,
                    success: false,
                    error: Some(error.message),
                    data: None,
                });
            }
        }
    }
    if results.iter().all(|result| !result.success) {
        let errors = results
            .iter()
            .filter_map(|result| result.error.as_deref())
            .collect::<Vec<_>>()
            .join("; ");
        return Err(rmcp::ErrorData::invalid_request(
            format!("All PDF sources failed to process: {errors}"),
            None,
        ));
    }

    let mut payload = ReadPdfResponse {
        profile: "pdf_read_results",
        results,
    };
    let ocr_sources = payload
        .results
        .iter()
        .enumerate()
        .filter_map(|(source_index, result)| {
            let pages = result.data.as_ref()?.ocr_candidate_pages.clone();
            (!pages.is_empty()).then(|| {
                materialized[source_index]
                    .as_ref()
                    .map(|source| (source, pages))
            })?
        })
        .collect::<Vec<_>>();
    let mut outcomes = if ocr_sources.is_empty() {
        Vec::new()
    } else {
        run_read_ocr(&ocr_sources, ReadOcrOptions::default())
    };
    if ocr_requested {
        outcomes.extend(
            payload
                .results
                .iter()
                .enumerate()
                .filter(|(_, result)| {
                    result
                        .data
                        .as_ref()
                        .is_some_and(|data| data.ocr_candidate_pages.is_empty())
                })
                .map(|(source_index, _)| pdf_reader_core::SourceOcrOutcome {
                    source_index,
                    pages: Vec::new(),
                    warnings: Vec::new(),
                    error: None,
                }),
        );
    }
    fuse_ocr_outcomes(&mut payload, outcomes);

    let source_hash = materialized
        .first()
        .and_then(Option::as_ref)
        .and_then(|source| hash_file(source.path(), DEFAULT_MAX_FILE_BYTES).ok())
        .map(|hash| hash.source_hash);

    let has_provider_ocr = payload.results.iter().any(|result| {
        result
            .data
            .as_ref()
            .and_then(|data| data.ocr_text_layer.as_ref())
            .is_some()
    });
    let mut structured = attach_evidence(
        "read_pdf",
        None,
        &parsed_sources,
        READ_PDF_ROUTE,
        source_hash,
        Vec::new(),
        serde_json::to_value(&payload).map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to serialize read_pdf: {error}"), None)
        })?,
    );
    if has_provider_ocr {
        structured["evidence"]["confidence"] = json!("provider-dependent");
    }

    let mut result = CallToolResult::structured(structured);
    append_ocr_content(&mut result, &payload);
    Ok(result)
}

fn append_ocr_content(result: &mut CallToolResult, payload: &ReadPdfResponse) {
    for source in &payload.results {
        let Some(pages) = source
            .data
            .as_ref()
            .and_then(|data| data.ocr_text_layer.as_ref())
            .and_then(|layer| layer.get("pages"))
            .and_then(Value::as_array)
        else {
            continue;
        };
        for page in pages {
            let Some(text) = page.get("text").and_then(Value::as_str) else {
                continue;
            };
            if text.is_empty() {
                continue;
            }
            let page_number = page.get("page").and_then(Value::as_u64).unwrap_or(0);
            result
                .content
                .push(Content::text(format!("[Page {page_number} OCR]\n{text}")));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn appends_nonempty_ocr_pages_after_existing_content() {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        let mut payload = read_pdf_from_value(&json!({
            "sources": [{"path": fixture}],
            "include_ocr_text_layer": true
        }))
        .expect("read fixture");
        payload.results[0]
            .data
            .as_mut()
            .expect("read data")
            .ocr_text_layer = Some(json!({
            "profile": "ocr_text_layer",
            "pages": [
                {"page": 2, "text": "scanned text"},
                {"page": 3, "text": ""}
            ]
        }));
        let mut result = CallToolResult::structured(json!({"profile":"pdf_read_results"}));
        result.content.push(Content::text("structured-json"));
        let existing_parts = result.content.len();

        append_ocr_content(&mut result, &payload);

        assert_eq!(result.content.len(), existing_parts + 1);
        let encoded = serde_json::to_value(result.content.last().expect("OCR content"))
            .expect("content json");
        assert_eq!(encoded["text"], "[Page 2 OCR]\nscanned text");
        assert!(result.structured_content.is_some());
    }

    #[test]
    fn malformed_source_is_rejected_instead_of_shifting_source_ordinals() {
        let error = read_pdf(json!({
            "sources": [
                {"path": 42},
                {"path": "later.pdf"}
            ],
            "include_ocr_text_layer": true
        }))
        .expect_err("malformed first source must fail validation");
        assert!(error.message.contains("sources[0]"));
    }

    #[test]
    fn empty_selected_page_set_does_not_claim_or_warn_about_provider_execution() {
        let fixture =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test/fixtures/sample.pdf");
        let result = read_pdf(json!({
            "sources": [{"path": fixture, "pages": [999]}],
            "auto": false,
            "include_document_map": true,
            "include_ocr_text_layer": true
        }))
        .expect("read with invalid selected page");
        let structured = result.structured_content.expect("structured result");
        let data = &structured["results"][0]["data"];
        assert!(data.get("ocr_text_layer").is_none());
        assert_eq!(
            data["document_map"]["routing"]["needs_ocr_pages"],
            json!([])
        );
        assert_eq!(
            data["document_map"]["routing"]["ocr_applied_pages"],
            json!([])
        );
        assert_eq!(data["document_map"]["summary"]["ocr_page_count"], 0);
        assert_eq!(data["document_map"]["summary"]["ocr_text_chars"], 0);
        let warnings = data["warnings"].as_array().expect("warnings");
        assert!(warnings.iter().any(|warning| warning
            .as_str()
            .is_some_and(|warning| warning.contains("exceed document page count"))));
        assert!(!warnings.iter().any(|warning| warning
            .as_str()
            .is_some_and(|warning| warning.contains("provider"))));
    }
}
