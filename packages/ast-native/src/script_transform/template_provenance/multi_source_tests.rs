use super::*;
use crate::script_transform::fragments;
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_codegen::CodegenOptions;
use oxc_parser::Parser;
use oxc_span::SourceType;
use serde_json::json;
use std::path::PathBuf;

#[test]
fn identical_names_in_distinct_full_sources_preserve_occurrence_ownership_and_crlf() {
    let main = "export default null;";
    let contract: SourceContract = serde_json::from_value(json!({"schemaVersion":1,"coordinateEncoding":"utf16",
        "sources":[{"id":"first","filename":"first.vue","content":"jump()\r"},
            {"id":"second","filename":"second.vue","content":"😀\r\njump()"}],
        "occurrences":[
            {"id":"on-first","kind":"inline-handler-callee","sourceId":"first","inlineId":"i0",
                "expression":{"start":0,"end":6,"text":"jump()"},"callee":{"start":0,"end":4,"name":"jump"}},
            {"id":"on-second","kind":"inline-handler-callee","sourceId":"second","inlineId":"i1",
                "expression":{"start":4,"end":10,"text":"jump()"},"callee":{"start":4,"end":8,"name":"jump"}}]})).unwrap();
    let origins = InlineOrigins::new(main, &contract).unwrap();
    let allocator = Allocator::default();
    let mut expression = fragments::expression(
        "({methods:{inline:{i0:{fn:ctx=>ctx.jump(1)},i1:{fn:ctx=>ctx.jump(2)}}}})",
        &allocator,
    )
    .unwrap();
    let Expression::ObjectExpression(component) = &mut expression else {
        panic!()
    };
    origins.apply(component, "inline", &json!({"inlineExpressions":[
        {"id":"i0","parameterNames":{"context":"ctx"}}, {"id":"i1","parameterNames":{"context":"ctx"}}]})).unwrap();
    let mut parsed = Parser::new(&allocator, main, SourceType::mjs()).parse();
    let Statement::ExportDefaultDeclaration(export) = &mut parsed.program.body[0] else {
        panic!()
    };
    export.declaration = ExportDefaultDeclarationKind::from(expression);
    let result = origins
        .generate(
            &mut parsed.program,
            &allocator,
            CodegenOptions {
                source_map_path: Some(PathBuf::from("inline.ts")),
                ..CodegenOptions::default()
            },
        )
        .unwrap();
    let map = result.map.unwrap();
    let lookup = map.generate_lookup_table();
    for (needle, source, original_line) in
        [("jump(1)", "first.vue", 0), ("jump(2)", "second.vue", 1)]
    {
        let prefix = &result.code[..result.code.find(needle).unwrap()];
        let token = map
            .lookup_source_view_token(
                &lookup,
                prefix.bytes().filter(|b| *b == b'\n').count() as u32,
                prefix.rsplit('\n').next().unwrap().encode_utf16().count() as u32,
            )
            .unwrap();
        assert_eq!(token.get_source(), Some(source));
        assert_eq!(
            (token.get_src_line(), token.get_src_col()),
            (original_line, 0)
        );
    }
    assert_eq!(map.get_source_content(0), Some(main));
    assert_eq!(map.get_source_content(1), Some("jump()\r"));
    assert_eq!(map.get_source_content(2), Some("😀\r\njump()"));
}
