use napi::bindgen_prelude::Utf16String;
use oxc_sourcemap::SourceMap;

use super::{NativeScriptRoundTrip, round_trip_script_native};

fn round_trip(code: &str, filename: &str, minify: bool) -> NativeScriptRoundTrip {
    round_trip_script_native(code.to_string().into(), Some(filename.to_string()), Some(minify)).unwrap()
}

fn assert_rejected(result: &NativeScriptRoundTrip, status: &str) {
    assert_eq!(result.status, status);
    assert!(result.code.is_none());
    assert!(result.map.is_none());
}

fn position(source: &str, byte: usize) -> (u32, u32) {
    let prefix = &source[..byte];
    let line = prefix.bytes().filter(|byte| *byte == b'\n').count() as u32;
    let column = prefix.rsplit('\n').next().unwrap().encode_utf16().count() as u32;
    (line, column)
}

#[test]
fn emits_code_and_v3_sourcemap_with_default_filename() {
    let input = "export const answer = 40 + 2;";
    let result = round_trip_script_native(input.to_string().into(), None, None).unwrap();
    assert_eq!(result.status, "ok");
    assert!(result.parse_diagnostics.is_empty());
    assert!(result.semantic_diagnostics.is_empty());
    assert!(result.unsupported_reason.is_none());
    assert!(result.code.as_ref().unwrap().contains("export const answer"));
    let json: serde_json::Value = serde_json::from_str(result.map.as_ref().unwrap()).unwrap();
    assert_eq!(json["version"], 3);
    assert_eq!(json["sources"], serde_json::json!(["inline.js"]));
    assert_eq!(json["sourcesContent"], serde_json::json!([input]));
    assert!(!json["mappings"].as_str().unwrap().is_empty());
}

#[test]
fn preserves_directives_important_comments_and_module_exports() {
    let input = r#""use strict";
/*! retained license */
/* @preserve retained copyright */
export const value = /* @__PURE__ */ createValue();
/* @__NO_SIDE_EFFECTS__ */
export function createValue() { return "ok"; }
export const load = () => import(/* webpackChunkName: "chunk" */ "./chunk.js");
export const ignore = () => import(/* @vite-ignore */ source);
"#;
    for minify in [false, true] {
        let result = round_trip(input, "stage.mjs", minify);
        assert_eq!(result.status, "ok");
        let code = result.code.unwrap();
        for marker in ["use strict", "retained license", "retained copyright", "@__PURE__", "@__NO_SIDE_EFFECTS__", "webpackChunkName", "@vite-ignore"] {
            assert!(code.contains(marker), "missing {marker} in {code}");
        }
        assert_eq!(round_trip(&code, "stage.mjs", minify).status, "ok");
    }
}

#[test]
fn rejects_lone_utf16_surrogates_before_parsing() {
    for code in [vec![0xD800], vec![0xDC00], vec![b'\'' as u16, 0xD800, b'\'' as u16]] {
        let error = round_trip_script_native(Utf16String::from(code), None, None).unwrap_err();
        assert!(error.reason.contains("lone UTF-16 surrogates"));
    }
    assert_eq!(round_trip("const value = '😀';", "unicode.js", false).status, "ok");
}

#[test]
fn preserves_escaped_directive_and_valid_surrogate_escape_syntax() {
    // 源码中的 ASCII 转义是有效 JS；不能把非严格指令改写为真正的 use strict。
    let input = r#""use\x20strict"; const value = "\uD800";"#;
    for minify in [false, true] {
        let result = round_trip(input, "escapes.js", minify);
        assert_eq!(result.status, "ok");
        let code = result.code.unwrap();
        assert!(code.contains(r#""use\x20strict""#));
        assert!(code.to_lowercase().contains(r"\ud800"));
        assert!(!code.contains('�'));
    }
}

#[test]
fn rejects_ts_jsx_and_unknown_filenames_without_transforming() {
    for filename in ["stage.ts", "stage.tsx", "stage.jsx", "stage.mts", "stage.cts", "stage.vue", "stage"] {
        let result = round_trip("const value = 1;", filename, false);
        assert_rejected(&result, "unsupported-source-type");
        assert!(result.unsupported_reason.unwrap().contains("TypeScript and JSX are not transformed"));
        assert!(result.parse_diagnostics.is_empty());
        assert!(result.semantic_diagnostics.is_empty());
    }
}

#[test]
fn rejects_invalid_syntax_ts_jsx_and_invalid_regular_expressions_in_js() {
    for input in ["const value = ;", "const value: number = 1;", "const value = <View />;", "enum Color { Red }", "const invalid = /(/;"] {
        let result = round_trip(input, "stage.js", false);
        assert_rejected(&result, "parse-error");
        assert!(!result.parse_diagnostics.is_empty(), "{input}");
        assert!(result.semantic_diagnostics.is_empty());
    }
}

#[test]
fn rejects_semantic_errors_after_a_successful_parse() {
    let result = round_trip("const value = 1; const value = 2;", "stage.mjs", false);
    assert_rejected(&result, "semantic-error");
    assert!(result.parse_diagnostics.is_empty());
    assert!(!result.semantic_diagnostics.is_empty());
    assert!(result.semantic_diagnostics.iter().any(|diagnostic| diagnostic.message.contains("declared")));
}

#[test]
fn returns_utf16_diagnostic_ranges_after_astral_text_and_crlf() {
    let input = "const emoji = '😀';\r\nconst café = 1; const café = 2;";
    let result = round_trip(input, "stage.mjs", false);
    assert_rejected(&result, "semantic-error");
    let expected: Vec<_> = input.match_indices("café").map(|(index, name)| {
        let start = input[..index].encode_utf16().count() as u32;
        (start, start + name.encode_utf16().count() as u32)
    }).collect();
    let actual: Vec<_> = result.semantic_diagnostics.iter().flat_map(|diagnostic| {
        diagnostic.labels.iter().map(|label| (label.start, label.end))
    }).collect();
    for range in expected {
        assert!(actual.contains(&range), "missing {range:?} in {actual:?}");
    }
}

#[test]
fn sourcemaps_use_utf16_columns_for_unicode_and_crlf_in_both_modes() {
    let input = "const 𐐀 = '😀'; const café = 𐐀;\r\nconsole.log('😀', café);";
    for minify in [false, true] {
        let result = round_trip(input, "fixtures/unicode.js", minify);
        assert_eq!(result.status, "ok");
        let code = result.code.unwrap();
        let map_json = result.map.unwrap();
        let map = SourceMap::from_json_string(&map_json).unwrap();
        assert_eq!(map.get_sources().collect::<Vec<_>>(), ["fixtures/unicode.js"]);
        assert_eq!(map.get_source_contents().collect::<Vec<_>>(), [Some(input)]);
        for name in ["𐐀", "café", "console"] {
            let source_occurrences: Vec<_> = input.match_indices(name).map(|(index, _)| position(input, index)).collect();
            let generated_occurrences: Vec<_> = code.match_indices(name).map(|(index, _)| position(&code, index)).collect();
            assert_eq!(source_occurrences.len(), generated_occurrences.len());
            for (source, generated) in source_occurrences.iter().zip(generated_occurrences.iter()) {
                assert!(map.get_tokens().any(|token| {
                    (token.get_src_line(), token.get_src_col()) == *source
                        && (token.get_dst_line(), token.get_dst_col()) == *generated
                }), "missing {name} {source:?} -> {generated:?} in {code}");
            }
        }
    }
}

#[test]
fn normalizes_source_labels_and_honors_explicit_module_modes() {
    let result = round_trip("module.exports = 42;", "fixtures\\stage.cjs", false);
    assert_eq!(result.status, "ok");
    let map_json = result.map.unwrap();
    let map = SourceMap::from_json_string(&map_json).unwrap();
    assert_eq!(map.get_sources().collect::<Vec<_>>(), ["fixtures/stage.cjs"]);
    assert_eq!(round_trip("export default 42;", "stage.mjs", false).status, "ok");
    assert_ne!(round_trip("export default 42;", "stage.cjs", false).status, "ok");
}
