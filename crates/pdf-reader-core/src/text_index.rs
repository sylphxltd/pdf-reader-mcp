//! Literal PDF text indexing and search for pdf-reader-mcp.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

pub const TEXT_INDEX_ROUTE: &str = "rust-text-index";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TextSearchMatch {
    pub id: String,
    pub page: u32,
    pub text: String,
    pub snippet: String,
    pub match_start: u32,
    pub match_end: u32,
    pub route: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

pub fn extract_page_texts(path: &Path, max_file_bytes: u64) -> Result<Vec<String>, TextIndexError> {
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

    let pages = pdf_extract::extract_text_by_pages(path).map_err(|err| {
        TextIndexError::extraction_failed(format!("Failed to extract PDF text: {err}"))
    })?;

    if pages.is_empty() {
        return Ok(vec![String::new()]);
    }

    Ok(pages
        .into_iter()
        .map(|page| page.trim().to_string())
        .collect())
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
    let pages = extract_page_texts(path, max_file_bytes)?;
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
        let text = pages.get(page_index).map(String::as_str).unwrap_or("");
        let remaining = max_matches.saturating_add(1) as usize - matches.len();
        let page_matches =
            find_matches_in_text_bounded(text, query, case_sensitive, whole_word, remaining);

        for (start, end) in page_matches {
            if matches.len() >= max_matches as usize {
                truncated = true;
                break;
            }

            let matched_text = text[start..end].to_string();
            let snippet = build_snippet(text, start, end, context_chars as usize);
            matches.push(TextSearchMatch {
                id: format!("p{page}-match-{}", matches.len() + 1),
                page,
                text: matched_text,
                snippet,
                match_start: start as u32,
                match_end: end as u32,
                route: TEXT_INDEX_ROUTE.into(),
            });
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

    #[test]
    fn preserves_real_pdf_page_boundaries_including_blank_pages() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("two-pages.pdf");
        std::fs::write(&path, two_blank_page_pdf()).expect("write PDF");
        let pages = extract_page_texts(&path, 1_000_000).expect("extract pages");
        assert_eq!(pages, vec![String::new(), String::new()]);
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
