use pdf_reader_mcp_server::{engine_bridge, PdfReaderMcp, SERVER_VERSION};
use rmcp::ServiceExt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::args().nth(1).as_deref() == Some("doctor") {
        eprintln!(
            "pdf-reader-mcp Rust MCP server {SERVER_VERSION} ({})",
            pdf_reader_core::ENGINE_NAME
        );
        if let Some(script) = engine_bridge::resolve_engine_script() {
            eprintln!("engine bridge: {}", script.display());
        } else {
            eprintln!("engine bridge: unavailable (run `bun run build`)");
        }
        return Ok(());
    }

    let service = PdfReaderMcp::new().serve(rmcp::transport::stdio()).await?;
    service.waiting().await?;
    Ok(())
}