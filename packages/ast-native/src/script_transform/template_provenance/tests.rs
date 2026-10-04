use super::*;
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_ast_visit::Visit;
use oxc_codegen::CodegenOptions;
use oxc_parser::Parser;
use oxc_span::{SPAN, SourceType, Span};
use serde_json::json;
use std::path::PathBuf;

fn contract(
    source: &str,
    text: &str,
    start: u32,
    end: u32,
    callee_start: u32,
    callee_end: u32,
) -> SourceContract {
    serde_json::from_value(json!({"schemaVersion":1,"coordinateEncoding":"utf16",
        "sources":[{"id":"template","filename":"pages/test.vue","content":source}],
        "occurrences":[{"id":"on-1","kind":"inline-handler-callee","sourceId":"template","inlineId":"i0",
            "expression":{"start":start,"end":end,"text":text},"callee":{"start":callee_start,"end":callee_end,"name":"jump"}}]})).unwrap()
}
fn options() -> serde_json::Value {
    json!({"inlineExpressions":[{"id":"i0","parameterNames":{"context":"ctx"}}]})
}
fn component<'a>(allocator: &'a Allocator, handler: &str) -> Expression<'a> {
    crate::script_transform::fragments::expression(
        &format!("({{methods:{{inline:{{i0:{{fn:(ctx,scope,event)=>({handler})}}}}}}}})"),
        allocator,
    )
    .unwrap()
}
fn apply(origins: &InlineOrigins<'_>, expression: &mut Expression<'_>) -> Result<(), String> {
    let Expression::ObjectExpression(object) = expression else {
        panic!()
    };
    origins.apply(object, "inline", &options())
}

#[test]
fn validates_original_ast_token_instead_of_matching_same_text_elsewhere() {
    for (text, start, end) in [
        (" jump(value) ", 1, 5),
        ("((jump))(value)", 2, 6),
        (" (jump) ", 2, 6),
    ] {
        let c = contract(text, text, 0, text.len() as u32, start, end);
        assert!(InlineOrigins::new("export default {}", &c).is_ok());
    }
    for (text, start, end) in [
        ("other(jump)", 6, 10),
        ("value.jump()", 6, 10),
        ("jump + other", 0, 4),
        ("jump?.()", 0, 4),
    ] {
        let c = contract(text, text, 0, text.len() as u32, start, end);
        assert!(
            InlineOrigins::new("export default {}", &c).is_err(),
            "{text}"
        );
    }
    let mut c = contract("j\\u0075mp()", "j\\u0075mp()", 0, 11, 0, 9);
    c.occurrences[0].callee.name = "j\\u0075mp".to_owned();
    assert!(InlineOrigins::new("export default {}", &c).is_err());
}

#[test]
fn rejects_malformed_identity_range_and_unowned_sources() {
    let baseline = serde_json::to_value(json!({"schemaVersion":1,"coordinateEncoding":"utf16",
        "sources":[{"id":"template","filename":"test.vue","content":"😀jump()"}],
        "occurrences":[{"id":"on-1","kind":"inline-handler-callee","sourceId":"template","inlineId":"i0",
            "expression":{"start":2,"end":8,"text":"jump()"},"callee":{"start":2,"end":6,"name":"jump"}}]})).unwrap();
    for mutation in 0..8 {
        let mut value = baseline.clone();
        match mutation {
            0 => value["occurrences"][0]["callee"]["start"] = json!(1),
            1 => value["occurrences"][0]["expression"]["end"] = json!(99),
            2 => value["occurrences"][0]["sourceId"] = json!("missing"),
            3 => value["occurrences"][0]["expression"]["text"] = json!("jump(1)"),
            4 => value["sources"][0]["filename"] = json!("inline.ts"),
            5 => {
                let entry = value["occurrences"][0].clone();
                value["occurrences"].as_array_mut().unwrap().push(entry);
            }
            6 => value["coordinateEncoding"] = json!("utf8"),
            _ => value["occurrences"][0]["kind"] = json!("guessed"),
        }
        let c: SourceContract = serde_json::from_value(value).unwrap();
        assert!(
            InlineOrigins::new("export default {}", &c).is_err(),
            "mutation {mutation}"
        );
    }
    let mut unknown = baseline.clone();
    unknown["occurrences"][0]["guessed"] = json!(true);
    assert!(serde_json::from_value::<SourceContract>(unknown).is_err());
}

#[test]
fn attaches_only_supported_actual_inline_root_callees() {
    let c = contract("jump()", "jump()", 0, 6, 0, 4);
    let origins = InlineOrigins::new("export default {}", &c).unwrap();
    for handler in [
        "other.jump()",
        "ctx.other()",
        "ctx.jump?.()",
        "ctx['jump']()",
        "ctx.jump + 1",
        "(()=>ctx.jump())()",
    ] {
        let allocator = Allocator::default();
        assert!(
            apply(&origins, &mut component(&allocator, handler)).is_err(),
            "{handler}"
        );
    }
    let allocator = Allocator::default();
    assert!(apply(&origins, &mut component(&allocator, "ctx.jump(event)")).is_ok());
}

#[derive(Default)]
struct Spans(Vec<Span>);
impl<'a> Visit<'a> for Spans {
    fn visit_span(&mut self, span: &Span) {
        self.0.push(*span);
    }
}

#[test]
fn emits_true_multisource_tokens_and_restores_spans_without_changing_code() {
    let main = "// retained\r\nconst user=1; export default null;";
    let source = "😀\r\n<!-- first -->\u{2028}jump()";
    let start = source.encode_utf16().count() as u32 - 6;
    let c = contract(source, "jump()", start, start + 6, start, start + 4);
    let origins = InlineOrigins::new(main, &c).unwrap();
    for minify in [false, true] {
        let allocator = Allocator::default();
        let mut parsed = Parser::new(&allocator, main, SourceType::mjs()).parse();
        let mut object = component(&allocator, "ctx.jump(event)");
        let unmarked = oxc_codegen::Codegen::new()
            .with_options(CodegenOptions {
                minify,
                ..CodegenOptions::default()
            })
            .build(&parsed.program)
            .code;
        assert!(unmarked.contains("user"));
        apply(&origins, &mut object).unwrap();
        let Statement::ExportDefaultDeclaration(export) = parsed.program.body.last_mut().unwrap()
        else {
            panic!()
        };
        export.declaration = ExportDefaultDeclarationKind::from(object);
        let mut before = Spans::default();
        before.visit_program(&parsed.program);
        let comments: Vec<_> = parsed
            .program
            .comments
            .iter()
            .map(|c| (c.span, c.attached_to))
            .collect();
        let output = origins
            .generate(
                &mut parsed.program,
                &allocator,
                CodegenOptions {
                    minify,
                    source_map_path: Some(PathBuf::from("inline.ts")),
                    ..CodegenOptions::default()
                },
            )
            .unwrap();
        let mut after = Spans::default();
        after.visit_program(&parsed.program);
        assert_eq!(before.0, after.0);
        assert_eq!(parsed.program.source_text, main);
        assert_eq!(
            comments,
            parsed
                .program
                .comments
                .iter()
                .map(|c| (c.span, c.attached_to))
                .collect::<Vec<_>>()
        );
        let map = output.map.unwrap();
        assert_eq!(map.get_source_content(0), Some(main));
        assert_eq!(map.get_source_content(1), Some(source));
        let table = map.generate_lookup_table();
        let at = |needle: &str| {
            let byte = output.code.find(needle).unwrap();
            let prefix = &output.code[..byte];
            map.lookup_source_view_token(
                &table,
                prefix.bytes().filter(|b| *b == b'\n').count() as u32,
                prefix.rsplit('\n').next().unwrap().encode_utf16().count() as u32,
            )
            .unwrap()
        };
        let token = at("jump");
        assert_eq!(token.get_source(), Some("pages/test.vue"));
        assert_eq!((token.get_src_line(), token.get_src_col()), (2, 0));
        assert_eq!(at("ctx.jump").get_source(), None);
        assert_eq!(at("user").get_source(), Some("inline.ts"));
        assert!(!map.to_json_string().contains("\\u0000"));
        let no_map = origins
            .generate(
                &mut parsed.program,
                &allocator,
                CodegenOptions {
                    minify,
                    ..CodegenOptions::default()
                },
            )
            .unwrap();
        assert_eq!(output.code, no_map.code);
        assert!(no_map.map.is_none());
        assert!(before.0.contains(&SPAN));
    }
}
