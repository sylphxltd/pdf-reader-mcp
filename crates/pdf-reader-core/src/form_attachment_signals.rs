use std::collections::{HashMap, HashSet, VecDeque};

use lopdf::{Dictionary, Document, Object, ObjectId};
use pdf_extract::decode_text_string;
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

#[derive(Clone, Default)]
struct Inherited {
    field_type: Option<Object>,
    flags: Option<Object>,
    value: Option<Object>,
    default_value: Option<Object>,
}

pub(crate) fn extract_form_attachment_signals(
    document: &Document,
    pages: &[(u32, ObjectId)],
    want_forms: bool,
    want_attachments: bool,
) -> FormAttachmentSignals {
    let mut output = FormAttachmentSignals::default();
    let Ok(catalog) = document.catalog().cloned() else {
        return output;
    };
    if want_forms {
        let mut walker = Walker::new(document);
        output.form_fields = extract_forms(&mut walker, &catalog, pages);
        if walker.limited {
            output.form_fields = None;
            output.warnings.push("include_form_fields: COS traversal exceeded the bounded form-field limit; the surface was omitted.".into());
        }
    }
    if want_attachments {
        let mut walker = Walker::new(document);
        output.attachments = extract_attachments(&mut walker, &catalog);
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
    failed: bool,
    limited: bool,
}

impl<'a> Walker<'a> {
    fn new(document: &'a Document) -> Self {
        Self {
            document,
            work: 0,
            entries: 0,
            text_remaining: MAX_TEXT_BYTES,
            failed: false,
            limited: false,
        }
    }

    fn resolve(&mut self, value: &Object) -> Option<Object> {
        let mut value = value.clone();
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
            if !seen.insert(id) {
                self.failed = true;
                return None;
            }
            let Ok(next) = self.document.get_object(id) else {
                self.failed = true;
                return None;
            };
            value = next.clone();
        }
        self.limited = true;
        None
    }

    fn dict(&mut self, value: &Object) -> Option<Dictionary> {
        self.resolve(value)?.as_dict().ok().cloned()
    }

    fn text(&mut self, value: &Object) -> Option<String> {
        let value = self.resolve(value)?;
        let bytes = match &value {
            Object::String(bytes, _) | Object::Name(bytes) => bytes,
            _ => return None,
        };
        if bytes.len() > MAX_STRING_BYTES || bytes.len() > self.text_remaining {
            self.limited = true;
            return None;
        }
        let text = match &value {
            Object::Name(bytes) => String::from_utf8_lossy(bytes).into_owned(),
            _ => decode_text_string(&value).ok()?,
        };
        if text.len() > MAX_STRING_BYTES || text.len() > self.text_remaining {
            self.limited = true;
            return None;
        }
        self.text_remaining -= text.len();
        Some(text)
    }
}

fn extract_forms(
    walker: &mut Walker<'_>,
    catalog: &Dictionary,
    pages: &[(u32, ObjectId)],
) -> Option<Vec<FormField>> {
    let acroform = walker.dict(catalog.get(b"AcroForm").ok()?)?;
    let fields = walker.resolve(acroform.get(b"Fields").ok()?)?;
    let fields = fields.as_array().ok()?.clone();
    let page_by_id = pages
        .iter()
        .map(|(page, id)| (*id, *page))
        .collect::<HashMap<_, _>>();
    let mut annotation_pages = HashMap::new();
    for (page, page_id) in pages {
        let Ok(page_dict) = walker
            .document
            .get_object(*page_id)
            .and_then(Object::as_dict)
        else {
            continue;
        };
        if let Ok(annots) = page_dict.get(b"Annots").and_then(Object::as_array) {
            for annot in annots {
                if let Ok(id) = annot.as_reference() {
                    annotation_pages.insert(id, *page);
                }
            }
        }
    }
    let mut output = Vec::new();
    let mut visited = HashSet::new();
    for field in fields {
        walk_field(
            walker,
            &field,
            0,
            "",
            &Inherited::default(),
            &page_by_id,
            &annotation_pages,
            &mut visited,
            &mut output,
        );
        if walker.failed || walker.limited {
            return None;
        }
    }
    (!output.is_empty()).then_some(output)
}

#[allow(clippy::too_many_arguments)]
fn walk_field(
    walker: &mut Walker<'_>,
    value: &Object,
    depth: usize,
    parent_name: &str,
    inherited: &Inherited,
    page_by_id: &HashMap<ObjectId, u32>,
    annotation_pages: &HashMap<ObjectId, u32>,
    visited: &mut HashSet<ObjectId>,
    output: &mut Vec<FormField>,
) {
    if depth >= MAX_DEPTH || output.len() >= MAX_ENTRIES {
        walker.limited = true;
        return;
    }
    let id = value.as_reference().ok();
    if let Some(id) = id {
        if !visited.insert(id) {
            return;
        }
    }
    let Some(dict) = walker.dict(value) else {
        walker.failed = false;
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
    let name = match (parent_name.is_empty(), partial.trim().is_empty()) {
        (true, true) => String::new(),
        (true, false) => partial.trim().to_string(),
        (false, true) => parent_name.to_string(),
        (false, false) => format!("{parent_name}.{}", partial.trim()),
    };
    let next = Inherited {
        field_type: dict
            .get(b"FT")
            .ok()
            .cloned()
            .or_else(|| inherited.field_type.clone()),
        flags: dict
            .get(b"Ff")
            .ok()
            .cloned()
            .or_else(|| inherited.flags.clone()),
        value: dict
            .get(b"V")
            .ok()
            .cloned()
            .or_else(|| inherited.value.clone()),
        default_value: dict
            .get(b"DV")
            .ok()
            .cloned()
            .or_else(|| inherited.default_value.clone()),
    };
    let kids = dict
        .get(b"Kids")
        .ok()
        .and_then(|value| walker.resolve(value))
        .and_then(|value| value.as_array().ok().cloned());
    if !name.is_empty() {
        if kids.is_some() {
            output.push(FormField {
                name: name.clone(),
                r#type: None,
                value: None,
                default_value: None,
                page: None,
                id: id.map(format_id),
                editable: None,
                bounding_box: None,
            });
        } else if let Some(field) = normalize_leaf(
            walker,
            &dict,
            id,
            name.clone(),
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
                &kid,
                depth + 1,
                &name,
                &next,
                page_by_id,
                annotation_pages,
                visited,
                output,
            );
        }
    }
}

fn normalize_leaf(
    walker: &mut Walker<'_>,
    dict: &Dictionary,
    id: Option<ObjectId>,
    name: String,
    inherited: &Inherited,
    page_by_id: &HashMap<ObjectId, u32>,
    annotation_pages: &HashMap<ObjectId, u32>,
) -> Option<FormField> {
    let ft = inherited
        .field_type
        .as_ref()
        .and_then(|v| walker.resolve(v))
        .and_then(|v| v.as_name().ok().map(<[u8]>::to_vec));
    let flags = inherited
        .flags
        .as_ref()
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
    let mut value = inherited.value.as_ref().and_then(|v| form_value(walker, v));
    let mut default_value = inherited
        .default_value
        .as_ref()
        .and_then(|v| form_value(walker, v));
    match field_type.as_deref() {
        Some("text") => {
            default_value.get_or_insert_with(|| Value::String(String::new()));
        }
        Some("checkbox" | "radiobutton" | "button") => {
            value.get_or_insert_with(|| Value::String("Off".into()));
            default_value.get_or_insert(Value::Null);
        }
        Some("listbox" | "combobox") => value = Some(first_choice_value(value)),
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

fn form_value(walker: &mut Walker<'_>, value: &Object) -> Option<Value> {
    let value = walker.resolve(value)?;
    match &value {
        Object::Null => Some(Value::Null),
        Object::Boolean(v) => Some(Value::Bool(*v)),
        Object::Integer(v) => Some((*v).into()),
        Object::Real(v) => serde_json::Number::from_f64(f64::from(*v)).map(Value::Number),
        Object::String(_, _) | Object::Name(_) => walker.text(&value).map(Value::String),
        Object::Array(values) if values.len() <= 256 => values
            .iter()
            .map(|v| form_value(walker, v))
            .collect::<Option<Vec<_>>>()
            .map(Value::Array),
        _ => None,
    }
}

fn rect(walker: &mut Walker<'_>, value: &Object) -> Option<BoxValue> {
    let value = walker.resolve(value)?;
    let values = value.as_array().ok()?;
    if values.len() < 4 {
        return None;
    }
    let mut n = [0.0; 4];
    for (index, value) in values.iter().take(4).enumerate() {
        n[index] = number(&walker.resolve(value)?)?;
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

fn extract_attachments(walker: &mut Walker<'_>, catalog: &Dictionary) -> Option<Vec<Attachment>> {
    let names = walker.dict(catalog.get(b"Names").ok()?)?;
    let root = names.get(b"EmbeddedFiles").ok()?.clone();
    let mut queue = VecDeque::from([(root, 0usize)]);
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
        let dict = walker.dict(&node)?;
        let kids = dict
            .get(b"Kids")
            .ok()
            .and_then(|value| walker.resolve(value))
            .and_then(|value| value.as_array().ok().cloned());
        if let Some(kids) = kids {
            for kid in kids {
                queue.push_back((kid, depth + 1));
            }
        }
        let names = dict
            .get(b"Names")
            .ok()
            .and_then(|value| walker.resolve(value))
            .and_then(|value| value.as_array().ok().cloned());
        if let Some(names) = names {
            if names.len() % 2 != 0 {
                walker.failed = true;
                return None;
            }
            for pair in names.chunks_exact(2) {
                pairs.push((pair[0].clone(), pair[1].clone()));
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
        let name = walker.text(&key)?;
        let spec = walker.dict(&spec)?;
        let filename = filename(walker, &spec);
        let description = spec
            .get(b"Desc")
            .ok()
            .and_then(|v| walker.text(v))
            .filter(|v| !v.is_empty());
        let size_bytes = embedded_size(walker, &spec);
        let attachment = Attachment {
            name: name.clone(),
            filename,
            description,
            size_bytes,
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

fn filename(walker: &mut Walker<'_>, spec: &Dictionary) -> Option<String> {
    let raw = [b"UF".as_slice(), b"F", b"Unix", b"Mac", b"DOS"]
        .into_iter()
        .find_map(|key| spec.get(key).ok().and_then(|v| walker.text(v)));
    let normalized = raw.unwrap_or_default().replace('\\', "/");
    Some(
        normalized
            .rsplit('/')
            .find(|part| !part.is_empty())
            .unwrap_or("unnamed")
            .to_string(),
    )
}

fn embedded_size(walker: &mut Walker<'_>, spec: &Dictionary) -> Option<usize> {
    let ef = walker.dict(spec.get(b"EF").ok()?)?;
    let stream = [b"UF".as_slice(), b"F", b"Unix", b"Mac", b"DOS"]
        .into_iter()
        .find_map(|key| ef.get(key).ok().cloned())?;
    let stream = walker.resolve(&stream)?;
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
}
