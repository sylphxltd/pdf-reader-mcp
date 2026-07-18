//! Literal PDF text indexing and search for pdf-reader-mcp.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use pdf_extract::{
    decode_text_string, output_doc, ColorSpace, Document, MediaBox, Object, OutputDev, OutputError,
    Path as PdfPath, Transform,
};
use serde::{Deserialize, Serialize};

const MAX_EXTRACTED_TEXT_BYTES: usize = 2 * 1024 * 1024;
const MAX_GEOMETRY_CHARS: usize = 250_000;

pub const TEXT_INDEX_ROUTE: &str = "rust-text-index";

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct TextBoundingBox {
    pub left: f64,
    pub bottom: f64,
    pub right: f64,
    pub top: f64,
}

impl TextBoundingBox {
    fn from_character(trm: &Transform, width: f64, font_size: f64) -> Option<Self> {
        let values = [
            trm.m11, trm.m12, trm.m21, trm.m22, trm.m31, trm.m32, width, font_size,
        ];
        if !values.into_iter().all(f64::is_finite) {
            return None;
        }
        let x_advance = (trm.m11 * width * font_size).abs();
        let y_advance = (trm.m12 * width * font_size).abs();
        let glyph_width = x_advance.hypot(y_advance);
        let x_height = (trm.m21 * font_size).abs();
        let y_height = (trm.m22 * font_size).abs();
        let glyph_height = x_height.hypot(y_height);
        let right = trm.m31 + glyph_width.max(0.0);
        let top = trm.m32 + glyph_height.max(0.0);
        [right, top]
            .into_iter()
            .all(f64::is_finite)
            .then_some(Self {
                left: canonical_zero(trm.m31),
                bottom: canonical_zero(trm.m32),
                right: canonical_zero(right),
                top: canonical_zero(top),
            })
    }

    fn union(self, other: Self) -> Option<Self> {
        let union = Self {
            left: self.left.min(other.left),
            bottom: self.bottom.min(other.bottom),
            right: self.right.max(other.right),
            top: self.top.max(other.top),
        };
        let width = union.right - union.left;
        let height = union.top - union.bottom;
        [
            union.left,
            union.bottom,
            union.right,
            union.top,
            width,
            height,
        ]
        .into_iter()
        .all(f64::is_finite)
        .then_some(union)
    }

    fn estimated_utf16_range(self, text_len: u32, start: u32, end: u32) -> Option<Self> {
        let width = self.right - self.left;
        if text_len == 0 || end <= start || self.right <= self.left || !width.is_finite() {
            return None;
        }
        let start_ratio = f64::from(start.min(text_len)) / f64::from(text_len);
        let end_ratio = f64::from(end.min(text_len).max(start)) / f64::from(text_len);
        let estimated = Self {
            left: canonical_zero(self.left + width * start_ratio),
            bottom: self.bottom,
            right: canonical_zero(self.left + width * end_ratio),
            top: self.top,
        };
        [
            estimated.left,
            estimated.bottom,
            estimated.right,
            estimated.top,
        ]
        .into_iter()
        .all(f64::is_finite)
        .then_some(estimated)
    }
}

fn canonical_zero(value: f64) -> f64 {
    if value == 0.0 {
        0.0
    } else {
        value
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextCharacterGeometry {
    pub text: String,
    pub item_char_start: u32,
    pub item_char_end: u32,
    pub is_whitespace: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box: Option<TextBoundingBox>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PositionedTextItem {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box: Option<TextBoundingBox>,
    pub chars: Vec<TextCharacterGeometry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextSearchMatch {
    pub id: String,
    pub page: u32,
    pub text: String,
    pub snippet: String,
    pub match_start: u32,
    pub match_end: u32,
    pub text_item_index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box: Option<TextBoundingBox>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box_level: Option<String>,
    pub route: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExtractedPageText {
    pub text: String,
    pub items: Vec<String>,
    pub positioned_items: Vec<PositionedTextItem>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PdfInfo {
    pub format_version: String,
    pub fields: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ExtractedPdfText {
    pub pages: Vec<ExtractedPageText>,
    pub info: PdfInfo,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextSearchResult {
    pub num_pages: u32,
    pub searched_pages: Vec<u32>,
    pub total_matches: u32,
    pub matches: Vec<TextSearchMatch>,
    pub route: String,
    pub truncated: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_cache: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TextIndexErrorCode {
    InvalidParams,
    InvalidRequest,
    ExtractionFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextIndexError {
    pub code: TextIndexErrorCode,
    pub message: String,
}

impl From<crate::HashError> for TextIndexError {
    fn from(error: crate::HashError) -> Self {
        match error.code {
            crate::HashErrorCode::InvalidParams => Self::invalid_params(error.message),
            crate::HashErrorCode::InvalidRequest => Self::invalid_request(error.message),
        }
    }
}

impl TextIndexError {
    fn invalid_params(message: impl Into<String>) -> Self {
        Self {
            code: TextIndexErrorCode::InvalidParams,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: TextIndexErrorCode::InvalidRequest,
            message: message.into(),
        }
    }

    fn extraction_failed(message: impl Into<String>) -> Self {
        Self {
            code: TextIndexErrorCode::ExtractionFailed,
            message: message.into(),
        }
    }
}

fn validate_pdf_path(path: &Path, max_file_bytes: u64) -> Result<(), TextIndexError> {
    let meta = fs::metadata(path).map_err(|err| {
        TextIndexError::invalid_request(format!(
            "Unable to access file at '{}': {err}",
            path.display()
        ))
    })?;

    if !meta.is_file() {
        return Err(TextIndexError::invalid_request(format!(
            "Path '{}' is not a regular file.",
            path.display()
        )));
    }

    if meta.len() > max_file_bytes {
        return Err(TextIndexError::invalid_request(format!(
            "File exceeds maximum size of {} bytes.",
            max_file_bytes
        )));
    }

    Ok(())
}

#[derive(Default)]
struct TextItemOutput {
    pages: Vec<Vec<PositionedTextItem>>,
    current_item: Option<PositionedTextItem>,
    current_item_utf16_len: u32,
    current_item_geometry_valid: bool,
    text_bytes: usize,
    geometry_chars: usize,
}

impl TextItemOutput {
    fn finish_item(&mut self) {
        let Some(mut item) = self.current_item.take() else {
            return;
        };
        self.current_item_utf16_len = 0;
        if !self.current_item_geometry_valid {
            item.bounding_box = None;
            for character in &mut item.chars {
                character.bounding_box = None;
            }
        } else if let Some(item_box) = item.bounding_box {
            let text_len = item
                .text
                .encode_utf16()
                .count()
                .try_into()
                .unwrap_or(u32::MAX);
            for character in &mut item.chars {
                character.bounding_box = item_box.estimated_utf16_range(
                    text_len,
                    character.item_char_start,
                    character.item_char_end,
                );
            }
        }
        self.current_item_geometry_valid = false;
        if !item.text.is_empty() {
            if let Some(page) = self.pages.last_mut() {
                page.push(item);
            }
        }
    }
}

impl OutputDev for TextItemOutput {
    fn begin_page(
        &mut self,
        _page_num: u32,
        _media_box: &MediaBox,
        _art_box: Option<(f64, f64, f64, f64)>,
    ) -> Result<(), OutputError> {
        self.finish_item();
        self.pages.push(Vec::new());
        Ok(())
    }

    fn end_page(&mut self) -> Result<(), OutputError> {
        self.finish_item();
        Ok(())
    }

    fn output_character(
        &mut self,
        trm: &Transform,
        width: f64,
        _spacing: f64,
        font_size: f64,
        character: &str,
    ) -> Result<(), OutputError> {
        self.text_bytes = self.text_bytes.saturating_add(character.len());
        self.geometry_chars = self.geometry_chars.saturating_add(1);
        if self.text_bytes > MAX_EXTRACTED_TEXT_BYTES || self.geometry_chars > MAX_GEOMETRY_CHARS {
            return Err(OutputError::IoError(std::io::Error::other(
                "selectable text exceeds bounded extraction budget",
            )));
        }
        if let Some(item) = self.current_item.as_mut() {
            let start = self.current_item_utf16_len;
            item.text.push_str(character);
            let char_units = character
                .encode_utf16()
                .count()
                .try_into()
                .unwrap_or(u32::MAX);
            let end = start.saturating_add(char_units);
            self.current_item_utf16_len = end;
            let mut bounding_box = if self.current_item_geometry_valid {
                TextBoundingBox::from_character(trm, width, font_size)
            } else {
                None
            };
            if self.current_item_geometry_valid && bounding_box.is_none() {
                self.current_item_geometry_valid = false;
                item.bounding_box = None;
                for existing in &mut item.chars {
                    existing.bounding_box = None;
                }
            }
            if let Some(box_) = bounding_box {
                if let Some(current) = item.bounding_box {
                    if let Some(union) = current.union(box_) {
                        item.bounding_box = Some(union);
                    } else {
                        self.current_item_geometry_valid = false;
                        item.bounding_box = None;
                        for existing in &mut item.chars {
                            existing.bounding_box = None;
                        }
                        bounding_box = None;
                    }
                } else {
                    item.bounding_box = Some(box_);
                }
            }
            item.chars.push(TextCharacterGeometry {
                text: character.to_string(),
                item_char_start: start,
                item_char_end: end,
                is_whitespace: character.chars().all(char::is_whitespace),
                bounding_box,
            });
        }
        Ok(())
    }

    fn begin_word(&mut self) -> Result<(), OutputError> {
        // A TJ operator can emit several strings for one logical PDF.js text item.
        // Keep those fragments together until the text matrix advances to a new line.
        if self.current_item.is_none() {
            self.current_item = Some(PositionedTextItem {
                text: String::new(),
                bounding_box: None,
                chars: Vec::new(),
            });
            self.current_item_geometry_valid = true;
        }
        Ok(())
    }

    fn end_word(&mut self) -> Result<(), OutputError> {
        Ok(())
    }

    fn end_line(&mut self) -> Result<(), OutputError> {
        self.finish_item();
        Ok(())
    }

    fn stroke(
        &mut self,
        _ctm: &Transform,
        _colorspace: &ColorSpace,
        _color: &[f64],
        _path: &PdfPath,
    ) -> Result<(), OutputError> {
        Ok(())
    }

    fn fill(
        &mut self,
        _ctm: &Transform,
        _colorspace: &ColorSpace,
        _color: &[f64],
        _path: &PdfPath,
    ) -> Result<(), OutputError> {
        Ok(())
    }
}

pub(crate) fn read_pdf_info(doc: &Document) -> PdfInfo {
    let mut fields = BTreeMap::new();
    let info_object = doc
        .trailer
        .get(b"Info")
        .ok()
        .and_then(|object| match object {
            Object::Reference(id) => doc.get_object(*id).ok(),
            Object::Dictionary(_) => Some(object),
            _ => None,
        });
    if let Some(info) = info_object.and_then(|object| object.as_dict().ok()) {
        for key in [
            "Title",
            "Author",
            "Subject",
            "Keywords",
            "Creator",
            "Producer",
            "CreationDate",
            "ModDate",
            "Trapped",
        ] {
            if let Ok(value) = info.get(key.as_bytes()) {
                if let Ok(decoded) = decode_text_string(value) {
                    fields.insert(key.to_string(), decoded);
                }
            }
        }
    }
    PdfInfo {
        format_version: doc.version.clone(),
        fields,
    }
}

pub fn extract_pdf_text(
    path: &Path,
    max_file_bytes: u64,
) -> Result<ExtractedPdfText, TextIndexError> {
    validate_pdf_path(path, max_file_bytes)?;

    let mut doc = Document::load(path).map_err(|err| {
        TextIndexError::extraction_failed(format!("Failed to extract PDF text: {err}"))
    })?;
    if doc.is_encrypted() {
        doc.decrypt("").map_err(|err| {
            TextIndexError::extraction_failed(format!("Failed to extract PDF text: {err}"))
        })?;
    }
    extract_pdf_text_from_document(&doc)
}

pub(crate) fn extract_pdf_text_from_document(
    doc: &Document,
) -> Result<ExtractedPdfText, TextIndexError> {
    let info = read_pdf_info(doc);
    let mut output = TextItemOutput::default();
    output_doc(doc, &mut output).map_err(|err| {
        TextIndexError::extraction_failed(format!("Failed to extract PDF text: {err}"))
    })?;

    let pages = if output.pages.is_empty() {
        vec![ExtractedPageText {
            text: String::new(),
            items: Vec::new(),
            positioned_items: Vec::new(),
        }]
    } else {
        output
            .pages
            .into_iter()
            .map(|positioned_items| {
                let items = positioned_items
                    .iter()
                    .map(|item| item.text.clone())
                    .collect::<Vec<_>>();
                ExtractedPageText {
                    text: items.concat(),
                    items,
                    positioned_items,
                }
            })
            .collect()
    };

    Ok(ExtractedPdfText { pages, info })
}

pub fn extract_page_texts(path: &Path, max_file_bytes: u64) -> Result<Vec<String>, TextIndexError> {
    let extracted = extract_pdf_text(path, max_file_bytes)?;

    Ok(extracted.pages.into_iter().map(|page| page.text).collect())
}

#[allow(clippy::too_many_arguments)]
pub fn search_pdf_text(
    path: &Path,
    max_file_bytes: u64,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    max_pages: u32,
    max_matches: u32,
    context_chars: u32,
) -> Result<TextSearchResult, TextIndexError> {
    search_pdf_text_pages(
        path,
        max_file_bytes,
        query,
        case_sensitive,
        whole_word,
        None,
        max_pages,
        max_matches,
        context_chars,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn search_pdf_text_pages(
    path: &Path,
    max_file_bytes: u64,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    requested_pages: Option<&[u32]>,
    max_pages: u32,
    max_matches: u32,
    context_chars: u32,
) -> Result<TextSearchResult, TextIndexError> {
    if query.is_empty() {
        return Err(TextIndexError::invalid_params("query must not be empty."));
    }

    // TS 3.0.14 does not persist extracted document text beside the source.
    // Keep search side-effect free; a future cache needs an explicit private-root contract.
    let extracted = extract_pdf_text(path, max_file_bytes)?;
    let pages = extracted.pages;
    let page_cache = None;
    let num_pages = pages.len().max(1) as u32;
    let searched_pages: Vec<u32> = requested_pages
        .map(|requested| requested.to_vec())
        .unwrap_or_else(|| (1..=num_pages).collect())
        .into_iter()
        .filter(|page| *page <= num_pages)
        .take(max_pages.max(1) as usize)
        .collect();
    let mut matches = Vec::new();
    let mut truncated = false;

    for &page in &searched_pages {
        let page_index = (page - 1) as usize;
        let page_text = pages.get(page_index);
        for (text_item_index, item) in page_text
            .map(|page| page.positioned_items.iter())
            .into_iter()
            .flatten()
            .enumerate()
        {
            let text = &item.text;
            let remaining = max_matches.saturating_add(1) as usize - matches.len();
            let item_matches =
                find_matches_in_text_bounded(text, query, case_sensitive, whole_word, remaining);

            for (start, end) in item_matches {
                if matches.len() >= max_matches as usize {
                    truncated = true;
                    break;
                }

                let matched_text = text[start..end].to_string();
                let snippet = build_snippet(text, start, end, context_chars as usize);
                let start_utf16 = utf16_offset(text, start);
                let end_utf16 = utf16_offset(text, end);
                let (bounding_box, bounding_box_level) =
                    match_bounding_box(item, start_utf16, end_utf16);
                matches.push(TextSearchMatch {
                    id: format!("p{page}-match-{}", matches.len() + 1),
                    page,
                    text: matched_text,
                    snippet,
                    match_start: start_utf16,
                    match_end: end_utf16,
                    text_item_index: text_item_index as u32,
                    bounding_box,
                    bounding_box_level,
                    route: TEXT_INDEX_ROUTE.into(),
                });
            }

            if truncated {
                break;
            }
        }

        if truncated {
            break;
        }
    }

    Ok(TextSearchResult {
        num_pages,
        searched_pages,
        total_matches: matches.len() as u32,
        matches,
        route: TEXT_INDEX_ROUTE.into(),
        truncated,
        page_cache,
    })
}

fn match_bounding_box(
    item: &PositionedTextItem,
    start_utf16: u32,
    end_utf16: u32,
) -> (Option<TextBoundingBox>, Option<String>) {
    let char_box = item
        .chars
        .iter()
        .filter(|character| {
            !character.is_whitespace
                && character.item_char_start >= start_utf16
                && character.item_char_end <= end_utf16
        })
        .filter_map(|character| character.bounding_box)
        .try_fold(None::<TextBoundingBox>, |current, box_| match current {
            None => Some(Some(box_)),
            Some(current) => current.union(box_).map(Some),
        })
        .flatten();
    if let Some(box_) = char_box {
        (Some(box_), Some("char_estimated".to_string()))
    } else if let Some(box_) = item.bounding_box {
        (Some(box_), Some("text_item".to_string()))
    } else {
        (None, None)
    }
}

fn utf16_offset(text: &str, byte_offset: usize) -> u32 {
    text[..byte_offset.min(text.len())]
        .encode_utf16()
        .count()
        .try_into()
        .unwrap_or(u32::MAX)
}

fn is_word_char(value: Option<char>) -> bool {
    matches!(value, Some(ch) if ch.is_ascii_alphanumeric() || ch == '_')
}

fn is_whole_word_match(text: &str, start: usize, end: usize) -> bool {
    let before = text.get(..start).and_then(|s| s.chars().last());
    let after = text.get(end..).and_then(|s| s.chars().next());
    !is_word_char(before) && !is_word_char(after)
}

/// Case-insensitive matching that keeps original-string byte indices.
/// Avoids lowercasing the whole haystack (Unicode case folding can change length,
/// e.g. ﬁ → fi), which previously produced mid-codepoint slice panics.
#[cfg(test)]
fn find_matches_in_text(
    text: &str,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
) -> Vec<(usize, usize)> {
    find_matches_in_text_bounded(text, query, case_sensitive, whole_word, usize::MAX)
}

fn find_matches_in_text_bounded(
    text: &str,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    max_results: usize,
) -> Vec<(usize, usize)> {
    if query.is_empty() {
        return Vec::new();
    }

    let mut matches = Vec::new();
    if case_sensitive {
        let mut search_from = 0;
        while search_from + query.len() <= text.len() {
            let Some(rel) = text.get(search_from..).and_then(|slice| slice.find(query)) else {
                break;
            };
            let start = search_from + rel;
            let end = start + query.len();
            if text.is_char_boundary(start)
                && text.is_char_boundary(end)
                && (!whole_word || is_whole_word_match(text, start, end))
            {
                matches.push((start, end));
                if matches.len() >= max_results {
                    break;
                }
            }
            search_from = end.max(start + 1);
            while search_from < text.len() && !text.is_char_boundary(search_from) {
                search_from += 1;
            }
        }
        return matches;
    }

    // Expand query into its lowercase char sequence (may be multi-char per input char).
    let query_chars: Vec<char> = query.chars().flat_map(|c| c.to_lowercase()).collect();
    if query_chars.is_empty() {
        return matches;
    }
    let query_len = query_chars.len();
    let text_chars: Vec<(usize, char)> = text.char_indices().collect();

    // Precompute expanded lowercase stream with original char index ownership.
    // Each expanded lowercase char maps back to the source char index that produced it.
    let mut expanded: Vec<(usize, char)> = Vec::new();
    for (idx, ch) in &text_chars {
        for lower in ch.to_lowercase() {
            expanded.push((*idx, lower));
        }
    }
    if expanded.len() < query_len {
        return matches;
    }

    let mut i = 0;
    while i + query_len <= expanded.len() {
        if expanded[i..i + query_len]
            .iter()
            .zip(query_chars.iter())
            .all(|((_, hay), q)| hay == q)
        {
            let start_char_byte = expanded[i].0;
            // End is the first byte after the last source char that contributed to the match.
            let last_source_byte = expanded[i + query_len - 1].0;
            let end = text_chars
                .iter()
                .find(|(byte, _)| *byte == last_source_byte)
                .map(|(byte, ch)| byte + ch.len_utf8())
                .unwrap_or(text.len());
            if !whole_word || is_whole_word_match(text, start_char_byte, end) {
                matches.push((start_char_byte, end));
                if matches.len() >= max_results {
                    break;
                }
            }
            // Advance past this match in expanded space (at least one expanded char).
            i += query_len.max(1);
        } else {
            i += 1;
        }
    }

    matches
}

fn floor_char_boundary(text: &str, index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    let mut index = index;
    while index > 0 && !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn ceil_char_boundary(text: &str, index: usize) -> usize {
    if index >= text.len() {
        return text.len();
    }
    let mut index = index;
    while index < text.len() && !text.is_char_boundary(index) {
        index += 1;
    }
    index
}

fn build_snippet(text: &str, start: usize, end: usize, context_chars: usize) -> String {
    let start = floor_char_boundary(text, start.min(text.len()));
    let end = ceil_char_boundary(text, end.min(text.len()));
    // context_chars is a soft byte budget; clamp to char boundaries.
    let snippet_start = floor_char_boundary(text, start.saturating_sub(context_chars));
    let snippet_end = ceil_char_boundary(text, (end + context_chars).min(text.len()));
    let prefix = if snippet_start > 0 { "..." } else { "" };
    let suffix = if snippet_end < text.len() { "..." } else { "" };
    format!("{prefix}{}{suffix}", &text[snippet_start..snippet_end])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn two_blank_page_pdf() -> Vec<u8> {
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Resources << >> /Contents 5 0 R >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Resources << >> /Contents 6 0 R >>".to_string(),
            "<< /Length 0 >>\nstream\nendstream".to_string(),
            "<< /Length 0 >>\nstream\nendstream".to_string(),
        ];
        let mut pdf = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
        let mut offsets = Vec::with_capacity(objects.len());
        for (index, object) in objects.iter().enumerate() {
            offsets.push(pdf.len());
            pdf.extend_from_slice(format!("{} 0 obj\n{object}\nendobj\n", index + 1).as_bytes());
        }
        let xref_offset = pdf.len();
        pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
        pdf.extend_from_slice(b"0000000000 65535 f \n");
        for offset in offsets {
            pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }
        pdf.extend_from_slice(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
                objects.len() + 1
            )
            .as_bytes(),
        );
        pdf
    }

    fn positioned_text_pdf(text: &str) -> Vec<u8> {
        let content = format!("BT /F1 12 Tf 1 0 0 1 72 700 Tm ({text}) Tj ET");
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>".to_string(),
            format!("<< /Length {} >>\nstream\n{content}\nendstream", content.len()),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        ];
        let mut pdf = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
        let mut offsets = Vec::with_capacity(objects.len());
        for (index, object) in objects.iter().enumerate() {
            offsets.push(pdf.len());
            pdf.extend_from_slice(format!("{} 0 obj\n{object}\nendobj\n", index + 1).as_bytes());
        }
        let xref_offset = pdf.len();
        pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
        pdf.extend_from_slice(b"0000000000 65535 f \n");
        for offset in offsets {
            pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }
        pdf.extend_from_slice(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
                objects.len() + 1
            )
            .as_bytes(),
        );
        pdf
    }

    #[test]
    fn preserves_real_pdf_page_boundaries_including_blank_pages() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("two-pages.pdf");
        std::fs::write(&path, two_blank_page_pdf()).expect("write PDF");
        let pages = extract_page_texts(&path, 1_000_000).expect("extract pages");
        assert_eq!(pages, vec![String::new(), String::new()]);
    }

    #[test]
    fn captures_bounded_selectable_text_geometry_and_search_match_boxes() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("positioned.pdf");
        std::fs::write(&path, positioned_text_pdf("Alpha beta")).expect("write PDF");

        let extracted = extract_pdf_text(&path, 1_000_000).expect("extract geometry");
        let item = &extracted.pages[0].positioned_items[0];
        assert_eq!(item.text, "Alpha beta");
        assert_eq!(item.chars.len(), 10);
        assert_eq!(item.chars[0].item_char_start, 0);
        assert_eq!(item.chars[0].item_char_end, 1);
        assert!(item.bounding_box.is_some());
        assert!(item
            .chars
            .iter()
            .all(|character| character.bounding_box.is_some()));

        let result = search_pdf_text(&path, 1_000_000, "beta", true, false, 1, 5, 10)
            .expect("search geometry");
        assert_eq!(result.matches.len(), 1);
        assert_eq!(result.matches[0].match_start, 6);
        assert_eq!(result.matches[0].match_end, 10);
        assert_eq!(
            result.matches[0].bounding_box_level.as_deref(),
            Some("char_estimated")
        );
        let match_box = result.matches[0].bounding_box.expect("match box");
        let item_box = item.bounding_box.expect("item box");
        assert!(match_box.left > item_box.left);
        assert_eq!(match_box.right, item_box.right);
    }

    #[test]
    fn captures_geometry_for_behavior_fixture() {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-behavior-v1.pdf");
        let extracted = extract_pdf_text(&path, 1_000_000).expect("extract fixture");
        let needle_items = extracted
            .pages
            .iter()
            .flat_map(|page| &page.positioned_items)
            .filter(|item| item.text.to_lowercase().contains("needle"))
            .collect::<Vec<_>>();
        assert!(
            needle_items.iter().all(|item| item.bounding_box.is_some()),
            "needle items: {needle_items:?}"
        );
    }

    #[test]
    fn geometry_is_finite_utf16_aware_and_bounded() {
        let item_box = TextBoundingBox {
            left: 10.0,
            bottom: 20.0,
            right: 50.0,
            top: 30.0,
        };
        // A😀B has four JavaScript UTF-16 code units; the astral character owns two.
        let astral = item_box
            .estimated_utf16_range(4, 1, 3)
            .expect("astral range box");
        assert_eq!(astral.left, 20.0);
        assert_eq!(astral.right, 40.0);

        let nonfinite = Transform::row_major(1.0, 0.0, 0.0, 1.0, f64::NAN, 20.0);
        assert!(TextBoundingBox::from_character(&nonfinite, 1.0, 12.0).is_none());

        let mut output = TextItemOutput {
            text_bytes: MAX_EXTRACTED_TEXT_BYTES,
            ..TextItemOutput::default()
        };
        output.begin_word().expect("begin word");
        let error = output
            .output_character(&Transform::identity(), 1.0, 0.0, 12.0, "x")
            .expect_err("budget must fail closed");
        assert!(error.to_string().contains("bounded extraction budget"));
    }

    #[test]
    fn opposite_extreme_finite_coordinates_fail_item_geometry_closed() {
        let left = TextBoundingBox {
            left: -1.0e308,
            bottom: 0.0,
            right: -9.0e307,
            top: 12.0,
        };
        let right = TextBoundingBox {
            left: 9.0e307,
            bottom: 0.0,
            right: 1.0e308,
            top: 12.0,
        };
        assert!(left.union(right).is_none());
        assert!(TextBoundingBox {
            left: -1.0e308,
            bottom: 0.0,
            right: 1.0e308,
            top: 12.0,
        }
        .estimated_utf16_range(2, 0, 1)
        .is_none());

        let mut output = TextItemOutput {
            pages: vec![Vec::new()],
            ..TextItemOutput::default()
        };
        output.begin_word().expect("begin word");
        let left_transform = Transform::row_major(1.0, 0.0, 0.0, 1.0, -1.0e308, 10.0);
        let right_transform = Transform::row_major(1.0, 0.0, 0.0, 1.0, 1.0e308, 10.0);
        output
            .output_character(&left_transform, 1.0, 0.0, 12.0, "a")
            .expect("left character");
        output
            .output_character(&right_transform, 1.0, 0.0, 12.0, "b")
            .expect("right character");
        output.end_line().expect("end line");
        let item = &output.pages[0][0];
        assert_eq!(item.bounding_box, None);
        assert!(item
            .chars
            .iter()
            .all(|character| character.bounding_box.is_none()));
    }

    #[test]
    fn individual_invalid_character_geometry_is_sticky_in_both_orders() {
        let valid = Transform::row_major(1.0, 0.0, 0.0, 1.0, 72.0, 700.0);
        let invalid = Transform::row_major(1.0, 0.0, 0.0, 1.0, f64::NAN, 700.0);
        for transforms in [[&invalid, &valid], [&valid, &invalid]] {
            let mut output = TextItemOutput {
                pages: vec![Vec::new()],
                ..TextItemOutput::default()
            };
            output.begin_word().expect("begin word");
            for (index, transform) in transforms.into_iter().enumerate() {
                output
                    .output_character(
                        transform,
                        1.0,
                        0.0,
                        12.0,
                        if index == 0 { "a" } else { "b" },
                    )
                    .expect("character callback remains recoverable");
            }
            output.end_line().expect("end line");
            let item = &output.pages[0][0];
            assert_eq!(item.bounding_box, None);
            assert!(item
                .chars
                .iter()
                .all(|character| character.bounding_box.is_none()));
        }
    }

    #[test]
    fn whitespace_only_match_falls_back_to_text_item_box() {
        let item_box = TextBoundingBox {
            left: 10.0,
            bottom: 20.0,
            right: 50.0,
            top: 30.0,
        };
        let item = PositionedTextItem {
            text: " ".into(),
            bounding_box: Some(item_box),
            chars: vec![TextCharacterGeometry {
                text: " ".into(),
                item_char_start: 0,
                item_char_end: 1,
                is_whitespace: true,
                bounding_box: Some(item_box),
            }],
        };
        let (box_, level) = match_bounding_box(&item, 0, 1);
        assert_eq!(box_, Some(item_box));
        assert_eq!(level.as_deref(), Some("text_item"));
    }

    #[test]
    fn finds_literal_matches_with_snippets() {
        let text = "Sample PDF file with sample terms inside.";
        let matches = find_matches_in_text(text, "sample", false, false);
        assert_eq!(matches.len(), 2);
        let snippet = build_snippet(text, matches[0].0, matches[0].1, 6);
        assert!(snippet.contains("Sample PDF"));
    }

    #[test]
    fn respects_whole_word_boundaries() {
        let text = "risk risky risk";
        let matches = find_matches_in_text(text, "risk", false, true);
        assert_eq!(matches.len(), 2);
    }

    #[test]
    fn does_not_panic_on_multibyte_ligature_when_searching_ascii() {
        // ﬁ lowercases to "fi" (2 chars); naive byte-index search used to panic in snippets.
        let text = "preﬁx and more text around here for context";
        let matches = find_matches_in_text(text, "a", false, false);
        assert!(!matches.is_empty());
        for (start, end) in matches {
            let _ = build_snippet(text, start, end, 40);
            assert!(text.is_char_boundary(start));
            assert!(text.is_char_boundary(end));
        }
    }

    #[test]
    fn reports_offsets_in_javascript_utf16_code_units() {
        let text = "😀Café";
        let (start, end) = find_matches_in_text(text, "Café", true, false)[0];
        assert_eq!(utf16_offset(text, start), 2);
        assert_eq!(utf16_offset(text, end), 6);
    }

    #[test]
    fn search_does_not_persist_extracted_text_beside_source() {
        let fixture = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/sample.pdf");
        if !fixture.is_file() {
            return;
        }

        let temp = tempfile::tempdir().expect("tempdir");
        let pdf_path = temp.path().join("sample.pdf");
        std::fs::copy(&fixture, &pdf_path).expect("copy fixture");

        let first = search_pdf_text(
            pdf_path.as_path(),
            1024 * 1024,
            "Lorem",
            false,
            false,
            10,
            10,
            32,
        )
        .expect("first search");
        assert_eq!(first.page_cache, None);
        assert!(first.total_matches > 0);

        let second = search_pdf_text(
            pdf_path.as_path(),
            1024 * 1024,
            "Lorem",
            false,
            false,
            10,
            10,
            32,
        )
        .expect("second search");
        assert_eq!(second.page_cache, None);
        assert_eq!(second.total_matches, first.total_matches);
        assert!(!temp.path().join(".pdf-reader-mcp").exists());
    }

    #[test]
    fn bulk_normalize_case_and_empty_query() {
        assert_eq!(find_matches_in_text("AbC", "abc", false, false).len(), 1);
        assert_eq!(find_matches_in_text("AbC", "AbC", true, false).len(), 1);
        assert!(find_matches_in_text("AbC", "abc", true, false).is_empty());
        assert!(find_matches_in_text("hello", "", false, false).is_empty());
        assert!(find_matches_in_text("hello", "z", false, false).is_empty());
    }

    #[test]
    fn bulk_whole_word_and_snippet_ellipsis() {
        let text = "alpha beta alphabet";
        let whole = find_matches_in_text(text, "alpha", false, true);
        assert_eq!(whole.len(), 1, "{whole:?}");
        let loose = find_matches_in_text(text, "alpha", false, false);
        assert!(loose.len() >= 2, "{loose:?}");
        assert!(is_word_char(Some('a')));
        assert!(is_word_char(Some('_')));
        assert!(!is_word_char(Some(' ')));
        assert!(!is_word_char(None));
        let snip = build_snippet("0123456789abcdefghij", 8, 12, 2);
        assert!(snip.contains("..."), "{snip}");
        let snip2 = build_snippet("short", 0, 5, 10);
        assert_eq!(snip2, "short");
    }
}
