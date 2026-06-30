use std::collections::BTreeMap;

use napi_derive::napi;
use serde::Serialize;

#[derive(Clone)]
struct SfcBlock {
    block_type: String,
    attrs: BTreeMap<String, SfcAttrValue>,
    content: String,
}

#[derive(Clone, Serialize)]
#[serde(untagged)]
enum SfcAttrValue {
    Bool(bool),
    String(String),
}

#[derive(Serialize)]
struct SerializedSfcBlock<'a> {
    #[serde(rename = "type")]
    block_type: &'a str,
    attrs: &'a BTreeMap<String, SfcAttrValue>,
    content: &'a str,
}

#[derive(Default)]
struct SfcDescriptor {
    script: Option<SfcBlock>,
    script_setup: Option<SfcBlock>,
    template: Option<SfcBlock>,
    styles: Vec<SfcBlock>,
    custom_blocks: Vec<SfcBlock>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SfcNonJsonPayload<'a> {
    script: Option<SerializedSfcBlock<'a>>,
    script_setup: Option<SerializedSfcBlock<'a>>,
    template: Option<SerializedSfcBlock<'a>>,
    styles: Vec<SerializedSfcBlock<'a>>,
    custom_blocks: Vec<SerializedSfcBlock<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SfcScriptPayload<'a> {
    script: Option<SerializedSfcBlock<'a>>,
    script_setup: Option<SerializedSfcBlock<'a>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VueSfcSignaturePayload<'a> {
    non_json: SfcNonJsonPayload<'a>,
    script: SfcScriptPayload<'a>,
    has_template: bool,
}

#[napi(js_name = "getVueSfcSignaturePayloadNative")]
pub fn get_vue_sfc_signature_payload_native(source: String) -> Option<String> {
    let descriptor = parse_sfc_descriptor(&source)?;
    let payload = VueSfcSignaturePayload {
        non_json: SfcNonJsonPayload {
            script: descriptor.script.as_ref().map(serialize_sfc_block),
            script_setup: descriptor.script_setup.as_ref().map(serialize_sfc_block),
            template: descriptor.template.as_ref().map(serialize_sfc_block),
            styles: descriptor.styles.iter().map(serialize_sfc_block).collect(),
            custom_blocks: descriptor
                .custom_blocks
                .iter()
                .filter(|block| block.block_type != "json")
                .map(serialize_sfc_block)
                .collect(),
        },
        script: SfcScriptPayload {
            script: descriptor.script.as_ref().map(serialize_sfc_block),
            script_setup: descriptor.script_setup.as_ref().map(serialize_sfc_block),
        },
        has_template: descriptor
            .template
            .as_ref()
            .is_some_and(|block| !block.content.trim().is_empty()),
    };

    serde_json::to_string(&payload).ok()
}

fn serialize_sfc_block(block: &SfcBlock) -> SerializedSfcBlock<'_> {
    SerializedSfcBlock {
        block_type: &block.block_type,
        attrs: &block.attrs,
        content: &block.content,
    }
}

fn parse_sfc_descriptor(source: &str) -> Option<SfcDescriptor> {
    let mut descriptor = SfcDescriptor::default();
    let mut cursor = 0;

    while let Some(relative_open) = source[cursor..].find('<') {
        let open_start = cursor + relative_open;
        if source[open_start..].starts_with("</")
            || source[open_start..].starts_with("<!--")
            || source[open_start..].starts_with("<!")
            || source[open_start..].starts_with("<?")
        {
            cursor = open_start + 1;
            continue;
        }

        let open_end = find_tag_end(source, open_start)?;
        let raw_open = &source[open_start + 1..open_end];
        let trimmed_open = raw_open.trim();
        if trimmed_open.is_empty() || trimmed_open.ends_with('/') {
            cursor = open_end + 1;
            continue;
        }

        let (block_type, attrs) = parse_open_tag(trimmed_open)?;
        if block_type.is_empty() || !is_sfc_top_level_block(&block_type) {
            cursor = open_end + 1;
            continue;
        }

        let close_tag = format!("</{}>", block_type);
        let content_start = open_end + 1;
        let close_start = source[content_start..].find(&close_tag)? + content_start;
        let content = source[content_start..close_start].to_string();
        let block = SfcBlock {
            block_type,
            attrs,
            content,
        };

        match block.block_type.as_str() {
            "script" if is_script_setup_block(&block) => {
                if descriptor.script_setup.is_some() {
                    return None;
                }
                descriptor.script_setup = Some(block);
            }
            "script" => {
                if descriptor.script.is_some() {
                    return None;
                }
                descriptor.script = Some(block);
            }
            "template" => {
                if descriptor.template.is_some() {
                    return None;
                }
                descriptor.template = Some(block);
            }
            "style" => {
                descriptor.styles.push(block);
            }
            _ => {
                descriptor.custom_blocks.push(block);
            }
        }

        cursor = close_start + close_tag.len();
    }

    Some(descriptor)
}

fn find_tag_end(source: &str, open_start: usize) -> Option<usize> {
    let mut quote: Option<u8> = None;
    for (offset, byte) in source[open_start + 1..].bytes().enumerate() {
        match (quote, byte) {
            (Some(current), value) if value == current => quote = None,
            (None, b'"' | b'\'') => quote = Some(byte),
            (None, b'>') => return Some(open_start + 1 + offset),
            _ => {}
        }
    }
    None
}

fn parse_open_tag(raw: &str) -> Option<(String, BTreeMap<String, SfcAttrValue>)> {
    let bytes = raw.as_bytes();
    let mut index = 0;
    while index < bytes.len() && bytes[index].is_ascii_whitespace() {
        index += 1;
    }
    let name_start = index;
    while index < bytes.len() && is_tag_name_char(bytes[index]) {
        index += 1;
    }
    if name_start == index {
        return None;
    }
    let tag_name = raw[name_start..index].to_string();
    let mut attrs = BTreeMap::new();

    while index < bytes.len() {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() {
            break;
        }
        if bytes[index] == b'/' {
            return None;
        }

        let attr_start = index;
        while index < bytes.len()
            && !bytes[index].is_ascii_whitespace()
            && bytes[index] != b'='
            && bytes[index] != b'/'
        {
            index += 1;
        }
        if attr_start == index {
            return None;
        }
        let attr_name = raw[attr_start..index].to_string();

        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }

        if index >= bytes.len() || bytes[index] != b'=' {
            attrs.insert(attr_name, SfcAttrValue::Bool(true));
            continue;
        }

        index += 1;
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() {
            attrs.insert(attr_name, SfcAttrValue::String(String::new()));
            break;
        }

        let value = if bytes[index] == b'"' || bytes[index] == b'\'' {
            let quote = bytes[index];
            index += 1;
            let value_start = index;
            while index < bytes.len() && bytes[index] != quote {
                index += 1;
            }
            if index >= bytes.len() {
                return None;
            }
            let value = raw[value_start..index].to_string();
            index += 1;
            value
        } else {
            let value_start = index;
            while index < bytes.len() && !bytes[index].is_ascii_whitespace() && bytes[index] != b'/'
            {
                index += 1;
            }
            raw[value_start..index].to_string()
        };
        attrs.insert(attr_name, SfcAttrValue::String(value));
    }

    Some((tag_name, attrs))
}

fn is_tag_name_char(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_')
}

fn is_sfc_top_level_block(block_type: &str) -> bool {
    matches!(
        block_type,
        "template" | "script" | "style" | "json" | "config" | "wxs"
    )
}

fn is_script_setup_block(block: &SfcBlock) -> bool {
    matches!(
        block.attrs.get("setup"),
        Some(SfcAttrValue::Bool(true) | SfcAttrValue::String(_))
    )
}
