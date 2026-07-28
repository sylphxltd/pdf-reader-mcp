use pdf_reader_mcp_server::{
    cli_bridge, discover_compat, http_transport, PdfReaderMcp, SERVER_VERSION,
};
use rmcp::transport::async_rw::AsyncRwTransport;
use rmcp::{ServerHandler, ServiceExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::args().nth(1).as_deref() == Some("doctor") {
        eprintln!(
            "pdf-reader-mcp Rust MCP server {SERVER_VERSION} ({})",
            pdf_reader_core::ENGINE_NAME
        );
        if let Some(cli) = cli_bridge::resolve_cli_binary() {
            eprintln!("engine cli: {}", cli.display());
        } else {
            eprintln!("engine cli: unavailable (run `bun run build:rust`)");
        }
        return Ok(());
    }

    if http_transport::transport_from_env().is_some() {
        return http_transport::serve_http(http_transport::HttpConfig::from_env()).await;
    }

    let server = PdfReaderMcp::new();
    let discover_payload = discover_compat::discover_result_value(&server.get_info());
    let (stdin, stdout) = rmcp::transport::stdio();
    let transport = discover_compat::DiscoverAwareTransport::new(
        AsyncRwTransport::new_server(stdin, stdout),
        discover_payload,
    );
    let service = server.serve(transport).await?;
    service.waiting().await?;
    Ok(())
}
