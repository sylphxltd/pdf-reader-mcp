//! Typed MCP tool argument schemas (schemars → tools/list inputSchema).

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct PdfSource {
    #[schemars(description = "Path to the local PDF file (absolute or relative to cwd).")]
    pub path: Option<String>,
    #[schemars(description = "URL of the PDF file.")]
    pub url: Option<String>,
    #[schemars(description = "Optional page list or range string (e.g. \"1-3\" or [1,2]).")]
    pub pages: Option<Value>,
}

impl PdfSource {
    pub fn validate(&self) -> Result<(), String> {
        let has_path = self.path.as_ref().is_some_and(|value| !value.is_empty());
        let has_url = self.url.as_ref().is_some_and(|value| !value.is_empty());
        match (has_path, has_url) {
            (true, false) | (false, true) => Ok(()),
            (false, false) => Err("Provide exactly one of path or url for each PDF source.".into()),
            (true, true) => Err("Provide exactly one of path or url for each PDF source.".into()),
        }
    }

    pub fn label(&self) -> String {
        self.path
            .clone()
            .or_else(|| self.url.clone())
            .unwrap_or_else(|| "unknown".into())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, Default)]
pub struct ReadPdfArgs {
    pub sources: Vec<PdfSource>,
    #[schemars(
        description = "Automatically choose high-value extraction options. Defaults to true only when no explicit include_* options are supplied."
    )]
    pub auto: Option<bool>,
    #[schemars(description = "Automatic extraction depth: fast | balanced | full.")]
    pub auto_detail: Option<String>,
    #[schemars(description = "Max pages to sample when auto inspection is enabled (1-20).")]
    pub sample_pages: Option<u32>,
    pub include_full_text: Option<bool>,
    pub include_metadata: Option<bool>,
    pub include_page_count: Option<bool>,
    pub include_images: Option<bool>,
    pub include_tables: Option<bool>,
    pub include_elements: Option<bool>,
    pub include_semantic_hints: Option<bool>,
    pub include_markdown: Option<bool>,
    pub include_html: Option<bool>,
    pub include_chunks: Option<bool>,
    pub include_text_layer: Option<bool>,
    pub include_ocr_text_layer: Option<bool>,
    pub include_outline: Option<bool>,
    pub include_annotations: Option<bool>,
    pub include_page_labels: Option<bool>,
    pub include_page_geometry: Option<bool>,
    pub include_permissions: Option<bool>,
    pub include_form_fields: Option<bool>,
    pub include_attachments: Option<bool>,
    pub include_structure_tree: Option<bool>,
    pub include_safety_findings: Option<bool>,
    pub include_layout_diagnostics: Option<bool>,
    pub include_document_map: Option<bool>,
    pub include_document_ast: Option<bool>,
    pub include_visual_enrichments: Option<bool>,
    pub max_visual_enrichments: Option<u32>,
    pub include_trust_report: Option<bool>,
    pub trust_report_redaction: Option<String>,
    pub include_accessibility_report: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct SearchPdfArgs {
    pub sources: Vec<PdfSource>,
    #[schemars(description = "Literal text query to search for in extracted PDF text.")]
    pub query: String,
    #[schemars(description = "Use case-sensitive literal matching.")]
    pub case_sensitive: Option<bool>,
    #[schemars(description = "Match only whole words using ASCII word boundaries.")]
    pub whole_word: Option<bool>,
    #[schemars(
        description = "Also search a configured local OCR text layer. Fail-closed on pure-Rust without a provider."
    )]
    pub include_ocr_text_layer: Option<bool>,
    #[schemars(description = "Maximum pages to search per source (1-1000).")]
    pub max_pages: Option<u32>,
    #[schemars(description = "Maximum matches returned per source (1-500).")]
    pub max_matches_per_source: Option<u32>,
    #[schemars(description = "Context characters around each match (0-1000).")]
    pub context_chars: Option<u32>,
    #[schemars(
        description = "Prefer speed-oriented text-index route. Pure-Rust always uses the text index."
    )]
    pub prefer_speed: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct PdfEvidenceRegion {
    pub id: Option<String>,
    pub page: Option<u32>,
    pub bounding_box: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct PdfEvidenceSource {
    pub path: Option<String>,
    pub url: Option<String>,
    pub pages: Option<Value>,
    pub regions: Option<Vec<PdfEvidenceRegion>>,
}

impl PdfEvidenceSource {
    pub fn validate(&self) -> Result<(), String> {
        let has_path = self.path.as_ref().is_some_and(|value| !value.is_empty());
        let has_url = self.url.as_ref().is_some_and(|value| !value.is_empty());
        match (has_path, has_url) {
            (true, false) | (false, true) => Ok(()),
            (false, false) => {
                Err("Provide exactly one of path or url for each PDF evidence source.".into())
            }
            (true, true) => {
                Err("Provide exactly one of path or url for each PDF evidence source.".into())
            }
        }
    }

    pub fn label(&self) -> String {
        self.path
            .clone()
            .or_else(|| self.url.clone())
            .unwrap_or_else(|| "unknown".into())
    }

    pub fn as_pdf_source(&self) -> PdfSource {
        PdfSource {
            path: self.path.clone(),
            url: self.url.clone(),
            pages: self.pages.clone(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct PdfEvidenceArgs {
    #[schemars(
        description = "Evidence operation: inspect | render_page | extract_regions | ocr_pages | analyze_regions"
    )]
    pub operation: String,
    pub sources: Vec<PdfEvidenceSource>,
    pub sample_pages: Option<u32>,
    pub include_metadata: Option<bool>,
    pub scale: Option<f64>,
    pub max_pages: Option<u32>,
    pub max_regions: Option<u32>,
    pub max_pixels_per_page: Option<u64>,
    pub include_image: Option<bool>,
    pub timeout_ms: Option<u32>,
    pub max_output_chars: Option<u32>,
    pub languages: Option<Vec<String>>,
}
