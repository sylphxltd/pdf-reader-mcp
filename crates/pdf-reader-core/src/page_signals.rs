use std::collections::HashSet;

use lopdf::{Document, Object, ObjectId};
use pdf_extract::decode_text_string;
use serde_json::{json, Value};

const MAX_PARENT_DEPTH: usize = 64;
const MAX_ANNOTATIONS_PER_PAGE: usize = 1_000;
const MAX_ANNOTATIONS_PER_SOURCE: usize = 10_000;
const MAX_STRING_BYTES: usize = 64 * 1024;

#[derive(Default)]
pub(crate) struct PageSignals {
    pub geometry: Vec<Value>,
    pub annotations: Vec<Value>,
    pub warnings: Vec<String>,
}

pub(crate) fn extract_page_signals(
    document: &Document,
    pages: &[(u32, ObjectId)],
    selected_pages: &[u32],
    want_geometry: bool,
    want_annotations: bool,
) -> PageSignals {
    let mut signals = PageSignals::default();
    let selected: HashSet<u32> = selected_pages.iter().copied().collect();
    let mut annotation_count = 0usize;
    for (page, page_id) in pages {
        if !selected.contains(page) {
            continue;
        }
        if want_geometry {
            if let Some(value) = page_geometry(document, *page, *page_id) {
                signals.geometry.push(value);
            }
        }
        if want_annotations && annotation_count < MAX_ANNOTATIONS_PER_SOURCE {
            let (annotations, truncated) = page_annotations(
                document,
                *page,
                *page_id,
                (MAX_ANNOTATIONS_PER_SOURCE - annotation_count).min(MAX_ANNOTATIONS_PER_PAGE),
            );
            annotation_count += annotations.len();
            if !annotations.is_empty() {
                signals.annotations.push(json!({
                    "page": page,
                    "annotations": annotations,
                }));
            }
            if truncated {
                signals.warnings.push(format!(
                    "include_annotations: page {page} exceeded the bounded annotation limit."
                ));
            }
        }
    }
    if want_annotations && annotation_count >= MAX_ANNOTATIONS_PER_SOURCE {
        signals.warnings.push(format!(
            "include_annotations: source exceeded the {MAX_ANNOTATIONS_PER_SOURCE} annotation limit."
        ));
    }
    signals
}

fn page_geometry(document: &Document, page: u32, page_id: ObjectId) -> Option<Value> {
    let media = inherited_array(document, page_id, b"MediaBox")?;
    let media = box_values(document, media)?;
    let crop = inherited_array(document, page_id, b"CropBox")
        .and_then(|value| box_values(document, value))
        .and_then(|crop| intersect_boxes(media, crop))
        .unwrap_or(media);
    let rotation = inherited_number(document, page_id, b"Rotate")
        .unwrap_or(0.0)
        .rem_euclid(360.0);
    // PDF.js exposes page.userUnit from the page dictionary itself; unlike
    // MediaBox/CropBox/Rotate, a Pages-node UserUnit is not inherited there.
    let user_unit = page_number(document, page_id, b"UserUnit").unwrap_or(1.0);
    if !user_unit.is_finite() || user_unit <= 0.0 {
        return None;
    }
    let base_width = (crop[2] - crop[0]).abs() * user_unit;
    let base_height = (crop[3] - crop[1]).abs() * user_unit;
    let quarter_turn =
        (rotation - 90.0).abs() < f64::EPSILON || (rotation - 270.0).abs() < f64::EPSILON;
    let (width, height) = if quarter_turn {
        (base_height, base_width)
    } else {
        (base_width, base_height)
    };
    if !width.is_finite() || !height.is_finite() {
        return None;
    }
    Some(json!({
        "page": page,
        "width": width,
        "height": height,
        "rotation": rotation,
        "user_unit": user_unit,
        "view_box": {
            "left": crop[0], "bottom": crop[1], "right": crop[2], "top": crop[3],
        },
    }))
}

fn page_annotations(
    document: &Document,
    page: u32,
    page_id: ObjectId,
    limit: usize,
) -> (Vec<Value>, bool) {
    let Some(annots) = inherited_array(document, page_id, b"Annots") else {
        return (Vec::new(), false);
    };
    let Ok(values) = resolve(document, annots).and_then(Object::as_array) else {
        return (Vec::new(), false);
    };
    let truncated = values.len() > limit;
    let annotations = values
        .iter()
        .take(limit)
        .filter_map(|value| normalize_annotation(document, page, value))
        .collect();
    (annotations, truncated)
}

fn normalize_annotation(document: &Document, page: u32, value: &Object) -> Option<Value> {
    let id = match value {
        Object::Reference((object, generation)) => Some(if *generation == 0 {
            format!("{object}R")
        } else {
            format!("{object}R{generation}")
        }),
        _ => None,
    };
    let dict = resolve(document, value).ok()?.as_dict().ok()?;
    let subtype = name_value(dict.get(b"Subtype").ok()?);
    let contents = dict
        .get(b"Contents")
        .ok()
        .and_then(|value| decoded_string(document, value));
    let title = dict
        .get(b"T")
        .ok()
        .and_then(|value| decoded_string(document, value));
    let rect = dict
        .get(b"Rect")
        .ok()
        .and_then(|value| box_values(document, value));
    let dest = dict
        .get(b"Dest")
        .ok()
        .and_then(|value| destination(document, value));
    let url = dict
        .get(b"A")
        .ok()
        .and_then(|value| resolve(document, value).ok())
        .and_then(|value| value.as_dict().ok())
        .filter(|action| action.get(b"S").ok().and_then(name_value).as_deref() == Some("URI"))
        .and_then(|action| action.get(b"URI").ok())
        .and_then(|value| decoded_string(document, value));

    if id.is_none()
        && subtype.is_none()
        && contents.is_none()
        && title.is_none()
        && url.is_none()
        && dest.is_none()
    {
        return None;
    }
    let mut output = serde_json::Map::new();
    output.insert("page".into(), json!(page));
    if let Some(value) = id {
        output.insert("id".into(), json!(value));
    }
    if let Some(value) = subtype.filter(|value| !value.trim().is_empty()) {
        output.insert("subtype".into(), json!(value));
    }
    if let Some(value) = contents.filter(|value| !value.trim().is_empty()) {
        output.insert("contents".into(), json!(value));
    }
    if let Some(value) = title.filter(|value| !value.trim().is_empty()) {
        output.insert("title".into(), json!(value));
    }
    if let Some(value) = url.filter(|value| !value.is_empty()) {
        output.insert("url".into(), json!(value));
    }
    if let Some(value) = dest {
        output.insert("dest".into(), value);
    }
    if let Some(value) = rect {
        output.insert(
            "bounding_box".into(),
            json!({
                "left": value[0].min(value[2]), "bottom": value[1].min(value[3]),
                "right": value[0].max(value[2]), "top": value[1].max(value[3]),
            }),
        );
    }
    Some(Value::Object(output))
}

fn inherited_array<'a>(
    document: &'a Document,
    page_id: ObjectId,
    key: &[u8],
) -> Option<&'a Object> {
    inherited(document, page_id, key)
}

fn inherited_number(document: &Document, page_id: ObjectId, key: &[u8]) -> Option<f64> {
    let value = inherited(document, page_id, key)?;
    number(resolve(document, value).ok()?)
}

fn page_number(document: &Document, page_id: ObjectId, key: &[u8]) -> Option<f64> {
    let dict = document.get_object(page_id).ok()?.as_dict().ok()?;
    number(resolve(document, dict.get(key).ok()?).ok()?)
}

fn inherited<'a>(document: &'a Document, mut id: ObjectId, key: &[u8]) -> Option<&'a Object> {
    let mut visited = HashSet::new();
    for _ in 0..MAX_PARENT_DEPTH {
        if !visited.insert(id) {
            return None;
        }
        let dict = document.get_object(id).ok()?.as_dict().ok()?;
        if let Ok(value) = dict.get(key) {
            return Some(value);
        }
        id = dict.get(b"Parent").ok()?.as_reference().ok()?;
    }
    None
}

fn resolve<'a>(document: &'a Document, value: &'a Object) -> Result<&'a Object, lopdf::Error> {
    match value {
        Object::Reference(id) => document.get_object(*id),
        _ => Ok(value),
    }
}

fn box_values(document: &Document, value: &Object) -> Option<[f64; 4]> {
    let values = resolve(document, value).ok()?.as_array().ok()?;
    if values.len() < 4 {
        return None;
    }
    let parsed = [
        number(resolve(document, &values[0]).ok()?)?,
        number(resolve(document, &values[1]).ok()?)?,
        number(resolve(document, &values[2]).ok()?)?,
        number(resolve(document, &values[3]).ok()?)?,
    ];
    parsed
        .iter()
        .all(|value| value.is_finite())
        .then_some(parsed)
}

fn number(value: &Object) -> Option<f64> {
    match value {
        Object::Integer(value) => Some(*value as f64),
        Object::Real(value) => Some(f64::from(*value)),
        _ => None,
    }
}

fn intersect_boxes(a: [f64; 4], b: [f64; 4]) -> Option<[f64; 4]> {
    let a = [
        a[0].min(a[2]),
        a[1].min(a[3]),
        a[0].max(a[2]),
        a[1].max(a[3]),
    ];
    let b = [
        b[0].min(b[2]),
        b[1].min(b[3]),
        b[0].max(b[2]),
        b[1].max(b[3]),
    ];
    let value = [
        a[0].max(b[0]),
        a[1].max(b[1]),
        a[2].min(b[2]),
        a[3].min(b[3]),
    ];
    (value[0] < value[2] && value[1] < value[3]).then_some(value)
}

fn name_value(value: &Object) -> Option<String> {
    value
        .as_name()
        .ok()
        .map(|value| String::from_utf8_lossy(value).into_owned())
}

fn decoded_string(document: &Document, value: &Object) -> Option<String> {
    let value = resolve(document, value).ok()?;
    let decoded = decode_text_string(value).ok()?;
    (decoded.len() <= MAX_STRING_BYTES).then_some(decoded)
}

fn destination(document: &Document, value: &Object) -> Option<Value> {
    let value = resolve(document, value).ok()?;
    match value {
        Object::String(_, _) => decoded_string(document, value).map(Value::String),
        Object::Name(value) => Some(Value::String(String::from_utf8_lossy(value).into_owned())),
        Object::Array(values) if values.len() <= 8 => Some(Value::Array(
            values
                .iter()
                .filter_map(|value| match resolve(document, value).ok()? {
                    Object::Integer(value) => Some(json!(value)),
                    Object::Real(value) => Some(json!(value)),
                    Object::Name(value) => Some(json!(String::from_utf8_lossy(value))),
                    Object::Null => Some(Value::Null),
                    Object::Reference((object, generation)) => Some(json!([object, generation])),
                    _ => None,
                })
                .collect(),
        )),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_document() -> Document {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-behavior-v1.pdf");
        Document::load(path).expect("load immutable signal fixture")
    }

    #[test]
    fn geometry_and_link_annotation_match_the_frozen_v3014_subset() {
        let document = fixture_document();
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], true, true);
        assert_eq!(signals.warnings, Vec::<String>::new());
        assert_eq!(
            signals.geometry,
            vec![json!({
                "page": 1, "width": 1460.0, "height": 1120.0, "rotation": 90.0,
                "user_unit": 2.0,
                "view_box": { "left": 20.0, "bottom": 30.0, "right": 580.0, "top": 760.0 },
            })]
        );
        assert_eq!(
            signals.annotations,
            vec![json!({
                "page": 1,
                "annotations": [{
                    "page": 1, "id": "11R", "subtype": "Link",
                    "contents": "  Linked note  ", "url": "https://example.com/a",
                    "bounding_box": { "left": 50.0, "bottom": 150.0, "right": 100.0, "top": 200.0 },
                }],
            })]
        );
    }

    #[test]
    fn selected_page_without_annotations_produces_no_placeholder_group() {
        let document = fixture_document();
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[2], false, true);
        assert!(signals.annotations.is_empty());
        assert!(signals.geometry.is_empty());
        assert!(signals.warnings.is_empty());
    }
}
