use chrono::Utc;
use serde::Serialize;
use serde_json::{json, Value};

use crate::schema::PdfSource;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfToolEvidence {
    pub subject: String,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_hash: Option<String>,
    pub freshness: Freshness,
    pub locator: Locator,
    pub route: Route,
    pub confidence: &'static str,
    pub warnings: Vec<String>,
    pub next_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Freshness {
    pub indexed_at: String,
    pub stale: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Locator {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    pub extraction: String,
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation: Option<String>,
}

pub fn primary_source_label(sources: &[PdfSource]) -> String {
    sources
        .first()
        .and_then(|source| source.path.clone().or_else(|| source.url.clone()))
        .unwrap_or_else(|| "unknown".into())
}

pub fn attach_evidence(
    tool: &str,
    operation: Option<&str>,
    sources: &[PdfSource],
    route: &str,
    source_hash: Option<String>,
    warnings: Vec<String>,
    payload: Value,
) -> Value {
    let source = primary_source_label(sources);
    let first = sources.first();
    let evidence = PdfToolEvidence {
        subject: source.clone(),
        source: source.clone(),
        source_hash,
        freshness: Freshness {
            indexed_at: Utc::now().to_rfc3339(),
            stale: false,
        },
        locator: Locator {
            path: first.and_then(|s| s.path.clone()),
            url: first.and_then(|s| s.url.clone()),
            tool: tool.into(),
            operation: operation.map(str::to_string),
        },
        route: Route {
            extraction: route.into(),
            tool: tool.into(),
            operation: operation.map(str::to_string),
        },
        confidence: "deterministic",
        warnings,
        next_actions: vec![
            "Use search_pdf for literal retrieval with page and bbox locators".into(),
            "Use pdf_evidence for inspect, render, crop, OCR, or visual-region follow-up".into(),
        ],
    };

    let mut object = match payload {
        Value::Object(map) => map,
        other => {
            let mut map = serde_json::Map::new();
            map.insert("payload".into(), other);
            map
        }
    };

    object.insert(
        "evidence".into(),
        serde_json::to_value(evidence).unwrap_or(json!({})),
    );
    Value::Object(object)
}