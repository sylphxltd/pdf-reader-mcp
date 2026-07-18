//! Shared legacy-engine opt-in gate for pdf-reader-mcp.

pub fn legacy_engine_allowed() -> bool {
    std::env::var("PDF_READER_ALLOW_LEGACY_ENGINE")
        .ok()
        .as_deref()
        == Some("1")
}
