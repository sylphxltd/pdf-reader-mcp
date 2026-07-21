use std::collections::{HashMap, HashSet, VecDeque};

use crate::pdfjs_text::decode_pdfjs_text_string;
use lopdf::{Dictionary, Document, Object, ObjectId};
use serde::Serialize;
use serde_json::Value;

const MAX_DEPTH: usize = 64;
const MAX_OBJECTS: usize = 100_000;
const MAX_ENTRIES: usize = 10_000;
const MAX_STRING_BYTES: usize = 64 * 1024;
const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;

#[derive(Default)]
pub(crate) struct FormAttachmentSignals {
    pub form_fields: Option<Vec<FormField>>,
    pub attachments: Option<Vec<Attachment>>,
    pub warnings: Vec<String>,
    #[cfg(test)]
    form_materialized_array_items: usize,
    #[cfg(test)]
    form_annotation_materialized_array_items: usize,
    #[cfg(test)]
    attachment_materialized_array_items: usize,
}

#[derive(Debug, Serialize)]
pub(crate) struct FormField {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    value: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    default_value: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    editable: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bounding_box: Option<BoxValue>,
}

#[derive(Debug, Serialize)]
struct BoxValue {
    left: f64,
    bottom: f64,
    right: f64,
    top: f64,
}

#[derive(Debug, Serialize)]
pub(crate) struct Attachment {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    size_bytes: Option<usize>,
}

#[derive(Clone, Copy, Default)]
struct Inherited<'a> {
    field_type: Option<&'a Object>,
    flags: Option<&'a Object>,
    value: Option<&'a Object>,
    default_value: Option<&'a Object>,
}

pub(crate) fn extract_form_attachment_signals(
    document: &Document,
    pages: &[(u32, ObjectId)],
    want_forms: bool,
    want_attachments: bool,
) -> FormAttachmentSignals {
    let mut output = FormAttachmentSignals::default();
    let Ok(root) = document.trailer.get(b"Root") else {
        return output;
    };
    if want_forms {
        let mut walker = Walker::new(document);
        output.form_fields = walker
            .dict(root)
            .and_then(|catalog| extract_forms(&mut walker, catalog, pages));
        #[cfg(test)]
        {
            output.form_materialized_array_items = walker.materialized_array_items;
            output.form_annotation_materialized_array_items =
                walker.annotation_materialized_array_items;
        }
        if walker.limited {
            output.form_fields = None;
            output.warnings.push("include_form_fields: COS traversal exceeded the bounded form-field limit; the surface was omitted.".into());
        }
    }
    if want_attachments {
        let mut walker = Walker::new(document);
        output.attachments = walker
            .dict(root)
            .and_then(|catalog| extract_attachments(&mut walker, catalog));
        #[cfg(test)]
        {
            output.attachment_materialized_array_items = walker.materialized_array_items;
        }
        if walker.limited {
            output.attachments = None;
            output.warnings.push("include_attachments: COS traversal exceeded the bounded embedded-file limit; the surface was omitted.".into());
        }
    }
    output
}

struct Walker<'a> {
    document: &'a Document,
    work: usize,
    entries: usize,
    text_remaining: usize,
    form_value_nodes_remaining: usize,
    failed: bool,
    limited: bool,
    #[cfg(test)]
    materialized_array_items: usize,
    #[cfg(test)]
    annotation_materialized_array_items: usize,
}

impl<'a> Walker<'a> {
    fn new(document: &'a Document) -> Self {
        Self {
            document,
            work: 0,
            entries: 0,
            text_remaining: MAX_TEXT_BYTES,
            form_value_nodes_remaining: MAX_ENTRIES,
            failed: false,
            limited: false,
            #[cfg(test)]
            materialized_array_items: 0,
            #[cfg(test)]
            annotation_materialized_array_items: 0,
        }
    }

    fn resolve(&mut self, mut value: &'a Object) -> Option<&'a Object> {
        let mut seen = HashSet::new();
        for _ in 0..MAX_DEPTH {
            self.work += 1;
            if self.work > MAX_OBJECTS {
                self.limited = true;
                return None;
            }
            let Object::Reference(id) = value else {
                return Some(value);
            };
            if !seen.insert(*id) {
                self.failed = true;
                return None;
            }
            let Some(next) = self.document.objects.get(id) else {
                self.failed = true;
                return None;
            };
            value = next;
        }
        self.limited = true;
        None
    }

    fn dict(&mut self, value: &'a Object) -> Option<&'a Dictionary> {
        self.resolve(value)?.as_dict().ok()
    }

    fn array_bounded(&mut self, value: &'a Object, max_len: usize) -> Option<Vec<&'a Object>> {
        let values = self.resolve(value)?.as_array().ok()?;
        if values.len() > max_len {
            self.limited = true;
            return None;
        }
        #[cfg(test)]
        {
            self.materialized_array_items += values.len();
        }
        Some(values.iter().collect())
    }

    fn annotation_array_bounded(
        &mut self,
        value: &'a Object,
        max_len: usize,
    ) -> Option<Vec<&'a Object>> {
        let values = self.array_bounded(value, max_len)?;
        #[cfg(test)]
        {
            self.annotation_materialized_array_items += values.len();
        }
        Some(values)
    }

    fn text(&mut self, value: &'a Object) -> Option<String> {
        let value = self.resolve(value)?;
        let bytes = match value {
            Object::String(bytes, _) | Object::Name(bytes) => bytes,
            _ => return None,
        };
        if bytes.len() > MAX_STRING_BYTES || bytes.len() > self.text_remaining {
            self.limited = true;
            return None;
        }
        let text = match value {
            Object::Name(bytes) => String::from_utf8_lossy(bytes).into_owned(),
            _ => decode_pdfjs_text_string(value)?,
        };
        if text.len() > MAX_STRING_BYTES || text.len() > self.text_remaining {
            self.limited = true;
            return None;
        }
        self.text_remaining -= text.len();
        Some(text)
    }
}

fn extract_forms<'a>(
    walker: &mut Walker<'a>,
    catalog: &'a Dictionary,
    pages: &[(u32, ObjectId)],
) -> Option<Vec<FormField>> {
    let acroform = walker.dict(catalog.get(b"AcroForm").ok()?)?;
    let mut raw_node_budget = MAX_ENTRIES;
    let fields = walker.array_bounded(acroform.get(b"Fields").ok()?, raw_node_budget)?;
    raw_node_budget -= fields.len();
    if pages.len() > MAX_ENTRIES {
        walker.limited = true;
        return None;
    }
    let mut page_annotation_budget = MAX_ENTRIES - pages.len();
    let mut admitted_annotations = Vec::new();
    for (page, page_id) in pages {
        let Some(page_value) = walker.document.objects.get(page_id) else {
            continue;
        };
        let Some(page_dict) = walker.dict(page_value) else {
            if walker.failed || walker.limited {
                return None;
            }
            continue;
        };
        let Ok(annots_value) = page_dict.get(b"Annots") else {
            continue;
        };
        let Some(annots) = walker.annotation_array_bounded(annots_value, page_annotation_budget)
        else {
            if walker.failed || walker.limited {
                return None;
            }
            continue;
        };
        page_annotation_budget -= annots.len();
        admitted_annotations.push((*page, annots));
    }
    let page_by_id = pages
        .iter()
        .map(|(page, id)| (*id, *page))
        .collect::<HashMap<_, _>>();
    let mut annotation_pages = HashMap::new();
    for (page, annots) in admitted_annotations {
        for annot in annots {
            if let Ok(id) = annot.as_reference() {
                annotation_pages.insert(id, page);
            }
        }
    }
    let mut output = Vec::new();
    let mut visited = HashSet::new();
    for field in fields {
        if field.as_reference().is_err() {
            continue;
        }
        walk_field(
            walker,
            field,
            0,
            "",
            &Inherited::default(),
            &page_by_id,
            &annotation_pages,
            &mut visited,
            &mut output,
            &mut raw_node_budget,
        );
        if walker.failed || walker.limited {
            return None;
        }
    }
    (!output.is_empty()).then_some(output)
}

#[allow(clippy::too_many_arguments)]
fn walk_field<'a>(
    walker: &mut Walker<'a>,
    value: &'a Object,
    depth: usize,
    parent_name: &str,
    inherited: &Inherited<'a>,
    page_by_id: &HashMap<ObjectId, u32>,
    annotation_pages: &HashMap<ObjectId, u32>,
    visited: &mut HashSet<ObjectId>,
    output: &mut Vec<FormField>,
    raw_node_budget: &mut usize,
) {
    if depth >= MAX_DEPTH || output.len() >= MAX_ENTRIES {
        walker.limited = true;
        return;
    }
    let Ok(id) = value.as_reference() else {
        return;
    };
    if !visited.insert(id) {
        return;
    }
    let Some(resolved) = walker.resolve(value) else {
        return;
    };
    let Ok(dict) = resolved.as_dict() else {
        return;
    };
    if dict.get(b"Subtype").ok().and_then(|v| v.as_name().ok()) == Some(b"Link") {
        return;
    }
    let partial = dict
        .get(b"T")
        .ok()
        .and_then(|v| walker.text(v))
        .unwrap_or_default();
    let name = match (parent_name.is_empty(), partial.is_empty()) {
        (true, true) => String::new(),
        (true, false) => partial,
        (false, true) => parent_name.to_string(),
        (false, false) => format!("{parent_name}.{partial}"),
    };
    let next = Inherited {
        field_type: dict.get(b"FT").ok().or(inherited.field_type),
        flags: dict.get(b"Ff").ok().or(inherited.flags),
        value: dict.get(b"V").ok().or(inherited.value),
        default_value: dict.get(b"DV").ok().or(inherited.default_value),
    };
    let kids = dict
        .get(b"Kids")
        .ok()
        .and_then(|value| walker.array_bounded(value, *raw_node_budget));
    if let Some(kids) = kids.as_ref() {
        *raw_node_budget -= kids.len();
    }
    let public_name = name.trim().to_string();
    if !public_name.is_empty() {
        if kids.is_some() {
            output.push(FormField {
                name: public_name.clone(),
                r#type: None,
                value: None,
                default_value: None,
                page: None,
                id: Some(format_id(id)),
                editable: None,
                bounding_box: None,
            });
        } else if let Some(field) = normalize_leaf(
            walker,
            dict,
            Some(id),
            public_name,
            &next,
            page_by_id,
            annotation_pages,
        ) {
            output.push(field);
        }
    }
    if let Some(kids) = kids {
        for kid in kids {
            walk_field(
                walker,
                kid,
                depth + 1,
                &name,
                &next,
                page_by_id,
                annotation_pages,
                visited,
                output,
                raw_node_budget,
            );
        }
    }
}

fn button_has_named_normal_appearance<'a>(walker: &mut Walker<'a>, dict: &'a Dictionary) -> bool {
    // pdf.js ButtonWidgetAnnotation _processCheckBox/_processRadioButton require
    // AP dict and AP/N named-state dict before setting defaultFieldValue = "Off".
    let Ok(ap) = dict.get(b"AP") else {
        return false;
    };
    let Some(ap_dict) = walker.resolve(ap).and_then(|value| value.as_dict().ok()) else {
        return false;
    };
    let Ok(normal) = ap_dict.get(b"N") else {
        return false;
    };
    walker
        .resolve(normal)
        .and_then(|value| value.as_dict().ok())
        .is_some()
}

fn checkbox_named_export_values<'a>(
    walker: &mut Walker<'a>,
    dict: &'a Dictionary,
    field_value: Option<&Value>,
) -> Option<Vec<String>> {
    // pdf.js _processCheckBox exportValues construction from AP/N keys.
    let Ok(ap) = dict.get(b"AP") else {
        return None;
    };
    let ap_dict = walker.resolve(ap).and_then(|value| value.as_dict().ok())?;
    let Ok(normal) = ap_dict.get(b"N") else {
        return None;
    };
    let normal_dict = walker
        .resolve(normal)
        .and_then(|value| value.as_dict().ok())?;
    let mut keys: Vec<String> = normal_dict
        .iter()
        .filter_map(|(k, _)| std::str::from_utf8(k).ok().map(str::to_string))
        .collect();
    let yes = match field_value {
        Some(Value::String(s)) if !s.is_empty() && s != "Off" => s.clone(),
        _ => "Yes".to_string(),
    };
    if keys.is_empty() {
        keys.push("Off".into());
        keys.push(yes);
    } else if keys.len() == 1 {
        if keys[0] == "Off" {
            keys.push(yes);
        } else {
            keys.insert(0, "Off".into());
        }
    } else if keys.iter().any(|k| k == &yes) {
        keys.clear();
        keys.push("Off".into());
        keys.push(yes);
    } else {
        let other_yes = keys
            .iter()
            .find(|k| k.as_str() != "Off")
            .cloned()
            .unwrap_or_else(|| "Yes".into());
        keys.clear();
        keys.push("Off".into());
        keys.push(other_yes);
    }
    Some(keys)
}

fn normalize_leaf<'a>(
    walker: &mut Walker<'a>,
    dict: &'a Dictionary,
    id: Option<ObjectId>,
    name: String,
    inherited: &Inherited<'a>,
    page_by_id: &HashMap<ObjectId, u32>,
    annotation_pages: &HashMap<ObjectId, u32>,
) -> Option<FormField> {
    let ft = inherited
        .field_type
        .and_then(|v| walker.resolve(v))
        .and_then(|v| v.as_name().ok().map(<[u8]>::to_vec));
    let flags = inherited
        .flags
        .and_then(|v| walker.resolve(v))
        .and_then(|v| v.as_i64().ok())
        .unwrap_or(0);
    let field_type = match ft.as_deref() {
        Some(b"Tx") => Some("text"),
        Some(b"Btn") if flags & (1 << 16) != 0 => Some("button"),
        Some(b"Btn") if flags & (1 << 15) != 0 => Some("radiobutton"),
        Some(b"Btn") => Some("checkbox"),
        Some(b"Ch") if flags & (1 << 17) != 0 => Some("combobox"),
        Some(b"Ch") => Some("listbox"),
        Some(b"Sig") => Some("signature"),
        _ => None,
    }
    .map(str::to_string);
    let raw_value = inherited.value.map(|v| form_value(walker, v));
    let mut default_value = inherited.default_value.and_then(|v| form_value(walker, v));
    let fallback = default_value.clone().filter(|value| !value.is_null());
    let mut value = raw_value.unwrap_or(fallback);
    match field_type.as_deref() {
        Some("text") => {
            value = Some(match value {
                Some(Value::String(value)) => Value::String(value),
                _ => Value::String(String::new()),
            });
            if default_value.as_ref().is_none_or(Value::is_null) {
                default_value = Some(Value::String(String::new()));
            }
        }
        Some("checkbox" | "radiobutton" | "button") => {
            // pdf.js _processCheckBox: when AP/N is a named-state dict, AS string
            // overwrites fieldValue, then exportValues normalization may force Off.
            if field_type.as_deref() == Some("checkbox")
                && button_has_named_normal_appearance(walker, dict)
            {
                if let Some(as_value) = dict.get(b"AS").ok().and_then(|v| form_value(walker, v)) {
                    match &as_value {
                        Value::String(s) if !s.is_empty() => value = Some(as_value),
                        _ => {}
                    }
                }
                if let Some(export_values) =
                    checkbox_named_export_values(walker, dict, value.as_ref())
                {
                    let current = match &value {
                        Some(Value::String(s)) => Some(s.as_str()),
                        _ => None,
                    };
                    if current.is_none_or(|s| !export_values.iter().any(|k| k == s)) {
                        value = Some(Value::String("Off".into()));
                    }
                }
            }
            // pdf.js getFieldObjects keeps non-empty button V/DV arrays as string
            // arrays; only missing/null/empty/non-string non-array values collapse
            // to the public "Off" sentinel.
            value = Some(match value {
                Some(Value::Array(values)) if !values.is_empty() => Value::Array(values),
                Some(Value::String(value)) if !value.is_empty() => Value::String(value),
                _ => Value::String("Off".into()),
            });
            // pdf.js _processCheckBox/_processRadioButton only (not pushbutton):
            // when AP/N is a named-state dict and DV is null, defaultFieldValue
            // becomes "Off". Pushbutton and non-named AP leave default null.
            if default_value.as_ref().is_none_or(Value::is_null) {
                let is_checkbox_or_radio = matches!(
                    field_type.as_deref(),
                    Some("checkbox") | Some("radiobutton")
                );
                if is_checkbox_or_radio && button_has_named_normal_appearance(walker, dict) {
                    default_value = Some(Value::String("Off".into()));
                } else {
                    default_value.get_or_insert(Value::Null);
                }
            }
        }
        Some("listbox" | "combobox") => {
            value = Some(first_choice_value(value));
            default_value.get_or_insert(Value::Null);
        }
        Some("signature") => {
            value = Some(Value::Null);
            default_value = None;
        }
        _ => {}
    }
    let page = dict
        .get(b"P")
        .ok()
        .and_then(|v| v.as_reference().ok())
        .and_then(|id| page_by_id.get(&id).copied())
        .or_else(|| id.and_then(|id| annotation_pages.get(&id).copied()));
    let bounding_box = dict.get(b"Rect").ok().and_then(|v| rect(walker, v));
    Some(FormField {
        name,
        r#type: field_type.clone(),
        value,
        default_value,
        page,
        id: id.map(format_id),
        editable: field_type
            .as_deref()
            .filter(|kind| *kind != "signature")
            .map(|_| flags & 1 == 0),
        bounding_box: (field_type.as_deref() != Some("signature"))
            .then_some(bounding_box)
            .flatten(),
    })
}

fn first_choice_value(value: Option<Value>) -> Value {
    match value {
        Some(Value::Array(values)) => values.into_iter().next().unwrap_or(Value::Null),
        Some(value) => value,
        None => Value::Null,
    }
}

fn form_value<'a>(walker: &mut Walker<'a>, value: &'a Object) -> Option<Value> {
    form_value_at_depth(walker, value, 0)
}

fn form_value_at_depth<'a>(
    walker: &mut Walker<'a>,
    value: &'a Object,
    depth: usize,
) -> Option<Value> {
    if depth >= MAX_DEPTH || walker.form_value_nodes_remaining == 0 {
        walker.limited = true;
        return None;
    }
    walker.form_value_nodes_remaining -= 1;
    let value = walker.resolve(value)?;
    match value {
        Object::String(_, _) | Object::Name(_) => walker.text(value).map(Value::String),
        Object::Array(values) => {
            if values.len() > 256 || values.len() > walker.form_value_nodes_remaining {
                walker.limited = true;
                return None;
            }
            let mut decoded = Vec::new();
            for value in values {
                if let Some(value) = form_value_at_depth(walker, value, depth + 1) {
                    if !value.is_null() {
                        decoded.push(value);
                    }
                }
                if walker.limited {
                    return None;
                }
            }
            Some(if decoded.is_empty() {
                Value::Null
            } else {
                Value::Array(decoded)
            })
        }
        _ => Some(Value::Null),
    }
}

fn rect<'a>(walker: &mut Walker<'a>, value: &'a Object) -> Option<BoxValue> {
    let value = walker.resolve(value)?;
    let values = value.as_array().ok()?;
    if values.len() < 4 {
        return None;
    }
    let mut n = [0.0; 4];
    for (index, value) in values.iter().take(4).enumerate() {
        n[index] = number(walker.resolve(value)?)?;
    }
    Some(BoxValue {
        left: n[0].min(n[2]),
        bottom: n[1].min(n[3]),
        right: n[0].max(n[2]),
        top: n[1].max(n[3]),
    })
}

fn number(value: &Object) -> Option<f64> {
    let n = match value {
        Object::Integer(v) => *v as f64,
        Object::Real(v) => f64::from(*v),
        _ => return None,
    };
    n.is_finite().then_some(n)
}
fn format_id((num, generation): ObjectId) -> String {
    if generation == 0 {
        format!("{num}R")
    } else {
        format!("{num}R{generation}")
    }
}

fn extract_attachments<'a>(
    walker: &mut Walker<'a>,
    catalog: &'a Dictionary,
) -> Option<Vec<Attachment>> {
    let names = walker.dict(catalog.get(b"Names").ok()?)?;
    let root = names.get(b"EmbeddedFiles").ok()?;
    let mut queue = VecDeque::from([(root, 0usize)]);
    let mut tree_node_budget = MAX_ENTRIES.saturating_sub(1);
    let mut pair_budget = MAX_ENTRIES;
    let mut visited = HashSet::new();
    let mut pairs = Vec::new();
    while let Some((node, depth)) = queue.pop_front() {
        if depth >= MAX_DEPTH || pairs.len() >= MAX_ENTRIES {
            walker.limited = true;
            return None;
        }
        if let Ok(id) = node.as_reference() {
            if !visited.insert(id) {
                walker.failed = true;
                return None;
            }
        }
        let dict = walker.dict(node)?;
        if let Ok(kids_value) = dict.get(b"Kids") {
            if let Some(kids) = walker.array_bounded(kids_value, tree_node_budget) {
                tree_node_budget -= kids.len();
                for kid in kids {
                    queue.push_back((kid, depth + 1));
                }
            }
            continue;
        }
        let names = dict
            .get(b"Names")
            .ok()
            .and_then(|value| walker.array_bounded(value, pair_budget.saturating_mul(2)));
        if let Some(names) = names {
            // pdf.js NameTree: complete key/value pairs are admitted; a trailing
            // unpaired key materializes as an unnamed attachment instead of
            // failing the whole EmbeddedFiles surface.
            let pair_count = names.len() / 2;
            let orphan_count = usize::from(names.len() % 2 == 1);
            let needed = pair_count + orphan_count;
            if needed > pair_budget {
                walker.limited = true;
                return None;
            }
            pair_budget -= needed;
            for pair in names.chunks_exact(2) {
                pairs.push((pair[0], Some(pair[1])));
            }
            if orphan_count == 1 {
                if let Some(key) = names.last() {
                    pairs.push((*key, None));
                }
            }
        }
    }
    let mut output: Vec<Attachment> = Vec::new();
    let mut positions = HashMap::new();
    for (key, spec) in pairs {
        walker.entries += 1;
        if walker.entries > MAX_ENTRIES {
            walker.limited = true;
            return None;
        }
        let name = walker.text(key)?;
        let attachment = if let Some(spec) = spec {
            let spec = walker.dict(spec)?;
            let filename = filename(walker, spec);
            let description = spec
                .get(b"Desc")
                .ok()
                .and_then(|v| walker.text(v))
                .filter(|v| !v.is_empty());
            let size_bytes = embedded_size(walker, spec);
            Attachment {
                name: name.clone(),
                filename,
                description,
                size_bytes,
            }
        } else {
            Attachment {
                name: name.clone(),
                filename: Some("unnamed".into()),
                description: None,
                size_bytes: None,
            }
        };
        if let Some(index) = positions.get(&name).copied() {
            output[index] = attachment
        } else {
            positions.insert(name, output.len());
            output.push(attachment)
        }
    }
    if walker.failed {
        return None;
    }
    (!output.is_empty()).then_some(output)
}

fn filename<'a>(walker: &mut Walker<'a>, spec: &'a Dictionary) -> Option<String> {
    let mut raw = None;
    for key in [b"UF".as_slice(), b"F", b"Unix", b"Mac", b"DOS"] {
        if let Ok(value) = spec.get(key) {
            raw = walker.text(value);
            break;
        }
    }
    let normalized = raw.unwrap_or_default().replace('\\', "/");
    Some(
        normalized
            .rsplit('/')
            .next()
            .filter(|part| !part.is_empty())
            .unwrap_or("unnamed")
            .to_string(),
    )
}

fn embedded_size<'a>(walker: &mut Walker<'a>, spec: &'a Dictionary) -> Option<usize> {
    let ef = walker.dict(spec.get(b"EF").ok()?)?;
    let stream = [b"UF".as_slice(), b"F", b"Unix", b"Mac", b"DOS"]
        .into_iter()
        .find_map(|key| ef.get(key).ok())?;
    let stream = walker.resolve(stream)?;
    let stream = stream.as_stream().ok()?;
    stream
        .dict
        .get(b"Filter")
        .is_err()
        .then_some(stream.content.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::{dictionary, Stream};

    fn base_document() -> (Document, ObjectId) {
        let mut document = Document::with_version("1.7");
        let pages = document
            .add_object(dictionary! {"Type"=>"Pages","Kids"=>Vec::<Object>::new(),"Count"=>0});
        (document, pages)
    }

    fn finish_catalog(document: &mut Document, pages: ObjectId, extra: Dictionary) {
        let mut catalog = dictionary! {"Type"=>"Catalog","Pages"=>pages};
        catalog.extend(&extra);
        let root = document.add_object(catalog);
        document.trailer.set("Root", root);
    }
    #[test]
    fn path_filename_is_stripped_and_unfiltered_size_is_actual() {
        let mut doc = Document::with_version("1.7");
        let pages =
            doc.add_object(dictionary! {"Type"=>"Pages","Kids"=>Vec::<Object>::new(),"Count"=>0});
        let stream = doc.add_object(Stream::new(dictionary! {}, b"hello".to_vec()));
        let spec=doc.add_object(dictionary!{"UF"=>Object::string_literal(r"C:\reports\a.txt"),"EF"=>dictionary!{"UF"=>stream}});
        let tree =
            doc.add_object(dictionary! {"Names"=>vec![Object::string_literal("key"),spec.into()]});
        let root=doc.add_object(dictionary!{"Type"=>"Catalog","Pages"=>pages,"Names"=>dictionary!{"EmbeddedFiles"=>tree}});
        doc.trailer.set("Root", root);
        let out = extract_form_attachment_signals(&doc, &[], false, true);
        assert_eq!(
            serde_json::to_value(out.attachments).unwrap(),
            serde_json::json!([{"name":"key","filename":"a.txt","size_bytes":5}])
        );
    }

    #[test]
    fn frozen_v3014_forms_and_attachments_match_the_real_ts_subset() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../test/fixtures/differential/v3014-behavior-v1.pdf");
        let document = Document::load(path).expect("load immutable behavior fixture");
        let pages = document.get_pages().into_iter().collect::<Vec<_>>();
        let output = extract_form_attachment_signals(&document, &pages, true, true);
        assert!(output.warnings.is_empty());
        assert_eq!(
            serde_json::to_value(output.form_fields).unwrap(),
            serde_json::json!([
                {"name":"customer_name","type":"text","value":"Ada Lovelace","default_value":"","page":1,"id":"22R","editable":true,"bounding_box":{"left":72.0,"bottom":635.0,"right":260.0,"top":660.0}},
                {"name":"profile","id":"24R"},
                {"name":"profile","type":"text","value":"Grace Hopper","default_value":"Unknown","page":2,"id":"25R","editable":false,"bounding_box":{"left":72.0,"bottom":500.0,"right":260.0,"top":525.0}},
                {"name":"consent","type":"checkbox","value":"Yes","default_value":null,"page":2,"id":"26R","editable":true,"bounding_box":{"left":72.0,"bottom":450.0,"right":90.0,"top":468.0}},
                {"name":"tier","type":"listbox","value":"gold","default_value":"silver","page":3,"id":"27R","editable":true,"bounding_box":{"left":72.0,"bottom":400.0,"right":200.0,"top":425.0}}
            ])
        );
        assert_eq!(
            serde_json::to_value(output.attachments).unwrap(),
            serde_json::json!([
                {"name":"source.csv","filename":"source.csv","description":"Source data","size_bytes":19},
                {"name":"evidence","filename":"report.txt","size_bytes":5}
            ])
        );
    }

    #[test]
    fn forms_skip_direct_top_level_and_direct_kids_and_use_dv_as_current_value() {
        let (mut document, pages) = base_document();
        let child = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("  child  "),
            "DV"=>Object::string_literal("fallback")
        });
        let parent = document.add_object(dictionary! {
            "T"=>Object::string_literal("  parent  "),
            "Kids"=>vec![Object::Dictionary(dictionary!{"Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("direct")}),child.into()]
        });
        let direct = Object::Dictionary(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("top-direct")
        });
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"AcroForm"=>dictionary!{"Fields"=>vec![direct,parent.into()]}},
        );
        let output = extract_form_attachment_signals(&document, &[], true, false);
        assert_eq!(
            serde_json::to_value(output.form_fields).unwrap(),
            serde_json::json!([
                {"name":"parent","id":format_id(parent)},
                {"name":"parent  .  child","type":"text","value":"fallback","default_value":"fallback","id":format_id(child),"editable":true}
            ])
        );
    }

    #[test]
    fn name_tree_kids_win_over_names_and_wrong_type_kids_skip_the_node() {
        let (mut document, pages) = base_document();
        let stream = document.add_object(Stream::new(dictionary! {}, b"x".to_vec()));
        let spec = document.add_object(
            dictionary! {"F"=>Object::string_literal("a.txt"),"EF"=>dictionary!{"F"=>stream}},
        );
        let child = document
            .add_object(dictionary! {"Names"=>vec![Object::string_literal("child"),spec.into()]});
        let tree = document.add_object(dictionary! {
            "Kids"=>vec![child.into()],
            "Names"=>vec![Object::string_literal("must-skip"),spec.into()]
        });
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"Names"=>dictionary!{"EmbeddedFiles"=>tree}},
        );
        let output = extract_form_attachment_signals(&document, &[], false, true);
        assert_eq!(
            serde_json::to_value(output.attachments).unwrap(),
            serde_json::json!([{"name":"child","filename":"a.txt","size_bytes":1}])
        );

        let (mut document, pages) = base_document();
        let tree = document.add_object(
            dictionary! {"Kids"=>7,"Names"=>vec![Object::string_literal("ignored"),Object::Null]},
        );
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"Names"=>dictionary!{"EmbeddedFiles"=>tree}},
        );
        assert!(extract_form_attachment_signals(&document, &[], false, true)
            .attachments
            .is_none());
    }

    #[test]
    fn indirect_name_tree_arrays_work_duplicate_kids_fail_and_invalid_uf_does_not_fallback() {
        let (mut document, pages) = base_document();
        let stream = document.add_object(Stream::new(dictionary! {}, b"xy".to_vec()));
        let spec=document.add_object(dictionary!{"UF"=>7,"F"=>Object::string_literal("fallback.txt"),"EF"=>dictionary!{"F"=>stream}});
        let names_array = document.add_object(vec![Object::string_literal("key"), spec.into()]);
        let child = document.add_object(dictionary! {"Names"=>names_array});
        let kids_array = document.add_object(vec![child.into()]);
        let tree = document.add_object(dictionary! {"Kids"=>kids_array});
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"Names"=>dictionary!{"EmbeddedFiles"=>tree}},
        );
        let output = extract_form_attachment_signals(&document, &[], false, true);
        assert_eq!(
            serde_json::to_value(output.attachments).unwrap(),
            serde_json::json!([{"name":"key","filename":"unnamed","size_bytes":2}])
        );

        let (mut document, pages) = base_document();
        let child = document.add_object(dictionary! {});
        let tree = document.add_object(dictionary! {"Kids"=>vec![child.into(),child.into()]});
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"Names"=>dictionary!{"EmbeddedFiles"=>tree}},
        );
        assert!(extract_form_attachment_signals(&document, &[], false, true)
            .attachments
            .is_none());
    }

    #[test]
    fn broken_top_level_reference_fails_the_whole_form_surface() {
        let (mut document, pages) = base_document();
        let valid = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("valid")
        });
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"AcroForm"=>dictionary!{"Fields"=>vec![valid.into(),Object::Reference((999,0))]}},
        );
        assert!(extract_form_attachment_signals(&document, &[], true, false)
            .form_fields
            .is_none());
    }

    #[test]
    fn form_values_follow_pdfjs_decode_and_widget_coercion() {
        let (mut document, pages) = base_document();
        let text_numeric = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("numeric"),"V"=>7,"DV"=>Object::string_literal("default")
        });
        let text_missing = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("missing")
        });
        let button_bool = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("button"),"V"=>true,"DV"=>Object::Name(b"Default".to_vec())
        });
        let choice_filtered = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Ch","T"=>Object::string_literal("choice"),
            "V"=>vec![7.into(),Object::string_literal("first"),Object::Null,Object::string_literal("second")]
        });
        let choice_fallback = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Ch","T"=>Object::string_literal("fallback"),
            "DV"=>vec![false.into(),Object::string_literal("from-default")]
        });
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"AcroForm"=>dictionary!{"Fields"=>vec![text_numeric.into(),text_missing.into(),button_bool.into(),choice_filtered.into(),choice_fallback.into()]}},
        );
        let output = extract_form_attachment_signals(&document, &[], true, false);
        assert_eq!(
            serde_json::to_value(output.form_fields).unwrap(),
            serde_json::json!([
                {"name":"numeric","type":"text","value":"","default_value":"default","id":format_id(text_numeric),"editable":true},
                {"name":"missing","type":"text","value":"","default_value":"","id":format_id(text_missing),"editable":true},
                {"name":"button","type":"checkbox","value":"Off","default_value":"Default","id":format_id(button_bool),"editable":true},
                {"name":"choice","type":"listbox","value":"first","default_value":null,"id":format_id(choice_filtered),"editable":true},
                {"name":"fallback","type":"listbox","value":"from-default","default_value":["from-default"],"id":format_id(choice_fallback),"editable":true}
            ])
        );
    }

    #[test]
    fn button_array_v_and_dv_preserve_pdfjs_arrays() {
        let mut document = Document::with_version("1.4");
        let pages_id = document.new_object_id();
        let page_id = document.add_object(dictionary! {
            "Type"=>"Page","Parent"=>pages_id,"MediaBox"=>vec![0.into(),0.into(),612.into(),792.into()]
        });
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type"=>"Pages","Kids"=>vec![page_id.into()],"Count"=>1
            }),
        );
        let checkbox_array = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("flags"),
            "V"=>vec![Object::Name(b"Yes".to_vec()), Object::Name(b"Off".to_vec())],
            "Rect"=>vec![72.into(),650.into(),100.into(),670.into()],"P"=>page_id
        });
        let radio_array = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("tier"),
            "V"=>vec![Object::Name(b"Gold".to_vec()), Object::Name(b"Silver".to_vec())],
            "Ff"=>1i64<<15,
            "Rect"=>vec![72.into(),620.into(),100.into(),640.into()],"P"=>page_id
        });
        let push_array = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("go"),
            "V"=>vec![Object::Name(b"Off".to_vec()), Object::Name(b"Pushed".to_vec())],
            "Ff"=>1i64<<16,
            "Rect"=>vec![72.into(),590.into(),140.into(),610.into()],"P"=>page_id
        });
        let plain = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("plain"),
            "V"=>Object::Name(b"Yes".to_vec()),
            "Rect"=>vec![72.into(),560.into(),100.into(),580.into()],"P"=>page_id
        });
        let empty_array = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("empty"),
            "V"=>Vec::<Object>::new(),
            "Rect"=>vec![72.into(),530.into(),100.into(),550.into()],"P"=>page_id
        });
        let dv_array = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Btn","T"=>Object::string_literal("dv"),
            "DV"=>vec![Object::Name(b"Yes".to_vec()), Object::Name(b"Off".to_vec())],
            "Rect"=>vec![72.into(),500.into(),100.into(),520.into()],"P"=>page_id
        });
        let catalog = document.add_object(dictionary! {
            "Type"=>"Catalog","Pages"=>pages_id,
            "AcroForm"=>dictionary! {
                "Fields"=>vec![
                    checkbox_array.into(), radio_array.into(), push_array.into(),
                    plain.into(), empty_array.into(), dv_array.into()
                ]
            }
        });
        document.trailer.set("Root", catalog);
        let signals = extract_form_attachment_signals(&document, &[(1, page_id)], true, false);
        let fields = signals.form_fields.expect("fields");
        let value_of = |name: &str| {
            fields
                .iter()
                .find(|field| field.name == name)
                .map(|field| serde_json::to_value(&field.value).unwrap())
                .expect(name)
        };
        let type_of = |name: &str| {
            fields
                .iter()
                .find(|field| field.name == name)
                .and_then(|field| field.r#type.clone())
                .expect(name)
        };
        let default_of = |name: &str| {
            fields
                .iter()
                .find(|field| field.name == name)
                .map(|field| serde_json::to_value(&field.default_value).unwrap())
                .expect(name)
        };
        assert_eq!(value_of("flags"), serde_json::json!(["Yes", "Off"]));
        assert_eq!(value_of("tier"), serde_json::json!(["Gold", "Silver"]));
        assert_eq!(type_of("tier"), "radiobutton");
        assert_eq!(value_of("go"), serde_json::json!(["Off", "Pushed"]));
        assert_eq!(type_of("go"), "button");
        assert_eq!(value_of("plain"), serde_json::json!("Yes"));
        assert_eq!(value_of("empty"), serde_json::json!("Off"));
        assert_eq!(value_of("dv"), serde_json::json!(["Yes", "Off"]));
        assert_eq!(default_of("dv"), serde_json::json!(["Yes", "Off"]));
    }

    #[test]
    fn utf16_be_odd_length_form_values_drop_trailing_byte_like_pdfjs() {
        let mut document = Document::with_version("1.4");
        let pages_id = document.new_object_id();
        let page_id = document.add_object(dictionary! {
            "Type"=>"Page","Parent"=>pages_id,"MediaBox"=>vec![0.into(),0.into(),612.into(),792.into()]
        });
        document.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type"=>"Pages","Kids"=>vec![page_id.into()],"Count"=>1
            }),
        );
        // FEFF 0041 0064 0061 => "Ada"
        let valid = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("valid"),
            "V"=>Object::String(vec![0xFE,0xFF,0x00,0x41,0x00,0x64,0x00,0x61], lopdf::StringFormat::Hexadecimal),
            "Rect"=>vec![72.into(),650.into(),200.into(),670.into()],"P"=>page_id
        });
        // FEFF 0042 006F 62 => drop trailing 0x62 => "Bo"
        let odd = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("odd"),
            "V"=>Object::String(vec![0xFE,0xFF,0x00,0x42,0x00,0x6F,0x62], lopdf::StringFormat::Hexadecimal),
            "DV"=>Object::String(vec![0xFE,0xFF,0x00,0x42,0x00,0x6F,0x62], lopdf::StringFormat::Hexadecimal),
            "Rect"=>vec![72.into(),620.into(),200.into(),640.into()],"P"=>page_id
        });
        // plain PDFDocEncoding control
        let plain = document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("plain"),
            "V"=>Object::string_literal("Alice"),
            "Rect"=>vec![72.into(),590.into(),200.into(),610.into()],"P"=>page_id
        });
        let catalog = document.add_object(dictionary! {
            "Type"=>"Catalog","Pages"=>pages_id,
            "AcroForm"=>dictionary!{"Fields"=>vec![valid.into(), odd.into(), plain.into()]}
        });
        document.trailer.set("Root", catalog);
        let signals = extract_form_attachment_signals(&document, &[(1, page_id)], true, false);
        let fields = signals.form_fields.expect("fields");
        let value_of = |name: &str| {
            fields
                .iter()
                .find(|field| field.name == name)
                .map(|field| serde_json::to_value(&field.value).unwrap())
                .expect(name)
        };
        let default_of = |name: &str| {
            fields
                .iter()
                .find(|field| field.name == name)
                .map(|field| serde_json::to_value(&field.default_value).unwrap())
                .expect(name)
        };
        assert_eq!(value_of("valid"), serde_json::json!("Ada"));
        assert_eq!(value_of("odd"), serde_json::json!("Bo"));
        assert_eq!(default_of("odd"), serde_json::json!("Bo"));
        assert_eq!(value_of("plain"), serde_json::json!("Alice"));
    }

    #[test]
    fn odd_length_names_materialize_trailing_orphan_like_pdfjs() {
        let (mut document, pages) = base_document();
        let stream = document.add_object(Stream::new(dictionary! {}, b"x".to_vec()));
        let spec = document.add_object(dictionary! {
            "F"=>Object::string_literal("a.txt"),
            "EF"=>dictionary!{"F"=>stream}
        });
        let tree = document.add_object(dictionary! {
            "Names"=>vec![
                Object::string_literal("child"),
                spec.into(),
                Object::string_literal("orphan"),
            ]
        });
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"Names"=>dictionary!{"EmbeddedFiles"=>tree}},
        );
        let out = extract_form_attachment_signals(&document, &[], false, true);
        assert!(out.warnings.is_empty());
        assert_eq!(
            serde_json::to_value(out.attachments).unwrap(),
            serde_json::json!([
                {"name":"child","filename":"a.txt","size_bytes":1},
                {"name":"orphan","filename":"unnamed"}
            ])
        );
    }

    #[test]
    fn orphan_only_names_array_materializes_unnamed_attachment() {
        let (mut document, pages) = base_document();
        let tree = document.add_object(dictionary! {
            "Names"=>vec![Object::string_literal("orphan")]
        });
        finish_catalog(
            &mut document,
            pages,
            dictionary! {"Names"=>dictionary!{"EmbeddedFiles"=>tree}},
        );
        let out = extract_form_attachment_signals(&document, &[], false, true);
        assert!(out.warnings.is_empty());
        assert_eq!(
            serde_json::to_value(out.attachments).unwrap(),
            serde_json::json!([{"name":"orphan","filename":"unnamed"}])
        );
    }

    #[test]
    fn trailing_slash_filename_becomes_unnamed() {
        let document = Document::with_version("1.7");
        let mut walker = Walker::new(&document);
        let spec = dictionary! {"UF"=>Object::string_literal(r"folder/")};
        assert_eq!(filename(&mut walker, &spec), Some("unnamed".into()));
    }

    fn valid_attachment_tree(document: &mut Document) -> ObjectId {
        let stream = document.add_object(Stream::new(dictionary! {}, b"x".to_vec()));
        let spec = document.add_object(
            dictionary! {"F"=>Object::string_literal("ok.txt"),"EF"=>dictionary!{"F"=>stream}},
        );
        document.add_object(dictionary! {"Names"=>vec![Object::string_literal("ok"),spec.into()]})
    }

    fn valid_form(document: &mut Document) -> ObjectId {
        document.add_object(dictionary! {
            "Subtype"=>"Widget","FT"=>"Tx","T"=>Object::string_literal("ok")
        })
    }

    #[test]
    fn root_fields_and_form_kids_have_global_raw_admission_budgets() {
        for oversized_kids in [false, true] {
            let (mut document, pages) = base_document();
            let attachment_tree = valid_attachment_tree(&mut document);
            let fields = if oversized_kids {
                let parent = document.add_object(dictionary! {
                    "T"=>Object::string_literal("parent"),
                    "Kids"=>vec![Object::Null;MAX_ENTRIES+1]
                });
                vec![parent.into()]
            } else {
                vec![Object::Null; MAX_ENTRIES + 1]
            };
            let acroform = document.add_object(dictionary! {"Fields"=>fields});
            finish_catalog(
                &mut document,
                pages,
                dictionary! {
                    "AcroForm"=>acroform,
                    "Names"=>dictionary!{"EmbeddedFiles"=>attachment_tree}
                },
            );
            let output = extract_form_attachment_signals(&document, &[], true, true);
            assert!(output.form_fields.is_none());
            assert!(output.attachments.is_some());
            assert!(output
                .warnings
                .iter()
                .any(|warning| warning.contains("include_form_fields")));
            assert_eq!(
                output.form_materialized_array_items,
                usize::from(oversized_kids),
                "an oversized direct array must not materialize its children"
            );
        }
    }

    #[test]
    fn name_tree_kids_and_pairs_have_global_admission_budgets() {
        for oversized_pairs in [false, true] {
            let (mut document, pages) = base_document();
            let form = valid_form(&mut document);
            let tree = if oversized_pairs {
                document.add_object(dictionary! {
                    "Names"=>vec![Object::Null; (MAX_ENTRIES+1)*2]
                })
            } else {
                document.add_object(dictionary! {
                    "Kids"=>vec![Object::Null;MAX_ENTRIES+1]
                })
            };
            finish_catalog(
                &mut document,
                pages,
                dictionary! {
                    "AcroForm"=>dictionary!{"Fields"=>vec![form.into()]},
                    "Names"=>dictionary!{"EmbeddedFiles"=>tree}
                },
            );
            let output = extract_form_attachment_signals(&document, &[], true, true);
            assert!(output.form_fields.is_some());
            assert!(output.attachments.is_none());
            assert!(output
                .warnings
                .iter()
                .any(|warning| warning.contains("include_attachments")));
            assert_eq!(
                output.attachment_materialized_array_items, 0,
                "an oversized NameTree collection must fail before item materialization"
            );
        }
    }

    #[test]
    fn page_and_annotation_admission_is_bounded_before_form_maps() {
        for indirect_annots in [false, true] {
            let (mut document, pages_root) = base_document();
            let form = valid_form(&mut document);
            let attachment_tree = valid_attachment_tree(&mut document);
            let annots = vec![Object::Null; MAX_ENTRIES + 1];
            let page = if indirect_annots {
                let annots = document.add_object(annots);
                document.add_object(dictionary! {"Type"=>"Page","Annots"=>annots})
            } else {
                document.add_object(dictionary! {"Type"=>"Page","Annots"=>annots})
            };
            finish_catalog(
                &mut document,
                pages_root,
                dictionary! {
                    "AcroForm"=>dictionary!{"Fields"=>vec![form.into()]},
                    "Names"=>dictionary!{"EmbeddedFiles"=>attachment_tree}
                },
            );
            let output = extract_form_attachment_signals(&document, &[(1, page)], true, true);
            assert!(output.form_fields.is_none());
            assert!(output.attachments.is_some());
            assert!(output
                .warnings
                .iter()
                .any(|warning| warning.contains("include_form_fields")));
            assert_eq!(output.form_annotation_materialized_array_items, 0);
        }

        let (mut document, pages_root) = base_document();
        let form = valid_form(&mut document);
        let attachment_tree = valid_attachment_tree(&mut document);
        let page = document.add_object(dictionary! {"Type"=>"Page"});
        finish_catalog(
            &mut document,
            pages_root,
            dictionary! {
                "AcroForm"=>dictionary!{"Fields"=>vec![form.into()]},
                "Names"=>dictionary!{"EmbeddedFiles"=>attachment_tree}
            },
        );
        let pages = vec![(1, page); MAX_ENTRIES + 1];
        let output = extract_form_attachment_signals(&document, &pages, true, true);
        assert!(output.form_fields.is_none());
        assert!(output.attachments.is_some());
        assert_eq!(output.form_annotation_materialized_array_items, 0);
    }

    #[test]
    fn form_value_depth_and_aggregate_nodes_are_bounded() {
        let mut deep = Object::Name(b"leaf".to_vec());
        for _ in 0..=MAX_DEPTH {
            deep = Object::Array(vec![deep]);
        }
        let child = Object::Array(vec![Object::Null; 256]);
        let aggregate = Object::Array(vec![child; (MAX_ENTRIES / 256) + 2]);
        let oversized = Object::Array(vec![Object::Null; 257]);
        for value in [deep, aggregate, oversized] {
            let (mut document, pages) = base_document();
            let field = document.add_object(dictionary! {
                "Subtype"=>"Widget","FT"=>"Ch","T"=>Object::string_literal("hostile"),
                "V"=>value
            });
            let attachment_tree = valid_attachment_tree(&mut document);
            finish_catalog(
                &mut document,
                pages,
                dictionary! {
                    "AcroForm"=>dictionary!{"Fields"=>vec![field.into()]},
                    "Names"=>dictionary!{"EmbeddedFiles"=>attachment_tree}
                },
            );
            let output = extract_form_attachment_signals(&document, &[], true, true);
            assert!(output.form_fields.is_none());
            assert!(output.attachments.is_some());
            assert!(output
                .warnings
                .iter()
                .any(|warning| warning.contains("include_form_fields")));
        }
    }

    #[test]
    fn bounded_array_resolution_rejects_reference_depth_overflow() {
        let mut document = Document::with_version("1.7");
        let mut id = document.add_object(Vec::<Object>::new());
        for _ in 0..=MAX_DEPTH {
            id = document.add_object(Object::Reference(id));
        }
        document.trailer.set("Root", id);
        let root = document.trailer.get(b"Root").unwrap();
        let mut walker = Walker::new(&document);
        assert!(walker.array_bounded(root, MAX_ENTRIES).is_none());
        assert!(walker.limited);
        assert!(!walker.failed);
    }

    #[test]
    fn button_ap_default_off_when_named_normal_appearance() {
        let cases = [
            (
                "v3014-form-checkbox-ap-default-off-v1.pdf",
                "Agree",
                "checkbox",
                "Yes",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-radio-ap-default-off-v1.pdf",
                "Plan",
                "radiobutton",
                "Gold",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-noap-default-null-v1.pdf",
                "Consent",
                "checkbox",
                "Yes",
                serde_json::Value::Null,
            ),
        ];
        for (fixture, name, kind, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load button default fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, name, "fixture {fixture}");
            assert_eq!(field.r#type.as_deref(), Some(kind), "fixture {fixture}");
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }

    #[test]
    fn pushbutton_ap_default_stays_null() {
        let cases = [
            (
                "v3014-form-pushbutton-ap-default-null-v1.pdf",
                "Go",
                "button",
                "Off",
                serde_json::Value::Null,
            ),
            (
                "v3014-form-pushbutton-noap-default-null-v1.pdf",
                "Go",
                "button",
                "Off",
                serde_json::Value::Null,
            ),
            (
                "v3014-form-checkbox-ap-default-off-v1.pdf",
                "Agree",
                "checkbox",
                "Yes",
                serde_json::json!("Off"),
            ),
        ];
        for (fixture, name, kind, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load pushbutton default fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, name, "fixture {fixture}");
            assert_eq!(field.r#type.as_deref(), Some(kind), "fixture {fixture}");
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }

    #[test]
    fn checkbox_as_overrides_v_when_named_normal_appearance() {
        let cases = [
            (
                "v3014-form-checkbox-as-overrides-v-off-v1.pdf",
                "Off",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-as-overrides-v-yes-v1.pdf",
                "Yes",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-as-noap-keeps-v-v1.pdf",
                "Yes",
                serde_json::Value::Null,
            ),
        ];
        for (fixture, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load checkbox AS fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, "Agree", "fixture {fixture}");
            assert_eq!(
                field.r#type.as_deref(),
                Some("checkbox"),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }

    #[test]
    fn checkbox_export_value_normalization() {
        let cases = [
            (
                "v3014-form-checkbox-as-invalid-export-off-v1.pdf",
                "Off",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-as-only-off-yes-v1.pdf",
                "Yes",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-as-off-export-ok-v1.pdf",
                "Off",
                serde_json::json!("Off"),
            ),
        ];
        for (fixture, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load checkbox export fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, "Agree", "fixture {fixture}");
            assert_eq!(
                field.r#type.as_deref(),
                Some("checkbox"),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }
    #[test]
    fn radio_as_does_not_override_v() {
        let cases = [
            (
                "v3014-form-radio-as-does-not-override-v-v1.pdf",
                "radiobutton",
                "Gold",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-radio-as-invalid-keeps-v-v1.pdf",
                "radiobutton",
                "Gold",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-radio-checkbox-as-regression-v1.pdf",
                "checkbox",
                "Off",
                serde_json::json!("Off"),
            ),
        ];
        for (fixture, field_type, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load radio as residual fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(
                field.r#type.as_deref(),
                Some(field_type),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }
    #[test]
    fn checkbox_multi_export_options() {
        let cases = [
            (
                "v3014-form-checkbox-multi-export-foo-v1.pdf",
                "Foo",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-multi-export-as-bar-v1.pdf",
                "Bar",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-multi-export-as-baz-off-v1.pdf",
                "Off",
                serde_json::json!("Off"),
            ),
        ];
        for (fixture, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load multi-export fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, "Agree", "fixture {fixture}");
            assert_eq!(
                field.r#type.as_deref(),
                Some("checkbox"),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }
    #[test]
    fn checkbox_multi_export_many_options() {
        let cases = [
            (
                "v3014-form-checkbox-multi-export-many-c-v1.pdf",
                "C",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-multi-export-many-a-v1.pdf",
                "A",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-multi-export-many-z-off-v1.pdf",
                "Off",
                serde_json::json!("Off"),
            ),
        ];
        for (fixture, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load multi-export-many fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, "Agree", "fixture {fixture}");
            assert_eq!(
                field.r#type.as_deref(),
                Some("checkbox"),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }
    #[test]
    fn checkbox_export_empty_single_options() {
        let cases = [
            (
                "v3014-form-checkbox-export-empty-ap-yes-v1.pdf",
                "Yes",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-export-single-foo-v1.pdf",
                "Foo",
                serde_json::json!("Off"),
            ),
            (
                "v3014-form-checkbox-export-single-bar-off-v1.pdf",
                "Off",
                serde_json::json!("Off"),
            ),
        ];
        for (fixture, value, default_value) in cases {
            let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../test/fixtures/differential")
                .join(fixture);
            let document = Document::load(path).expect("load empty/single export fixture");
            let pages = document.get_pages().into_iter().collect::<Vec<_>>();
            let output = extract_form_attachment_signals(&document, &pages, true, false);
            let fields = output.form_fields.expect("form fields");
            assert_eq!(fields.len(), 1, "fixture {fixture}");
            let field = &fields[0];
            assert_eq!(field.name, "Agree", "fixture {fixture}");
            assert_eq!(
                field.r#type.as_deref(),
                Some("checkbox"),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.value).unwrap(),
                serde_json::json!(value),
                "fixture {fixture}"
            );
            assert_eq!(
                serde_json::to_value(&field.default_value).unwrap(),
                default_value,
                "fixture {fixture}"
            );
        }
    }
}
