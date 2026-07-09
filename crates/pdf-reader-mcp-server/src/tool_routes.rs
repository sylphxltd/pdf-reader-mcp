//! Explicit shipped routing table for pdf-reader-mcp primary tools.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolRoute {
    RustCore,
    LegacyOptIn,
}

pub fn route_for_tool(tool: &str) -> Option<ToolRoute> {
    match tool {
        "read_pdf" | "search_pdf" | "pdf_hash" | "pdf_text_search" => Some(ToolRoute::RustCore),
        "pdf_evidence" => Some(ToolRoute::RustCore),
        _ => None,
    }
}

pub fn is_rust_core_tool(tool: &str) -> bool {
    matches!(route_for_tool(tool), Some(ToolRoute::RustCore))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_primary_tools_to_explicit_routes() {
        assert_eq!(route_for_tool("read_pdf"), Some(ToolRoute::RustCore));
        assert_eq!(route_for_tool("search_pdf"), Some(ToolRoute::RustCore));
        assert_eq!(route_for_tool("pdf_evidence"), Some(ToolRoute::RustCore));
        assert_eq!(route_for_tool("pdf_hash"), Some(ToolRoute::RustCore));
        assert_eq!(route_for_tool("pdf_text_search"), Some(ToolRoute::RustCore));
    }
}