pub mod cli_bridge;
pub mod http_transport;
pub mod evidence;
pub mod parity_bridge;
pub mod pdf_evidence;
pub mod read_pdf;
pub mod schema;
pub mod search;
pub mod tool_routes;

use rmcp::{
    handler::server::router::tool::ToolRouter,
    handler::server::wrapper::Parameters,
    model::{Implementation, ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router, ErrorData, ServerHandler,
};
use serde_json::Value;

pub const SERVER_NAME: &str = "pdf-reader-mcp";
pub const SERVER_VERSION: &str = "3.0.18";
pub const SERVER_INSTRUCTIONS: &str = "V3 PDF intelligence MCP server (Rust rmcp transport + full TypeScript engine parity by default). Use read_pdf first with auto=true for smart Agent Document Twin extraction, search_pdf for cheap literal evidence retrieval, and pdf_evidence for focused inspect, render, crop, OCR, or visual-region evidence operations. Pure-Rust subset: PDF_READER_ENGINE_MODE=pure-rust.";

#[derive(Clone)]
pub struct PdfReaderMcp {
    pub tool_router: ToolRouter<Self>,
}

impl PdfReaderMcp {
    pub fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
        }
    }
}

#[tool_router]
impl PdfReaderMcp {
    #[tool(
        description = "Primary V3 PDF reader. With only sources, it auto-inspects and returns a routed Agent Document Twin; use auto_detail or explicit include_* options for precise control."
    )]
    pub fn read_pdf(
        &self,
        Parameters(args): Parameters<Value>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        read_pdf::read_pdf(args)
    }

    #[tool(
        description = "Searches extracted PDF text with page, snippet, bounding-box, and provenance evidence for agent retrieval."
    )]
    pub fn search_pdf(
        &self,
        Parameters(args): Parameters<Value>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        search::search_pdf(args)
    }

    #[tool(
        description = "Focused PDF evidence operations: inspect, render, crop, OCR, or visual-region analysis with provenance."
    )]
    pub fn pdf_evidence(
        &self,
        Parameters(args): Parameters<Value>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        pdf_evidence::pdf_evidence(args)
    }
}

#[tool_handler]
impl ServerHandler for PdfReaderMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            protocol_version: rmcp::model::ProtocolVersion::default(),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: SERVER_NAME.into(),
                title: None,
                version: SERVER_VERSION.into(),
                description: Some(
                    "MCP server for pdf-reader-mcp (Rust rmcp transport; full TS engine parity by default)"
                        .into(),
                ),
                icons: None,
                website_url: Some("https://sylphxai.github.io/pdf-reader-mcp/".into()),
            },
            instructions: Some(SERVER_INSTRUCTIONS.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PdfReaderMcp;
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn rmcp_server_defaults_to_full_ts_parity_bridge() {
        let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        for file in ["cli_bridge.rs", "lib.rs", "main.rs", "search.rs", "read_pdf.rs", "pdf_evidence.rs"] {
            let source = fs::read_to_string(src_dir.join(file)).expect("read mcp-server source");
            let production = source.split("#[cfg(test)]").next().unwrap_or(&source);
            assert!(
                !production.contains("invoke_ts_engine"),
                "{file} must not call invoke_ts_engine"
            );
            assert!(
                !production.contains("engine_bridge::"),
                "{file} must not call engine_bridge"
            );
        }
        let lib_rs = fs::read_to_string(src_dir.join("lib.rs")).expect("read lib.rs");
        let production_lib = lib_rs.split("#[cfg(test)]").next().unwrap_or(&lib_rs);
        assert!(production_lib.contains("read_pdf::read_pdf"));
        assert!(production_lib.contains("pdf_evidence::pdf_evidence"));
        assert!(production_lib.contains("search::search_pdf"));
        assert!(production_lib.contains("parity_bridge"));
        let parity = fs::read_to_string(src_dir.join("parity_bridge.rs")).expect("parity_bridge");
        assert!(parity.contains("legacy-engine-runtime.js"));
        assert!(parity.contains("EngineMode::Full"));
        let routes = fs::read_to_string(src_dir.join("tool_routes.rs")).expect("read tool_routes");
        assert!(routes.contains("search_pdf"));
        assert!(routes.contains("FullParity"));
    }

    #[test]
    fn exposes_v3_tool_surface() {
        let tools = PdfReaderMcp::new().tool_router.list_all();
        let names: Vec<_> = tools.iter().map(|tool| tool.name.to_string()).collect();
        assert!(names.contains(&"read_pdf".to_string()));
        assert!(names.contains(&"search_pdf".to_string()));
        assert!(names.contains(&"pdf_evidence".to_string()));
    }

    #[test]
    fn rust_http_transport_module_is_wired_for_web_mcp() {
        let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        let main_rs = fs::read_to_string(src_dir.join("main.rs")).expect("read main.rs");
        let http_rs =
            fs::read_to_string(src_dir.join("http_transport.rs")).expect("read http_transport.rs");
        assert!(main_rs.contains("http_transport::serve_http"));
        assert!(http_rs.contains("StreamableHttpService"));
        assert!(http_rs.contains("/mcp/health"));
    }
}