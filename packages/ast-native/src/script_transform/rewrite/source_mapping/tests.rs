use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_ast::{ast::Statement, builder::AstBuilder};
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_sourcemap::{SourceMap, Token};
use oxc_span::{SPAN, SourceType};

use super::{positions::SourcePositions, prepare};
use crate::script_transform::rewrite::{prepare_program, tests::contract};

fn mapped(source: &str, minify: bool) -> (String, SourceMap<'static>) {
    let allocator = Allocator::default();
    let mut parsed = Parser::new(&allocator, source, SourceType::ts()).parse();
    assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
    let semantic = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program);
    assert!(
        semantic.diagnostics.is_empty(),
        "{:?}",
        semantic.diagnostics
    );
    let scoping = semantic.semantic.into_scoping();
    let prepared = prepare_program(&mut parsed.program, &allocator, &contract(), &scoping).unwrap();
    if let Some(expression) = prepared.expression {
        parsed.program.body.insert(
            prepared.default_export_index.unwrap(),
            Statement::new_export_default_declaration(
                SPAN,
                expression.into(),
                &AstBuilder::new(&allocator),
            ),
        );
    }
    let options = CodegenOptions {
        minify,
        source_map_path: Some(PathBuf::from("input.ts")),
        ..CodegenOptions::default()
    };
    let before = Codegen::new()
        .with_options(options.clone())
        .build(&parsed.program);
    let provenance = prepare(&mut parsed.program);
    let after = Codegen::new().with_options(options).build(&parsed.program);
    assert_eq!(
        before.code, after.code,
        "mapping preparation must not change emitted code"
    );
    let map = provenance.repair_names(after.map.unwrap());
    assert_eq!(map.get_source_content(0), Some(source));
    (after.code, map.into_owned())
}

fn point(text: &str, needle: &str, within: usize) -> (u32, u32) {
    let byte = text
        .find(needle)
        .unwrap_or_else(|| panic!("missing {needle:?} in {text}"))
        + within;
    let prefix = &text[..byte];
    let line = prefix.bytes().filter(|byte| *byte == b'\n').count();
    let column = prefix.rsplit('\n').next().unwrap().encode_utf16().count();
    (line as u32, column as u32)
}

fn assert_origin(
    code: &str,
    map: &SourceMap<'_>,
    generated: (&str, usize),
    expected: (u32, u32),
    name: Option<&str>,
) {
    let (line, column) = point(code, generated.0, generated.1);
    let table = map.generate_lookup_table();
    let token = map.lookup_source_view_token(&table, line, column).unwrap();
    assert_eq!(
        (token.get_dst_line(), token.get_dst_col()),
        (line, column),
        "must be an explicit mapping for {generated:?}"
    );
    assert_eq!(
        (token.get_src_line(), token.get_src_col()),
        expected,
        "{generated:?}"
    );
    assert_eq!(token.get_name(), name, "{generated:?}");
}

#[test]
fn relocated_named_imports_retain_alias_and_original_imported_positions() {
    let source = "// 😀\r\nimport { computed, ref as value } from 'wevu';\r\nimport { useSlots as slots } from 'vue';\r\nconst capture = { computed, value, slots };";
    for minify in [false, true] {
        let (code, map) = mapped(source, minify);
        assert_origin(&code, &map, ("computed", 0), (1, 9), None);
        assert_origin(&code, &map, ("ref as value", 0), (1, 19), None);
        assert_origin(&code, &map, ("ref as value", 7), (1, 26), None);
        assert_origin(&code, &map, ("useSlots as slots", 0), (2, 9), None);
        assert_origin(&code, &map, ("useSlots as slots", 12), (2, 21), None);
    }
}

#[test]
fn helper_default_import_preserves_only_the_real_local_binding() {
    let source = "import helper from '@vue/babel-helper-vue-transform-on'; const use = helper;";
    let (code, map) = mapped(source, false);
    assert_origin(&code, &map, ("transformOn as helper", 15), (0, 7), None);
    let added = point(&code, "transformOn", 0);
    assert!(
        !map.get_tokens()
            .any(|token| (token.get_dst_line(), token.get_dst_col()) == added),
        "the synthetic export name has no original identifier"
    );
}

#[test]
fn expose_shorthand_uses_binding_origin_and_call_keeps_original_name() {
    let source = "// 😀\r\nexport default { setup(_, { expose: __expose }) {\r\n  const marker = '😀'; __expose({ marker });\r\n  function nested(__expose) { __expose({ marker }); }\r\n  return { nested };\r\n} };";
    for minify in [false, true] {
        let (code, map) = mapped(source, minify);
        let parameter = if minify { "{expose}" } else { "{ expose }" };
        assert_origin(
            &code,
            &map,
            (parameter, if minify { 1 } else { 2 }),
            point(source, "__expose", 0),
            Some("__expose"),
        );
        assert_origin(
            &code,
            &map,
            ("expose({", 0),
            point(source, "__expose({ marker });", 0),
            Some("__expose"),
        );
        assert_origin(
            &code,
            &map,
            ("nested(__expose)", 7),
            point(source, "nested(__expose)", 7),
            None,
        );
        let call = point(source, "__expose({ marker });", 0);
        assert_eq!(
            call,
            (2, 23),
            "astral character occupies two UTF-16 columns"
        );
    }
}

#[test]
fn template_boundaries_map_to_actual_empty_or_nonempty_content_start() {
    // 两个代表页中的空 tail、空格和等号片段，再覆盖相邻插值和嵌套模板。
    let source = "const a = `${item.fullName} ${item.docUrl || ''}`;\r\nconst b = `${key}=${encode ? encodeURIComponent(value) : value}`;\r\nconst c = `${first}${second}`;\r\nconst d = `😀${`${inner}`}`;";
    for minify in [false, true] {
        let (code, map) = mapped(source, minify);
        for boundary in ["} ${", "}=${", "}${", "second}`", "inner}`", "}`}`"] {
            let within = if boundary == "second}`" {
                7
            } else if boundary == "inner}`" {
                6
            } else {
                1
            };
            assert_origin(
                &code,
                &map,
                (boundary, within),
                point(source, boundary, within),
                None,
            );
        }
        let tail = if minify { "||``}`" } else { "|| \"\"}`" };
        assert_origin(
            &code,
            &map,
            (tail, tail.len() - 1),
            point(source, "|| ''}`", 6),
            None,
        );
        assert_origin(
            &code,
            &map,
            ("value}`", 6),
            point(source, "value}`", 6),
            None,
        );
    }
}

#[test]
fn template_raw_crlf_and_utf16_are_preserved_while_empty_tail_is_mapped() {
    let source = "const view = `😀\r\n${value}`;\r\nconst next = 1;";
    let (code, map) = mapped(source, false);
    assert_origin(&code, &map, ("value}`", 6), (1, 8), None);
    assert!(
        code.contains("`😀\n${value}`"),
        "Oxc's existing raw newline normalization stays unchanged"
    );
}

#[test]
fn utf16_positions_handle_crlf_lone_cr_and_ecmascript_line_separators() {
    let source = "😀x\r\ny\rz\u{2028}w\u{2029}q";
    let positions = SourcePositions::new(source);
    for (needle, expected) in [
        ("x", (0, 2)),
        ("y", (1, 0)),
        ("z", (2, 0)),
        ("w", (3, 0)),
        ("q", (4, 0)),
    ] {
        assert_eq!(
            positions.get(source.find(needle).unwrap() as u32),
            Some(expected)
        );
    }
    assert_eq!(
        positions.get(1),
        None,
        "middle of UTF-8 character is not a source boundary"
    );
    assert_eq!(positions.get(source.len() as u32 + 1), None);
}

#[test]
fn name_repair_preserves_coordinates_and_never_assigns_names_to_unmapped_tokens() {
    let source = "__expose";
    let provenance = super::OriginalSourceMappings {
        source,
        renamed: [((0, 0), source)].into(),
    };
    let map = SourceMap::new(
        None,
        vec![],
        None,
        vec!["input.ts".into()],
        vec![Some(source.into())],
        vec![
            Token::new(0, 0, 0, 0, Some(0), None),
            Token::new(0, 6, 0, 0, None, None),
        ]
        .into_boxed_slice(),
        None,
    );
    let repaired = provenance.repair_names(map);
    let original = repaired.get_source_view_token(0).unwrap();
    assert_eq!(
        original.to_tuple(),
        (Some("input.ts"), 0, 0, Some("__expose"))
    );
    assert_eq!(
        repaired.get_token(1).unwrap(),
        Token::new(0, 6, 0, 0, None, None)
    );
}

#[test]
fn diagnostic_minified_synthetic_tokens_still_inherit_source_mapping_without_fences() {
    let source = "const original = userValue;";
    let allocator = Allocator::default();
    let mut parsed = Parser::new(&allocator, source, SourceType::mjs()).parse();
    parsed.program.body.extend(
        crate::script_transform::fragments::statements(
            "register(original); export default original;",
            &allocator,
        )
        .unwrap(),
    );
    let provenance = prepare(&mut parsed.program);
    let output = Codegen::new()
        .with_options(CodegenOptions {
            minify: true,
            source_map_path: Some(PathBuf::from("input.ts")),
            ..CodegenOptions::default()
        })
        .build(&parsed.program);
    let map = provenance.repair_names(output.map.unwrap());
    let table = map.generate_lookup_table();
    // 这是直接调用 Oxc 的来源隔离缺陷诊断，不能当作正确 provenance 的断言：
    // 清空 synthetic span 只让 codegen 跳过它，不会产生 source=None fence；
    // minify 后同一行的注册和导出因此通过 GLB 继承前面的真实源码位置。
    // 完整转换经 provenance 包装器产生 fence；此用例保留原始 codegen 对照。
    for needle in ["register", "export default"] {
        let position = point(&output.code, needle, 0);
        let token = map
            .lookup_source_view_token(&table, position.0, position.1)
            .unwrap();
        assert_eq!(token.get_source(), Some("input.ts"));
        assert_ne!((token.get_dst_line(), token.get_dst_col()), position);
        assert!((token.get_dst_line(), token.get_dst_col()) < position);
    }
}
