use std::collections::{HashSet, VecDeque};

use lopdf::{Dictionary, Document, Object, ObjectId};
use pdf_extract::decode_text_string;
use serde::Serialize;

use crate::cos_document::EncryptionFacts;

const MAX_REFERENCE_DEPTH: usize = 64;
const MAX_TREE_DEPTH: usize = 64;
const MAX_OBJECT_WORK: usize = 100_000;
const MAX_ENTRIES: usize = 10_000;
const MAX_STRING_BYTES: usize = 64 * 1024;
const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;

#[derive(Default)]
pub(crate) struct CatalogSignals {
    pub page_labels: Option<Vec<String>>,
    pub mark_info: Option<MarkInfo>,
    pub permissions: Option<Vec<String>>,
    pub outline: Option<Vec<OutlineItem>>,
}

#[derive(Debug, Serialize)]
pub(crate) struct MarkInfo {
    #[serde(rename = "Marked")]
    marked: bool,
    #[serde(rename = "UserProperties")]
    user_properties: bool,
    #[serde(rename = "Suspects")]
    suspects: bool,
}

#[derive(Clone, Debug, Serialize)]
pub(crate) struct OutlineItem {
    title: String,
    bold: bool,
    italic: bool,
    color: Vec<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    dest: Destination,
    #[serde(skip_serializing_if = "Option::is_none")]
    items: Option<Vec<OutlineItem>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(untagged)]
enum Destination {
    Text(String),
    Parts(Vec<DestinationPart>),
    Null,
}

#[derive(Clone, Debug, Serialize)]
#[serde(untagged)]
enum DestinationPart {
    Integer(i64),
    Real(f64),
    Text(String),
    Name { name: String },
    Reference { num: u32, gen: u16 },
    Null,
}

pub(crate) struct CatalogSignalRequest {
    pub page_labels: bool,
    pub permissions: bool,
    pub outline: bool,
}

pub(crate) fn extract_catalog_signals(
    document: &Document,
    encryption_facts: Option<EncryptionFacts>,
    num_pages: u32,
    request: CatalogSignalRequest,
) -> CatalogSignals {
    let mut output = CatalogSignals::default();
    let Ok(catalog) = document.catalog().cloned() else {
        return output;
    };
    if request.page_labels {
        let mut walker = Walker::new(document);
        output.page_labels = extract_page_labels(&mut walker, &catalog, num_pages);
    }
    if request.permissions {
        output.permissions = extract_permissions(encryption_facts);
        let mut walker = Walker::new(document);
        output.mark_info = extract_mark_info(&mut walker, &catalog);
    }
    if request.outline {
        let mut walker = Walker::new(document);
        output.outline = extract_outline(&mut walker, &catalog);
    }
    output
}

struct Walker<'a> {
    document: &'a Document,
    work: usize,
    entries: usize,
    text_remaining: usize,
    truncated: bool,
    failed: bool,
}

impl<'a> Walker<'a> {
    fn new(document: &'a Document) -> Self {
        Self {
            document,
            work: 0,
            entries: 0,
            text_remaining: MAX_TEXT_BYTES,
            truncated: false,
            failed: false,
        }
    }

    fn resolve_owned(&mut self, value: &Object) -> Option<Object> {
        let mut current = value.clone();
        let mut visited = HashSet::new();
        for _ in 0..MAX_REFERENCE_DEPTH {
            self.work += 1;
            if self.work > MAX_OBJECT_WORK {
                self.truncated = true;
                return None;
            }
            let Object::Reference(id) = current else {
                return Some(current);
            };
            if !visited.insert(id) {
                self.truncated = true;
                return None;
            }
            let Ok(next) = self.document.get_object(id) else {
                self.failed = true;
                return None;
            };
            current = next.clone();
        }
        self.truncated = true;
        None
    }

    fn dict(&mut self, value: &Object) -> Option<Dictionary> {
        self.resolve_owned(value)?.as_dict().ok().cloned()
    }

    fn text(&mut self, value: &Object) -> Option<String> {
        let value = self.resolve_owned(value)?;
        let raw_len = match &value {
            Object::String(bytes, _) | Object::Name(bytes) => bytes.len(),
            _ => return None,
        };
        if raw_len > MAX_STRING_BYTES || raw_len > self.text_remaining {
            self.text_remaining = 0;
            self.truncated = true;
            return None;
        }
        let decoded = match &value {
            Object::Name(bytes) => String::from_utf8_lossy(bytes).into_owned(),
            _ => match decode_text_string(&value) {
                Ok(value) => value,
                Err(_) => {
                    self.failed = true;
                    return None;
                }
            },
        };
        if decoded.len() > MAX_STRING_BYTES || decoded.len() > self.text_remaining {
            self.text_remaining = 0;
            self.truncated = true;
            return None;
        }
        self.text_remaining -= decoded.len();
        Some(decoded)
    }
}

fn extract_mark_info(walker: &mut Walker<'_>, catalog: &Dictionary) -> Option<MarkInfo> {
    let dict = walker.dict(catalog.get(b"MarkInfo").ok()?)?;
    let mut boolean = |key: &[u8]| {
        dict.get(key)
            .ok()
            .and_then(|value| walker.resolve_owned(value))
            .and_then(|value| value.as_bool().ok())
    };
    let value = MarkInfo {
        marked: boolean(b"Marked").unwrap_or(false),
        user_properties: boolean(b"UserProperties").unwrap_or(false),
        suspects: boolean(b"Suspects").unwrap_or(false),
    };
    (!walker.truncated && !walker.failed).then_some(value)
}

fn extract_permissions(facts: Option<EncryptionFacts>) -> Option<Vec<String>> {
    let facts = facts?;
    let raw = facts.permissions?;
    let bits = (raw as i32) as u32;
    let mut labels = Vec::new();
    for (flag, label) in [
        (4, "print"),
        (8, "modify"),
        (16, "copy"),
        (32, "annotate"),
        (256, "fill_forms"),
        (512, "copy_for_accessibility"),
        (1024, "assemble"),
        (2048, "print_high_quality"),
    ] {
        if bits & flag != 0 {
            labels.push(label.to_string());
        }
    }
    (!labels.is_empty()).then_some(labels)
}

#[derive(Clone)]
struct LabelRange {
    start: u32,
    style: Option<Vec<u8>>,
    prefix: String,
    first: u32,
}

fn extract_page_labels(
    walker: &mut Walker<'_>,
    catalog: &Dictionary,
    num_pages: u32,
) -> Option<Vec<String>> {
    if num_pages as usize > MAX_ENTRIES {
        walker.truncated = true;
        return None;
    }
    let root = catalog.get(b"PageLabels").ok()?.clone();
    let mut ranges = Vec::new();
    let mut processed = HashSet::new();
    let mut invalid = false;
    collect_label_ranges(walker, &root, 0, &mut processed, &mut ranges, &mut invalid);
    if invalid || walker.truncated || walker.failed {
        return None;
    }
    ranges.sort_by_key(|range| range.start);
    ranges.dedup_by_key(|range| range.start);
    let mut labels = Vec::with_capacity(num_pages as usize);
    let default_range = LabelRange {
        start: 0,
        style: None,
        prefix: String::new(),
        first: 1,
    };
    let mut active: &LabelRange = &default_range;
    let mut next = 0usize;
    let mut label_bytes_remaining = MAX_TEXT_BYTES;
    for page_index in 0..num_pages {
        while next < ranges.len() && ranges[next].start <= page_index {
            active = &ranges[next];
            next += 1;
        }
        let range = active;
        let number = range
            .first
            .saturating_add(page_index.saturating_sub(range.start));
        let suffix = format_label(range.style.as_deref(), number)?;
        let label_bytes = range.prefix.len().checked_add(suffix.len())?;
        if label_bytes > MAX_STRING_BYTES || label_bytes > label_bytes_remaining {
            return None;
        }
        label_bytes_remaining -= label_bytes;
        labels.push(format!("{}{}", range.prefix, suffix));
    }
    Some(labels)
}

fn collect_label_ranges(
    walker: &mut Walker<'_>,
    value: &Object,
    depth: usize,
    processed: &mut HashSet<ObjectId>,
    output: &mut Vec<LabelRange>,
    invalid: &mut bool,
) {
    if depth >= MAX_TREE_DEPTH || output.len() >= MAX_ENTRIES || walker.entries >= MAX_ENTRIES {
        walker.truncated = true;
        return;
    }
    walker.entries += 1;
    let id = value.as_reference().ok();
    if let Some(id) = id {
        if !processed.insert(id) {
            walker.truncated = true;
            return;
        }
    }
    let Some(dict) = walker.dict(value) else {
        *invalid = true;
        return;
    };
    if let Ok(value) = dict.get(b"Kids") {
        let Some(kids) = walker
            .resolve_owned(value)
            .and_then(|value| value.as_array().ok().cloned())
        else {
            *invalid = true;
            return;
        };
        if kids.len() > MAX_ENTRIES {
            walker.truncated = true;
            return;
        }
        for kid in &kids {
            collect_label_ranges(walker, kid, depth + 1, processed, output, invalid);
            if walker.truncated {
                return;
            }
        }
        // PDF.js treats a node with Kids as an internal node and ignores a
        // same-node Nums entry.
        return;
    }
    if let Ok(value) = dict.get(b"Nums") {
        let Some(nums) = walker
            .resolve_owned(value)
            .and_then(|value| value.as_array().ok().cloned())
        else {
            *invalid = true;
            return;
        };
        if nums.len() % 2 != 0 || nums.len() / 2 > MAX_ENTRIES.saturating_sub(output.len()) {
            walker.truncated = true;
            return;
        }
        for pair in nums.chunks_exact(2) {
            let Some(start) = walker
                .resolve_owned(&pair[0])
                .and_then(|value| value.as_i64().ok())
                .and_then(|n| u32::try_from(n).ok())
            else {
                *invalid = true;
                continue;
            };
            let Some(spec) = walker.dict(&pair[1]) else {
                *invalid = true;
                continue;
            };
            if let Ok(value) = spec.get(b"Type") {
                let valid = walker
                    .resolve_owned(value)
                    .and_then(|value| value.as_name().ok().map(<[u8]>::to_vec))
                    .is_some_and(|name| name == b"PageLabel");
                if !valid {
                    *invalid = true;
                    continue;
                }
            }
            let style = if let Ok(value) = spec.get(b"S") {
                let Some(style) = walker
                    .resolve_owned(value)
                    .and_then(|value| value.as_name().ok().map(<[u8]>::to_vec))
                else {
                    *invalid = true;
                    continue;
                };
                Some(style)
            } else {
                None
            };
            if style
                .as_deref()
                .is_some_and(|value| !matches!(value, b"D" | b"R" | b"r" | b"A" | b"a"))
            {
                *invalid = true;
                continue;
            }
            let prefix = if let Ok(value) = spec.get(b"P") {
                let Some(prefix) = walker.text(value) else {
                    *invalid = true;
                    continue;
                };
                prefix
            } else {
                String::new()
            };
            let first = if let Ok(value) = spec.get(b"St") {
                let Some(value) = value
                    .as_i64()
                    .ok()
                    .and_then(|n| u32::try_from(n).ok())
                    .filter(|n| *n > 0)
                else {
                    *invalid = true;
                    continue;
                };
                value
            } else {
                1
            };
            output.push(LabelRange {
                start,
                style,
                prefix,
                first,
            });
        }
    }
}

fn format_label(style: Option<&[u8]>, number: u32) -> Option<String> {
    match style {
        None => Some(String::new()),
        Some(b"D") => Some(number.to_string()),
        Some(b"R") => roman(number, false),
        Some(b"r") => roman(number, true),
        Some(b"A") => alphabetic(number, false),
        Some(b"a") => alphabetic(number, true),
        _ => None,
    }
}

fn alphabetic(number: u32, lower: bool) -> Option<String> {
    if number == 0 {
        return None;
    }
    let ch = ((number - 1) % 26) as u8 + if lower { b'a' } else { b'A' };
    let repetitions = ((number - 1) / 26 + 1) as usize;
    if repetitions > MAX_STRING_BYTES {
        return None;
    }
    Some(std::iter::repeat_n(char::from(ch), repetitions).collect())
}

fn roman(mut number: u32, lower: bool) -> Option<String> {
    if number == 0 || number > 3999 {
        return None;
    }
    let mut out = String::new();
    for (value, token) in [
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    ] {
        while number >= value {
            number -= value;
            out.push_str(token);
        }
    }
    Some(if lower { out.to_lowercase() } else { out })
}

fn extract_outline(walker: &mut Walker<'_>, catalog: &Dictionary) -> Option<Vec<OutlineItem>> {
    let root = walker.dict(catalog.get(b"Outlines").ok()?)?;
    let first = root.get(b"First").ok()?.clone();
    let first_id = first.as_reference().ok()?;
    let mut processed = HashSet::new();
    processed.insert(first_id);
    let mut arena = vec![OutlineArenaNode::default()];
    let mut queue = VecDeque::from([(first, 0usize, 0usize)]);

    while let Some((value, parent, depth)) = queue.pop_front() {
        if depth >= MAX_TREE_DEPTH || walker.entries >= MAX_ENTRIES {
            walker.truncated = true;
            break;
        }
        let Some(object) = walker.resolve_owned(&value) else {
            break;
        };
        if matches!(object, Object::Null) {
            continue;
        }
        let Ok(dict) = object.as_dict() else {
            walker.failed = true;
            break;
        };
        walker.entries += 1;
        let node = arena.len();
        arena.push(OutlineArenaNode {
            item: normalize_outline_item(walker, dict),
            children: Vec::new(),
        });
        arena[parent].children.push(node);

        for (key, child_parent, child_depth) in [
            (b"First".as_slice(), node, depth + 1),
            (b"Next".as_slice(), parent, depth),
        ] {
            let Ok(next) = dict.get(key) else { continue };
            let Ok(next_id) = next.as_reference() else {
                continue;
            };
            if processed.insert(next_id) {
                queue.push_back((next.clone(), child_parent, child_depth));
            }
        }
    }
    if walker.truncated || walker.failed {
        return None;
    }
    Some(build_outline_children(&arena, 0))
}

#[derive(Default)]
struct OutlineArenaNode {
    item: Option<OutlineItem>,
    children: Vec<usize>,
}

fn build_outline_children(arena: &[OutlineArenaNode], parent: usize) -> Vec<OutlineItem> {
    arena[parent]
        .children
        .iter()
        .filter_map(|child| {
            let mut item = arena[*child].item.as_ref()?.clone();
            let children = build_outline_children(arena, *child);
            if !children.is_empty() {
                item.items = Some(children);
            }
            Some(item)
        })
        .collect()
}

fn normalize_outline_item(walker: &mut Walker<'_>, dict: &Dictionary) -> Option<OutlineItem> {
    let title = walker.text(dict.get(b"Title").ok()?)?.trim().to_string();
    if title.is_empty() {
        return None;
    }
    let flags = dict
        .get(b"F")
        .ok()
        .and_then(|v| v.as_i64().ok())
        .unwrap_or(0);
    let color = dict
        .get(b"C")
        .ok()
        .and_then(|v| v.as_array().ok())
        .filter(|v| v.len() == 3)
        .and_then(|v| v.iter().map(finite_number).collect::<Option<Vec<_>>>())
        .map(|values| {
            values
                .into_iter()
                .map(|value| (value.clamp(0.0, 1.0) * 255.0).round() as u8)
                .collect()
        })
        .unwrap_or_else(|| vec![0, 0, 0]);
    let direct_dest = dict
        .get(b"Dest")
        .ok()
        .and_then(|v| normalized_destination(walker, v));
    let action = dict.get(b"A").ok().and_then(|v| walker.dict(v));
    let action_kind = action
        .as_ref()
        .and_then(|a| a.get(b"S").ok())
        .and_then(|v| v.as_name().ok());
    let url = action
        .as_ref()
        .filter(|_| action_kind == Some(b"URI"))
        .and_then(|a| a.get(b"URI").ok())
        .and_then(|v| walker.text(v))
        .and_then(|value| safe_outline_url(walker, &value));
    let action_dest = action
        .as_ref()
        .filter(|_| action_kind == Some(b"GoTo"))
        .and_then(|a| a.get(b"D").ok())
        .and_then(|v| normalized_destination(walker, v));
    // PDF.js initializes every outline destination to null, including items
    // with no action or with an unsupported action. The TS sanitizer retains
    // null because the member is defined.
    let dest = direct_dest.or(action_dest).unwrap_or(Destination::Null);
    Some(OutlineItem {
        title,
        bold: flags & 2 != 0,
        italic: flags & 1 != 0,
        color,
        url,
        dest,
        items: None,
    })
}

fn safe_outline_url(walker: &mut Walker<'_>, value: &str) -> Option<String> {
    let parsed = url::Url::parse(value).ok()?;
    if !matches!(parsed.scheme(), "http" | "https" | "ftp" | "mailto" | "tel") {
        return None;
    }
    let normalized = parsed.to_string();
    if normalized.len() > MAX_STRING_BYTES {
        walker.text_remaining = 0;
        walker.truncated = true;
        return None;
    }
    let expansion = normalized.len().saturating_sub(value.len());
    if expansion > walker.text_remaining {
        walker.text_remaining = 0;
        walker.truncated = true;
        return None;
    }
    walker.text_remaining -= expansion;
    Some(normalized)
}

fn finite_number(value: &Object) -> Option<f64> {
    let n = match value {
        Object::Integer(v) => *v as f64,
        Object::Real(v) => f64::from(*v),
        _ => return None,
    };
    n.is_finite().then_some(n)
}

fn normalized_destination(walker: &mut Walker<'_>, value: &Object) -> Option<Destination> {
    let value = walker.resolve_owned(value)?;
    match &value {
        Object::String(_, _) | Object::Name(_) => walker.text(&value).map(Destination::Text),
        Object::Array(parts) if parts.len() <= 8 => {
            let mut output = Vec::new();
            for part in parts {
                output.push(match part {
                    Object::Integer(v) => DestinationPart::Integer(*v),
                    Object::Real(v) if v.is_finite() => DestinationPart::Real(f64::from(*v)),
                    Object::String(_, _) => DestinationPart::Text(walker.text(part)?),
                    Object::Name(_) => DestinationPart::Name {
                        name: walker.text(part)?,
                    },
                    Object::Reference((num, gen)) => DestinationPart::Reference {
                        num: *num,
                        gen: *gen,
                    },
                    Object::Null => DestinationPart::Null,
                    _ => return None,
                });
            }
            Some(Destination::Parts(output))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::dictionary;

    fn document(catalog_extra: Dictionary) -> Document {
        let mut document = Document::with_version("1.7");
        let pages = document
            .add_object(dictionary! {"Type"=>"Pages","Kids"=>Vec::<Object>::new(),"Count"=>0});
        let mut catalog = dictionary! {"Type"=>"Catalog","Pages"=>pages};
        catalog.extend(&catalog_extra);
        let root = document.add_object(catalog);
        document.trailer.set("Root", root);
        document
    }

    #[test]
    fn expands_number_tree_labels_and_mark_info() {
        let doc = document(dictionary! {
            "PageLabels"=>dictionary!{"Nums"=>vec![0.into(),Object::Dictionary(dictionary!{"S"=>"r"}),2.into(),Object::Dictionary(dictionary!{"P"=>Object::string_literal("A-"),"S"=>"D","St"=>3})]},
            "MarkInfo"=>dictionary!{"Marked"=>true,"Suspects"=>false},
        });
        let out = extract_catalog_signals(
            &doc,
            None,
            4,
            CatalogSignalRequest {
                page_labels: true,
                permissions: true,
                outline: false,
            },
        );
        assert_eq!(
            out.page_labels,
            Some(vec!["i".into(), "ii".into(), "A-3".into(), "A-4".into()])
        );
        assert_eq!(
            serde_json::to_value(out.mark_info).unwrap(),
            serde_json::json!({"Marked":true,"UserProperties":false,"Suspects":false})
        );
    }

    #[test]
    fn preserves_nested_outline_styles_and_safe_actions() {
        let mut doc = document(dictionary! {});
        let child=doc.add_object(dictionary!{"Title"=>Object::string_literal("Child"),"A"=>dictionary!{"S"=>"URI","URI"=>Object::string_literal("https://example.com")}});
        let first=doc.add_object(dictionary!{"Title"=>Object::string_literal("Root"),"F"=>3,"C"=>vec![1.into(),0.into(),0.into()],"First"=>child});
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert_eq!(value[0]["title"], "Root");
        assert_eq!(value[0]["bold"], true);
        assert_eq!(value[0]["items"][0]["url"], "https://example.com/");
    }

    #[test]
    fn permission_bits_match_pdfjs_p_flag_enumeration() {
        let facts = EncryptionFacts {
            permissions: Some(4 | 8 | 256),
            filter_name: Some("Standard".to_string()),
        };
        assert_eq!(
            extract_permissions(Some(facts)),
            Some(vec!["print".into(), "modify".into(), "fill_forms".into()])
        );
    }

    #[test]
    fn mark_info_defaults_missing_and_non_boolean_keys_to_false() {
        let doc = document(dictionary! {
            "MarkInfo"=>dictionary!{"Marked"=>true,"Suspects"=>1},
        });
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: true,
                outline: false,
            },
        );
        assert_eq!(
            serde_json::to_value(out.mark_info).unwrap(),
            serde_json::json!({"Marked":true,"UserProperties":false,"Suspects":false})
        );
    }

    #[test]
    fn outline_without_action_retains_pdfjs_null_destination() {
        let mut doc = document(dictionary! {});
        let first = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("Plain"),
        });
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert_eq!(value[0]["dest"], serde_json::Value::Null);
        assert_eq!(value[0]["bold"], false);
        assert_eq!(value[0]["color"], serde_json::json!([0, 0, 0]));
    }

    #[test]
    fn invalid_page_label_dictionary_omits_the_whole_surface() {
        let doc = document(dictionary! {
            "PageLabels"=>dictionary!{"Nums"=>vec![
                0.into(),
                Object::Dictionary(dictionary!{"S"=>"Bogus"}),
            ]},
        });
        let out = extract_catalog_signals(
            &doc,
            None,
            2,
            CatalogSignalRequest {
                page_labels: true,
                permissions: false,
                outline: false,
            },
        );
        assert!(out.page_labels.is_none());
    }

    #[test]
    fn decoded_text_expansion_sticky_exhausts_the_source_budget() {
        let doc = document(dictionary! {});
        let mut walker = Walker::new(&doc);
        walker.text_remaining = 1;
        assert!(walker.text(&Object::string_literal(vec![0x80])).is_none());
        assert_eq!(walker.text_remaining, 0);
        assert!(walker.text(&Object::string_literal("x")).is_none());
    }

    #[test]
    fn unsafe_outline_uri_is_omitted_and_destination_remains_null() {
        let mut doc = document(dictionary! {});
        let first = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("Unsafe"),
            "A"=>dictionary!{"S"=>"URI","URI"=>Object::string_literal("javascript:alert(1)")},
        });
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert!(value[0].get("url").is_none());
        assert_eq!(value[0]["dest"], serde_json::Value::Null);
    }

    #[test]
    fn outline_cycle_is_suppressed_by_pdfjs_global_processed_set() {
        let mut doc = document(dictionary! {});
        let first = doc.add_object(dictionary! {"Title"=>Object::string_literal("Cycle")});
        doc.get_object_mut(first)
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .set("Next", first);
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert_eq!(value.as_array().unwrap().len(), 1);
        assert_eq!(value[0]["title"], "Cycle");
    }

    #[test]
    fn page_label_overflow_omits_only_that_surface() {
        let mut doc = document(dictionary! {});
        let excessive_kids = (0..=MAX_ENTRIES)
            .map(|_| Object::Dictionary(Dictionary::new()))
            .collect::<Vec<_>>();
        let labels = doc.add_object(dictionary! {"Kids"=>excessive_kids});
        doc.catalog_mut().unwrap().set("PageLabels", labels);

        let first = doc.add_object(dictionary! {"Title"=>Object::string_literal("Still valid")});
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);

        let out = extract_catalog_signals(
            &doc,
            None,
            1,
            CatalogSignalRequest {
                page_labels: true,
                permissions: false,
                outline: true,
            },
        );
        assert!(out.page_labels.is_none());
        assert_eq!(out.outline.unwrap().len(), 1);
    }

    #[test]
    fn mark_info_reference_cycle_omits_instead_of_inventing_false() {
        let mut doc = document(dictionary! {});
        let cycle = doc.add_object(Object::Null);
        *doc.get_object_mut(cycle).unwrap() = Object::Reference(cycle);
        doc.catalog_mut()
            .unwrap()
            .set("MarkInfo", dictionary! {"Marked"=>cycle});
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: true,
                outline: false,
            },
        );
        assert!(out.mark_info.is_none());
    }

    #[test]
    fn indirect_number_tree_array_is_resolved() {
        let mut doc = document(dictionary! {});
        let nums = doc.add_object(Object::Array(vec![
            0.into(),
            Object::Dictionary(dictionary! {"S"=>"D"}),
        ]));
        let labels = doc.add_object(dictionary! {"Nums"=>nums});
        doc.catalog_mut().unwrap().set("PageLabels", labels);
        let out = extract_catalog_signals(
            &doc,
            None,
            2,
            CatalogSignalRequest {
                page_labels: true,
                permissions: false,
                outline: false,
            },
        );
        assert_eq!(out.page_labels, Some(vec!["1".into(), "2".into()]));
    }

    #[test]
    fn direct_outline_link_is_omitted_like_pdfjs() {
        let doc = document(dictionary! {
            "Outlines"=>dictionary!{"First"=>dictionary!{"Title"=>Object::string_literal("Direct")}},
        });
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        assert!(out.outline.is_none());
    }

    #[test]
    fn url_normalization_expansion_respects_the_field_cap() {
        let mut doc = document(dictionary! {});
        let oversized_after_normalization = format!("https://example.com/{}", "\"".repeat(30_000));
        let first = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("Expanded"),
            "A"=>dictionary!{
                "S"=>"URI",
                "URI"=>Object::string_literal(oversized_after_normalization),
            },
        });
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        assert!(out.outline.is_none());
    }

    #[test]
    fn duplicate_number_tree_reference_omits_the_whole_surface() {
        let mut doc = document(dictionary! {});
        let leaf = doc.add_object(dictionary! {
            "Nums"=>vec![0.into(),Object::Dictionary(dictionary!{"S"=>"D"})],
        });
        let labels = doc.add_object(dictionary! {"Kids"=>vec![leaf.into(),leaf.into()]});
        doc.catalog_mut().unwrap().set("PageLabels", labels);
        let out = extract_catalog_signals(
            &doc,
            None,
            1,
            CatalogSignalRequest {
                page_labels: true,
                permissions: false,
                outline: false,
            },
        );
        assert!(out.page_labels.is_none());
    }

    #[test]
    fn number_tree_kids_take_precedence_over_same_node_nums() {
        let mut doc = document(dictionary! {});
        let leaf = doc.add_object(dictionary! {
            "Nums"=>vec![0.into(),Object::Dictionary(dictionary!{"S"=>"D"})],
        });
        let labels = doc.add_object(dictionary! {
            "Kids"=>vec![leaf.into()],
            "Nums"=>vec![0.into(),Object::Dictionary(dictionary!{"P"=>Object::string_literal("wrong")})],
        });
        doc.catalog_mut().unwrap().set("PageLabels", labels);
        let out = extract_catalog_signals(
            &doc,
            None,
            2,
            CatalogSignalRequest {
                page_labels: true,
                permissions: false,
                outline: false,
            },
        );
        assert_eq!(out.page_labels, Some(vec!["1".into(), "2".into()]));
    }

    #[test]
    fn shared_outline_reference_is_emitted_only_on_first_pdfjs_branch() {
        let mut doc = document(dictionary! {});
        let shared = doc.add_object(dictionary! {"Title"=>Object::string_literal("Shared")});
        let second = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("Second"),
            "First"=>shared,
        });
        let first = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("First"),
            "First"=>shared,
            "Next"=>second,
        });
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert_eq!(value[0]["items"][0]["title"], "Shared");
        assert!(value[1].get("items").is_none());
    }

    #[test]
    fn outline_first_and_next_are_globally_admitted_before_child_runs() {
        let mut doc = document(dictionary! {});
        let shared = doc.add_object(dictionary! {"Title"=>Object::string_literal("Shared")});
        let child = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("Child"),
            "First"=>shared,
        });
        let first = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("First"),
            "First"=>child,
            "Next"=>shared,
        });
        let outlines = doc.add_object(dictionary! {"First"=>first});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert_eq!(value[0]["items"][0]["title"], "Child");
        assert!(value[0]["items"][0].get("items").is_none());
        assert_eq!(value[1]["title"], "Shared");
    }

    #[test]
    fn outline_fifo_assigns_deep_shared_ref_to_earlier_queued_sibling() {
        let mut doc = document(dictionary! {});
        let z = doc.add_object(dictionary! {"Title"=>Object::string_literal("Z")});
        let x = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("X"),
            "First"=>z,
        });
        let b = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("B"),
            "First"=>z,
        });
        let c = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("C"),
            "First"=>x,
        });
        let a = doc.add_object(dictionary! {
            "Title"=>Object::string_literal("A"),
            "First"=>c,
            "Next"=>b,
        });
        let outlines = doc.add_object(dictionary! {"First"=>a});
        doc.catalog_mut().unwrap().set("Outlines", outlines);
        let out = extract_catalog_signals(
            &doc,
            None,
            0,
            CatalogSignalRequest {
                page_labels: false,
                permissions: false,
                outline: true,
            },
        );
        let value = serde_json::to_value(out.outline).unwrap();
        assert_eq!(value[0]["title"], "A");
        assert_eq!(value[0]["items"][0]["title"], "C");
        assert_eq!(value[0]["items"][0]["items"][0]["title"], "X");
        assert!(value[0]["items"][0]["items"][0].get("items").is_none());
        assert_eq!(value[1]["title"], "B");
        assert_eq!(value[1]["items"][0]["title"], "Z");
    }
}
