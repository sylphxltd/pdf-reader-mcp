//! Full TypeScript V3 engine bridge for drop-in MCP parity.
//!
//! Production default engine mode is `full`: every MCP tool call is executed by
//! `dist/legacy-engine-runtime.js` (the complete TypeScript handlers). This makes
//! the Rust rmcp process a protocol transport that is behaviorally identical to
//! `@sylphx/pdf-reader-mcp@3.0.14` / `3.0.16` TypeScript entrypoints.
//!
//! Pure-Rust subset remains available via:
//!   PDF_READER_ENGINE_MODE=pure-rust
//! or
//!   PDF_READER_PURE_RUST=1
//!
//! Pure-Rust is NOT drop-in until the parity matrix is fully green.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use rmcp::model::CallToolResult;
use serde_json::Value;

const LEGACY_RUNTIME_RELATIVE: &str = "dist/legacy-engine-runtime.js";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineMode {
    /// Full TypeScript V3 handlers via legacy-engine-runtime (drop-in).
    Full,
    /// Incomplete pure-Rust subset (experimental).
    PureRust,
}

pub fn engine_mode() -> EngineMode {
    if env_truthy("PDF_READER_PURE_RUST") {
        return EngineMode::PureRust;
    }
    match std::env::var("PDF_READER_ENGINE_MODE")
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "pure-rust" | "pure_rust" | "rust" | "native" => EngineMode::PureRust,
        // Default and all other values: full drop-in parity.
        _ => EngineMode::Full,
    }
}

pub fn uses_full_parity_engine() -> bool {
    matches!(engine_mode(), EngineMode::Full)
}

fn env_truthy(name: &str) -> bool {
    matches!(
        std::env::var(name)
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "1" | "true" | "yes" | "on"
    )
}

pub fn resolve_legacy_runtime_script() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("PDF_READER_LEGACY_ENGINE_SCRIPT") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    // Walk ancestors from the running binary and cwd until we find the package
    // layout: dist/legacy-engine-runtime.js (works for bin/native, target/release,
    // and target/release/deps test binaries).
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        roots.push(exe);
    }
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }

    for root in roots {
        let mut cursor = root.as_path();
        for _ in 0..8 {
            let candidate = cursor.join(LEGACY_RUNTIME_RELATIVE);
            if candidate.is_file() {
                return Some(candidate);
            }
            match cursor.parent() {
                Some(parent) => cursor = parent,
                None => break,
            }
        }
    }

    let cwd = Path::new(LEGACY_RUNTIME_RELATIVE);
    if cwd.is_file() {
        return Some(cwd.to_path_buf());
    }

    None
}

/// Invoke the full TypeScript V3 tool surface and return an MCP CallToolResult.
pub fn invoke_full_ts_tool(tool: &str, arguments: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let script = resolve_legacy_runtime_script().ok_or_else(|| {
        rmcp::ErrorData::invalid_request(
            format!(
                "Full TypeScript engine runtime is unavailable (expected {LEGACY_RUNTIME_RELATIVE}). \
                 Run `bun run build` so dist/legacy-engine-runtime.js is present. \
                 Pure-Rust subset: PDF_READER_ENGINE_MODE=pure-rust."
            ),
            None,
        )
    })?;

    let node = std::env::var("PDF_READER_NODE").unwrap_or_else(|_| "node".into());
    let request = serde_json::json!({ "tool": tool, "arguments": arguments });
    let payload = serde_json::to_string(&request).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Failed to serialize parity bridge request: {error}"), None)
    })?;

    let mut child = Command::new(&node)
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            rmcp::ErrorData::internal_error(
                format!(
                    "Failed to spawn TypeScript engine runtime with `{node}`: {error}. \
                     Install Node.js or set PDF_READER_NODE."
                ),
                None,
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(payload.as_bytes()).map_err(|error| {
            rmcp::ErrorData::internal_error(
                format!("Failed to write parity bridge request: {error}"),
                None,
            )
        })?;
    }

    let output = child.wait_with_output().map_err(|error| {
        rmcp::ErrorData::internal_error(format!("TypeScript engine runtime failed: {error}"), None)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(rmcp::ErrorData::internal_error(
            format!(
                "TypeScript engine runtime exited with status {:?}: {stderr}",
                output.status.code()
            ),
            None,
        ));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| {
        rmcp::ErrorData::internal_error(
            format!("TypeScript engine runtime returned non-UTF8 output: {error}"),
            None,
        )
    })?;

    // Prefer last non-empty line (runtime may emit logs before JSON).
    let json_line = stdout
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| line.starts_with('{'))
        .unwrap_or(stdout.trim());

    let value: Value = serde_json::from_str(json_line).map_err(|error| {
        rmcp::ErrorData::internal_error(
            format!("TypeScript engine runtime returned invalid JSON: {error}; raw={stdout}"),
            None,
        )
    })?;

    serde_json::from_value::<CallToolResult>(value).map_err(|error| {
        rmcp::ErrorData::internal_error(
            format!("TypeScript engine runtime returned invalid CallToolResult: {error}"),
            None,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_full_parity_engine() {
        // Do not assert global env; just ensure the parser accepts defaults.
        let mode = match std::env::var("PDF_READER_ENGINE_MODE") {
            Ok(value) if !value.trim().is_empty() => engine_mode(),
            _ if env_truthy("PDF_READER_PURE_RUST") => EngineMode::PureRust,
            _ => EngineMode::Full,
        };
        // When neither pure-rust flag is set in this process, expect Full.
        if std::env::var("PDF_READER_ENGINE_MODE").is_err()
            && std::env::var("PDF_READER_PURE_RUST").is_err()
        {
            assert_eq!(mode, EngineMode::Full);
            assert!(uses_full_parity_engine());
        }
    }
}
