use oxc_codegen::{CommentOptions, LegalComment};
use oxc_sourcemap::Token;
use oxc_span::Span;

use super::*;

#[test]
fn comment_annotations_literals_and_returned_legal_comments_are_byte_identical() {
    let source = "#!/usr/bin/env node\r\n/*! license 😀 */\r\nconst value = /* #__PURE__ */ make(/a\\/b/giu, 0xFF, 100n, String.raw`\\u{notEscape}`, '😀');\r\n/* @__NO_SIDE_EFFECTS__ */ function preserved(){ return value; }\r\n/*! final */";
    for minify in [false, true] {
        for legal in [
            LegalComment::Inline,
            LegalComment::Eof,
            LegalComment::External,
            LegalComment::Linked("licenses.txt".to_owned()),
        ] {
            let allocator = Allocator::default();
            let mut program = parse(&allocator, source);
            program.body.insert(
                0,
                fragments::statements("before();", &allocator)
                    .unwrap()
                    .remove(0),
            );
            program
                .body
                .extend(fragments::statements("after();", &allocator).unwrap());
            let mut opts = options(minify);
            opts.comments = CommentOptions {
                legal,
                ..CommentOptions::default()
            };
            checked(&mut program, &allocator, opts);
        }
    }
}

#[test]
fn zero_width_original_spans_and_source_offset_zero_restore_without_aliasing_sentinel() {
    for source in [
        "actualValue;",
        "`${actualValue}`;",
        "",
        "\r\n\u{2028}\u{2029}",
        "/*! only comment */",
    ] {
        let allocator = Allocator::default();
        let mut program = parse(&allocator, source);
        program
            .body
            .extend(fragments::statements("after();", &allocator).unwrap());
        let (code, map) = checked(&mut program, &allocator, options(true));
        unmapped(&code, &map, "after", 0);
        if source.starts_with("actualValue") {
            real(&code, &map, "actualValue", (0, 0));
        }
        assert!(!map.to_json_string().contains("\\u0000"));
    }
}

#[test]
fn source_map_disabled_and_fully_original_programs_preserve_existing_codegen() {
    let allocator = Allocator::default();
    let mut program = parse(&allocator, "const original = 1;");
    let baseline = Codegen::new().with_options(options(false)).build(&program);
    let actual = generate(&mut program, &allocator, options(false)).unwrap();
    assert_eq!(baseline.code, actual.code);
    assert_eq!(
        baseline.map.unwrap().to_json_string(),
        actual.map.unwrap().to_json_string()
    );
    program
        .body
        .extend(fragments::statements("helper();", &allocator).unwrap());
    let before = format!("{program:?}");
    let generated = generate(&mut program, &allocator, CodegenOptions::default()).unwrap();
    assert!(generated.map.is_none());
    assert_eq!(before, format!("{program:?}"));
}

#[test]
fn invalid_original_spans_and_comment_attachments_fail_before_mutation() {
    let allocator = Allocator::default();
    for invalid_span in [Span::new(2, 1), Span::new(1, 1000)] {
        let mut program = parse(&allocator, "const original = 1;");
        program.span = invalid_span;
        let before = format!("{program:?}");
        assert!(generate(&mut program, &allocator, options(false)).is_err());
        assert_eq!(before, format!("{program:?}"));
    }
    let mut program = parse(&allocator, "/*! comment */ const original = 1;");
    program.comments[0].attached_to = u32::MAX;
    assert!(generate(&mut program, &allocator, options(false)).is_err());
    let mut program = parse(&allocator, "const original = '😀';");
    program.span.end = program.source_text.find('😀').unwrap() as u32 + 1;
    assert!(
        generate(&mut program, &allocator, options(false)).is_err(),
        "UTF-8 midpoint is not an original boundary"
    );
}

#[test]
fn finalize_rejects_foreign_sources_out_of_bounds_and_invalid_name_ids() {
    fn sample(content: &str, token: Token) -> SourceMap<'_> {
        SourceMap::new(
            None,
            vec![],
            None,
            vec!["input.js".into()],
            vec![Some(content.into())],
            vec![token].into_boxed_slice(),
            None,
        )
    }
    for (content, token) in [
        ("wrong", Token::new(0, 0, 1, 0, Some(0), None)),
        ("\0\nx", Token::new(0, 0, 1, 0, Some(1), None)),
        ("\0\nx", Token::new(0, 0, 1, 2, Some(0), None)),
        ("\0\nx", Token::new(0, 0, 0, 2, Some(0), None)),
        ("\0\nx", Token::new(0, 0, 1, 0, Some(0), Some(42))),
    ] {
        assert!(super::super::map::finalize(sample(content, token), "x", "\0\nx").is_err());
    }
}

#[test]
fn virtual_source_guard_restores_ast_during_unwinding() {
    let allocator = Allocator::default();
    let mut program = parse(&allocator, "/* note */ const original = '😀';");
    program
        .body
        .extend(fragments::statements("helper();", &allocator).unwrap());
    let original = program.source_text;
    let before = format!("{program:?}");
    let failed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        super::super::spans::prepare(&mut program);
        program.source_text = allocator.alloc_str(&format!("\0\n{original}"));
        let _guard = super::super::VirtualSource {
            program: &mut program,
            original,
        };
        panic!("simulated codegen failure");
    }));
    assert!(failed.is_err());
    assert_eq!(format!("{program:?}"), before);
}

#[test]
fn literal_nul_in_original_source_and_genuine_renamed_names_are_not_removed() {
    let source = "const originalName = `\0\nx`; originalName;";
    let allocator = Allocator::default();
    let mut program = parse(&allocator, source);
    struct Rename;
    impl<'a> VisitMut<'a> for Rename {
        fn visit_binding_identifier(&mut self, node: &mut BindingIdentifier<'a>) {
            if node.name == "originalName" {
                node.name = "short".into();
            }
        }
        fn visit_identifier_reference(&mut self, node: &mut IdentifierReference<'a>) {
            if node.name == "originalName" {
                node.name = "short".into();
            }
        }
    }
    Rename.visit_program(&mut program);
    program.body.insert(
        0,
        fragments::statements("helper();", &allocator)
            .unwrap()
            .remove(0),
    );
    let (code, map) = checked(&mut program, &allocator, options(true));
    assert_eq!(map.get_source_content(0), Some(source));
    assert_eq!(map.get_names().collect::<Vec<_>>(), vec!["originalName"]);
    real(&code, &map, "short", (0, 6));
    unmapped(&code, &map, "helper", 0);
}
