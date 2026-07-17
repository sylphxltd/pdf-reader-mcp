//! HTTP(S) PDF body fetch with SSRF protection and redirect revalidation.

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::ssrf::assert_host_not_private;

const MAX_REDIRECTS: usize = 5;
const MAX_BYTES: u64 = 256 * 1024 * 1024;
const TIMEOUT_SECS: u64 = 30;

pub fn fetch_url_to_temp_file(url: &str) -> Result<PathBuf, String> {
    let mut current = url.to_string();
    for _ in 0..=MAX_REDIRECTS {
        let parsed = url::Url::parse(&current).map_err(|e| format!("Invalid URL: {e}"))?;
        if parsed.scheme() != "http" && parsed.scheme() != "https" {
            return Err("Only http(s) URLs are allowed.".into());
        }
        let host = parsed
            .host_str()
            .ok_or_else(|| "URL host is required.".to_string())?;
        assert_host_not_private(host)?;

        let agent = ureq::AgentBuilder::new()
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .redirects(0)
            .build();

        let response = agent
            .get(parsed.as_str())
            .call()
            .map_err(|e| format!("URL fetch failed: {e}"))?;

        let status = response.status();
        if (300..400).contains(&status) {
            let location = response
                .header("location")
                .ok_or_else(|| "Redirect without Location header.".to_string())?
                .to_string();
            current = parsed
                .join(&location)
                .map_err(|e| format!("Invalid redirect URL: {e}"))?
                .to_string();
            continue;
        }
        if !(200..300).contains(&status) {
            return Err(format!("URL fetch returned HTTP {status}."));
        }

        let mut reader = response.into_reader().take(MAX_BYTES + 1);
        let mut bytes = Vec::new();
        std::io::copy(&mut reader, &mut bytes).map_err(|e| format!("Failed to read URL body: {e}"))?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err(format!("URL body exceeds maximum size of {MAX_BYTES} bytes."));
        }
        if bytes.is_empty() {
            return Err("URL body is empty.".into());
        }

        let dir = std::env::temp_dir().join("pdf-reader-mcp-url");
        fs::create_dir_all(&dir).map_err(|e| format!("temp dir: {e}"))?;
        let path = dir.join(format!("fetch-{}.pdf", uuid_v4_simple()));
        let mut file = fs::File::create(&path).map_err(|e| format!("temp file: {e}"))?;
        file.write_all(&bytes).map_err(|e| format!("temp write: {e}"))?;
        return Ok(path);
    }
    Err(format!("Too many redirects (>{MAX_REDIRECTS})."))
}

pub fn cleanup_temp_file(path: &Path) {
    let _ = fs::remove_file(path);
}

fn uuid_v4_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}")
}
