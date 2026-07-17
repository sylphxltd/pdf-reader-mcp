//! Literal PDF text indexing and search for pdf-reader-mcp.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::page_cache::{extract_page_texts_cached, PageCacheStatus};



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
        TextIndexError::invalid_request(format!("Unable to access file at '{}': {err}", path.display()))
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

    let extracted = pdf_extract::extract_text(path).map_err(|err| {
        TextIndexError::extraction_failed(format!("Failed to extract PDF text: {err}"))
    })?;

    if extracted.is_empty() {
        return Ok(vec![String::new()]);
    }

    let pages: Vec<String> = extracted
        .split('\x0c')
        .map(str::trim)
        .map(ToString::to_string)
        .collect();

    if pages.is_empty() {
        return Ok(vec![extracted]);
    }

    Ok(pages)
}

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
    if query.is_empty() {
        return Err(TextIndexError::invalid_params("query must not be empty."));
    }

    let (pages, cache_status) = extract_page_texts_cached(path, max_file_bytes)?;
    let page_cache = match cache_status {
        PageCacheStatus::CacheHit => Some("cache_hit".into()),
        PageCacheStatus::CacheMiss => Some("cache_miss".into()),
        PageCacheStatus::CacheBypass => None,
    };
    let num_pages = pages.len().max(1) as u32;
    let searched_pages: Vec<u32> = (1..=num_pages.min(max_pages.max(1))).collect();
    let mut matches = Vec::new();
    let mut truncated = false;

    for &page in &searched_pages {
        let page_index = (page - 1) as usize;
        let text = pages.get(page_index).map(String::as_str).unwrap_or("");
        let page_matches = find_matches_in_text(text, query, case_sensitive, whole_word);

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
fn find_matches_in_text(
    text: &str,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
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
    fn reuses_page_cache_on_second_search() {
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
        assert_eq!(first.page_cache.as_deref(), Some("cache_miss"));
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
        assert_eq!(second.page_cache.as_deref(), Some("cache_hit"));
        assert_eq!(second.total_matches, first.total_matches);
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
