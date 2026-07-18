use std::fs::File;
use std::io::Read;
use std::path::Path;

use lopdf::{Document, ObjectId};
use sha2::{Digest, Sha256};

use crate::text_index::{TextIndexError, TextIndexErrorCode};

pub(crate) struct ParsedPdf {
    pub document: Document,
    pub pages: Vec<(u32, ObjectId)>,
    pub encryption_facts: Option<EncryptionFacts>,
    #[allow(dead_code)]
    pub source_hash: String,
}

#[derive(Clone, Copy, Debug, Default)]
pub(crate) struct EncryptionFacts {
    pub permissions: Option<i64>,
}

impl ParsedPdf {
    pub fn load(path: &Path, max_file_bytes: u64) -> Result<Self, TextIndexError> {
        let file = File::open(path).map_err(|error| invalid_request(path, error))?;
        let metadata = file
            .metadata()
            .map_err(|error| invalid_request(path, error))?;
        if !metadata.is_file() {
            return Err(request_error(format!(
                "Path '{}' is not a regular file.",
                path.display()
            )));
        }
        if metadata.len() > max_file_bytes {
            return Err(request_error(format!(
                "File exceeds maximum size of {max_file_bytes} bytes."
            )));
        }
        let mut bytes =
            Vec::with_capacity(usize::try_from(metadata.len().min(max_file_bytes)).unwrap_or(0));
        file.take(max_file_bytes.saturating_add(1))
            .read_to_end(&mut bytes)
            .map_err(|error| {
                request_error(format!(
                    "Failed to read PDF bytes at '{}': {error}",
                    path.display()
                ))
            })?;
        if bytes.len() as u64 > max_file_bytes {
            return Err(request_error(format!(
                "File exceeds maximum size of {max_file_bytes} bytes."
            )));
        }
        let source_hash = format!("{:x}", Sha256::digest(&bytes));
        let mut document = Document::load_mem(&bytes).map_err(extraction_error)?;
        // lopdf automatically decrypts PDFs that accept the empty password and
        // preserves the decoded security state. Capture /P from either the raw
        // Encrypt dictionary or that preserved state before any explicit decrypt.
        let encryption_facts = read_encryption_facts(&document);
        if document.is_encrypted() {
            document.decrypt("").map_err(|error| {
                extraction_error(format!(
                    "encrypted PDF requires a supported password: {error}"
                ))
            })?;
        }
        let pages = document.get_pages().into_iter().collect();
        Ok(Self {
            document,
            pages,
            encryption_facts,
            source_hash,
        })
    }
}

fn read_encryption_facts(document: &Document) -> Option<EncryptionFacts> {
    if let Ok(dictionary) = document.get_encrypted() {
        return Some(EncryptionFacts {
            permissions: dictionary
                .get(b"P")
                .ok()
                .and_then(|value| value.as_i64().ok()),
        });
    }
    document
        .encryption_state
        .as_ref()
        .map(|state| EncryptionFacts {
            permissions: Some(state.permissions().p_value() as i64),
        })
}

fn invalid_request(path: &Path, error: std::io::Error) -> TextIndexError {
    request_error(format!(
        "Unable to access file at '{}': {error}",
        path.display()
    ))
}

fn request_error(message: String) -> TextIndexError {
    TextIndexError {
        code: TextIndexErrorCode::InvalidRequest,
        message,
    }
}

fn extraction_error(error: impl std::fmt::Display) -> TextIndexError {
    TextIndexError {
        code: TextIndexErrorCode::ExtractionFailed,
        message: format!("Failed to extract PDF: {error}"),
    }
}
