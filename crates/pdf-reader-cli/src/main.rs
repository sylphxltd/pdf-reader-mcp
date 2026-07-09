use pdf_reader_core::text_index::{search_pdf_text, TextIndexErrorCode};
use pdf_reader_core::{hash_file, HashErrorCode, ENGINE_NAME, ENGINE_VERSION};
use serde::Deserialize;
use std::io::{self, Read};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct Request {
    tool: String,
    input: serde_json::Value,
}

#[derive(Debug, serde::Serialize)]
struct HashSuccessEnvelope {
    status: &'static str,
    engine: &'static str,
    version: &'static str,
    hash: pdf_reader_core::FileHash,
}

#[derive(Debug, serde::Serialize)]
struct TextSearchSuccessEnvelope {
    status: &'static str,
    engine: &'static str,
    version: &'static str,
    search: pdf_reader_core::text_index::TextSearchResult,
}

#[derive(Debug, serde::Serialize)]
struct ErrorEnvelope {
    status: &'static str,
    code: String,
    message: String,
    next_action: String,
}

fn policy_code(code: HashErrorCode) -> &'static str {
    match code {
        HashErrorCode::InvalidParams => "INVALID_PARAMS",
        HashErrorCode::InvalidRequest => "INVALID_REQUEST",
    }
}

fn text_index_error_code(code: TextIndexErrorCode) -> &'static str {
    match code {
        TextIndexErrorCode::InvalidParams => "INVALID_PARAMS",
        TextIndexErrorCode::InvalidRequest => "INVALID_REQUEST",
        TextIndexErrorCode::ExtractionFailed => "EXTRACTION_FAILED",
    }
}

fn handle_pdf_text_search(
    input: &serde_json::Value,
) -> Result<TextSearchSuccessEnvelope, ErrorEnvelope> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| ErrorEnvelope {
            status: "error",
            code: "INVALID_PARAMS".into(),
            message: "path is required".into(),
            next_action: "Pass an absolute or cwd-relative PDF path.".into(),
        })?;

    let query = input
        .get("query")
        .and_then(|value| value.as_str())
        .ok_or_else(|| ErrorEnvelope {
            status: "error",
            code: "INVALID_PARAMS".into(),
            message: "query is required".into(),
            next_action: "Pass a non-empty search query.".into(),
        })?;

    let max_file_bytes = input
        .get("max_file_bytes")
        .and_then(|value| value.as_u64())
        .unwrap_or(256 * 1024 * 1024);

    let case_sensitive = input
        .get("case_sensitive")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    let whole_word = input
        .get("whole_word")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    let max_pages = input
        .get("max_pages")
        .and_then(|value| value.as_u64())
        .unwrap_or(100) as u32;

    let max_matches = input
        .get("max_matches")
        .and_then(|value| value.as_u64())
        .unwrap_or(50) as u32;

    let context_chars = input
        .get("context_chars")
        .and_then(|value| value.as_u64())
        .unwrap_or(120) as u32;

    match search_pdf_text(
        PathBuf::from(path).as_path(),
        max_file_bytes,
        query,
        case_sensitive,
        whole_word,
        max_pages,
        max_matches,
        context_chars,
    ) {
        Ok(search) => Ok(TextSearchSuccessEnvelope {
            status: "ok",
            engine: ENGINE_NAME,
            version: ENGINE_VERSION,
            search,
        }),
        Err(error) => Err(ErrorEnvelope {
            status: "error",
            code: text_index_error_code(error.code).into(),
            message: error.message,
            next_action: "Provide a readable PDF with extractable text.".into(),
        }),
    }
}

fn handle_pdf_hash(input: &serde_json::Value) -> Result<HashSuccessEnvelope, ErrorEnvelope> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| ErrorEnvelope {
            status: "error",
            code: "INVALID_PARAMS".into(),
            message: "path is required".into(),
            next_action: "Pass an absolute or cwd-relative PDF path.".into(),
        })?;

    let max_file_bytes = input
        .get("max_file_bytes")
        .and_then(|value| value.as_u64())
        .unwrap_or(256 * 1024 * 1024);

    match hash_file(PathBuf::from(path).as_path(), max_file_bytes) {
        Ok(hash) => Ok(HashSuccessEnvelope {
            status: "ok",
            engine: ENGINE_NAME,
            version: ENGINE_VERSION,
            hash,
        }),
        Err(error) => Err(ErrorEnvelope {
            status: "error",
            code: policy_code(error.code).into(),
            message: error.message,
            next_action: "Provide a readable PDF file within configured safety limits.".into(),
        }),
    }
}

fn main() {
    let mut payload = String::new();
    if io::stdin().read_to_string(&mut payload).is_err() {
        eprintln!("Failed to read stdin");
        std::process::exit(1);
    }

    let request: Request = match serde_json::from_str(&payload) {
        Ok(value) => value,
        Err(error) => {
            let envelope = ErrorEnvelope {
                status: "error",
                code: "INVALID_REQUEST".into(),
                message: format!("Invalid JSON request: {error}"),
                next_action: "Send {\"tool\":\"pdf_hash\",\"input\":{...}} on stdin.".into(),
            };
            println!("{}", serde_json::to_string(&envelope).expect("serialize"));
            std::process::exit(1);
        }
    };

    let output = match request.tool.as_str() {
        "pdf_hash" => match handle_pdf_hash(&request.input) {
            Ok(success) => serde_json::to_string(&success).expect("serialize"),
            Err(error) => serde_json::to_string(&error).expect("serialize"),
        },
        "pdf_text_search" => match handle_pdf_text_search(&request.input) {
            Ok(success) => serde_json::to_string(&success).expect("serialize"),
            Err(error) => serde_json::to_string(&error).expect("serialize"),
        },
        other => serde_json::to_string(&ErrorEnvelope {
            status: "error",
            code: "UNSUPPORTED_TOOL".into(),
            message: format!("Unsupported tool: {other}"),
            next_action: "Use pdf_hash or pdf_text_search.".into(),
        })
        .expect("serialize"),
    };

    println!("{output}");
}