use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::Value;

use rmcp::model::CallToolResult;

const ENGINE_INVOKE_RELATIVE: &str = "dist/engine-invoke.js";

pub fn resolve_engine_script() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("PDF_READER_ENGINE_SCRIPT") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let package_root = parent.parent()?;
            let candidate = package_root.join(ENGINE_INVOKE_RELATIVE);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    let cwd_candidate = Path::new(ENGINE_INVOKE_RELATIVE);
    if cwd_candidate.is_file() {
        return Some(cwd_candidate.to_path_buf());
    }

    None
}

pub fn invoke_ts_engine(tool: &str, arguments: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let script = resolve_engine_script().ok_or_else(|| {
        rmcp::ErrorData::invalid_request(
            format!(
                "TypeScript engine bridge unavailable. Build the package (`bun run build`) and set PDF_READER_ENGINE_SCRIPT to {ENGINE_INVOKE_RELATIVE}."
            ),
            None,
        )
    })?;

    let node = std::env::var("PDF_READER_NODE").unwrap_or_else(|_| "node".into());
    let request = serde_json::json!({ "tool": tool, "arguments": arguments });
    let payload = serde_json::to_string(&request).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Failed to serialize engine request: {error}"), None)
    })?;

    let mut child = Command::new(node)
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to spawn engine bridge: {error}"), None)
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(payload.as_bytes()).map_err(|error| {
            rmcp::ErrorData::internal_error(format!("Failed to write engine request: {error}"), None)
        })?;
    }

    let output = child.wait_with_output().map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Engine bridge failed: {error}"), None)
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(rmcp::ErrorData::internal_error(
            format!(
                "Engine bridge exited with status {:?}: {stderr}",
                output.status.code()
            ),
            None,
        ));
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| {
        rmcp::ErrorData::internal_error(
            format!("Engine bridge returned non-UTF8 output: {error}"),
            None,
        )
    })?;

    serde_json::from_str(&stdout).map_err(|error| {
        rmcp::ErrorData::internal_error(
            format!("Engine bridge returned invalid JSON: {error}; raw={stdout}"),
            None,
        )
    })
}