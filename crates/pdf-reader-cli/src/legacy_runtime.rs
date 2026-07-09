use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::Value;

const LEGACY_RUNTIME_RELATIVE: &str = "dist/legacy-engine-runtime.js";

#[derive(Debug, serde::Serialize)]
pub struct LegacyToolSuccessEnvelope {
    pub status: &'static str,
    pub engine: &'static str,
    pub version: &'static str,
    pub tool: String,
    pub result: Value,
}

#[derive(Debug, serde::Serialize)]
pub struct ErrorEnvelope {
    pub status: &'static str,
    pub code: String,
    pub message: String,
    pub next_action: String,
}

pub fn resolve_legacy_runtime_script() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("PDF_READER_LEGACY_ENGINE_SCRIPT") {
        let candidate = PathBuf::from(path);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if let Some(package_root) = parent.parent() {
                let candidate = package_root.join(LEGACY_RUNTIME_RELATIVE);
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    let cwd_candidate = Path::new(LEGACY_RUNTIME_RELATIVE);
    if cwd_candidate.is_file() {
        return Some(cwd_candidate.to_path_buf());
    }

    None
}

pub fn handle_legacy_v3_tool(
    tool: &str,
    input: &Value,
) -> Result<LegacyToolSuccessEnvelope, ErrorEnvelope> {
    let script = resolve_legacy_runtime_script().ok_or_else(|| ErrorEnvelope {
        status: "error",
        code: "LEGACY_RUNTIME_UNAVAILABLE".into(),
        message: format!(
            "Legacy V3 engine runtime is unavailable (expected {LEGACY_RUNTIME_RELATIVE})."
        ),
        next_action: "Run `bun run build` to compile the legacy engine runtime.".into(),
    })?;

    let node = std::env::var("PDF_READER_NODE").unwrap_or_else(|_| "node".into());
    let request = serde_json::json!({ "tool": tool, "arguments": input });
    let payload = serde_json::to_string(&request).map_err(|error| ErrorEnvelope {
        status: "error",
        code: "SERIALIZATION_FAILED".into(),
        message: format!("Failed to serialize legacy engine request: {error}"),
        next_action: "Pass valid JSON tool arguments.".into(),
    })?;

    let mut child = Command::new(node)
        .arg(&script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ErrorEnvelope {
            status: "error",
            code: "LEGACY_RUNTIME_SPAWN_FAILED".into(),
            message: format!("Failed to spawn legacy engine runtime: {error}"),
            next_action: "Ensure Node.js is installed and on PATH.".into(),
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(payload.as_bytes()).map_err(|error| ErrorEnvelope {
            status: "error",
            code: "LEGACY_RUNTIME_WRITE_FAILED".into(),
            message: format!("Failed to write legacy engine request: {error}"),
            next_action: "Retry the request.".into(),
        })?;
    }

    let output = child.wait_with_output().map_err(|error| ErrorEnvelope {
        status: "error",
        code: "LEGACY_RUNTIME_FAILED".into(),
        message: format!("Legacy engine runtime failed: {error}"),
        next_action: "Inspect stderr and retry.".into(),
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ErrorEnvelope {
            status: "error",
            code: "LEGACY_RUNTIME_EXIT".into(),
            message: format!(
                "Legacy engine runtime exited with status {:?}: {stderr}",
                output.status.code()
            ),
            next_action: "Fix the runtime error and retry.".into(),
        });
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| ErrorEnvelope {
        status: "error",
        code: "LEGACY_RUNTIME_OUTPUT".into(),
        message: format!("Legacy engine runtime returned non-UTF8 output: {error}"),
        next_action: "Inspect runtime output.".into(),
    })?;

    let result: Value = serde_json::from_str(&stdout).map_err(|error| ErrorEnvelope {
        status: "error",
        code: "LEGACY_RUNTIME_JSON".into(),
        message: format!("Legacy engine runtime returned invalid JSON: {error}"),
        next_action: "Inspect runtime output.".into(),
    })?;

    Ok(LegacyToolSuccessEnvelope {
        status: "ok",
        engine: pdf_reader_core::ENGINE_NAME,
        version: pdf_reader_core::ENGINE_VERSION,
        tool: tool.into(),
        result,
    })
}