use std::collections::HashSet;

use crate::pdfjs_text::decode_pdfjs_text_string;
use lopdf::{Document, Object, ObjectId};
use serde_json::{json, Value};

const MAX_PARENT_DEPTH: usize = 64;
const MAX_ANNOTATIONS_PER_PAGE: usize = 1_000;
const MAX_ANNOTATIONS_PER_SOURCE: usize = 10_000;
const MAX_STRING_BYTES: usize = 64 * 1024;
const MAX_SIGNAL_TEXT_BYTES: usize = 2 * 1024 * 1024;

struct SignalTextBudget {
    remaining: usize,
    truncated: bool,
    #[cfg(test)]
    decode_attempts: usize,
}

impl SignalTextBudget {
    fn new() -> Self {
        Self {
            remaining: MAX_SIGNAL_TEXT_BYTES,
            truncated: false,
            #[cfg(test)]
            decode_attempts: 0,
        }
    }

    fn admit_raw(&mut self, bytes: usize) -> bool {
        if self.remaining == 0 || bytes > self.remaining {
            self.remaining = 0;
            self.truncated = true;
            false
        } else {
            true
        }
    }

    fn consume(&mut self, bytes: usize) -> bool {
        if bytes > self.remaining {
            self.remaining = 0;
            self.truncated = true;
            false
        } else {
            self.remaining -= bytes;
            true
        }
    }

    fn reject_oversized(&mut self) {
        self.truncated = true;
    }
}

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
    let mut annotation_work = 0usize;
    let mut text_budget = SignalTextBudget::new();
    for (page, page_id) in pages {
        if !selected.contains(page) {
            continue;
        }
        if want_geometry {
            if let Some(value) = page_geometry(document, *page, *page_id) {
                signals.geometry.push(value);
            }
        }
        if want_annotations && annotation_work < MAX_ANNOTATIONS_PER_SOURCE {
            let (annotations, truncated, inspected) = page_annotations(
                document,
                *page,
                *page_id,
                (MAX_ANNOTATIONS_PER_SOURCE - annotation_work).min(MAX_ANNOTATIONS_PER_PAGE),
                &mut text_budget,
            );
            annotation_work += inspected;
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
    if want_annotations && annotation_work >= MAX_ANNOTATIONS_PER_SOURCE {
        signals.warnings.push(format!(
            "include_annotations: source reached the {MAX_ANNOTATIONS_PER_SOURCE} annotation work limit."
        ));
    }
    if want_annotations && text_budget.truncated {
        signals.warnings.push(format!(
            "include_annotations: annotation strings exceeded the {MAX_STRING_BYTES}-byte field or {MAX_SIGNAL_TEXT_BYTES}-byte source text limit."
        ));
    }
    signals
}

fn page_geometry(document: &Document, page: u32, page_id: ObjectId) -> Option<Value> {
    let media = inherited_array(document, page_id, b"MediaBox")
        .and_then(|value| page_box_values(document, value))
        .unwrap_or([0.0, 0.0, 612.0, 792.0]);
    let crop = inherited_array(document, page_id, b"CropBox")
        .and_then(|value| page_box_values(document, value))
        .and_then(|crop| intersect_boxes(media, crop))
        .unwrap_or(media);
    let raw_rotation = inherited_number(document, page_id, b"Rotate").unwrap_or(0.0);
    let rotation = if raw_rotation.is_finite() && raw_rotation.rem_euclid(90.0) == 0.0 {
        raw_rotation.rem_euclid(360.0)
    } else {
        0.0
    };
    // PDF.js exposes page.userUnit from the page dictionary itself; unlike
    // MediaBox/CropBox/Rotate, a Pages-node UserUnit is not inherited there.
    let raw_user_unit = page_number(document, page_id, b"UserUnit").unwrap_or(1.0);
    let user_unit = if raw_user_unit.is_finite() && raw_user_unit > 0.0 {
        raw_user_unit
    } else {
        1.0
    };
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
    text_budget: &mut SignalTextBudget,
) -> (Vec<Value>, bool, usize) {
    let Some(annots) = inherited_array(document, page_id, b"Annots") else {
        return (Vec::new(), false, 0);
    };
    let Ok(values) = resolve(document, annots).and_then(Object::as_array) else {
        return (Vec::new(), false, 0);
    };
    let truncated = values.len() > limit;
    let inspected = values.len().min(limit);
    let annotations = values
        .iter()
        .take(limit)
        .filter_map(|value| normalize_annotation(document, page, value, text_budget))
        .collect();
    (annotations, truncated, inspected)
}

/// pdf.js TextAnnotation DEFAULT_ICON_SIZE.
const TEXT_ANNOTATION_ICON_SIZE: f64 = 22.0;

fn text_annotation_has_appearance(document: &Document, dict: &lopdf::Dictionary) -> bool {
    let Ok(ap) = dict.get(b"AP") else {
        return false;
    };
    let Ok(ap_dict) = resolve(document, ap).and_then(Object::as_dict) else {
        return false;
    };
    let Ok(normal) = ap_dict.get(b"N") else {
        return false;
    };
    // pdf.js Annotation.setAppearance:
    // - AP/N BaseStream (including empty) sets this.appearance
    // - AP/N named-state dict requires AS name and a stream for that state
    match resolve(document, normal) {
        Ok(Object::Stream(_)) => true,
        Ok(Object::Dictionary(states)) => {
            let Ok(as_name) = dict
                .get(b"AS")
                .and_then(|value| value.as_name().map(|name| name.to_vec()))
            else {
                return false;
            };
            let Ok(selected) = states.get(as_name.as_slice()) else {
                return false;
            };
            resolve(document, selected)
                .ok()
                .is_some_and(|obj| matches!(obj, Object::Stream(_)))
        }
        _ => false,
    }
}

fn popup_parent_dict<'a>(
    document: &'a Document,
    dict: &'a lopdf::Dictionary,
) -> Option<&'a lopdf::Dictionary> {
    let mut parent = dict
        .get(b"Parent")
        .ok()
        .and_then(|value| resolve(document, value).ok())
        .and_then(|value| value.as_dict().ok())?;
    // pdf.js: if Parent.RT == Group, follow IRT for title/contents/color source.
    if parent
        .get(b"RT")
        .ok()
        .and_then(|value| value.as_name().ok())
        .is_some_and(|name| name == b"Group")
    {
        if let Some(irt) = parent
            .get(b"IRT")
            .ok()
            .and_then(|value| resolve(document, value).ok())
            .and_then(|value| value.as_dict().ok())
        {
            parent = irt;
        }
    }
    Some(parent)
}

fn object_number(document: &Document, value: &Object) -> Option<f64> {
    match resolve(document, value).ok()? {
        Object::Integer(v) => Some(*v as f64),
        Object::Real(v) => Some(f64::from(*v)),
        _ => None,
    }
}

fn border_style_width(
    document: &Document,
    dict: &lopdf::Dictionary,
    rect: Option<[f64; 4]>,
) -> f64 {
    // pdf.js Annotation.setBorderStyle:
    // - prefer BS dict (Type absent or Border) width W
    // - else Border array with length >= 3 uses array[2]
    // - else Border short array / missing => width 0
    // Drawing paths then use `width || 1`.
    // When W exceeds half of either Rect dimension (both dimensions > 0), pdf.js clamps to 1.
    // pdf.js: if the BS key is present, never fall through to Border — even when
    // BS is null/non-dict or has a non-Border Type. Default AnnotationBorderStyle
    // width is 1; drawing paths still apply `width || 1`.
    let raw = if dict.get(b"BS").is_ok() {
        if let Some(bs) = dict
            .get(b"BS")
            .ok()
            .and_then(|value| resolve(document, value).ok())
            .and_then(|value| value.as_dict().ok())
        {
            let type_ok = match bs.get(b"Type").ok() {
                None => true,
                Some(value) => value.as_name().ok().is_some_and(|name| name == b"Border"),
            };
            if type_ok {
                bs.get(b"W")
                    .ok()
                    .and_then(|value| object_number(document, value))
                    .unwrap_or(1.0)
            } else {
                1.0
            }
        } else {
            1.0
        }
    } else if let Some(array) = dict
        .get(b"Border")
        .ok()
        .and_then(|value| resolve(document, value).ok())
        .and_then(|value| value.as_array().ok())
    {
        if array.len() >= 3 {
            object_number(document, &array[2]).unwrap_or(0.0)
        } else {
            0.0
        }
    } else {
        // pdf.js sets width 0 when neither BS nor Border is present; drawing uses || 1.
        0.0
    };
    let mut width = if raw == 0.0 { 1.0 } else { raw };
    if width > 0.0 {
        if let Some(rect) = rect {
            let rect = normalize_rect_coords(rect);
            let max_width = (rect[2] - rect[0]) / 2.0;
            let max_height = (rect[3] - rect[1]) / 2.0;
            if max_width > 0.0 && max_height > 0.0 && (width > max_width || width > max_height) {
                width = 1.0;
            }
        }
    }
    width
}

fn normalize_rect_coords(rect: [f64; 4]) -> [f64; 4] {
    let left = rect[0].min(rect[2]);
    let right = rect[0].max(rect[2]);
    let bottom = rect[1].min(rect[3]);
    let top = rect[1].max(rect[3]);
    [left, bottom, right, top]
}

fn expand_rect(rect: [f64; 4], pad: f64) -> [f64; 4] {
    let [left, bottom, right, top] = normalize_rect_coords(rect);
    [left - pad, bottom - pad, right + pad, top + pad]
}

fn rects_intersect(a: [f64; 4], b: [f64; 4]) -> bool {
    let a = normalize_rect_coords(a);
    let b = normalize_rect_coords(b);
    a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
}

fn line_coordinates(document: &Document, dict: &lopdf::Dictionary) -> Option<[f64; 4]> {
    let value = dict.get(b"L").ok()?;
    box_values(document, value)
}

fn vertices_points(document: &Document, dict: &lopdf::Dictionary) -> Option<Vec<(f64, f64)>> {
    let value = dict.get(b"Vertices").ok()?;
    let values = resolve(document, value).ok()?.as_array().ok()?;
    if values.len() < 2 {
        return None;
    }
    let mut points = Vec::with_capacity(values.len() / 2);
    let mut index = 0;
    while index + 1 < values.len() {
        let x = number(resolve(document, &values[index]).ok()?)?;
        let y = number(resolve(document, &values[index + 1]).ok()?)?;
        if !x.is_finite() || !y.is_finite() {
            return None;
        }
        points.push((x, y));
        index += 2;
    }
    (!points.is_empty()).then_some(points)
}

fn vertices_bbox(points: &[(f64, f64)], pad: f64) -> Option<[f64; 4]> {
    let mut left = f64::INFINITY;
    let mut bottom = f64::INFINITY;
    let mut right = f64::NEG_INFINITY;
    let mut top = f64::NEG_INFINITY;
    for &(x, y) in points {
        left = left.min(x - pad);
        bottom = bottom.min(y - pad);
        right = right.max(x + pad);
        top = top.max(y + pad);
    }
    left.is_finite().then_some([left, bottom, right, top])
}

fn ink_lists_points(document: &Document, dict: &lopdf::Dictionary) -> Option<Vec<(f64, f64)>> {
    let value = dict.get(b"InkList").ok()?;
    let lists = resolve(document, value).ok()?.as_array().ok()?;
    let mut points = Vec::new();
    for entry in lists {
        let values = resolve(document, entry).ok()?.as_array().ok()?;
        let mut index = 0;
        while index + 1 < values.len() {
            let x = number(resolve(document, &values[index]).ok()?)?;
            let y = number(resolve(document, &values[index + 1]).ok()?)?;
            if !x.is_finite() || !y.is_finite() {
                return None;
            }
            points.push((x, y));
            index += 2;
        }
    }
    (!points.is_empty()).then_some(points)
}

fn annotation_has_normal_appearance(document: &Document, dict: &lopdf::Dictionary) -> bool {
    // pdf.js Annotation.setAppearance: AP/N must be a stream, or a named-state
    // dict with AS selecting a stream. A bare AP/N key (null/name/non-stream)
    // does not set appearance, so Line/PolyLine/Ink keep geometry expansion.
    // Share the same gate as Text annotation appearance detection.
    text_annotation_has_appearance(document, dict)
}

fn normalize_annotation(
    document: &Document,
    page: u32,
    value: &Object,
    text_budget: &mut SignalTextBudget,
) -> Option<Value> {
    let id = match value {
        Object::Reference((object, generation)) => Some(if *generation == 0 {
            format!("{object}R")
        } else {
            format!("{object}R{generation}")
        }),
        _ => None,
    };
    let dict = resolve(document, value).ok()?.as_dict().ok()?;
    let subtype = bounded_name(dict.get(b"Subtype").ok()?, text_budget);
    let mut contents = dict
        .get(b"Contents")
        .ok()
        .and_then(|value| decoded_string(document, value, text_budget));
    let mut title = dict
        .get(b"T")
        .ok()
        .and_then(|value| decoded_string(document, value, text_budget));
    // pdf.js MarkupAnnotation: when RT == Group, title/contents are taken from IRT
    // (overwriting local values). Public TS projection only surfaces those fields.
    if dict
        .get(b"RT")
        .ok()
        .and_then(|value| value.as_name().ok())
        .is_some_and(|name| name == b"Group")
    {
        if let Some(irt) = dict
            .get(b"IRT")
            .ok()
            .and_then(|value| resolve(document, value).ok())
            .and_then(|value| value.as_dict().ok())
        {
            title = irt
                .get(b"T")
                .ok()
                .and_then(|value| decoded_string(document, value, text_budget));
            contents = irt
                .get(b"Contents")
                .ok()
                .and_then(|value| decoded_string(document, value, text_budget));
        }
    }
    // pdf.js PopupAnnotation always projects title/contents from Parent (and IRT
    // when Parent.RT is Group). Public TS projection only surfaces title/contents.
    if subtype.as_deref() == Some("Popup") {
        if let Some(parent) = popup_parent_dict(document, dict) {
            title = parent
                .get(b"T")
                .ok()
                .and_then(|value| decoded_string(document, value, text_budget));
            contents = parent
                .get(b"Contents")
                .ok()
                .and_then(|value| decoded_string(document, value, text_budget));
        }
    }
    let mut rect = dict
        .get(b"Rect")
        .ok()
        .and_then(|value| box_values(document, value));
    // pdf.js normalizes Rect first (lookupNormalRect), then TextAnnotation without
    // appearance forces a 22x22 icon box anchored at the top-left of that box:
    // bottom = top - 22, right = left + 22.
    if subtype.as_deref() == Some("Text") && !text_annotation_has_appearance(document, dict) {
        if let Some([x1, y1, x2, y2]) = rect {
            let left = x1.min(x2);
            let top = y1.max(y2);
            rect = Some([
                left,
                top - TEXT_ANNOTATION_ICON_SIZE,
                left + TEXT_ANNOTATION_ICON_SIZE,
                top,
            ]);
        }
    }
    // pdf.js PopupAnnotation: after lookupNormalRect, width==0 || height==0
    // sets data.rect = null, so public TS omits bounding_box.
    if subtype.as_deref() == Some("Popup") {
        if let Some([left, bottom, right, top]) = rect {
            let width = left.max(right) - left.min(right);
            let height = bottom.max(top) - bottom.min(top);
            if width == 0.0 || height == 0.0 {
                rect = None;
            }
        }
    }

    // pdf.js LineAnnotation without appearance:
    // - compute L-normalized bbox expanded by 2*borderWidth (default width 1)
    // - if Rect does not intersect that bbox, replace Rect with the L bbox
    // - public rect is then expanded by borderWidth (default appearance path)
    if subtype.as_deref() == Some("Line") && !annotation_has_normal_appearance(document, dict) {
        if let Some(line) = line_coordinates(document, dict) {
            let bw = border_style_width(document, dict, rect);
            let line = normalize_rect_coords(line);
            let line_bbox = expand_rect(line, 2.0 * bw);
            let current = rect.map(normalize_rect_coords);
            let base = match current {
                Some(r) if rects_intersect(r, line_bbox) => r,
                _ => line_bbox,
            };
            rect = Some(expand_rect(base, bw));
        }
    }

    // pdf.js PolylineAnnotation/PolygonAnnotation without appearance:
    // - vertices bbox expanded by 2*borderWidth (default width 1)
    // - if Rect does not intersect that bbox, replace Rect with the vertices bbox
    // - public rect is the resulting rectangle (no additional borderWidth expand)
    if matches!(subtype.as_deref(), Some("PolyLine") | Some("Polygon"))
        && !annotation_has_normal_appearance(document, dict)
    {
        if let Some(points) = vertices_points(document, dict) {
            let bw = border_style_width(document, dict, rect);
            if let Some(vertices_box) = vertices_bbox(&points, 2.0 * bw) {
                let current = rect.map(normalize_rect_coords);
                rect = Some(match current {
                    Some(r) if rects_intersect(r, vertices_box) => r,
                    _ => vertices_box,
                });
            }
        }
    }

    // pdf.js InkAnnotation without appearance:
    // - ink-list points bbox expanded by 2*borderWidth (default width 1)
    // - if Rect does not intersect that bbox, replace Rect with the ink bbox
    // - public rect is the resulting rectangle (no additional borderWidth expand)
    if subtype.as_deref() == Some("Ink") && !annotation_has_normal_appearance(document, dict) {
        if let Some(points) = ink_lists_points(document, dict) {
            let bw = border_style_width(document, dict, rect);
            if let Some(ink_box) = vertices_bbox(&points, 2.0 * bw) {
                let current = rect.map(normalize_rect_coords);
                rect = Some(match current {
                    Some(r) if rects_intersect(r, ink_box) => r,
                    _ => ink_box,
                });
            }
        }
    }

    let direct_dest = dict
        .get(b"Dest")
        .ok()
        .and_then(|value| destination(document, value, text_budget));
    let action = dict
        .get(b"A")
        .ok()
        .and_then(|value| resolve(document, value).ok())
        .and_then(|value| value.as_dict().ok());
    let action_kind = action
        .as_ref()
        .and_then(|action| action.get(b"S").ok())
        .and_then(|value| value.as_name().ok());
    // pdf.js Link annotations project destination/url from the action when
    // present: GoTo supplies dest (winning over /Dest), URI/Launch/GoToR supply
    // url and suppress dest, and only action-less annotations fall back to /Dest.
    // Launch/GoToR file specs prefer UF over F (pdf.js FileSpec/pickPlatformItem).
    // GoToR appends `#` + remote dest (string name or JSON explicit dest).
    let (dest, url) = match action_kind {
        Some(b"GoTo") => {
            let dest = action
                .as_ref()
                .and_then(|action| action.get(b"D").ok())
                .and_then(|value| destination(document, value, text_budget));
            (dest, None)
        }
        Some(b"URI") => {
            let url = action
                .as_ref()
                .and_then(|action| action.get(b"URI").ok())
                .and_then(|value| decoded_string(document, value, text_budget));
            (None, url)
        }
        Some(b"Launch") | Some(b"GoToR") => {
            let url = action.as_ref().and_then(|action| {
                let file = action.get(b"F").ok()?;
                let mut base = match resolve(document, file).ok()? {
                    Object::String(_, _) => decoded_string(document, file, text_budget)?,
                    Object::Dictionary(ref dict) => {
                        filespec_raw_filename(document, dict, text_budget)?
                    }
                    Object::Name(_) => bounded_name(file, text_budget)?,
                    _ => return None,
                };
                if action_kind == Some(b"GoToR") {
                    if let Some(remote) = fetch_remote_dest(document, action, text_budget) {
                        if let Some(hash) = base.find('#') {
                            base.truncate(hash);
                        }
                        base.push('#');
                        base.push_str(&remote);
                    }
                }
                Some(base)
            });
            (None, url)
        }
        _ => (direct_dest, None),
    };

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

fn page_box_values(document: &Document, value: &Object) -> Option<[f64; 4]> {
    let values = resolve(document, value).ok()?.as_array().ok()?;
    if values.len() != 4 {
        return None;
    }
    let value = normalize_box(box_values(document, value)?);
    (value[0] < value[2] && value[1] < value[3]).then_some(value)
}

fn number(value: &Object) -> Option<f64> {
    match value {
        Object::Integer(value) => Some(*value as f64),
        Object::Real(value) => Some(f64::from(*value)),
        _ => None,
    }
}

fn intersect_boxes(a: [f64; 4], b: [f64; 4]) -> Option<[f64; 4]> {
    let a = normalize_box(a);
    let b = normalize_box(b);
    let value = [
        a[0].max(b[0]),
        a[1].max(b[1]),
        a[2].min(b[2]),
        a[3].min(b[3]),
    ];
    (value[0] < value[2] && value[1] < value[3]).then_some(value)
}

fn normalize_box(value: [f64; 4]) -> [f64; 4] {
    [
        value[0].min(value[2]),
        value[1].min(value[3]),
        value[0].max(value[2]),
        value[1].max(value[3]),
    ]
}

fn bounded_name(value: &Object, budget: &mut SignalTextBudget) -> Option<String> {
    let bytes = value.as_name().ok()?;
    if bytes.len() > MAX_STRING_BYTES {
        budget.reject_oversized();
        return None;
    }
    if !budget.admit_raw(bytes.len()) {
        return None;
    }
    let decoded = String::from_utf8_lossy(bytes).into_owned();
    if !budget.consume(decoded.len()) {
        return None;
    }
    Some(decoded)
}

fn decoded_string(
    document: &Document,
    value: &Object,
    budget: &mut SignalTextBudget,
) -> Option<String> {
    let value = resolve(document, value).ok()?;
    if let Object::String(bytes, _) = value {
        if bytes.len() > MAX_STRING_BYTES {
            budget.reject_oversized();
            return None;
        }
        if !budget.admit_raw(bytes.len()) {
            return None;
        }
    }
    #[cfg(test)]
    {
        budget.decode_attempts += 1;
    }
    let decoded = decode_pdfjs_text_string(value)?;
    if decoded.len() > MAX_STRING_BYTES {
        budget.reject_oversized();
        return None;
    }
    if !budget.consume(decoded.len()) {
        return None;
    }
    Some(decoded)
}

fn filespec_raw_filename(
    document: &Document,
    dict: &lopdf::Dictionary,
    budget: &mut SignalTextBudget,
) -> Option<String> {
    // pdf.js pickPlatformItem order: UF, F, Unix, Mac, DOS.
    for key in [b"UF".as_slice(), b"F", b"Unix", b"Mac", b"DOS"] {
        if let Ok(value) = dict.get(key) {
            let resolved = match value {
                Object::Reference(_) => resolve(document, value).ok()?,
                other => other,
            };
            let name = match resolved {
                Object::String(_, _) => decoded_string(document, resolved, budget),
                Object::Name(_) => bounded_name(resolved, budget),
                _ => None,
            };
            if let Some(name) = name.filter(|value| !value.is_empty()) {
                return Some(name);
            }
        }
    }
    None
}

fn fetch_remote_dest(
    document: &Document,
    action: &lopdf::Dictionary,
    budget: &mut SignalTextBudget,
) -> Option<String> {
    let value = action.get(b"D").ok()?;
    // Named dest string/name.
    match value {
        Object::String(_, _) => return decoded_string(document, value, budget),
        Object::Name(_) => return bounded_name(value, budget),
        Object::Reference(_) => {
            let resolved = resolve(document, value).ok()?;
            match resolved {
                Object::String(_, _) => return decoded_string(document, resolved, budget),
                Object::Name(_) => return bounded_name(resolved, budget),
                Object::Array(_) => {
                    let projected = destination(document, resolved, budget)?;
                    return Some(projected.to_string());
                }
                _ => return None,
            }
        }
        Object::Array(_) => {
            let projected = destination(document, value, budget)?;
            return Some(projected.to_string());
        }
        _ => {}
    }
    None
}

fn destination(
    document: &Document,
    value: &Object,
    budget: &mut SignalTextBudget,
) -> Option<Value> {
    // Match pdf.js annotation dest shape: keep page object refs as {num,gen}
    // and name tokens as {name}, without resolving array members first.
    let value = match value {
        Object::Reference(_) => resolve(document, value).ok()?,
        other => other,
    };
    match value {
        Object::String(_, _) => decoded_string(document, value, budget).map(Value::String),
        Object::Name(_) => bounded_name(value, budget).map(Value::String),
        Object::Array(values) if values.len() <= 8 => {
            let mut parts = Vec::with_capacity(values.len());
            for part in values {
                let projected = match part {
                    Object::Reference((object, generation)) => {
                        Some(json!({ "num": object, "gen": generation }))
                    }
                    Object::Integer(value) => Some(json!(value)),
                    Object::Real(value) => Some(json!(value)),
                    Object::Name(_) => {
                        bounded_name(part, budget).map(|name| json!({ "name": name }))
                    }
                    Object::String(_, _) => {
                        decoded_string(document, part, budget).map(Value::String)
                    }
                    Object::Null => Some(Value::Null),
                    other => match resolve(document, other).ok()? {
                        Object::Integer(value) => Some(json!(value)),
                        Object::Real(value) => Some(json!(value)),
                        Object::Name(_) => bounded_name(resolve(document, other).ok()?, budget)
                            .map(|name| json!({ "name": name })),
                        Object::String(_, _) => {
                            decoded_string(document, resolve(document, other).ok()?, budget)
                                .map(Value::String)
                        }
                        Object::Null => Some(Value::Null),
                        _ => None,
                    },
                }?;
                parts.push(projected);
            }
            Some(Value::Array(parts))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{dictionary, Dictionary};

    fn fixture_document() -> Document {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-behavior-v1.pdf");
        Document::load(path).expect("load immutable signal fixture")
    }

    fn document_with_pages(page_dicts: Vec<Dictionary>) -> Document {
        let mut document = Document::with_version("1.7");
        let pages_id = document.new_object_id();
        let page_ids = page_dicts
            .into_iter()
            .map(|mut page| {
                page.set("Type", "Page");
                page.set("Parent", pages_id);
                document.add_object(page)
            })
            .collect::<Vec<_>>();
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => page_ids.iter().copied().map(Object::Reference).collect::<Vec<_>>(),
                "Count" => page_ids.len() as i64,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        document
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
    fn dest_only_link_keeps_pdfjs_page_ref_and_name_shape() {
        let mut document = Document::with_version("1.7");
        let pages_id = document.new_object_id();
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let page_two_id = document.new_object_id();
        let link_id = document.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Link",
            "Rect" => vec![72.into(), 500.into(), 140.into(), 530.into()],
            "Dest" => vec![Object::Reference(page_two_id), Object::Name("Fit".into())],
        });
        let page_one_id = document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => font_id } },
            "Annots" => vec![Object::Reference(link_id)],
        });
        document.objects.insert(
            page_two_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
                "Resources" => dictionary! { "Font" => dictionary! { "F1" => font_id } },
            }),
        );
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_one_id), Object::Reference(page_two_id)],
                "Count" => 2,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(signals.warnings, Vec::<String>::new());
        let annotations = &signals.annotations[0]["annotations"].as_array().unwrap()[0];
        assert_eq!(annotations["subtype"], json!("Link"));
        assert_eq!(
            annotations["dest"],
            json!([{ "num": page_two_id.0, "gen": page_two_id.1 }, { "name": "Fit" }])
        );
    }

    #[test]
    fn goto_action_dest_is_exposed_like_pdfjs() {
        let mut document = Document::with_version("1.7");
        let pages_id = document.new_object_id();
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let page_two_id = document.new_object_id();
        let action = dictionary! {
            "S" => "GoTo",
            "D" => vec![
                Object::Reference(page_two_id),
                Object::Name("FitH".into()),
                700.into(),
            ],
        };
        let link_id = document.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Link",
            "Rect" => vec![72.into(), 500.into(), 140.into(), 530.into()],
            "A" => action,
        });
        let page_one_id = document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => font_id } },
            "Annots" => vec![Object::Reference(link_id)],
        });
        document.objects.insert(
            page_two_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
                "Resources" => dictionary! { "Font" => dictionary! { "F1" => font_id } },
            }),
        );
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_one_id), Object::Reference(page_two_id)],
                "Count" => 2,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(signals.warnings, Vec::<String>::new());
        let annotations = &signals.annotations[0]["annotations"].as_array().unwrap()[0];
        assert_eq!(annotations["subtype"], json!("Link"));
        assert_eq!(
            annotations["dest"],
            json!([
                { "num": page_two_id.0, "gen": page_two_id.1 },
                { "name": "FitH" },
                700
            ])
        );
    }

    #[test]
    fn goto_action_wins_over_explicit_dest_like_pdfjs() {
        let mut document = Document::with_version("1.7");
        let pages_id = document.new_object_id();
        let font_id = document.add_object(dictionary! {
            "Type" => "Font",
            "Subtype" => "Type1",
            "BaseFont" => "Helvetica",
        });
        let page_two_id = document.new_object_id();
        let action = dictionary! {
            "S" => "GoTo",
            "D" => vec![
                Object::Reference(page_two_id),
                Object::Name("FitH".into()),
                10.into(),
            ],
        };
        let link_id = document.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Link",
            "Rect" => vec![72.into(), 500.into(), 140.into(), 530.into()],
            "Dest" => vec![Object::Reference(page_two_id), Object::Name("Fit".into())],
            "A" => action,
        });
        let page_one_id = document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => font_id } },
            "Annots" => vec![Object::Reference(link_id)],
        });
        document.objects.insert(
            page_two_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
                "Resources" => dictionary! { "Font" => dictionary! { "F1" => font_id } },
            }),
        );
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_one_id), Object::Reference(page_two_id)],
                "Count" => 2,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        let annotations = &signals.annotations[0]["annotations"].as_array().unwrap()[0];
        assert_eq!(
            annotations["dest"],
            json!([
                { "num": page_two_id.0, "gen": page_two_id.1 },
                { "name": "FitH" },
                10
            ])
        );
        assert!(annotations.get("url").is_none());
    }

    #[test]
    fn uri_action_suppresses_dest_and_launch_maps_file_to_url() {
        let mut document = Document::with_version("1.7");
        let pages_id = document.new_object_id();
        let page_two_id = document.new_object_id();
        let uri_link = document.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Link",
            "Rect" => vec![72.into(), 500.into(), 140.into(), 530.into()],
            "Dest" => vec![Object::Reference(page_two_id), Object::Name("Fit".into())],
            "A" => dictionary! {
                "S" => "URI",
                "URI" => Object::string_literal("https://example.com/x"),
            },
        });
        let launch_link = document.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Link",
            "Rect" => vec![150.into(), 500.into(), 220.into(), 530.into()],
            "A" => dictionary! {
                "S" => "Launch",
                "F" => Object::string_literal("evil.exe"),
            },
        });
        let page_one_id = document.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Annots" => vec![Object::Reference(uri_link), Object::Reference(launch_link)],
        });
        document.objects.insert(
            page_two_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            }),
        );
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_one_id), Object::Reference(page_two_id)],
                "Count" => 2,
            }),
        );
        let catalog_id = document.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => pages_id,
        });
        document.trailer.set("Root", catalog_id);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        let annotations = signals.annotations[0]["annotations"].as_array().unwrap();
        assert_eq!(annotations[0]["url"], json!("https://example.com/x"));
        assert!(annotations[0].get("dest").is_none());
        assert_eq!(annotations[1]["url"], json!("evil.exe"));
        assert!(annotations[1].get("dest").is_none());
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

    #[test]
    fn malformed_geometry_uses_pdfjs_fallback_and_normalization_rules() {
        let document = document_with_pages(vec![
            dictionary! {},
            dictionary! { "MediaBox" => vec![612.into(), 792.into(), 0.into(), 0.into()] },
            dictionary! {
                "MediaBox" => vec![0.into(), 0.into(), 200.into(), 300.into()],
                "Rotate" => 45,
                "UserUnit" => 0,
            },
            dictionary! {
                "MediaBox" => vec![0.into(), 0.into(), 200.into(), 300.into()],
                "Rotate" => -90,
            },
            dictionary! { "MediaBox" => vec![0.into(), 0.into(), 0.into(), 0.into()] },
            dictionary! { "MediaBox" => vec![0.into(), 0.into(), 200.into(), 300.into(), 999.into()] },
            dictionary! {
                "MediaBox" => vec![0.into(), 0.into(), 200.into(), 300.into()],
                "CropBox" => vec![10.into(), 10.into(), 10.into(), 20.into()],
            },
        ]);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1, 2, 3, 4, 5, 6, 7], true, false);
        assert_eq!(
            signals.geometry,
            vec![
                json!({"page":1,"width":612.0,"height":792.0,"rotation":0.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":612.0,"top":792.0}}),
                json!({"page":2,"width":612.0,"height":792.0,"rotation":0.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":612.0,"top":792.0}}),
                json!({"page":3,"width":200.0,"height":300.0,"rotation":0.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":200.0,"top":300.0}}),
                json!({"page":4,"width":300.0,"height":200.0,"rotation":270.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":200.0,"top":300.0}}),
                json!({"page":5,"width":612.0,"height":792.0,"rotation":0.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":612.0,"top":792.0}}),
                json!({"page":6,"width":612.0,"height":792.0,"rotation":0.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":612.0,"top":792.0}}),
                json!({"page":7,"width":200.0,"height":300.0,"rotation":0.0,"user_unit":1.0,"view_box":{"left":0.0,"bottom":0.0,"right":200.0,"top":300.0}}),
            ]
        );
    }

    #[test]
    fn malformed_annotations_consume_the_request_wide_work_budget() {
        let page = || {
            dictionary! {
                "MediaBox" => vec![0.into(), 0.into(), 100.into(), 100.into()],
                "Annots" => vec![Object::Null; MAX_ANNOTATIONS_PER_PAGE],
            }
        };
        let document = document_with_pages((0..11).map(|_| page()).collect());
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let selected = (1..=11).collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &selected, false, true);
        assert!(signals.annotations.is_empty());
        assert_eq!(signals.warnings, vec![format!(
            "include_annotations: source reached the {MAX_ANNOTATIONS_PER_SOURCE} annotation work limit."
        )]);
    }

    #[test]
    fn oversized_annotation_strings_are_omitted_with_a_warning() {
        let annotation = Object::Dictionary(dictionary! {
            "Subtype" => "Text",
            "Contents" => Object::string_literal("x".repeat(MAX_STRING_BYTES + 1)),
        });
        let document = document_with_pages(vec![dictionary! {
            "MediaBox" => vec![0.into(), 0.into(), 100.into(), 100.into()],
            "Annots" => vec![annotation],
        }]);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(signals.annotations[0]["annotations"][0]["subtype"], "Text");
        assert!(signals.annotations[0]["annotations"][0]
            .get("contents")
            .is_none());
        assert_eq!(signals.warnings, vec![format!(
            "include_annotations: annotation strings exceeded the {MAX_STRING_BYTES}-byte field or {MAX_SIGNAL_TEXT_BYTES}-byte source text limit."
        )]);
    }

    #[test]
    fn aggregate_text_exhaustion_stops_later_decode_attempts() {
        let document = Document::with_version("1.7");
        let chunk = Object::string_literal("x".repeat(MAX_STRING_BYTES));
        let sentinel = Object::string_literal("must-not-decode");
        let mut budget = SignalTextBudget::new();
        for _ in 0..(MAX_SIGNAL_TEXT_BYTES / MAX_STRING_BYTES) {
            assert!(decoded_string(&document, &chunk, &mut budget).is_some());
        }
        assert_eq!(budget.remaining, 0);
        assert_eq!(budget.decode_attempts, 32);
        assert!(decoded_string(&document, &sentinel, &mut budget).is_none());
        assert_eq!(budget.decode_attempts, 32);
        assert!(budget.truncated);
    }

    #[test]
    fn text_annotation_without_appearance_uses_pdfjs_icon_box() {
        let annotation = Object::Dictionary(dictionary! {
            "Subtype" => "Text",
            "Contents" => "Sticky note",
            "T" => "Author",
            "Rect" => vec![120.into(), 680.into(), 140.into(), 700.into()],
        });
        let document = document_with_pages(vec![dictionary! {
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Annots" => vec![annotation],
        }]);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(
            signals.annotations[0]["annotations"][0]["bounding_box"],
            json!({"left": 120.0, "bottom": 678.0, "right": 142.0, "top": 700.0})
        );
        assert_eq!(signals.annotations[0]["annotations"][0]["subtype"], "Text");
    }

    #[test]
    fn freetext_annotation_keeps_raw_rect_box() {
        let annotation = Object::Dictionary(dictionary! {
            "Subtype" => "FreeText",
            "Contents" => "Hello FreeText",
            "Rect" => vec![100.into(), 600.into(), 250.into(), 650.into()],
        });
        let document = document_with_pages(vec![dictionary! {
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Annots" => vec![annotation],
        }]);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(
            signals.annotations[0]["annotations"][0]["bounding_box"],
            json!({"left": 100.0, "bottom": 600.0, "right": 250.0, "top": 650.0})
        );
    }

    #[test]
    fn launch_file_dict_prefers_uf_like_pdfjs() {
        let annotation = Object::Dictionary(dictionary! {
            "Subtype" => "Link",
            "Rect" => vec![72.into(), 500.into(), 140.into(), 530.into()],
            "A" => dictionary! {
                "S" => "Launch",
                "F" => dictionary! {
                    "F" => Object::string_literal("report.pdf"),
                    "UF" => Object::string_literal("report-u.pdf"),
                },
            },
        });
        let document = document_with_pages(vec![dictionary! {
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Annots" => vec![annotation],
        }]);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(
            signals.annotations[0]["annotations"][0]["url"],
            "report-u.pdf"
        );
        assert!(signals.annotations[0]["annotations"][0]
            .get("dest")
            .is_none());
    }

    #[test]
    fn gotor_appends_remote_dest_json_like_pdfjs() {
        let annotation = Object::Dictionary(dictionary! {
            "Subtype" => "Link",
            "Rect" => vec![72.into(), 500.into(), 140.into(), 530.into()],
            "A" => dictionary! {
                "S" => "GoToR",
                "F" => Object::string_literal("other.pdf"),
                "D" => vec![Object::Integer(0), Object::Name("Fit".into())],
                "NewWindow" => true,
            },
        });
        let document = document_with_pages(vec![dictionary! {
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Annots" => vec![annotation],
        }]);
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        assert_eq!(
            signals.annotations[0]["annotations"][0]["url"],
            r#"other.pdf#[0,{"name":"Fit"}]"#
        );
        assert!(signals.annotations[0]["annotations"][0]
            .get("dest")
            .is_none());
    }

    #[test]
    fn gotor_named_dest_string_and_name_token_append_like_pdfjs() {
        for (fixture, _) in [
            (
                "../../test/fixtures/differential/v3014-annotation-gotor-named-string-v1.pdf",
                "string",
            ),
            (
                "../../test/fixtures/differential/v3014-annotation-gotor-named-name-v1.pdf",
                "name",
            ),
        ] {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(fixture);
            if !path.is_file() {
                continue;
            }
            let document = Document::load(&path).expect("load gotor named fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            assert_eq!(
                signals.annotations[0]["annotations"][0]["url"],
                "other.pdf#Chapter1"
            );
            assert!(signals.annotations[0]["annotations"][0]
                .get("dest")
                .is_none());
        }
    }

    #[test]
    fn popup_inherits_parent_title_and_contents() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-popup-v1.pdf");
        if !path.is_file() {
            return;
        }
        let document = Document::load(&path).expect("load popup fixture");
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        let anns = signals.annotations[0]["annotations"].as_array().unwrap();
        assert_eq!(anns.len(), 2);
        let popup = anns.iter().find(|a| a["subtype"] == "Popup").unwrap();
        assert_eq!(popup["contents"], "Parent note");
        assert_eq!(popup["title"], "Author");
        assert_eq!(
            popup["bounding_box"],
            json!({"left": 130.0, "bottom": 600.0, "right": 250.0, "top": 670.0})
        );
        let text = anns.iter().find(|a| a["subtype"] == "Text").unwrap();
        assert_eq!(text["contents"], "Parent note");
        assert_eq!(
            text["bounding_box"],
            json!({"left": 100.0, "bottom": 650.0, "right": 122.0, "top": 672.0})
        );
    }

    #[test]
    fn popup_zero_size_rect_omits_bounding_box() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-popup-zerosize-v1.pdf");
        if !path.is_file() {
            return;
        }
        let document = Document::load(&path).expect("load zero-size popup fixture");
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        let anns = signals.annotations[0]["annotations"].as_array().unwrap();
        let popup = anns.iter().find(|a| a["subtype"] == "Popup").unwrap();
        assert!(
            popup.get("bounding_box").is_none(),
            "zero-size popup must omit bounding_box"
        );
        assert_eq!(popup["contents"], "Parent note");
        assert_eq!(popup["title"], "Author");
        let text = anns.iter().find(|a| a["subtype"] == "Text").unwrap();
        assert_eq!(
            text["bounding_box"],
            json!({"left": 100.0, "bottom": 650.0, "right": 122.0, "top": 672.0})
        );
    }

    #[test]
    fn group_text_and_popup_inherit_irt_title_and_contents() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-popup-group-irt-v1.pdf");
        if !path.is_file() {
            return;
        }
        let document = Document::load(&path).expect("load group/irt fixture");
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        let anns = signals.annotations[0]["annotations"].as_array().unwrap();
        assert_eq!(anns.len(), 4);
        let root = anns.iter().find(|a| a["id"] == "5R").unwrap();
        assert_eq!(root["contents"], "Root note");
        assert_eq!(root["title"], "RootAuthor");
        let group = anns.iter().find(|a| a["id"] == "6R").unwrap();
        assert_eq!(group["contents"], "Root note");
        assert_eq!(group["title"], "RootAuthor");
        let group_popup = anns.iter().find(|a| a["id"] == "9R").unwrap();
        assert_eq!(group_popup["contents"], "Root note");
        assert_eq!(group_popup["title"], "RootAuthor");
        assert_eq!(
            group_popup["bounding_box"],
            json!({"left": 230.0, "bottom": 600.0, "right": 350.0, "top": 670.0})
        );
    }

    #[test]
    fn text_with_appearance_keeps_raw_rect_even_if_stream_empty() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-text-ap-v1.pdf");
        if path.is_file() {
            let document = Document::load(&path).expect("load text ap fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], "Text");
            assert_eq!(
                ann["bounding_box"],
                json!({"left": 100.0, "bottom": 600.0, "right": 200.0, "top": 700.0})
            );
        }
        let empty = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-text-emptyap-v1.pdf");
        if empty.is_file() {
            let document = Document::load(&empty).expect("load empty ap fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], "Text");
            assert_eq!(
                ann["bounding_box"],
                json!({"left": 50.0, "bottom": 600.0, "right": 150.0, "top": 700.0})
            );
        }
    }

    #[test]
    fn text_named_appearance_requires_as_for_raw_rect() {
        let with_as = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-text-namedap-v1.pdf");
        if with_as.is_file() {
            let document = Document::load(&with_as).expect("load named ap fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(
                ann["bounding_box"],
                json!({"left": 80.0, "bottom": 600.0, "right": 180.0, "top": 700.0})
            );
        }
        let no_as = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-text-namedap-noas-v1.pdf");
        if no_as.is_file() {
            let document = Document::load(&no_as).expect("load named ap no-as fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            // pdf.js icon box: bottom = top-22, right = left+22
            assert_eq!(
                ann["bounding_box"],
                json!({"left": 90.0, "bottom": 688.0, "right": 112.0, "top": 710.0})
            );
        }
    }

    #[test]
    fn text_no_appearance_normalizes_inverted_rect_before_icon_box() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-annotation-text-inverted-v1.pdf");
        if !path.is_file() {
            return;
        }
        let document = Document::load(&path).expect("load inverted text fixture");
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let signals = extract_page_signals(&document, &pages, &[1], false, true);
        let ann = &signals.annotations[0]["annotations"][0];
        assert_eq!(ann["subtype"], "Text");
        assert_eq!(ann["contents"], "Inverted");
        assert_eq!(
            ann["bounding_box"],
            json!({"left": 100.0, "bottom": 678.0, "right": 122.0, "top": 700.0})
        );
    }

    #[test]
    fn polyline_polygon_nonintersecting_rect_uses_vertices_bbox() {
        let cases = [
            (
                "v3014-annotation-polyline-l-bbox-v1.pdf",
                "PolyLine",
                json!({"left": 98.0, "bottom": 98.0, "right": 202.0, "top": 202.0}),
            ),
            (
                "v3014-annotation-polygon-l-bbox-v1.pdf",
                "Polygon",
                json!({"left": 48.0, "bottom": 48.0, "right": 122.0, "top": 122.0}),
            ),
            (
                "v3014-annotation-polyline-border2-v1.pdf",
                "PolyLine",
                json!({"left": 6.0, "bottom": 6.0, "right": 104.0, "top": 84.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load polyline/polygon fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype);
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn ink_nonintersecting_rect_uses_inklist_bbox() {
        let cases = [
            (
                "v3014-annotation-ink-l-bbox-v1.pdf",
                json!({"left": 98.0, "bottom": 98.0, "right": 182.0, "top": 202.0}),
            ),
            (
                "v3014-annotation-ink-multistroke-v1.pdf",
                json!({"left": 8.0, "bottom": 48.0, "right": 92.0, "top": 122.0}),
            ),
            (
                "v3014-annotation-ink-border2-v1.pdf",
                json!({"left": 26.0, "bottom": 26.0, "right": 104.0, "top": 94.0}),
            ),
        ];
        for (fixture, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load ink fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], "Ink");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn tiny_rect_border_width_clamp_matches_pdfjs() {
        let cases = [
            (
                "v3014-annotation-polyline-clamp-w2-v1.pdf",
                "PolyLine",
                json!({"left": 8.0, "bottom": 8.0, "right": 102.0, "top": 82.0}),
            ),
            (
                "v3014-annotation-line-clamp-w2-v1.pdf",
                "Line",
                json!({"left": 7.0, "bottom": 7.0, "right": 103.0, "top": 83.0}),
            ),
            (
                "v3014-annotation-ink-clamp-w2-v1.pdf",
                "Ink",
                json!({"left": 28.0, "bottom": 28.0, "right": 102.0, "top": 92.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load clamp fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn border_array_width_drives_line_polyline_ink_boxes() {
        let cases = [
            (
                "v3014-annotation-polyline-border-array-w2-v1.pdf",
                "PolyLine",
                json!({"left": 6.0, "bottom": 6.0, "right": 104.0, "top": 84.0}),
            ),
            (
                "v3014-annotation-line-border-array-w2-v1.pdf",
                "Line",
                json!({"left": 4.0, "bottom": 4.0, "right": 106.0, "top": 86.0}),
            ),
            (
                "v3014-annotation-ink-border-array-w3-v1.pdf",
                "Ink",
                json!({"left": 24.0, "bottom": 24.0, "right": 106.0, "top": 96.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load border array fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn border_bs_preference_over_border_array_width() {
        // Border [0 0 9] would expand much more; BS/W must win.
        let cases = [
            (
                "v3014-annotation-polyline-border-bs-pref-v1.pdf",
                "PolyLine",
                json!({"left": 6.0, "bottom": 6.0, "right": 104.0, "top": 84.0}),
            ),
            (
                "v3014-annotation-line-border-bs-pref-v1.pdf",
                "Line",
                json!({"left": 4.0, "bottom": 4.0, "right": 106.0, "top": 86.0}),
            ),
            (
                "v3014-annotation-ink-border-bs-pref-v1.pdf",
                "Ink",
                json!({"left": 24.0, "bottom": 24.0, "right": 106.0, "top": 96.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load border BS preference fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn border_bs_nondict_does_not_fall_through_to_border_array() {
        // BS null with Border [0 0 9] must keep default width 1, not Border[2]=9.
        let cases = [
            (
                "v3014-annotation-polyline-border-bs-null-v1.pdf",
                "PolyLine",
                json!({"left": 8.0, "bottom": 8.0, "right": 102.0, "top": 82.0}),
            ),
            (
                "v3014-annotation-line-border-bs-null-v1.pdf",
                "Line",
                json!({"left": 7.0, "bottom": 7.0, "right": 103.0, "top": 83.0}),
            ),
            (
                "v3014-annotation-ink-border-bs-null-v1.pdf",
                "Ink",
                json!({"left": 28.0, "bottom": 28.0, "right": 102.0, "top": 92.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load border BS nondict fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn border_array_short_keeps_default_width() {
        // Border length < 3 (no BS) must keep default drawing width 1.
        let cases = [
            (
                "v3014-annotation-polyline-border-short-v1.pdf",
                "PolyLine",
                json!({"left": 8.0, "bottom": 8.0, "right": 102.0, "top": 82.0}),
            ),
            (
                "v3014-annotation-line-border-empty-v1.pdf",
                "Line",
                json!({"left": 7.0, "bottom": 7.0, "right": 103.0, "top": 83.0}),
            ),
            (
                "v3014-annotation-ink-border-short-v1.pdf",
                "Ink",
                json!({"left": 28.0, "bottom": 28.0, "right": 102.0, "top": 92.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load short Border fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn border_bs_wrong_type_ignores_w_and_border() {
        // BS Type not Border with W=9 and Border[2]=5 must keep default width 1.
        let cases = [
            (
                "v3014-annotation-polyline-border-bs-wrong-type-v1.pdf",
                "PolyLine",
                json!({"left": 8.0, "bottom": 8.0, "right": 102.0, "top": 82.0}),
            ),
            (
                "v3014-annotation-line-border-bs-wrong-type-v1.pdf",
                "Line",
                json!({"left": 7.0, "bottom": 7.0, "right": 103.0, "top": 83.0}),
            ),
            (
                "v3014-annotation-ink-border-bs-wrong-type-v1.pdf",
                "Ink",
                json!({"left": 28.0, "bottom": 28.0, "right": 102.0, "top": 92.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load BS wrong-type fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn border_zero_size_rect_bypasses_width_clamp() {
        // Zero-dimension Rect + BS/W=2 must keep width 2 (no clamp).
        let cases = [
            (
                "v3014-annotation-polyline-zero-h-w2-v1.pdf",
                "PolyLine",
                json!({"left": 6.0, "bottom": 6.0, "right": 104.0, "top": 84.0}),
            ),
            (
                "v3014-annotation-line-zero-h-w2-v1.pdf",
                "Line",
                json!({"left": 4.0, "bottom": 4.0, "right": 106.0, "top": 86.0}),
            ),
            (
                "v3014-annotation-ink-zero-w-w2-v1.pdf",
                "Ink",
                json!({"left": 26.0, "bottom": 26.0, "right": 104.0, "top": 94.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load zero-size clamp-bypass fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn appearance_present_skips_line_polyline_ink_geometry_expansion() {
        // AP/N present => keep raw Rect even when L/vertices would expand farther.
        let cases = [
            (
                "v3014-annotation-line-ap-bbox-v1.pdf",
                "Line",
                json!({"left": 200.0, "bottom": 200.0, "right": 300.0, "top": 300.0}),
            ),
            (
                "v3014-annotation-polyline-ap-bbox-v1.pdf",
                "PolyLine",
                json!({"left": 200.0, "bottom": 200.0, "right": 300.0, "top": 300.0}),
            ),
            (
                "v3014-annotation-ink-ap-bbox-v1.pdf",
                "Ink",
                json!({"left": 200.0, "bottom": 200.0, "right": 300.0, "top": 300.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load appearance bbox fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn ap_n_nonstream_still_expands_line_polyline_ink_geometry() {
        // AP/N null or name is not appearance => expand geometry with BS/W=2.
        let cases = [
            (
                "v3014-annotation-line-ap-n-null-v1.pdf",
                "Line",
                json!({"left": 4.0, "bottom": 4.0, "right": 106.0, "top": 86.0}),
            ),
            (
                "v3014-annotation-polyline-ap-n-name-v1.pdf",
                "PolyLine",
                json!({"left": 6.0, "bottom": 6.0, "right": 104.0, "top": 84.0}),
            ),
            (
                "v3014-annotation-ink-ap-n-null-v1.pdf",
                "Ink",
                json!({"left": 26.0, "bottom": 26.0, "right": 104.0, "top": 94.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load AP non-stream fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn ap_named_state_as_selection_for_line_geometry() {
        let cases = [
            (
                "v3014-annotation-line-ap-as-on-v1.pdf",
                json!({"left": 200.0, "bottom": 200.0, "right": 300.0, "top": 300.0}),
            ),
            (
                "v3014-annotation-line-ap-as-missing-v1.pdf",
                json!({"left": 4.0, "bottom": 4.0, "right": 106.0, "top": 86.0}),
            ),
            (
                "v3014-annotation-line-ap-as-invalid-v1.pdf",
                json!({"left": 4.0, "bottom": 4.0, "right": 106.0, "top": 86.0}),
            ),
        ];
        for (fixture, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load AP named-state fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], "Line", "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }

    #[test]
    fn ap_named_state_polyline_ink_breadth() {
        let cases = [
            (
                "v3014-annotation-polyline-ap-as-on-v1.pdf",
                "PolyLine",
                json!({"left": 200.0, "bottom": 200.0, "right": 300.0, "top": 300.0}),
            ),
            (
                "v3014-annotation-ink-ap-as-missing-v1.pdf",
                "Ink",
                json!({"left": 26.0, "bottom": 26.0, "right": 104.0, "top": 94.0}),
            ),
            (
                "v3014-annotation-polyline-ap-as-invalid-v1.pdf",
                "PolyLine",
                json!({"left": 6.0, "bottom": 6.0, "right": 104.0, "top": 84.0}),
            ),
        ];
        for (fixture, subtype, expected) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            assert!(path.is_file(), "missing fixture {fixture}");
            let document = Document::load(&path).expect("load named-state polyline/ink fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let signals = extract_page_signals(&document, &pages, &[1], false, true);
            let ann = &signals.annotations[0]["annotations"][0];
            assert_eq!(ann["subtype"], subtype, "fixture {fixture}");
            assert_eq!(ann["bounding_box"], expected, "fixture {fixture}");
        }
    }
}
