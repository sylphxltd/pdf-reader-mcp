pub mod cli_bridge;
mod command_provider;
pub mod evidence;
pub mod http_transport;
mod ocr_evidence;
mod page_selection;
pub mod pdf_evidence;
pub mod read_pdf;
mod region_analysis_evidence;
pub mod schema;
pub mod search;
pub mod tool_routes;
mod visual_evidence;

use rmcp::{
    handler::server::router::tool::ToolRouter,
    handler::server::wrapper::Parameters,
    model::{Implementation, ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router, ErrorData, ServerHandler,
};

use crate::schema::{PdfEvidenceArgs, PdfEvidenceOperation, ReadPdfArgs, SearchPdfArgs};
use serde_json::Value;

pub const SERVER_NAME: &str = "pdf-reader-mcp";
/// Pure-Rust MCP server version — tracks the published npm product line when default.
pub const SERVER_VERSION: &str = "4.0.1";
pub const SERVER_INSTRUCTIONS: &str =
    "@sylphx/pdf-reader-mcp sole-Rust MCP server (platform native binary). \
Capability-first semantic compatibility with TypeScript 3.0.14 interface contracts (ADR-0005/0006). \
No TypeScript PDF runtime is shipped in this package. Historical LKG: @sylphx/pdf-reader-mcp@3.0.14.";

fn omit_absent_optional_fields(value: Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .into_iter()
                .filter_map(|(key, value)| {
                    (!value.is_null()).then(|| (key, omit_absent_optional_fields(value)))
                })
                .collect(),
        ),
        Value::Array(values) => Value::Array(
            values
                .into_iter()
                .map(omit_absent_optional_fields)
                .collect(),
        ),
        other => other,
    }
}

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

impl Default for PdfReaderMcp {
    fn default() -> Self {
        Self::new()
    }
}

#[tool_router]
impl PdfReaderMcp {
    #[tool(
        description = "Primary PDF reader. Pure-Rust default: selectable text, markdown, chunks, tables, search, and evidence-oriented twin fields under capability-first semantic compatibility (ADR-0005)."
    )]
    pub async fn read_pdf(
        &self,
        Parameters(args): Parameters<ReadPdfArgs>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        args.validate()
            .map_err(|message| ErrorData::invalid_params(message, None))?;
        let provider_operation = args.include_ocr_text_layer == Some(true);
        let value = serde_json::to_value(args)
            .map(omit_absent_optional_fields)
            .map_err(|error| {
                ErrorData::invalid_params(format!("Failed to encode read_pdf args: {error}"), None)
            })?;
        if provider_operation {
            tokio::task::spawn_blocking(move || read_pdf::read_pdf(value))
                .await
                .map_err(|error| {
                    ErrorData::internal_error(format!("read_pdf worker failed: {error}"), None)
                })?
        } else {
            read_pdf::read_pdf(value)
        }
    }

    #[tool(
        description = "Searches extracted PDF text with page, snippet, geometry, and provenance. Optional OCR uses the bounded command provider."
    )]
    pub async fn search_pdf(
        &self,
        Parameters(args): Parameters<SearchPdfArgs>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        args.validate()
            .map_err(|message| ErrorData::invalid_params(message, None))?;
        let provider_operation = args.include_ocr_text_layer == Some(true);
        let value = serde_json::to_value(args)
            .map(omit_absent_optional_fields)
            .map_err(|error| {
                ErrorData::invalid_params(
                    format!("Failed to encode search_pdf args: {error}"),
                    None,
                )
            })?;
        if provider_operation {
            tokio::task::spawn_blocking(move || search::search_pdf(value))
                .await
                .map_err(|error| {
                    ErrorData::internal_error(format!("search_pdf worker failed: {error}"), None)
                })?
        } else {
            search::search_pdf(value)
        }
    }

    #[tool(
        description = "Focused PDF evidence operations. Pure-Rust supports inspect, bounded page rendering/crops, opt-in bounded command-provider OCR, and region analysis via command, HTTP URL, or ollama/openai-compatible/lmstudio/llamacpp presets."
    )]
    pub async fn pdf_evidence(
        &self,
        Parameters(args): Parameters<PdfEvidenceArgs>,
    ) -> Result<rmcp::model::CallToolResult, ErrorData> {
        args.validate()
            .map_err(|message| ErrorData::invalid_params(message, None))?;
        let provider_operation = matches!(
            args.operation,
            PdfEvidenceOperation::OcrPages | PdfEvidenceOperation::AnalyzeRegions
        );
        let value = serde_json::to_value(args)
            .map(omit_absent_optional_fields)
            .map_err(|error| {
                ErrorData::invalid_params(
                    format!("Failed to encode pdf_evidence args: {error}"),
                    None,
                )
            })?;
        if provider_operation {
            tokio::task::spawn_blocking(move || pdf_evidence::pdf_evidence(value))
                .await
                .map_err(|error| {
                    ErrorData::internal_error(format!("Provider worker failed: {error}"), None)
                })?
        } else {
            pdf_evidence::pdf_evidence(value)
        }
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
                    "@sylphx/pdf-reader-mcp sole-Rust MCP server (native binary; no TypeScript PDF runtime)".into(),
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
    use rmcp::handler::server::wrapper::Parameters;
    use serde_json::Value;
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

    fn tool_schema(name: &str) -> Value {
        let tool = PdfReaderMcp::new()
            .tool_router
            .list_all()
            .into_iter()
            .find(|tool| tool.name == name)
            .unwrap_or_else(|| panic!("missing tool {name}"));
        serde_json::to_value(tool.input_schema).expect("schema json")
    }

    fn v3_0_14_schema_oracle() -> Value {
        serde_json::from_str(include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../test/fixtures/v3.0.14-input-schema-oracle.json"
        )))
        .expect("parse v3.0.14 schema oracle")
    }

    #[test]
    fn tools_list_schema_encodes_immutable_v3_0_14_enums_and_ranges() {
        let oracle = v3_0_14_schema_oracle();
        for fact in oracle["schemaFacts"].as_array().expect("schema facts") {
            let tool = fact["tool"].as_str().expect("fact tool");
            let pointer = fact["pointer"].as_str().expect("fact pointer");
            let schema = tool_schema(tool);
            let actual = schema.pointer(pointer).expect("schema fact pointer");
            let expected = &fact["expected"];
            let matches = match (actual.as_f64(), expected.as_f64()) {
                (Some(actual), Some(expected)) => actual == expected,
                _ => actual == expected,
            };
            assert!(
                matches,
                "v3.0.14 schema fact {tool}{pointer}: expected {expected}, got {actual}"
            );
        }

        for fact in oracle["enumFacts"].as_array().expect("enum facts") {
            let tool = fact["tool"].as_str().expect("enum tool");
            let schema_json = tool_schema(tool).to_string();
            for value in fact["values"].as_array().expect("enum values") {
                let value = value.as_str().expect("enum string");
                assert!(
                    schema_json.contains(&format!("\"{value}\"")),
                    "v3.0.14 {tool} missing enum {value}"
                );
            }
        }

        // v3.0.14 tools/list did not advertise prefer_speed (unknown keys were
        // stripped). Current product intentionally exposes prefer_speed as a
        // post-3.0.14 additive search_pdf property while dropInFor3014 stays false.
        const POST_3014_ADDITIVE: &[(&str, &str)] = &[("search_pdf", "prefer_speed")];
        for fact in oracle["absentProperties"]
            .as_array()
            .expect("absent properties")
        {
            let tool = fact["tool"].as_str().expect("absent tool");
            let property = fact["property"].as_str().expect("absent property");
            let schema = tool_schema(tool);
            let properties = schema["properties"].as_object().expect("tool properties");
            if POST_3014_ADDITIVE.contains(&(tool, property)) {
                assert!(
                    properties.contains_key(property),
                    "post-3.0.14 {tool} must expose additive property {property}"
                );
                let ty = properties[property]
                    .get("type")
                    .and_then(|value| value.as_str())
                    .or_else(|| {
                        properties[property]
                            .get("anyOf")
                            .and_then(|value| value.as_array())
                            .and_then(|items| {
                                items.iter().find_map(|item| item.get("type").and_then(|t| t.as_str()))
                            })
                    });
                assert!(
                    matches!(ty, Some("boolean")),
                    "post-3.0.14 {tool}.{property} must be boolean-typed, got {ty:?}"
                );
            } else {
                assert!(
                    !properties.contains_key(property),
                    "v3.0.14 {tool} must not expose {property}"
                );
            }
        }

        let read_json = tool_schema("read_pdf").to_string();
        assert!(
            read_json.contains("\"oneOf\""),
            "source locator XOR must be machine-readable"
        );
    }

    #[tokio::test]
    async fn tool_entrypoints_reject_values_outside_v3_0_14_runtime_bounds() {
        let server = PdfReaderMcp::new();
        let read = serde_json::from_value(serde_json::json!({
            "sources": [{"path": "sample.pdf"}],
            "sample_pages": 21
        }))
        .expect("structurally valid read args");
        assert!(server.read_pdf(Parameters(read)).await.is_err());

        let search = serde_json::from_value(serde_json::json!({
            "sources": [{"path": "sample.pdf"}],
            "query": "needle",
            "context_chars": 1001
        }))
        .expect("structurally valid search args");
        assert!(server.search_pdf(Parameters(search)).await.is_err());

        let evidence = serde_json::from_value(serde_json::json!({
            "operation": "inspect",
            "sources": [{"path": "sample.pdf"}],
            "scale": 4.01
        }))
        .expect("structurally valid evidence args");
        assert!(server.pdf_evidence(Parameters(evidence)).await.is_err());
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
    fn server_version_tracks_package_or_experimental_marker() {
        // Sole-runtime default may advertise the package version; pre-cutover
        // builds keep an experimental marker.
        assert!(
            super::SERVER_VERSION.contains("experimental")
                || super::SERVER_VERSION.starts_with("0.")
                || super::SERVER_VERSION
                    .split('.')
                    .take(1)
                    .all(|part| part.chars().all(|c| c.is_ascii_digit()))
        );
        assert_ne!(super::SERVER_VERSION, "3.1.1");
    }
}
