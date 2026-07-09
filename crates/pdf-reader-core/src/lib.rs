//! Rust hashing and text-index primitives for pdf-reader-mcp.

pub mod legacy;
pub mod page_cache;
pub mod read_pdf;
pub mod search_pdf;
pub mod text_index;

pub use legacy::legacy_engine_allowed;
pub use read_pdf::{
    read_pdf, read_pdf_from_value, ReadPdfError, ReadPdfErrorCode, ReadPdfInput, ReadPdfResponse,
    ReadPdfSource, ReadPdfSourceResult, READ_PDF_ROUTE,
};
pub use search_pdf::{
    search_pdf, search_pdf_from_value, SearchPdfError, SearchPdfErrorCode, SearchPdfInput,
    SearchPdfResponse, SearchPdfSource, SEARCH_PDF_ROUTE,
};

pub use page_cache::{
    extract_page_texts_cached, load_cached_pages, page_cache_path, store_cached_pages,
    PageCacheStatus, PageTextCacheEntry, PAGE_CACHE_DIR, PAGE_CACHE_SCHEMA_VERSION,
};

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const ENGINE_NAME: &str = "pdf-reader-core";
pub const ENGINE_VERSION: &str = "0.1.0";
pub const HASH_ROUTE: &str = "rust-sha256";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHash {
    pub path: String,
    pub source_hash: String,
    pub file_size: u64,
    pub route: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HashErrorCode {
    InvalidParams,
    InvalidRequest,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HashError {
    pub code: HashErrorCode,
    pub message: String,
}

impl HashError {
    fn invalid_params(message: impl Into<String>) -> Self {
        Self {
            code: HashErrorCode::InvalidParams,
            message: message.into(),
        }
    }

    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: HashErrorCode::InvalidRequest,
            message: message.into(),
        }
    }
}

pub fn hash_file(path: &Path, max_file_bytes: u64) -> Result<FileHash, HashError> {
    let meta = fs::metadata(path).map_err(|err| {
        HashError::invalid_request(format!("Unable to access file at '{}': {err}", path.display()))
    })?;

    if !meta.is_file() {
        return Err(HashError::invalid_request(format!(
            "Path '{}' is not a regular file.",
            path.display()
        )));
    }

    let file_size = meta.len();
    if file_size > max_file_bytes {
        return Err(HashError::invalid_request(format!(
            "File exceeds maximum size of {} bytes.",
            max_file_bytes
        )));
    }

    let bytes = fs::read(path).map_err(|err| {
        HashError::invalid_request(format!("Failed to read file bytes: {err}"))
    })?;

    Ok(FileHash {
        path: path.to_string_lossy().to_string(),
        source_hash: format!("{:x}", Sha256::digest(&bytes)),
        file_size,
        route: HASH_ROUTE.into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn hashes_fixture_bytes_deterministically() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("sample.pdf");
        let mut file = fs::File::create(&path).expect("create");
        file.write_all(b"%PDF-1.4 sample").expect("write");

        let first = hash_file(&path, 32 * 1024 * 1024).expect("hash");
        let second = hash_file(&path, 32 * 1024 * 1024).expect("hash");
        assert_eq!(first.source_hash, second.source_hash);
        assert_eq!(first.route, HASH_ROUTE);
        assert_eq!(first.file_size, 15);
    }

    #[test]
    fn rejects_oversized_files_before_hashing() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("big.pdf");
        let mut file = fs::File::create(&path).expect("create");
        file.write_all(&[0u8; 64]).expect("write");
        let err = hash_file(&path, 32).expect_err("oversized");
        assert_eq!(err.code, HashErrorCode::InvalidRequest);
    }
}