use oxc_ast::builder::AstBuilder;
use oxc_span::SPAN;

use super::*;

#[test]
fn real_synthetic_real_transitions_preserve_source_across_blank_lines() {
    let source = "let alpha = one;\r\n\r\n\r\nlet omega = two;";
    for minify in [false, true] {
        let allocator = Allocator::default();
        let mut program = parse(&allocator, source);
        let synthetic = fragments::statements("helper();", &allocator)
            .unwrap()
            .remove(0);
        program.body.insert(1, synthetic);
        program.body.extend(
            fragments::statements("register(omega);export default omega;", &allocator).unwrap(),
        );
        let (code, map) = checked(&mut program, &allocator, options(minify));
        real(&code, &map, "alpha", (0, 4));
        real(&code, &map, "one", (0, 12));
        unmapped(&code, &map, "helper", 0);
        real(&code, &map, "omega", (3, 4));
        real(&code, &map, "two", (3, 12));
        unmapped(&code, &map, "register", 0);
        unmapped(&code, &map, "export default", 0);
    }
}

#[test]
fn generated_containers_fence_their_closing_delimiters_after_real_children() {
    for minify in [false, true] {
        for (container, close) in [
            ("const shell = [null]; after();", "]"),
            ("const shell = { inner: null }; after();", "}"),
            ("const shell = wrap(null); after();", ")"),
        ] {
            let allocator = Allocator::default();
            let mut program = nested(&allocator, "\r\nactualValue;", container);
            let (code, map) = checked(&mut program, &allocator, options(minify));
            unmapped(&code, &map, "const", 0);
            unmapped(&code, &map, "shell", 0);
            real(&code, &map, "actualValue", (1, 0));
            unmapped(&code, &map, close, 0);
            unmapped(&code, &map, "after", 0);
        }
    }
}

#[test]
fn generated_runtime_import_keeps_original_specifier_but_unmaps_new_source_and_helpers() {
    let source = "import { ref as value } from 'wevu';\r\nconst keep = value;";
    for minify in [false, true] {
        let allocator = Allocator::default();
        let mut program = parse(&allocator, source);
        let Statement::ImportDeclaration(import) = &mut program.body[0] else {
            unreachable!()
        };
        import.span = SPAN;
        import.source =
            StringLiteral::new(SPAN, "internal/runtime", None, &AstBuilder::new(&allocator));
        program.body.insert(
            0,
            fragments::statements("import { helper } from 'internal/generated';", &allocator)
                .unwrap()
                .remove(0),
        );
        let (code, map) = checked(&mut program, &allocator, options(minify));
        unmapped(&code, &map, "import", 0);
        unmapped(&code, &map, "helper", 0);
        unmapped(&code, &map, "\"internal/generated\"", 0);
        real(&code, &map, "ref", (0, 9));
        real(&code, &map, "value", (0, 16));
        unmapped(&code, &map, "\"internal/runtime\"", 0);
        real(&code, &map, "keep", (1, 6));
    }
}

#[test]
fn nested_user_templates_and_unicode_identifiers_keep_utf16_crlf_origins() {
    let source = "\r\n[\"😀\", 用户, `raw\r\n${用户}`];";
    for minify in [false, true] {
        let allocator = Allocator::default();
        let mut program = nested(&allocator, source, "const generated = wrap(null); after();");
        let (code, map) = checked(&mut program, &allocator, options(minify));
        real(&code, &map, "用户", (1, 7));
        unmapped(&code, &map, "generated", 0);
        unmapped(&code, &map, "wrap", 0);
        unmapped(&code, &map, "after", 0);
        assert_eq!(map.get_source_content(0), Some(source));
    }
}

#[test]
fn diagnostic_oxc_unmapped_print_positions_are_not_character_level_range_boundaries() {
    // 本方案提供 Oxc 已有打印锚点的 fence，不声称每个生成字符都有独立映射。
    // 未调用 add_source_mapping 的逗号、分号和 opening punctuation 仍使用 GLB。
    for synthetic in [
        "const shell = [null, 2];",
        "const shell = null();",
        "const shell = null.field;",
    ] {
        let allocator = Allocator::default();
        let mut program = nested(&allocator, "actualValue;", synthetic);
        let (code, map) = checked(&mut program, &allocator, options(true));
        let punctuation = if synthetic.contains('[') {
            ","
        } else if synthetic.contains("()") {
            "("
        } else {
            "."
        };
        assert_eq!(
            origin(&map, point(&code, punctuation, 0)),
            Some((0, 0)),
            "known GLB gap: {code}"
        );
    }
}

#[test]
fn diagnostic_generated_from_keyword_still_inherits_the_last_real_import_specifier() {
    // `from` 也没有 Oxc 打印锚点；这是关键字级覆盖边界，不只是标点的 GLB 行为。
    for minify in [false, true] {
        let allocator = Allocator::default();
        let mut program = parse(&allocator, "import { ref } from 'wevu';");
        let Statement::ImportDeclaration(import) = &mut program.body[0] else {
            unreachable!()
        };
        import.span = SPAN;
        import.source =
            StringLiteral::new(SPAN, "internal/runtime", None, &AstBuilder::new(&allocator));
        let (code, map) = checked(&mut program, &allocator, options(minify));
        assert_eq!(origin(&map, point(&code, "from", 0)), Some((0, 9)));
        unmapped(&code, &map, "\"internal/runtime\"", 0);
    }
}

#[test]
fn unicode_line_separators_keep_real_lines_after_synthetic_fences() {
    let source = "const first = 1;\u{2028}const second = 2;\u{2029}const third = 3;";
    let allocator = Allocator::default();
    let mut program = parse(&allocator, source);
    program.body.insert(
        1,
        fragments::statements("helper();", &allocator)
            .unwrap()
            .remove(0),
    );
    let (code, map) = checked(&mut program, &allocator, options(true));
    real(&code, &map, "first", (0, 6));
    real(&code, &map, "second", (1, 6));
    real(&code, &map, "third", (2, 6));
    unmapped(&code, &map, "helper", 0);
}
