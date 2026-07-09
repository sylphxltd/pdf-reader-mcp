use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct PdfSource {
    #[schemars(description = "Path to the local PDF file (absolute or relative to cwd).")]
    pub path: Option<String>,
    #[schemars(description = "URL of the PDF file.")]
    pub url: Option<String>,
    #[schemars(description = "Optional page list or range string.")]
    pub pages: Option<serde_json::Value>,
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

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema)]
pub struct SearchPdfArgs {
    pub sources: Vec<PdfSource>,
    #[schemars(description = "Literal text query to search for in extracted PDF text.")]
    pub query: String,
    #[schemars(description = "Use case-sensitive literal matching.")]
    pub case_sensitive: Option<bool>,
    #[schemars(description = "Match only whole words using ASCII word boundaries.")]
    pub whole_word: Option<bool>,
    #[schemars(description = "Also search a configured local OCR text layer for selected pages.")]
    pub include_ocr_text_layer: Option<bool>,
    #[schemars(description = "Maximum pages to search per source.")]
    pub max_pages: Option<u32>,
    #[schemars(description = "Maximum matches returned per source.")]
    pub max_matches_per_source: Option<u32>,
    #[schemars(description = "Context characters to include around each match.")]
    pub context_chars: Option<u32>,
    #[schemars(
        description = "Prefer the Rust literal text-index route for local files. Defaults to false so search_pdf keeps page + bounding-box evidence from pdfjs."
    )]
    pub prefer_speed: Option<bool>,
}

