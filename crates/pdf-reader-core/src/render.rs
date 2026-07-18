//! Bounded, pure-Rust PDF page rendering and region cropping primitives.

use std::io::Cursor;

use hayro::hayro_interpret::hayro_syntax::page::Rotation;
use hayro::hayro_interpret::hayro_syntax::Pdf;
use hayro::hayro_interpret::InterpreterSettings;
use hayro::vello_cpu::color::palette::css::WHITE;
use hayro::{render, RenderCache, RenderSettings};
use image::{GenericImageView, ImageFormat};
use serde::{Deserialize, Serialize};

pub const DEFAULT_RENDER_SCALE: f32 = 2.0;
pub const DEFAULT_MAX_RENDER_PIXELS: u64 = 16_000_000;
pub const RENDER_ENGINE: &str = "hayro";
pub const RENDERER_NAME: &str = "hayro/vello_cpu";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderErrorCode {
    InvalidRequest,
    InvalidPdf,
    EncodeFailed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderError {
    pub code: RenderErrorCode,
    pub message: String,
}

impl RenderError {
    fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            code: RenderErrorCode::InvalidRequest,
            message: message.into(),
        }
    }

    fn invalid_pdf(message: impl Into<String>) -> Self {
        Self {
            code: RenderErrorCode::InvalidPdf,
            message: message.into(),
        }
    }

    fn encode_failed(message: impl Into<String>) -> Self {
        Self {
            code: RenderErrorCode::EncodeFailed,
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    pub left: f64,
    pub bottom: f64,
    pub right: f64,
    pub top: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct CropPixels {
    pub left: u32,
    pub top: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RenderProvenance {
    pub engine: &'static str,
    pub renderer: &'static str,
    pub source: &'static str,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RenderedPage {
    pub page: usize,
    pub width: u32,
    pub height: u32,
    pub scale: f32,
    pub pixel_count: u64,
    pub rotation: i32,
    pub format: &'static str,
    pub mime_type: &'static str,
    pub provenance: RenderProvenance,
    #[serde(skip)]
    pub png: Vec<u8>,
}

/// Render one 1-indexed PDF page into a white-background PNG.
///
/// The pixel budget is checked from page geometry before allocating the output.
pub fn render_pdf_page(
    pdf_bytes: Vec<u8>,
    page_number: usize,
    scale: f32,
    max_pixels: u64,
) -> Result<RenderedPage, RenderError> {
    if page_number == 0 {
        return Err(RenderError::invalid_request("page must be 1 or greater."));
    }
    if !scale.is_finite() || scale <= 0.0 {
        return Err(RenderError::invalid_request(
            "scale must be a finite positive number.",
        ));
    }
    if max_pixels == 0 {
        return Err(RenderError::invalid_request(
            "max_pixels_per_page must be greater than zero.",
        ));
    }

    let pdf = Pdf::new(pdf_bytes)
        .map_err(|_| RenderError::invalid_pdf("Unable to parse PDF for rendering."))?;
    let page = pdf.pages().get(page_number - 1).ok_or_else(|| {
        RenderError::invalid_request(format!(
            "Requested page {page_number} exceeds document page count {}.",
            pdf.pages().len()
        ))
    })?;
    let (page_width, page_height) = page.render_dimensions();
    let width = checked_render_dimension(page_width, scale, "width", page_number)?;
    let height = checked_render_dimension(page_height, scale, "height", page_number)?;
    let pixel_count = u64::from(width)
        .checked_mul(u64::from(height))
        .ok_or_else(|| RenderError::invalid_request("Rendered page dimensions overflow."))?;
    if pixel_count > max_pixels {
        return Err(RenderError::invalid_request(format!(
            "Page {page_number} would render {pixel_count} pixels at scale {scale}, exceeding max_pixels_per_page {max_pixels}. Lower scale or raise max_pixels_per_page."
        )));
    }

    // Hayro currently accepts u16 viewport dimensions. Reject instead of truncating.
    let viewport_width = u16::try_from(width).map_err(|_| {
        RenderError::invalid_request(format!(
            "Page {page_number} render width {width} exceeds renderer limit {}.",
            u16::MAX
        ))
    })?;
    let viewport_height = u16::try_from(height).map_err(|_| {
        RenderError::invalid_request(format!(
            "Page {page_number} render height {height} exceeds renderer limit {}.",
            u16::MAX
        ))
    })?;

    let pixmap = render(
        page,
        &RenderCache::new(),
        &InterpreterSettings::default(),
        &RenderSettings {
            x_scale: scale,
            y_scale: scale,
            width: Some(viewport_width),
            height: Some(viewport_height),
            bg_color: WHITE,
        },
    );
    let png = pixmap
        .into_png()
        .map_err(|err| RenderError::encode_failed(format!("Failed to encode page PNG: {err}")))?;

    Ok(RenderedPage {
        page: page_number,
        width,
        height,
        scale,
        pixel_count,
        rotation: rotation_degrees(page.rotation()),
        format: "png",
        mime_type: "image/png",
        provenance: RenderProvenance {
            engine: RENDER_ENGINE,
            renderer: RENDERER_NAME,
            source: "page-render",
        },
        png,
    })
}

fn rotation_degrees(rotation: Rotation) -> i32 {
    match rotation {
        Rotation::None => 0,
        Rotation::Horizontal => 90,
        Rotation::Flipped => 180,
        Rotation::FlippedHorizontal => 270,
    }
}

fn checked_render_dimension(
    page_points: f32,
    scale: f32,
    axis: &str,
    page_number: usize,
) -> Result<u32, RenderError> {
    let scaled = f64::from(page_points) * f64::from(scale);
    if !scaled.is_finite() || scaled <= 0.0 || scaled > f64::from(u32::MAX) {
        return Err(RenderError::invalid_request(format!(
            "Page {page_number} has invalid render {axis}."
        )));
    }
    Ok(scaled.ceil() as u32)
}

/// Convert a PDF bottom-left-origin bounding box into a clamped top-left pixel crop.
///
/// Rounding and padding intentionally match the TypeScript 3.0.14 implementation.
/// The 3.0.14 crop formula does not account for rotated page coordinates, so this
/// kernel rejects non-zero rotation rather than returning a plausibly wrong crop.
pub fn crop_pixels_for_bounding_box(
    page_width: u32,
    page_height: u32,
    scale: f32,
    page_rotation: i32,
    bounding_box: BoundingBox,
    padding: f64,
) -> Result<CropPixels, RenderError> {
    if !scale.is_finite() || scale <= 0.0 {
        return Err(RenderError::invalid_request(
            "scale must be a finite positive number.",
        ));
    }
    if !padding.is_finite() || padding < 0.0 {
        return Err(RenderError::invalid_request(
            "padding must be a finite non-negative number.",
        ));
    }
    if page_rotation.rem_euclid(360) != 0 {
        return Err(RenderError::invalid_request(
            "Region crops on rotated pages are not supported by the TS-compatible crop transform.",
        ));
    }
    if !valid_bounding_box(bounding_box) {
        return Err(RenderError::invalid_request(
            "Region bounding_box must have right > left and top > bottom.",
        ));
    }

    let scale = f64::from(scale);
    let left = ((bounding_box.left - padding) * scale).floor();
    let right = ((bounding_box.right + padding) * scale).ceil();
    let top = (f64::from(page_height) - (bounding_box.top + padding) * scale).floor();
    let bottom = (f64::from(page_height) - (bounding_box.bottom - padding) * scale).ceil();

    let clamped_left = clamp_pixel(left, page_width);
    let clamped_top = clamp_pixel(top, page_height);
    let clamped_right = clamp_pixel(right, page_width);
    let clamped_bottom = clamp_pixel(bottom, page_height);
    let width = clamped_right.saturating_sub(clamped_left);
    let height = clamped_bottom.saturating_sub(clamped_top);
    if width == 0 || height == 0 {
        return Err(RenderError::invalid_request(
            "Region bounding_box does not intersect the rendered page.",
        ));
    }

    Ok(CropPixels {
        left: clamped_left,
        top: clamped_top,
        width,
        height,
    })
}

fn valid_bounding_box(box_: BoundingBox) -> bool {
    box_.left.is_finite()
        && box_.bottom.is_finite()
        && box_.right.is_finite()
        && box_.top.is_finite()
        && box_.right > box_.left
        && box_.top > box_.bottom
}

fn clamp_pixel(value: f64, maximum: u32) -> u32 {
    value.max(0.0).min(f64::from(maximum)) as u32
}

/// Crop an encoded rendered-page PNG using already validated pixel coordinates.
pub fn crop_rendered_page_png(
    page_png: &[u8],
    expected_width: u32,
    expected_height: u32,
    crop: CropPixels,
) -> Result<Vec<u8>, RenderError> {
    let source = image::load_from_memory_with_format(page_png, ImageFormat::Png)
        .map_err(|err| RenderError::invalid_request(format!("Invalid rendered page PNG: {err}")))?;
    if source.dimensions() != (expected_width, expected_height) {
        return Err(RenderError::invalid_request(format!(
            "Rendered page PNG dimensions {:?} do not match expected {expected_width}x{expected_height}.",
            source.dimensions()
        )));
    }
    let right = crop.left.checked_add(crop.width);
    let bottom = crop.top.checked_add(crop.height);
    if crop.width == 0
        || crop.height == 0
        || right.is_none_or(|value| value > expected_width)
        || bottom.is_none_or(|value| value > expected_height)
    {
        return Err(RenderError::invalid_request(
            "Crop pixels must be non-empty and contained within the rendered page.",
        ));
    }

    let cropped = source.crop_imm(crop.left, crop.top, crop.width, crop.height);
    let mut encoded = Cursor::new(Vec::new());
    cropped
        .write_to(&mut encoded, ImageFormat::Png)
        .map_err(|err| RenderError::encode_failed(format!("Failed to encode crop PNG: {err}")))?;
    Ok(encoded.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_pdf(rotation: i32) -> Vec<u8> {
        let content = "0.1 0.2 0.8 rg\n10 10 100 60 re f\n";
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Rotate {rotation} /Resources << >> /Contents 4 0 R >>"
            ),
            format!(
                "<< /Length {} >>\nstream\n{content}endstream",
                content.len()
            ),
        ];
        let mut pdf = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".to_vec();
        let mut offsets = Vec::with_capacity(objects.len());
        for (index, object) in objects.iter().enumerate() {
            offsets.push(pdf.len());
            pdf.extend_from_slice(format!("{} 0 obj\n{object}\nendobj\n", index + 1).as_bytes());
        }
        let xref_offset = pdf.len();
        pdf.extend_from_slice(format!("xref\n0 {}\n", objects.len() + 1).as_bytes());
        pdf.extend_from_slice(b"0000000000 65535 f \n");
        for offset in offsets {
            pdf.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }
        pdf.extend_from_slice(
            format!(
                "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
                objects.len() + 1
            )
            .as_bytes(),
        );
        pdf
    }

    #[test]
    fn renders_fixture_page_to_bounded_png_at_scale_two() {
        let rendered = render_pdf_page(fixture_pdf(0), 1, 2.0, DEFAULT_MAX_RENDER_PIXELS)
            .expect("render fixture");
        assert_eq!(rendered.page, 1);
        assert_eq!(rendered.scale, 2.0);
        assert_eq!((rendered.width, rendered.height), (240, 160));
        assert_eq!(
            rendered.pixel_count,
            u64::from(rendered.width) * u64::from(rendered.height)
        );
        assert!(rendered.pixel_count <= DEFAULT_MAX_RENDER_PIXELS);
        assert_eq!(&rendered.png[..8], b"\x89PNG\r\n\x1a\n");
        assert_eq!(rendered.provenance.engine, RENDER_ENGINE);
        assert_eq!(rendered.provenance.renderer, RENDERER_NAME);

        let decoded = image::load_from_memory_with_format(&rendered.png, ImageFormat::Png)
            .expect("decode rendered PNG");
        assert_eq!(decoded.dimensions(), (rendered.width, rendered.height));
    }

    #[test]
    fn rejects_invalid_dimensions_and_pixel_budget_before_rendering() {
        let bytes = fixture_pdf(0);
        let err = render_pdf_page(bytes.clone(), 1, 0.0, DEFAULT_MAX_RENDER_PIXELS)
            .expect_err("zero scale");
        assert_eq!(err.code, RenderErrorCode::InvalidRequest);

        let err = render_pdf_page(bytes, 1, 2.0, 1).expect_err("pixel budget");
        assert_eq!(err.code, RenderErrorCode::InvalidRequest);
        assert!(err.message.contains("exceeding max_pixels_per_page"));
    }

    #[test]
    fn reports_page_rotation_and_rotated_dimensions() {
        let rendered = render_pdf_page(fixture_pdf(90), 1, 2.0, DEFAULT_MAX_RENDER_PIXELS)
            .expect("render rotated fixture");
        assert_eq!(rendered.rotation, 90);
        assert_eq!((rendered.width, rendered.height), (160, 240));
    }

    #[test]
    fn matches_ts_bottom_left_to_top_left_crop_math_with_clamp_and_padding() {
        assert_eq!(
            crop_pixels_for_bounding_box(
                10,
                10,
                1.0,
                0,
                BoundingBox {
                    left: 2.0,
                    bottom: 2.0,
                    right: 6.0,
                    top: 6.0
                },
                1.0,
            )
            .expect("crop"),
            CropPixels {
                left: 1,
                top: 3,
                width: 6,
                height: 6
            }
        );
        assert_eq!(
            crop_pixels_for_bounding_box(
                10,
                10,
                1.0,
                0,
                BoundingBox {
                    left: -4.0,
                    bottom: -3.0,
                    right: 3.0,
                    top: 4.0
                },
                0.0,
            )
            .expect("clamped crop"),
            CropPixels {
                left: 0,
                top: 6,
                width: 3,
                height: 4
            }
        );
    }

    #[test]
    fn rejects_invalid_or_non_intersecting_bounding_boxes() {
        let invalid = crop_pixels_for_bounding_box(
            10,
            10,
            1.0,
            0,
            BoundingBox {
                left: 4.0,
                bottom: 2.0,
                right: 4.0,
                top: 6.0,
            },
            0.0,
        )
        .expect_err("invalid box");
        assert_eq!(invalid.code, RenderErrorCode::InvalidRequest);

        let outside = crop_pixels_for_bounding_box(
            10,
            10,
            1.0,
            0,
            BoundingBox {
                left: 20.0,
                bottom: 20.0,
                right: 30.0,
                top: 30.0,
            },
            0.0,
        )
        .expect_err("non-intersecting box");
        assert!(outside.message.contains("does not intersect"));

        let rotated = crop_pixels_for_bounding_box(
            80,
            120,
            1.0,
            90,
            BoundingBox {
                left: 2.0,
                bottom: 2.0,
                right: 6.0,
                top: 6.0,
            },
            0.0,
        )
        .expect_err("rotated crop must fail closed");
        assert!(rotated.message.contains("rotated pages"));
    }

    #[test]
    fn crops_fixture_render_to_valid_png_with_deterministic_dimensions() {
        let rendered = render_pdf_page(fixture_pdf(0), 1, 2.0, DEFAULT_MAX_RENDER_PIXELS)
            .expect("render fixture");
        let crop = CropPixels {
            left: rendered.width / 4,
            top: rendered.height / 4,
            width: rendered.width / 2,
            height: rendered.height / 2,
        };
        let png = crop_rendered_page_png(&rendered.png, rendered.width, rendered.height, crop)
            .expect("crop PNG");
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        let decoded =
            image::load_from_memory_with_format(&png, ImageFormat::Png).expect("decode crop PNG");
        assert_eq!(decoded.dimensions(), (crop.width, crop.height));
    }
}
