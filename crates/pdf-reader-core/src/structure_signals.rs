use std::collections::{HashMap, HashSet, VecDeque};

use lopdf::{Dictionary, Document, Object, ObjectId};
use serde::Serialize;
#[cfg(test)]
use serde_json::{json, Value};

const PDFJS_MAX_DEPTH: usize = 40;
const MAX_OBJECTS_PER_PAGE: usize = 10_000;
const MAX_ARRAY_ITEMS: usize = 10_000;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct PageStructureTree {
    page: u32,
    tree: StructureNode,
}

#[derive(Debug, Clone, Serialize)]
struct StructureNode {
    role: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    children: Vec<StructureChild>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
enum StructureChild {
    Node(StructureNode),
    Content(StructureContent),
}

#[derive(Debug, Clone, Serialize)]
struct StructureContent {
    r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<String>,
}

pub(crate) fn extract_structure_trees(
    document: &Document,
    pages: &[(u32, ObjectId)],
    selected_pages: &[u32],
) -> Vec<PageStructureTree> {
    let Ok(root_value) = document.trailer.get(b"Root") else {
        return Vec::new();
    };
    let mut setup = Walker::new(document);
    let Some(catalog) = setup.dict(root_value) else {
        return Vec::new();
    };
    let Some(struct_root) = catalog
        .get(b"StructTreeRoot")
        .ok()
        .and_then(|value| setup.dict(value))
    else {
        return Vec::new();
    };
    let role_map = read_role_map(&mut setup, struct_root);
    let Some(top_level) = struct_root
        .get(b"K")
        .ok()
        .map(|value| object_list(&mut setup, value))
        .transpose()
        .ok()
        .flatten()
    else {
        return Vec::new();
    };
    let parent_tree = struct_root
        .get(b"ParentTree")
        .ok()
        .and_then(|value| read_number_tree(&mut setup, value));
    if setup.failed || setup.limited {
        return Vec::new();
    }

    let page_by_number = pages.iter().copied().collect::<HashMap<_, _>>();
    let mut selected = selected_pages.to_vec();
    selected.sort_unstable();
    selected.dedup();
    selected
        .into_iter()
        .filter_map(|page| {
            let page_id = *page_by_number.get(&page)?;
            let mut walker = Walker::new(document);
            extract_page_tree(
                &mut walker,
                page,
                page_id,
                struct_root,
                &top_level,
                &role_map,
                parent_tree.as_ref(),
            )
        })
        .collect()
}

fn extract_page_tree<'a>(
    walker: &mut Walker<'a>,
    page: u32,
    page_id: ObjectId,
    struct_root: &'a Dictionary,
    top_level: &[&'a Object],
    role_map: &HashMap<Vec<u8>, Vec<u8>>,
    parent_tree: Option<&HashMap<i64, &'a Object>>,
) -> Option<PageStructureTree> {
    let page_value = walker.document.objects.get(&page_id)?;
    let page_dict = walker.dict(page_value)?;
    let mut mapped = Vec::new();
    let mut annotation_elements = HashSet::new();
    if let (Some(tree), Some(key)) = (
        parent_tree,
        page_dict
            .get(b"StructParents")
            .ok()
            .and_then(|value| walker.integer(value)),
    ) {
        if let Some(value) = tree.get(&key) {
            for entry in object_list(walker, value).ok()? {
                if let Ok(id) = entry.as_reference() {
                    mapped.push(id);
                }
            }
        }
    }
    if let (Some(tree), Ok(annots_value)) = (parent_tree, page_dict.get(b"Annots")) {
        for annot in object_list(walker, annots_value).ok()? {
            let Ok(annot_id) = annot.as_reference() else {
                continue;
            };
            let Some(annot_dict) = walker.dict(annot) else {
                continue;
            };
            let Some(key) = annot_dict
                .get(b"StructParent")
                .ok()
                .and_then(|value| walker.integer(value))
            else {
                continue;
            };
            let Some(element_id) = tree.get(&key).and_then(|value| value.as_reference().ok())
            else {
                continue;
            };
            mapped.push(element_id);
            annotation_elements.insert(element_id);
            walker.annotation_ids.insert(annot_id);
        }
    }
    if walker.failed || walker.limited {
        return None;
    }

    let mut included = HashSet::new();
    for id in mapped {
        admit_ancestry(walker, id, struct_root, &mut included)?;
    }
    let top_positions = top_level
        .iter()
        .filter_map(|value| value.as_reference().ok())
        .enumerate()
        .map(|(index, id)| (id, index))
        .collect::<HashMap<_, _>>();
    let mut roots = included
        .iter()
        .copied()
        .filter(|id| {
            walker
                .document
                .objects
                .get(id)
                .and_then(|value| value.as_dict().ok())
                .and_then(|dict| dict.get(b"P").ok())
                .is_some_and(|parent| {
                    walker
                        .resolve_readonly(parent)
                        .and_then(|value| value.as_dict().ok())
                        .is_some_and(|dict| {
                            dict.get(b"Type")
                                .ok()
                                .and_then(|value| value.as_name().ok())
                                == Some(b"StructTreeRoot")
                        })
                })
        })
        .collect::<Vec<_>>();
    roots.sort_by_key(|id| top_positions.get(id).copied().unwrap_or(usize::MAX));
    let mut children = Vec::new();
    for id in roots {
        if let Some(node) = serialize_node(
            walker,
            id,
            page_id,
            role_map,
            &included,
            &annotation_elements,
            0,
        ) {
            children.push(StructureChild::Node(node));
        }
        if walker.failed || walker.limited {
            return None;
        }
    }
    Some(PageStructureTree {
        page,
        tree: StructureNode {
            role: "Root".into(),
            children,
        },
    })
}

fn admit_ancestry(
    walker: &mut Walker<'_>,
    mut id: ObjectId,
    struct_root: &Dictionary,
    included: &mut HashSet<ObjectId>,
) -> Option<()> {
    for _ in 0..=PDFJS_MAX_DEPTH {
        walker.admit_node()?;
        if !included.insert(id) {
            return Some(());
        }
        let dict = walker.document.objects.get(&id)?.as_dict().ok()?;
        let parent = dict.get(b"P").ok()?;
        let parent = walker.resolve(parent)?;
        let parent_dict = parent.as_dict().ok()?;
        if std::ptr::eq(parent_dict, struct_root) {
            return Some(());
        }
        let parent_id = parent.as_reference().ok().or_else(|| {
            dict.get(b"P")
                .ok()
                .and_then(|value| value.as_reference().ok())
        })?;
        if !parent_contains(walker, parent_dict, id) {
            included.remove(&id);
            return Some(());
        }
        id = parent_id;
    }
    walker.limited = true;
    None
}

fn parent_contains<'a>(walker: &mut Walker<'a>, parent: &'a Dictionary, child: ObjectId) -> bool {
    parent
        .get(b"K")
        .ok()
        .and_then(|value| object_list(walker, value).ok())
        .is_some_and(|kids| {
            kids.into_iter()
                .any(|kid| kid.as_reference().ok() == Some(child))
        })
}

#[allow(clippy::too_many_arguments)]
fn serialize_node(
    walker: &mut Walker<'_>,
    id: ObjectId,
    page_id: ObjectId,
    role_map: &HashMap<Vec<u8>, Vec<u8>>,
    included: &HashSet<ObjectId>,
    annotation_elements: &HashSet<ObjectId>,
    depth: usize,
) -> Option<StructureNode> {
    if depth > PDFJS_MAX_DEPTH {
        return None;
    }
    walker.admit_node()?;
    let dict = walker.document.objects.get(&id)?.as_dict().ok()?;
    let raw_role = dict
        .get(b"S")
        .ok()
        .and_then(|value| walker.resolve(value))
        .and_then(|value| value.as_name().ok())
        .unwrap_or_default();
    let role = role_map
        .get(raw_role)
        .map(Vec::as_slice)
        .unwrap_or(raw_role);
    let role = if role.is_empty() {
        "Unknown".into()
    } else {
        String::from_utf8_lossy(role).trim().to_string()
    };
    let inherited_page = dict
        .get(b"Pg")
        .ok()
        .and_then(|value| value.as_reference().ok());
    let kids = dict
        .get(b"K")
        .ok()
        .map(|value| object_list(walker, value))
        .transpose()
        .ok()
        .flatten()
        .unwrap_or_default();
    let mut children = Vec::new();
    for kid in kids {
        walker.admit_node()?;
        if let Ok(child_id) = kid.as_reference() {
            if included.contains(&child_id) {
                if let Some(node) = serialize_node(
                    walker,
                    child_id,
                    page_id,
                    role_map,
                    included,
                    annotation_elements,
                    depth + 1,
                ) {
                    children.push(StructureChild::Node(node));
                }
                continue;
            }
        }
        let resolved = walker.resolve(kid)?;
        if let Ok(mcid) = resolved.as_i64() {
            if inherited_page == Some(page_id) {
                children.push(content(
                    "content",
                    Some(format!("p{}_mc{mcid}", format_id(page_id))),
                ));
            }
            continue;
        }
        let Ok(content_dict) = resolved.as_dict() else {
            continue;
        };
        let content_page = content_dict
            .get(b"Pg")
            .ok()
            .and_then(|value| value.as_reference().ok())
            .or(inherited_page);
        if content_page != Some(page_id) {
            continue;
        }
        let kind = content_dict
            .get(b"Type")
            .ok()
            .and_then(|value| walker.resolve(value))
            .and_then(|value| value.as_name().ok());
        if kind == Some(b"MCR") {
            let id = content_dict
                .get(b"MCID")
                .ok()
                .and_then(|value| walker.integer(value))
                .map(|mcid| format!("p{}_mc{mcid}", format_id(page_id)));
            children.push(content("content", id));
        } else if kind == Some(b"OBJR") {
            let object_id = content_dict
                .get(b"Obj")
                .ok()
                .and_then(|value| value.as_reference().ok());
            let annotation = annotation_elements.contains(&id)
                || object_id.is_some_and(|id| walker.annotation_ids.contains(&id));
            let id = object_id.map(|id| {
                if annotation {
                    format!("pdfjs_internal_id_{}", format_id(id))
                } else {
                    format_id(id)
                }
            });
            children.push(content(
                if annotation { "annotation" } else { "object" },
                id,
            ));
        }
    }
    Some(StructureNode { role, children })
}

fn content(kind: &str, id: Option<String>) -> StructureChild {
    StructureChild::Content(StructureContent {
        r#type: kind.into(),
        id,
    })
}

fn read_role_map<'a>(walker: &mut Walker<'a>, root: &'a Dictionary) -> HashMap<Vec<u8>, Vec<u8>> {
    let Some(dict) = root
        .get(b"RoleMap")
        .ok()
        .and_then(|value| walker.dict(value))
    else {
        return HashMap::new();
    };
    dict.iter()
        .filter_map(|(key, value)| {
            walker
                .resolve(value)
                .and_then(|value| value.as_name().ok())
                .map(|value| (key.clone(), value.to_vec()))
        })
        .collect()
}

fn read_number_tree<'a>(
    walker: &mut Walker<'a>,
    root: &'a Object,
) -> Option<HashMap<i64, &'a Object>> {
    let mut queue = VecDeque::from([(root, 0usize)]);
    let mut seen = HashSet::new();
    let mut output = HashMap::new();
    while let Some((value, depth)) = queue.pop_front() {
        if depth > PDFJS_MAX_DEPTH || output.len() > MAX_ARRAY_ITEMS {
            walker.limited = true;
            return None;
        }
        if let Ok(id) = value.as_reference() {
            if !seen.insert(id) {
                walker.failed = true;
                return None;
            }
        }
        let dict = walker.dict(value)?;
        if let Ok(kids) = dict.get(b"Kids") {
            for kid in object_list(walker, kids).ok()? {
                queue.push_back((kid, depth + 1));
            }
            continue;
        }
        if let Ok(nums) = dict.get(b"Nums") {
            let nums = object_list(walker, nums).ok()?;
            if nums.len() % 2 != 0 || output.len() + nums.len() / 2 > MAX_ARRAY_ITEMS {
                walker.limited = true;
                return None;
            }
            for pair in nums.chunks_exact(2) {
                if let Some(key) = walker.integer(pair[0]) {
                    output.insert(key, pair[1]);
                }
            }
        }
    }
    Some(output)
}

fn object_list<'a>(walker: &mut Walker<'a>, value: &'a Object) -> Result<Vec<&'a Object>, ()> {
    let value = walker.resolve(value).ok_or(())?;
    if let Ok(values) = value.as_array() {
        if values.len() > MAX_ARRAY_ITEMS {
            walker.limited = true;
            return Err(());
        }
        Ok(values.iter().collect())
    } else if matches!(value, Object::Null) {
        Ok(Vec::new())
    } else {
        Ok(vec![value])
    }
}

struct Walker<'a> {
    document: &'a Document,
    work: usize,
    admitted: usize,
    failed: bool,
    limited: bool,
    annotation_ids: HashSet<ObjectId>,
}

impl<'a> Walker<'a> {
    fn new(document: &'a Document) -> Self {
        Self {
            document,
            work: 0,
            admitted: 0,
            failed: false,
            limited: false,
            annotation_ids: HashSet::new(),
        }
    }

    fn resolve(&mut self, mut value: &'a Object) -> Option<&'a Object> {
        let mut seen = HashSet::new();
        for _ in 0..=PDFJS_MAX_DEPTH {
            self.work += 1;
            if self.work > MAX_OBJECTS_PER_PAGE {
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
            value = self.document.objects.get(id)?;
        }
        self.limited = true;
        None
    }

    fn resolve_readonly(&self, mut value: &'a Object) -> Option<&'a Object> {
        let mut seen = HashSet::new();
        for _ in 0..=PDFJS_MAX_DEPTH {
            let Object::Reference(id) = value else {
                return Some(value);
            };
            if !seen.insert(*id) {
                return None;
            }
            value = self.document.objects.get(id)?;
        }
        None
    }

    fn dict(&mut self, value: &'a Object) -> Option<&'a Dictionary> {
        self.resolve(value)?.as_dict().ok()
    }

    fn integer(&mut self, value: &'a Object) -> Option<i64> {
        self.resolve(value)?.as_i64().ok()
    }

    fn admit_node(&mut self) -> Option<()> {
        self.admitted += 1;
        if self.admitted > MAX_OBJECTS_PER_PAGE {
            self.limited = true;
            None
        } else {
            Some(())
        }
    }
}

fn format_id((num, generation): ObjectId) -> String {
    if generation == 0 {
        format!("{num}R")
    } else {
        format!("{num}R{generation}")
    }
}

#[cfg(test)]
fn normalize_public_tree(raw: &Value) -> Option<Value> {
    fn node(raw: &Value, depth: usize, remaining: &mut usize) -> Option<Value> {
        if depth > PDFJS_MAX_DEPTH || *remaining == 0 {
            return None;
        }
        *remaining -= 1;
        let object = raw.as_object()?;
        let role = object
            .get("role")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("Unknown");
        let mut children = Vec::new();
        for child in object
            .get("children")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let Some(object) = child.as_object() else {
                continue;
            };
            if object.contains_key("role") || object.contains_key("children") {
                if let Some(child) = node(child, depth + 1, remaining) {
                    children.push(child);
                }
                continue;
            }
            let kind = object
                .get("type")
                .and_then(Value::as_str)
                .map(str::trim)
                .unwrap_or_default();
            let id = object
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .unwrap_or_default();
            if kind.is_empty() && id.is_empty() {
                continue;
            }
            let mut value = json!({"type":if kind.is_empty(){"content"}else{kind}});
            if !id.is_empty() {
                value["id"] = json!(id);
            }
            children.push(value);
        }
        let mut value = json!({"role":role});
        if !children.is_empty() {
            value["children"] = json!(children);
        }
        Some(value)
    }
    let mut remaining = MAX_OBJECTS_PER_PAGE;
    node(raw, 0, &mut remaining)
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::dictionary;
    use serde_json::json;

    fn tagged_document() -> (Document, Vec<(u32, ObjectId)>, ObjectId) {
        let mut document = Document::with_version("1.7");
        let pages_root = document.new_object_id();
        let page_one = document.new_object_id();
        let page_two = document.new_object_id();
        let annotation = document.new_object_id();
        let struct_root = document.new_object_id();
        let heading = document.new_object_id();
        let figure = document.new_object_id();
        let parent_tree = document.new_object_id();
        document.set_object(
            pages_root,
            dictionary! {"Type"=>"Pages","Kids"=>vec![page_one.into(),page_two.into()],"Count"=>2},
        );
        document.set_object(
            page_one,
            dictionary! {"Type"=>"Page","Parent"=>pages_root,"StructParents"=>0,"Annots"=>vec![annotation.into()]},
        );
        document.set_object(page_two, dictionary! {"Type"=>"Page","Parent"=>pages_root});
        document.set_object(
            annotation,
            dictionary! {"Type"=>"Annot","Subtype"=>"Link","StructParent"=>1},
        );
        document.set_object(
            heading,
            dictionary! {"Type"=>"StructElem","S"=>"CustomHeading","P"=>struct_root,"Pg"=>page_one,"K"=>0},
        );
        document.set_object(
            figure,
            dictionary! {"Type"=>"StructElem","S"=>"Figure","P"=>struct_root,"Pg"=>page_one,
            "K"=>dictionary!{"Type"=>"OBJR","Pg"=>page_one,"Obj"=>annotation}},
        );
        document.set_object(
            parent_tree,
            dictionary! {"Nums"=>vec![0.into(),Object::Array(vec![heading.into(),figure.into()]),1.into(),figure.into()]},
        );
        document.set_object(
            struct_root,
            dictionary! {"Type"=>"StructTreeRoot","K"=>vec![heading.into(),figure.into()],
            "ParentTree"=>parent_tree,"RoleMap"=>dictionary!{"CustomHeading"=>"H1"}},
        );
        let catalog = document.add_object(
            dictionary! {"Type"=>"Catalog","Pages"=>pages_root,"StructTreeRoot"=>struct_root},
        );
        document.trailer.set("Root", catalog);
        (document, vec![(1, page_one), (2, page_two)], annotation)
    }

    #[test]
    fn extracts_role_content_annotation_and_empty_root_pages_in_selected_order() {
        let (document, pages, annotation) = tagged_document();
        let trees = extract_structure_trees(&document, &pages, &[2, 1, 1]);
        assert_eq!(
            serde_json::to_value(trees).unwrap(),
            json!([
                {"page":1,"tree":{"role":"Root","children":[
                    {"role":"H1","children":[{"type":"content","id":format!("p{}_mc0",format_id(pages[0].1))}]},
                    {"role":"Figure","children":[{"type":"annotation","id":format!("pdfjs_internal_id_{}",format_id(annotation))}]}
                ]}},
                {"page":2,"tree":{"role":"Root"}}
            ])
        );
    }

    #[test]
    fn untagged_and_page_local_failures_do_not_invent_trees() {
        let mut document = Document::with_version("1.7");
        let pages = document
            .add_object(dictionary! {"Type"=>"Pages","Kids"=>Vec::<Object>::new(),"Count"=>0});
        let catalog = document.add_object(dictionary! {"Type"=>"Catalog","Pages"=>pages});
        document.trailer.set("Root", catalog);
        assert!(extract_structure_trees(&document, &[], &[1]).is_empty());

        let (mut document, pages, _) = tagged_document();
        let page = document
            .objects
            .get_mut(&pages[0].1)
            .unwrap()
            .as_dict_mut()
            .unwrap();
        page.set("StructParents", 999);
        page.remove(b"Annots");
        let trees = extract_structure_trees(&document, &pages, &[1, 2]);
        assert_eq!(trees.len(), 2);
        assert!(serde_json::to_value(&trees[0]).unwrap()["tree"]
            .get("children")
            .is_none());
    }

    #[test]
    fn public_normalizer_matches_frozen_ts_mock_boundary_oracle() {
        let oracle: Value = serde_json::from_str(include_str!(
            "../../../scripts/differential/fixtures/v3014-structure-normalizer-oracle.json"
        ))
        .unwrap();
        assert_eq!(
            normalize_public_tree(&oracle["input"]),
            Some(oracle["expected"].clone())
        );
        assert!(normalize_public_tree(&json!(null)).is_none());
    }

    #[test]
    fn hostile_page_is_omitted_without_suppressing_other_selected_pages() {
        let (mut document, pages, _) = tagged_document();
        let oversized = (0..=MAX_ARRAY_ITEMS)
            .map(|_| Object::Null)
            .collect::<Vec<_>>();
        document
            .objects
            .get_mut(&pages[0].1)
            .unwrap()
            .as_dict_mut()
            .unwrap()
            .set("Annots", Object::Array(oversized));

        let trees = extract_structure_trees(&document, &pages, &[1, 2]);
        assert_eq!(
            serde_json::to_value(trees).unwrap(),
            json!([
                {"page":2,"tree":{"role":"Root"}}
            ])
        );
    }

    #[test]
    fn public_normalizer_fails_closed_beyond_pdfjs_depth() {
        let mut raw = json!({"role":"P"});
        for _ in 0..=PDFJS_MAX_DEPTH {
            raw = json!({"role":"P","children":[raw]});
        }
        let normalized = normalize_public_tree(&raw).unwrap();
        let mut cursor = &normalized;
        for _ in 0..=PDFJS_MAX_DEPTH {
            let Some(child) = cursor
                .get("children")
                .and_then(Value::as_array)
                .and_then(|children| children.first())
            else {
                return;
            };
            cursor = child;
        }
        panic!("normalizer admitted a node beyond the pdf.js depth boundary");
    }
}
