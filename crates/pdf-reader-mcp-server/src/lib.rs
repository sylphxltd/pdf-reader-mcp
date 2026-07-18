pub mod cli_bridge;
pub mod evidence;
pub mod http_transport;
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

use crate::schema::{PdfEvidenceArgs, ReadPdfArgs, SearchPdfArgs};

pub const SERVER_NAME: &str = "pdf-reader-mcp";
/// Experimental pure-Rust engine version — not the published npm product line.
pub const SERVER_VERSION: &str = "0.0.0-pure-rust-experimental";
pub const SERVER_INSTRUCTIONS: &str = "Experimental pure-Rust PDF MCP engine (not the published npm latest). \
Supported depth: selectable-text read_pdf, search_pdf, pdf_evidence inspect. \
render/crop/OCR/analyze fail closed. For production drop-in use @sylphx/pdf-reader-mcp@3.0.14 (TypeScript).";

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
        description = "Primary PDF reader. Pure-Rust experimental: selectable text, markdown, chunks, and best-effort twin fields. Not full 3.0.14 geometry/evidence parity."
    )]
    pub fn read_pdf(
        &self,
        Parameters(args): Parameters<ReadPdfArgs>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        let value = serde_json::to_value(args).map_err(|error| {
            ErrorData::invalid_params(format!("Failed to encode read_pdf args: {error}"), None)
        })?;
        read_pdf::read_pdf(value)
    }

    #[tool(
        description = "Searches extracted PDF text with page, snippet, and provenance. Pure-Rust: no bounding boxes; OCR flag fails closed."
    )]
    pub fn search_pdf(
        &self,
        Parameters(args): Parameters<SearchPdfArgs>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        let value = serde_json::to_value(args).map_err(|error| {
            ErrorData::invalid_params(format!("Failed to encode search_pdf args: {error}"), None)
        })?;
        search::search_pdf(value)
    }

    #[tool(
        description = "Focused PDF evidence operations. Pure-Rust supports operation=inspect; render/crop/OCR/analyze fail closed with guidance."
    )]
    pub fn pdf_evidence(
        &self,
        Parameters(args): Parameters<PdfEvidenceArgs>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        let value = serde_json::to_value(args).map_err(|error| {
            ErrorData::invalid_params(format!("Failed to encode pdf_evidence args: {error}"), None)
        })?;
        pdf_evidence::pdf_evidence(value)
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
                    "Experimental pure-Rust MCP server (not published npm latest)".into(),
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
    fn rmcp_server_is_pure_rust() {
        let src_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("src");
        assert!(!src_dir.join("parity_bridge.rs").exists());
        let lib_rs = fs::read_to_string(src_dir.join("lib.rs")).expect("read lib.rs");
        let production_lib = lib_rs.split("#[cfg(test)]").next().unwrap_or(&lib_rs);
        assert!(production_lib.contains("read_pdf::read_pdf"));
        assert!(production_lib.contains("pdf_evidence::pdf_evidence"));
        assert!(production_lib.contains("search::search_pdf"));
        assert!(!production_lib.contains("parity_bridge"));
        let routes = fs::read_to_string(src_dir.join("tool_routes.rs")).expect("read tool_routes");
        assert!(routes.contains("RustCore"));
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
    fn tools_list_exposes_typed_object_schemas_not_empty_value() {
        let tools = PdfReaderMcp::new().tool_router.list_all();
        for tool in tools {
            let schema = tool.input_schema;
            let schema_value = serde_json::to_value(&schema).expect("schema json");
            // Must not be a bare free-form Value with no properties for our tools
            let ty = schema_value.get("type").and_then(|v| v.as_str());
            assert_eq!(
                ty,
                Some("object"),
                "tool {} schema type must be object, got {schema_value}",
                tool.name
            );
            let props = schema_value
                .get("properties")
                .and_then(|v| v.as_object())
                .expect("properties object");
            assert!(
                props.contains_key("sources"),
                "tool {} must document sources in inputSchema",
                tool.name
            );
            if tool.name == "search_pdf" {
                assert!(props.contains_key("query"));
            }
            if tool.name == "pdf_evidence" {
                assert!(props.contains_key("operation"));
            }
        }
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

    #[test]
    fn server_version_is_marked_experimental_not_published_line() {
        assert!(super::SERVER_VERSION.contains("experimental") || super::SERVER_VERSION.starts_with("0."));
        assert_ne!(super::SERVER_VERSION, "3.1.1");
        assert_ne!(super::SERVER_VERSION, "3.0.14");
    }
}
