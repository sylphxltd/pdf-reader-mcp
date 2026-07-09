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

    let pages = extract_page_texts(path, max_file_bytes)?;
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
    })
}

fn normalize_for_search(value: &str, case_sensitive: bool) -> String {
    if case_sensitive {
        value.to_string()
    } else {
        value.to_lowercase()
    }
}

fn is_word_char(value: Option<char>) -> bool {
    matches!(value, Some(ch) if ch.is_ascii_alphanumeric() || ch == '_')
}

fn is_whole_word_match(text: &str, start: usize, end: usize) -> bool {
    let before = text[..start].chars().last();
    let after = text[end..].chars().next();
    !is_word_char(before) && !is_word_char(after)
}

fn find_matches_in_text(
    text: &str,
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
) -> Vec<(usize, usize)> {
    let searchable_text = normalize_for_search(text, case_sensitive);
    let searchable_query = normalize_for_search(query, case_sensitive);
    if searchable_query.is_empty() {
        return Vec::new();
    }

    let mut matches = Vec::new();
    let mut search_from = 0;

    while search_from + searchable_query.len() <= searchable_text.len() {
        let Some(start) = searchable_text[search_from..].find(&searchable_query) else {
            break;
        };
        let start = search_from + start;
        let end = start + searchable_query.len();
        if !whole_word || is_whole_word_match(&searchable_text, start, end) {
            matches.push((start, end));
        }
        search_from = end.max(start + 1);
    }

    matches
}

fn build_snippet(text: &str, start: usize, end: usize, context_chars: usize) -> String {
    let snippet_start = start.saturating_sub(context_chars);
    let snippet_end = (end + context_chars).min(text.len());
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
}