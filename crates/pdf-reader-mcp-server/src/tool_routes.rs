//! Explicit shipped routing table for pdf-reader-mcp primary tools.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolRoute {
    /// Full TypeScript V3 handlers via parity bridge (production default / drop-in).
    FullParity,
    /// Incomplete pure-Rust subset (PDF_READER_ENGINE_MODE=pure-rust).
    PureRust,
}

pub fn route_for_tool(tool: &str) -> Option<ToolRoute> {
    match tool {
        "read_pdf" | "search_pdf" | "pdf_hash" | "pdf_text_search" | "pdf_evidence" => {
            if crate::parity_bridge::uses_full_parity_engine() {
                Some(ToolRoute::FullParity)
            } else {
                Some(ToolRoute::PureRust)
            }
        }
        _ => None,
    }
}

pub fn is_rust_core_tool(tool: &str) -> bool {
    matches!(route_for_tool(tool), Some(ToolRoute::PureRust))
}

pub fn is_full_parity_tool(tool: &str) -> bool {
    matches!(route_for_tool(tool), Some(ToolRoute::FullParity))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_primary_tools_when_full_parity_default() {
        if crate::parity_bridge::uses_full_parity_engine() {
            assert_eq!(route_for_tool("read_pdf"), Some(ToolRoute::FullParity));
            assert_eq!(route_for_tool("search_pdf"), Some(ToolRoute::FullParity));
            assert_eq!(route_for_tool("pdf_evidence"), Some(ToolRoute::FullParity));
        }
    }
}
