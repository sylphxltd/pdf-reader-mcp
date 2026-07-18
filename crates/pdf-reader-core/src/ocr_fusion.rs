//! Provider-neutral OCR text-layer fusion for `read_pdf`.
//!
//! Provider configuration and execution remain in the MCP server. This module
//! owns only deterministic response semantics so every transport observes the
//! same source-ordinal result.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::read_pdf::ReadPdfResponse;

pub const OCR_STUB_WARNING: &str = "include_ocr_text_layer: provider execution is owned by pdf-reader-mcp-server; pdf-reader-core omits ocr_text_layer until a normalized provider outcome is fused.";
pub const OCR_STRUCTURED_FUSION_GAP_WARNING: &str = "OCR text is available as a parallel text layer, but OCR word boxes are not yet fused into tables or document_ast on the pure-Rust path.";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrWord {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct OcrPage {
    pub page: u32,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<OcrWord>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub provider: String,
    pub source_render_evidence_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_render_scale: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_render_width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_render_height: Option<u32>,
    pub provenance: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SourceOcrOutcome {
    pub source_index: usize,
    pub pages: Vec<OcrPage>,
    pub warnings: Vec<String>,
    pub error: Option<String>,
}

fn utf16_len(value: &str) -> usize {
    value.encode_utf16().count()
}

fn round_ratio(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn append_unique_warning(warnings: &mut Option<Vec<String>>, warning: String) {
    let values = warnings.get_or_insert_with(Vec::new);
    if !values.contains(&warning) {
        values.push(warning);
    }
}

fn remove_stub_warning(warnings: &mut Option<Vec<String>>) {
    if let Some(values) = warnings {
        values.retain(|warning| warning != OCR_STUB_WARNING);
        if values.is_empty() {
            *warnings = None;
        }
    }
}

fn fuse_document_map(map: &mut Value, candidate_pages: &[u32], pages: &[OcrPage]) {
    let Some(object) = map.as_object_mut() else {
        return;
    };
    if !pages.is_empty() {
        let layers = object
            .entry("layers")
            .or_insert_with(|| json!([]))
            .as_array_mut();
        if let Some(layers) = layers {
            let layer = json!("ocr_text_layer");
            if !layers.contains(&layer) {
                layers.push(layer);
            }
        }
    }

    if let Some(map_pages) = object.get_mut("pages").and_then(Value::as_array_mut) {
        for map_page in map_pages {
            let Some(page_number) = map_page.get("page").and_then(Value::as_u64) else {
                continue;
            };
            let Some(ocr_page) = pages
                .iter()
                .find(|page| u64::from(page.page) == page_number)
            else {
                continue;
            };
            let Some(page_object) = map_page.as_object_mut() else {
                continue;
            };
            page_object.insert("ocr_text_chars".into(), json!(utf16_len(&ocr_page.text)));
            page_object.insert(
                "ocr_word_count".into(),
                json!(ocr_page.words.as_ref().map_or(0, Vec::len)),
            );
            page_object.insert(
                "ocr_source_render_evidence_id".into(),
                json!(ocr_page.source_render_evidence_id),
            );
            if let Some(confidence) = ocr_page.confidence {
                page_object.insert("ocr_confidence".into(), json!(confidence));
            }
        }
    }

    let routing = object.entry("routing").or_insert_with(|| json!({}));
    if let Some(routing) = routing.as_object_mut() {
        routing.insert("needs_ocr_pages".into(), json!(candidate_pages));
        routing.insert(
            "ocr_applied_pages".into(),
            json!(pages.iter().map(|page| page.page).collect::<Vec<_>>()),
        );
    }
    let summary = object.entry("summary").or_insert_with(|| json!({}));
    if let Some(summary) = summary.as_object_mut() {
        summary.insert("ocr_page_count".into(), json!(pages.len()));
        summary.insert(
            "ocr_text_chars".into(),
            json!(pages
                .iter()
                .map(|page| utf16_len(&page.text))
                .sum::<usize>()),
        );
    }
}

/// Fuse normalized provider outcomes into their matching read results.
///
/// Source identity is ordinal by design: duplicate source labels are valid.
pub fn fuse_ocr_outcomes(response: &mut ReadPdfResponse, outcomes: Vec<SourceOcrOutcome>) {
    for outcome in outcomes {
        let Some(result) = response.results.get_mut(outcome.source_index) else {
            continue;
        };
        let Some(data) = result.data.as_mut().filter(|_| result.success) else {
            continue;
        };
        remove_stub_warning(&mut data.warnings);
        data.ocr_text_layer = None;

        if let Some(error) = outcome.error {
            if let Some(map) = data.document_map.as_mut() {
                fuse_document_map(map, &data.ocr_candidate_pages, &[]);
            }
            append_unique_warning(
                &mut data.warnings,
                format!("OCR text layer unavailable: {error}"),
            );
            continue;
        }
        if outcome.pages.is_empty() {
            if let Some(map) = data.document_map.as_mut() {
                fuse_document_map(map, &data.ocr_candidate_pages, &[]);
            }
            continue;
        }

        let page_warnings = outcome
            .pages
            .iter()
            .flat_map(|page| page.warnings.clone().unwrap_or_default())
            .collect::<Vec<_>>();
        let mut layer_warnings = outcome.warnings.clone();
        layer_warnings.extend(page_warnings);
        let confidences = outcome
            .pages
            .iter()
            .filter_map(|page| page.confidence)
            .collect::<Vec<_>>();
        let average_confidence = (!confidences.is_empty())
            .then(|| round_ratio(confidences.iter().sum::<f64>() / confidences.len() as f64));
        let source_render_count = outcome
            .pages
            .iter()
            .map(|page| page.source_render_evidence_id.as_str())
            .collect::<std::collections::HashSet<_>>()
            .len();
        let mut summary = json!({
            "page_count": outcome.pages.len(),
            "text_chars": outcome.pages.iter().map(|page| utf16_len(&page.text)).sum::<usize>(),
            "word_count": outcome.pages.iter().map(|page| page.words.as_ref().map_or(0, Vec::len)).sum::<usize>(),
            "words_with_bounding_boxes": outcome.pages.iter().flat_map(|page| page.words.as_deref().unwrap_or_default()).filter(|word| word.bounding_box.is_some()).count(),
            "source_render_count": source_render_count,
        });
        if let Some(confidence) = average_confidence {
            summary["average_confidence"] = json!(confidence);
        }
        let mut layer = json!({
            "profile": "ocr_text_layer",
            "pages": outcome.pages,
            "summary": summary,
        });
        if !layer_warnings.is_empty() {
            layer["warnings"] = json!(layer_warnings);
        }
        data.ocr_text_layer = Some(layer);
        for warning in outcome.warnings {
            append_unique_warning(&mut data.warnings, warning);
        }

        if let Some(map) = data.document_map.as_mut() {
            fuse_document_map(map, &data.ocr_candidate_pages, &outcome.pages);
        }
        if data.tables.is_some() || data.document_ast.is_some() {
            append_unique_warning(
                &mut data.warnings,
                OCR_STRUCTURED_FUSION_GAP_WARNING.to_string(),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::read_pdf::{EngineInfo, ReadPdfData, ReadPdfSourceResult};

    fn response() -> ReadPdfResponse {
        ReadPdfResponse {
            profile: "agent_document_twin",
            results: vec![ReadPdfSourceResult {
                source: "duplicate.pdf".into(),
                success: true,
                error: None,
                data: Some(ReadPdfData {
                    num_pages: None,
                    info: None,
                    metadata: None,
                    full_text: Some("selectable".into()),
                    page_texts: None,
                    markdown: None,
                    html: None,
                    chunks: None,
                    elements: None,
                    text_layer: None,
                    tables: None,
                    images: None,
                    safety_findings: None,
                    layout_diagnostics: None,
                    document_map: Some(json!({"layers":[],"pages":[{"page":2}],"routing":{}})),
                    document_ast: None,
                    trust_report: None,
                    accessibility_report: None,
                    outline: None,
                    annotations: None,
                    form_fields: None,
                    attachments: None,
                    structure_trees: None,
                    page_labels: None,
                    page_geometry: None,
                    permissions: None,
                    ocr_text_layer: None,
                    visual_enrichments: None,
                    visual_enrichment_candidates: None,
                    warnings: Some(vec![OCR_STUB_WARNING.into()]),
                    route: "test".into(),
                    engine: EngineInfo {
                        name: "test",
                        version: "test",
                    },
                    ocr_candidate_pages: vec![2],
                }),
            }],
        }
    }

    #[test]
    fn fuses_by_ordinal_and_preserves_selectable_text() {
        let mut response = response();
        fuse_ocr_outcomes(
            &mut response,
            vec![SourceOcrOutcome {
                source_index: 0,
                pages: vec![OcrPage {
                    page: 2,
                    text: "A😀".into(),
                    confidence: Some(0.914),
                    words: Some(vec![OcrWord {
                        text: "A".into(),
                        confidence: Some(0.9),
                        bounding_box: Some(json!({"left":1,"bottom":2,"right":3,"top":4})),
                    }]),
                    language: None,
                    provider: "command".into(),
                    source_render_evidence_id: "render-2".into(),
                    source_render_scale: Some(2.0),
                    source_render_width: Some(100),
                    source_render_height: Some(200),
                    provenance: json!({"engine":"external-command","source":"ocr-provider"}),
                    warnings: None,
                }],
                warnings: vec!["render warning".into()],
                error: None,
            }],
        );
        let data = response.results[0].data.as_ref().unwrap();
        assert_eq!(data.full_text.as_deref(), Some("selectable"));
        assert_eq!(
            data.ocr_text_layer.as_ref().unwrap()["profile"],
            "ocr_text_layer"
        );
        assert_eq!(
            data.ocr_text_layer.as_ref().unwrap()["summary"]["text_chars"],
            3
        );
        assert_eq!(
            data.document_map.as_ref().unwrap()["routing"]["ocr_applied_pages"],
            json!([2])
        );
        assert!(!data
            .warnings
            .as_ref()
            .unwrap()
            .iter()
            .any(|warning| warning == OCR_STUB_WARNING));
    }

    #[test]
    fn provider_failure_omits_layer_and_keeps_source_successful() {
        let mut response = response();
        fuse_ocr_outcomes(
            &mut response,
            vec![SourceOcrOutcome {
                source_index: 0,
                pages: Vec::new(),
                warnings: Vec::new(),
                error: Some("provider failed".into()),
            }],
        );
        let result = &response.results[0];
        assert!(result.success);
        let data = result.data.as_ref().unwrap();
        assert!(data.ocr_text_layer.is_none());
        assert_eq!(
            data.warnings.as_ref().unwrap(),
            &["OCR text layer unavailable: provider failed"]
        );
        let map = data.document_map.as_ref().unwrap();
        assert_eq!(map["routing"]["needs_ocr_pages"], json!([2]));
        assert_eq!(map["routing"]["ocr_applied_pages"], json!([]));
        assert!(!map["layers"]
            .as_array()
            .unwrap()
            .contains(&json!("ocr_text_layer")));
    }

    #[test]
    fn repeated_fusion_replaces_layer_without_duplicate_map_or_warning_entries() {
        let mut response = response();
        let outcome = SourceOcrOutcome {
            source_index: 0,
            pages: vec![OcrPage {
                page: 2,
                text: "replacement".into(),
                confidence: None,
                words: None,
                language: None,
                provider: "command".into(),
                source_render_evidence_id: "render-2".into(),
                source_render_scale: None,
                source_render_width: None,
                source_render_height: None,
                provenance: json!({"engine":"external-command","source":"ocr-provider"}),
                warnings: None,
            }],
            warnings: vec!["render warning".into()],
            error: None,
        };
        fuse_ocr_outcomes(&mut response, vec![outcome.clone()]);
        fuse_ocr_outcomes(&mut response, vec![outcome]);
        let data = response.results[0].data.as_ref().unwrap();
        assert_eq!(
            data.document_map.as_ref().unwrap()["layers"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|layer| **layer == "ocr_text_layer")
                .count(),
            1
        );
        assert_eq!(
            data.warnings
                .as_ref()
                .unwrap()
                .iter()
                .filter(|warning| warning.as_str() == "render warning")
                .count(),
            1
        );
    }

    #[test]
    fn structured_outputs_remain_unchanged_and_gap_is_explicit() {
        let mut response = response();
        let data = response.results[0].data.as_mut().unwrap();
        data.tables = Some(json!([{"id":"selectable-table"}]));
        data.document_ast = Some(json!({"root":{"id":"selectable-root"}}));
        let tables_before = data.tables.clone();
        let ast_before = data.document_ast.clone();
        fuse_ocr_outcomes(
            &mut response,
            vec![SourceOcrOutcome {
                source_index: 0,
                pages: vec![OcrPage {
                    page: 2,
                    text: "OCR".into(),
                    confidence: None,
                    words: Some(vec![OcrWord {
                        text: "cell".into(),
                        confidence: None,
                        bounding_box: Some(json!({"left":1,"bottom":1,"right":2,"top":2})),
                    }]),
                    language: None,
                    provider: "command".into(),
                    source_render_evidence_id: "render-2".into(),
                    source_render_scale: Some(2.0),
                    source_render_width: Some(100),
                    source_render_height: Some(100),
                    provenance: json!({"engine":"external-command","source":"ocr-provider"}),
                    warnings: None,
                }],
                warnings: Vec::new(),
                error: None,
            }],
        );
        let data = response.results[0].data.as_ref().unwrap();
        assert_eq!(data.tables, tables_before);
        assert_eq!(data.document_ast, ast_before);
        assert!(data
            .warnings
            .as_ref()
            .unwrap()
            .contains(&OCR_STRUCTURED_FUSION_GAP_WARNING.to_string()));
    }
}
