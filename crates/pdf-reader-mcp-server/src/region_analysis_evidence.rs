//! Optional command-provider analysis over bounded pure-Rust region crops.

use std::env;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use rmcp::model::{CallToolResult, Content};
use serde_json::{json, Map, Value};
use tempfile::TempDir;

use crate::command_provider::{self, CommandInvocation, CommandRunError};
use crate::schema::PdfEvidenceArgs;
use crate::visual_evidence;

const DEFAULT_TIMEOUT_MS: u64 = 60_000;
const DEFAULT_MAX_OUTPUT_CHARS: usize = 200_000;
const COMMAND_ENV: &str = "MCP_PDF_REGION_ANALYSIS_COMMAND";
const ARGS_ENV: &str = "MCP_PDF_REGION_ANALYSIS_ARGS_JSON";
const HTTP_ENV: &str = "MCP_PDF_REGION_ANALYSIS_HTTP_URL";
const PRESET_ENV: &str = "MCP_PDF_REGION_ANALYSIS_PRESET";
const MAX_SOURCES_PER_REQUEST: usize = 32;
const MAX_REQUEST_TIMEOUT_MS: u64 = 600_000;
const MAX_REQUEST_OUTPUT_CHARS: usize = 2_000_000;
const MAX_REQUEST_PROVIDER_BYTES: usize = 16 * 1024 * 1024;
const MAX_CONCURRENT_REQUESTS: usize = 2;
static ACTIVE_REQUESTS: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug)]
struct RequestPermit;

impl RequestPermit {
    fn acquire() -> Result<Self, String> {
        ACTIVE_REQUESTS
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |active| {
                (active < MAX_CONCURRENT_REQUESTS).then_some(active + 1)
            })
            .map(|_| Self)
            .map_err(|_| {
                format!(
                    "Region analysis provider concurrency limit of {MAX_CONCURRENT_REQUESTS} active requests reached; retry later."
                )
            })
    }
}

impl Drop for RequestPermit {
    fn drop(&mut self) {
        ACTIVE_REQUESTS.fetch_sub(1, Ordering::Release);
    }
}

#[derive(Default)]
struct RequestBudget {
    provider_bytes: usize,
    output_chars: usize,
    exhausted: Option<String>,
}

impl RequestBudget {
    fn ensure_available(&self) -> Result<(), String> {
        self.exhausted.clone().map_or(Ok(()), Err)
    }

    fn exhaust(&mut self, message: String) -> Result<(), String> {
        self.exhausted = Some(message.clone());
        Err(message)
    }

    fn charge(&mut self, provider_bytes: usize, output_chars: usize) -> Result<(), String> {
        self.ensure_available()?;
        self.provider_bytes = match self.provider_bytes.checked_add(provider_bytes) {
            Some(value) => value,
            None => {
                return self.exhaust("Request region analysis provider byte count overflow.".into())
            }
        };
        if self.provider_bytes > MAX_REQUEST_PROVIDER_BYTES {
            return self.exhaust(format!(
                "Request exceeds region analysis provider output limit of {MAX_REQUEST_PROVIDER_BYTES} bytes."
            ));
        }
        self.output_chars = match self.output_chars.checked_add(output_chars) {
            Some(value) => value,
            None => {
                return self
                    .exhaust("Request region analysis output character count overflow.".into())
            }
        };
        if self.output_chars > MAX_REQUEST_OUTPUT_CHARS {
            return self.exhaust(format!(
                "Request exceeds region analysis output limit of {MAX_REQUEST_OUTPUT_CHARS} characters."
            ));
        }
        Ok(())
    }

    fn charge_failed_provider(&mut self, provider_bytes: usize) -> Result<(), String> {
        self.charge(provider_bytes, 0)
    }
}

#[derive(Clone, Debug)]
struct ProviderConfig {
    command: String,
    args_template: Vec<String>,
}

fn parse_args(value: &Value) -> Result<PdfEvidenceArgs, rmcp::ErrorData> {
    let args: PdfEvidenceArgs = serde_json::from_value(value.clone()).map_err(|error| {
        rmcp::ErrorData::invalid_params(format!("Invalid pdf_evidence arguments: {error}"), None)
    })?;
    args.validate()
        .map_err(|message| rmcp::ErrorData::invalid_params(message, None))?;
    Ok(args)
}

fn provider_config_from(
    command_value: Option<String>,
    args_value: Option<String>,
    http_value: Option<String>,
    preset_value: Option<String>,
) -> Result<ProviderConfig, String> {
    let command = command_value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if command.is_none()
        && (http_value.is_some_and(|value| !value.trim().is_empty())
            || preset_value.is_some_and(|value| !value.trim().is_empty()))
    {
        return Err("HTTP and preset region analysis providers are not available in the pure-Rust engine yet; set MCP_PDF_REGION_ANALYSIS_COMMAND for the bounded command adapter.".into());
    }
    let command = command.ok_or_else(|| {
        "Region analysis provider is not configured. Set MCP_PDF_REGION_ANALYSIS_COMMAND to enable analyze_regions in the pure-Rust engine."
            .to_string()
    })?;
    let args_template = match args_value {
        None => vec!["{input}".into()],
        Some(raw) => {
            let value: Value = serde_json::from_str(&raw).map_err(|_| {
                "MCP_PDF_REGION_ANALYSIS_ARGS_JSON must be a JSON string array.".to_string()
            })?;
            let values = value.as_array().ok_or_else(|| {
                "MCP_PDF_REGION_ANALYSIS_ARGS_JSON must be a JSON string array.".to_string()
            })?;
            let args = values
                .iter()
                .map(|entry| {
                    entry.as_str().map(ToOwned::to_owned).ok_or_else(|| {
                        "MCP_PDF_REGION_ANALYSIS_ARGS_JSON must be a JSON string array.".to_string()
                    })
                })
                .collect::<Result<Vec<_>, _>>()?;
            if !args.iter().any(|arg| arg.contains("{input}")) {
                return Err("MCP_PDF_REGION_ANALYSIS_ARGS_JSON must include the {input} placeholder so the provider receives the cropped region image.".into());
            }
            args
        }
    };
    Ok(ProviderConfig {
        command,
        args_template,
    })
}

fn provider_config() -> Result<ProviderConfig, String> {
    provider_config_from(
        env::var(COMMAND_ENV).ok(),
        env::var(ARGS_ENV).ok(),
        env::var(HTTP_ENV).ok(),
        env::var(PRESET_ENV).ok(),
    )
}

fn js_number(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{value:.0}")
    } else {
        value.to_string()
    }
}

fn replace_placeholders(
    template: &str,
    input: &str,
    source: &str,
    region: &Value,
    languages: &[String],
) -> String {
    let box_ = &region["source_bounding_box"];
    template
        .replace("{input}", input)
        .replace("{page}", &region["page"].as_u64().unwrap_or(0).to_string())
        .replace("{source}", source)
        .replace("{region_id}", region["region_id"].as_str().unwrap_or(""))
        .replace(
            "{evidence_id}",
            region["evidence_id"].as_str().unwrap_or(""),
        )
        .replace("{left}", &js_number(box_["left"].as_f64().unwrap_or(0.0)))
        .replace(
            "{bottom}",
            &js_number(box_["bottom"].as_f64().unwrap_or(0.0)),
        )
        .replace("{right}", &js_number(box_["right"].as_f64().unwrap_or(0.0)))
        .replace("{top}", &js_number(box_["top"].as_f64().unwrap_or(0.0)))
        .replace("{language}", languages.first().map_or("", String::as_str))
        .replace("{languages}", &languages.join(","))
}

fn truncate_utf16(text: &str, maximum: usize) -> (String, bool) {
    let mut units = 0usize;
    let mut end = text.len();
    for (index, character) in text.char_indices() {
        let next = units + character.len_utf16();
        if next > maximum {
            end = index;
            break;
        }
        units = next;
    }
    (
        text[..end].to_string(),
        text.encode_utf16().count() > maximum,
    )
}

fn normalized_string(value: Option<&Value>, maximum: usize) -> Option<String> {
    let trimmed = value?.as_str()?.trim();
    (!trimmed.is_empty()).then(|| truncate_utf16(trimmed, maximum).0)
}

fn confidence(value: Option<&Value>) -> Option<f64> {
    let value = value?.as_f64()?;
    value.is_finite().then(|| {
        let normalized = if value > 1.0 { value / 100.0 } else { value };
        normalized.clamp(0.0, 1.0)
    })
}

fn positive_integer(value: Option<&Value>) -> Option<u64> {
    value?.as_u64().filter(|value| *value > 0)
}

fn zero_integer(value: Option<&Value>) -> Option<u64> {
    value?.as_u64()
}

fn bounding_box(value: Option<&Value>) -> Option<Value> {
    let object = value?.as_object()?;
    let left = object.get("left")?.as_f64()?;
    let bottom = object.get("bottom")?.as_f64()?;
    let right = object.get("right")?.as_f64()?;
    let top = object.get("top")?.as_f64()?;
    ([left, bottom, right, top]
        .iter()
        .all(|value| value.is_finite())
        && right > left
        && top > bottom)
        .then(|| json!({"left": left, "bottom": bottom, "right": right, "top": top}))
}

fn rows(value: Option<&Value>) -> Option<Vec<Value>> {
    let rows = value?
        .as_array()?
        .iter()
        .filter_map(|row| {
            let cells = row.as_array()?;
            (!cells.is_empty()).then(|| {
                Value::Array(
                    cells
                        .iter()
                        .map(|cell| match cell {
                            Value::Null => Value::String(String::new()),
                            Value::String(value) => Value::String(value.clone()),
                            Value::Number(value) => Value::String(value.to_string()),
                            Value::Bool(value) => Value::String(value.to_string()),
                            _ => Value::String(String::new()),
                        })
                        .collect(),
                )
            })
        })
        .collect::<Vec<_>>();
    (!rows.is_empty()).then_some(rows)
}

fn table_cells(value: Option<&Value>, maximum: usize) -> Option<Vec<Value>> {
    let cells = value?
        .as_array()?
        .iter()
        .filter_map(|cell| {
            let cell = cell.as_object()?;
            let row = zero_integer(cell.get("row_index").or_else(|| cell.get("row")))?;
            let column = zero_integer(cell.get("column_index").or_else(|| cell.get("column")))?;
            let mut output = json!({
                "text": normalized_string(cell.get("text"), maximum).unwrap_or_default(),
                "row_index": row,
                "column_index": column,
            });
            if let Some(value) =
                positive_integer(cell.get("row_span").or_else(|| cell.get("rowspan")))
            {
                output["row_span"] = json!(value);
            }
            if let Some(value) =
                positive_integer(cell.get("column_span").or_else(|| cell.get("colspan")))
            {
                output["column_span"] = json!(value);
            }
            if let Some(value) = confidence(cell.get("confidence")) {
                output["confidence"] = json!(value);
            }
            if let Some(value) = bounding_box(cell.get("bounding_box").or_else(|| cell.get("bbox")))
            {
                output["bounding_box"] = value;
            }
            Some(output)
        })
        .collect::<Vec<_>>();
    (!cells.is_empty()).then_some(cells)
}

fn normalize_table(value: Option<&Value>, maximum: usize) -> Option<Value> {
    let candidate = value?.as_object()?;
    let rows = rows(candidate.get("rows"));
    let cells = table_cells(candidate.get("cells"), maximum);
    let row_count = positive_integer(
        candidate
            .get("row_count")
            .or_else(|| candidate.get("rowCount")),
    )
    .or_else(|| rows.as_ref().map(|rows| rows.len() as u64))
    .or_else(|| {
        cells.as_ref().and_then(|cells| {
            cells
                .iter()
                .filter_map(|cell| {
                    Some(
                        cell["row_index"].as_u64()?
                            + cell.get("row_span").and_then(Value::as_u64).unwrap_or(1),
                    )
                })
                .max()
        })
    });
    let column_count = positive_integer(
        candidate
            .get("column_count")
            .or_else(|| candidate.get("columnCount"))
            .or_else(|| candidate.get("col_count")),
    )
    .or_else(|| {
        rows.as_ref().and_then(|rows| {
            rows.iter()
                .filter_map(|row| row.as_array().map(|row| row.len() as u64))
                .max()
        })
    })
    .or_else(|| {
        cells.as_ref().and_then(|cells| {
            cells
                .iter()
                .filter_map(|cell| {
                    Some(
                        cell["column_index"].as_u64()?
                            + cell.get("column_span").and_then(Value::as_u64).unwrap_or(1),
                    )
                })
                .max()
        })
    });
    let markdown = normalized_string(candidate.get("markdown"), maximum);
    let csv = normalized_string(candidate.get("csv"), maximum);
    let confidence = confidence(candidate.get("confidence"));
    if rows.is_none()
        && cells.is_none()
        && markdown.is_none()
        && csv.is_none()
        && row_count.is_none()
        && column_count.is_none()
        && confidence.is_none()
    {
        return None;
    }
    let mut output = Map::new();
    if let Some(value) = rows {
        output.insert("rows".into(), Value::Array(value));
    }
    if let Some(value) = markdown {
        output.insert("markdown".into(), json!(value));
    }
    if let Some(value) = csv {
        output.insert("csv".into(), json!(value));
    }
    if let Some(value) = row_count {
        output.insert("row_count".into(), json!(value));
    }
    if let Some(value) = column_count {
        output.insert("column_count".into(), json!(value));
    }
    if let Some(value) = cells {
        output.insert("cells".into(), Value::Array(value));
    }
    if let Some(value) = confidence {
        output.insert("confidence".into(), json!(value));
    }
    Some(Value::Object(output))
}

fn normalize_formula(value: Option<&Value>, maximum: usize) -> Option<Value> {
    let candidate = value?.as_object()?;
    let mut output = Map::new();
    for (source, target) in [
        ("latex", "latex"),
        ("mathml", "mathml"),
        ("asciimath", "asciimath"),
        ("text", "text"),
    ] {
        if let Some(value) = normalized_string(candidate.get(source), maximum) {
            output.insert(target.into(), json!(value));
        }
    }
    if !output.contains_key("asciimath") {
        if let Some(value) = normalized_string(candidate.get("ascii_math"), maximum) {
            output.insert("asciimath".into(), json!(value));
        }
    }
    if let Some(value) = confidence(candidate.get("confidence")) {
        output.insert("confidence".into(), json!(value));
    }
    (!output.is_empty()).then_some(Value::Object(output))
}

fn data_points(value: Option<&Value>) -> Option<Value> {
    let points = value?
        .as_array()?
        .iter()
        .filter_map(|point| {
            let point = point.as_object()?;
            let output = point
                .iter()
                .filter(|(_, value)| {
                    matches!(
                        value,
                        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_)
                    )
                })
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect::<Map<_, _>>();
            (!output.is_empty()).then_some(Value::Object(output))
        })
        .collect::<Vec<_>>();
    (!points.is_empty()).then_some(Value::Array(points))
}

fn chart_axis(value: Option<&Value>, maximum: usize) -> Option<Value> {
    let candidate = value?.as_object()?;
    let mut output = Map::new();
    for key in ["label", "unit"] {
        if let Some(value) = normalized_string(candidate.get(key), maximum) {
            output.insert(key.into(), json!(value));
        }
    }
    for key in ["min", "max"] {
        if candidate
            .get(key)
            .and_then(Value::as_f64)
            .is_some_and(f64::is_finite)
        {
            output.insert(key.into(), candidate[key].clone());
        }
    }
    (!output.is_empty()).then_some(Value::Object(output))
}

fn chart_series(value: Option<&Value>, maximum: usize) -> Option<Value> {
    let series = value?
        .as_array()?
        .iter()
        .filter_map(|entry| {
            let entry = entry.as_object()?;
            let points = data_points(entry.get("data_points").or_else(|| entry.get("points")))?;
            let mut output = Map::new();
            if let Some(value) = normalized_string(entry.get("name"), maximum) {
                output.insert("name".into(), json!(value));
            }
            output.insert("data_points".into(), points);
            if let Some(value) = confidence(entry.get("confidence")) {
                output.insert("confidence".into(), json!(value));
            }
            Some(Value::Object(output))
        })
        .collect::<Vec<_>>();
    (!series.is_empty()).then_some(Value::Array(series))
}

fn normalize_chart(value: Option<&Value>, maximum: usize) -> Option<Value> {
    let candidate = value?.as_object()?;
    let mut output = Map::new();
    for key in ["title", "summary"] {
        if let Some(value) = normalized_string(candidate.get(key), maximum) {
            output.insert(key.into(), json!(value));
        }
    }
    if let Some(value) = data_points(candidate.get("data_points")) {
        output.insert("data_points".into(), value);
    }
    if let Some(value) = chart_axis(candidate.get("x_axis"), maximum) {
        output.insert("x_axis".into(), value);
    }
    if let Some(value) = chart_axis(candidate.get("y_axis"), maximum) {
        output.insert("y_axis".into(), value);
    }
    if let Some(value) = chart_series(candidate.get("series"), maximum) {
        output.insert("series".into(), value);
    }
    if let Some(value) = confidence(candidate.get("confidence")) {
        output.insert("confidence".into(), json!(value));
    }
    (!output.is_empty()).then_some(Value::Object(output))
}

fn normalize_output(stdout: &str, maximum: usize) -> Value {
    let trimmed = stdout.trim();
    let parsed = serde_json::from_str::<Value>(trimmed)
        .ok()
        .filter(Value::is_object);
    let Some(parsed) = parsed else {
        let (description, truncated) = truncate_utf16(trimmed, maximum);
        let mut output = json!({"kind": "unknown", "description": description});
        if truncated {
            output["warnings"] = json!([format!(
                "Region analysis output truncated to {maximum} characters."
            )]);
        }
        return output;
    };
    let object = parsed.as_object().expect("checked object");
    let mut warnings = object
        .get("warnings")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|warning| {
            warning
                .as_str()
                .map(str::trim)
                .filter(|warning| !warning.is_empty())
                .map(str::to_string)
        })
        .collect::<Vec<_>>();
    let kind = object
        .get("kind")
        .and_then(Value::as_str)
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .unwrap_or_else(|| "unknown".into());
    let kind = if matches!(
        kind.as_str(),
        "text" | "table" | "figure" | "chart" | "formula" | "image" | "diagram" | "unknown"
    ) {
        kind
    } else {
        warnings.push(format!(
            "Unsupported region analysis kind \"{kind}\"; normalized to \"unknown\"."
        ));
        "unknown".into()
    };
    let mut output = Map::from_iter([("kind".into(), json!(kind))]);
    for key in ["description", "text", "markdown"] {
        if let Some(value) = normalized_string(object.get(key), maximum) {
            output.insert(key.into(), json!(value));
        }
    }
    if let Some(value) = confidence(object.get("confidence")) {
        output.insert("confidence".into(), json!(value));
    }
    if let Some(value) = normalize_table(object.get("table"), maximum) {
        output.insert("table".into(), value);
    }
    if let Some(value) = normalize_formula(object.get("formula"), maximum) {
        output.insert("formula".into(), value);
    }
    if let Some(value) = normalize_chart(object.get("chart"), maximum) {
        output.insert("chart".into(), value);
    }
    if !warnings.is_empty() {
        output.insert("warnings".into(), json!(warnings));
    }
    Value::Object(output)
}

fn run_provider(
    config: &ProviderConfig,
    png: &[u8],
    source: &str,
    region: &Value,
    languages: &[String],
    timeout_ms: u64,
    max_output_chars: usize,
) -> Result<String, CommandRunError> {
    let page = region["page"].as_u64().unwrap_or(0);
    let region_id = region["region_id"].as_str().unwrap_or("unknown");
    let temp = TempDir::with_prefix("pdf-reader-mcp-region-analysis-").map_err(|_| {
        CommandRunError::new(
            "Failed to create region analysis provider workspace.".into(),
            0,
        )
    })?;
    let input = temp.path().join(format!("region-{page}.png"));
    std::fs::write(&input, png).map_err(|_| {
        CommandRunError::new(
            "Failed to write region analysis provider input image.".into(),
            0,
        )
    })?;
    let input = input.to_string_lossy();
    let args = config
        .args_template
        .iter()
        .map(|arg| replace_placeholders(arg, &input, source, region, languages))
        .collect();
    command_provider::run(CommandInvocation {
        command: config.command.clone(),
        args,
        timeout_ms,
        max_stdout_bytes: max_output_chars.saturating_mul(4).max(1024 * 1024),
        failure_message: format!(
            "Region analysis provider command failed for page {page} region {region_id}."
        ),
        timeout_message: format!(
            "Region analysis provider command timed out for page {page} region {region_id}."
        ),
    })
}

fn text_result(payload: Value) -> CallToolResult {
    let text = serde_json::to_string_pretty(&payload).unwrap_or_else(|_| payload.to_string());
    CallToolResult {
        content: vec![Content::text(text)],
        structured_content: Some(payload),
        is_error: Some(false),
        meta: None,
    }
}

fn error_result(message: String) -> CallToolResult {
    CallToolResult::error(vec![Content::text(message)])
}

pub fn analyze_regions(value: Value) -> Result<CallToolResult, rmcp::ErrorData> {
    let args = parse_args(&value)?;
    if args.sources.len() > MAX_SOURCES_PER_REQUEST {
        return Err(rmcp::ErrorData::invalid_params(
            format!("pdf_evidence accepts at most {MAX_SOURCES_PER_REQUEST} sources per request."),
            None,
        ));
    }
    if args.sources.is_empty() {
        return Ok(error_result(
            "All PDF sources failed region analysis: ".into(),
        ));
    }
    let config = match provider_config() {
        Ok(config) => config,
        Err(message) => {
            return Ok(error_result(format!(
                "All PDF sources failed region analysis: {message}"
            )))
        }
    };
    let _permit = match RequestPermit::acquire() {
        Ok(permit) => permit,
        Err(message) => {
            return Ok(error_result(format!(
                "All PDF sources failed region analysis: {message}"
            )))
        }
    };
    let scale = args.scale.unwrap_or(2.0);
    let max_regions = args.max_regions.unwrap_or(20);
    let max_pixels = args.max_pixels_per_page.unwrap_or(16_000_000);
    let timeout_ms = u64::from(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS as u32));
    let max_output_chars = args
        .max_output_chars
        .map_or(DEFAULT_MAX_OUTPUT_CHARS, |value| value as usize);
    let languages_provided = args.languages.is_some();
    let languages = args.languages.unwrap_or_default();
    let request_deadline = Instant::now() + Duration::from_millis(MAX_REQUEST_TIMEOUT_MS);
    let mut request_budget = RequestBudget::default();
    let mut crop_input = value;
    crop_input["operation"] = json!("extract_regions");
    crop_input["include_image"] = json!(true);
    let cropped = visual_evidence::extract_regions(crop_input)?;
    let encoded = serde_json::to_value(&cropped).map_err(|error| {
        rmcp::ErrorData::internal_error(format!("Failed to encode crop evidence: {error}"), None)
    })?;
    let Some(payload) = cropped.structured_content else {
        let message = encoded["content"][0]["text"]
            .as_str()
            .unwrap_or("All PDF sources failed region analysis.");
        return Ok(error_result(
            message.replace("failed region extraction", "failed region analysis"),
        ));
    };
    let mut results = Vec::new();
    for source in payload["results"].as_array().into_iter().flatten() {
        let source_label = source["source"].as_str().unwrap_or("unknown source");
        if source["success"] != true {
            results
                .push(json!({"source": source_label, "success": false, "error": source["error"]}));
            continue;
        }
        let output = (|| -> Result<Value, String> {
            let mut analyses = Vec::new();
            for region in source["regions"].as_array().into_iter().flatten() {
                request_budget.ensure_available()?;
                let index = region["image_content_index"].as_u64().ok_or_else(|| {
                    "Cropped region analysis input image index is missing.".to_string()
                })?;
                let data = encoded["content"][index as usize]["data"]
                    .as_str()
                    .ok_or_else(|| "Cropped region analysis input image is missing.".to_string())?;
                let png = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data)
                    .map_err(|_| "Cropped region analysis input image is invalid.".to_string())?;
                let remaining_ms = u64::try_from(
                    request_deadline
                        .saturating_duration_since(Instant::now())
                        .as_millis(),
                )
                .unwrap_or(u64::MAX);
                if remaining_ms == 0 {
                    return Err(format!("Request exceeds region analysis provider time limit of {MAX_REQUEST_TIMEOUT_MS} milliseconds."));
                }
                let stdout = match run_provider(
                    &config,
                    &png,
                    source_label,
                    region,
                    &languages,
                    timeout_ms.min(remaining_ms),
                    max_output_chars,
                ) {
                    Ok(stdout) => stdout,
                    Err(error) => {
                        request_budget.charge_failed_provider(error.charge_bytes)?;
                        return Err(error.message);
                    }
                };
                let mut normalized = normalize_output(&stdout, max_output_chars);
                let output_chars = serde_json::to_string(&normalized)
                    .map_or(0, |value| value.encode_utf16().count());
                request_budget.charge(stdout.len(), output_chars)?;
                normalized["region_id"] = region["region_id"].clone();
                normalized["page"] = region["page"].clone();
                normalized["provider"] = json!("command");
                normalized["source_crop_evidence_id"] = region["evidence_id"].clone();
                normalized["source_bounding_box"] = region["source_bounding_box"].clone();
                normalized["crop_pixels"] = region["crop_pixels"].clone();
                normalized["scale"] = region["scale"].clone();
                normalized["provenance"] =
                    json!({"engine": "external-command", "source": "region-analysis-provider"});
                analyses.push(normalized);
            }
            let mut result = json!({"source": source_label, "success": true, "num_pages": source["num_pages"], "region_analyses": analyses});
            if source.get("warnings").is_some() {
                result["warnings"] = source["warnings"].clone();
            }
            Ok(result)
        })();
        results.push(output.unwrap_or_else(
            |error| json!({"source": source_label, "success": false, "error": error}),
        ));
    }
    if results.iter().all(|result| result["success"] != true) {
        let errors = results
            .iter()
            .filter_map(|result| result["error"].as_str())
            .collect::<Vec<_>>()
            .join("; ");
        return Ok(error_result(format!(
            "All PDF sources failed region analysis: {errors}"
        )));
    }
    let mut options = json!({"scale": scale, "max_regions": max_regions, "max_pixels_per_page": max_pixels, "timeout_ms": timeout_ms, "max_output_chars": max_output_chars});
    if languages_provided {
        options["languages"] = json!(languages);
    }
    Ok(text_result(
        json!({"profile": "region_analysis", "analysis_options": options, "results": results}),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_rich_aliases_and_unknown_kind_like_v3014() {
        let value = normalize_output(
            r#"{
          "kind":" SPREADSHEET ", "description":"  report  ", "confidence":87,
          "warnings":[" note ", 3],
          "table":{"rows":[["A",2,true,null]],"cells":[{"text":"x","row":1,"column":2,"rowspan":2,"colspan":3,"confidence":50,"bbox":{"left":1,"bottom":2,"right":3,"top":4}}]},
          "formula":{"ascii_math":"x^2","confidence":150},
          "chart":{"title":" T ","data_points":[{"x":1,"nested":{}}],"x_axis":{"label":" X ","min":0},"series":[{"name":"S","points":[{"y":2}],"confidence":90}]}
        }"#,
            200_000,
        );
        assert_eq!(value["kind"], "unknown");
        assert_eq!(value["description"], "report");
        assert_eq!(value["confidence"], 0.87);
        assert_eq!(value["table"]["row_count"], 1);
        assert_eq!(value["table"]["column_count"], 4);
        assert_eq!(value["table"]["cells"][0]["row_span"], 2);
        assert_eq!(value["formula"]["asciimath"], "x^2");
        assert_eq!(value["formula"]["confidence"], 1.0);
        assert_eq!(value["chart"]["series"][0]["confidence"], 0.9);
        assert_eq!(value["warnings"][0], "note");
        assert!(value["warnings"][1]
            .as_str()
            .unwrap()
            .contains("Unsupported"));
    }

    #[test]
    fn plain_text_truncates_by_utf16_units() {
        let value = normalize_output(" A😀B ", 3);
        assert_eq!(value["description"], "A😀");
        assert_eq!(
            value["warnings"][0],
            "Region analysis output truncated to 3 characters."
        );
    }

    #[test]
    fn rejects_non_command_configuration_and_missing_input_placeholder() {
        assert!(
            provider_config_from(None, None, Some("http://localhost".into()), None)
                .unwrap_err()
                .contains("not available")
        );
        assert!(provider_config_from(
            Some("provider".into()),
            Some(r#"["--flag"]"#.into()),
            None,
            None
        )
        .unwrap_err()
        .contains("{input}"));
    }

    #[test]
    fn request_budget_exhaustion_is_sticky() {
        let mut budget = RequestBudget::default();
        budget.charge(MAX_REQUEST_PROVIDER_BYTES - 1, 0).unwrap();
        assert!(budget.charge(2, 0).unwrap_err().contains("bytes"));
        assert!(budget.ensure_available().unwrap_err().contains("bytes"));
    }
}
