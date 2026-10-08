use super::*;
use crate::script_transform::template_provenance::{InlineOrigins, SourceContract};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, Span};

fn fixture() -> Value {
    json!({"schemaVersion":1,"coordinateEncoding":"utf16",
    "sources":[{"id":"page","filename":"pages/test.vue",
        "content":"😀\r\njump('😀', 7, true, null)\r\njump(2)"}],
    "occurrences":[
        {"id":"on-0","kind":"inline-handler-callee","sourceId":"page","inlineId":"i0",
            "expression":{"start":4,"end":29,"text":"jump('😀', 7, true, null)"},
            "callee":{"start":4,"end":8,"name":"jump"},"fragments":[
                {"kind":"inline-handler-argument-literal","role":"copied",
                    "generated":{"start":10,"end":14,"text":"'😀'"},"source":{"start":9,"end":13,"text":"'😀'"}},
                {"kind":"inline-handler-argument-literal","role":"copied",
                    "generated":{"start":16,"end":17,"text":"7"},"source":{"start":15,"end":16,"text":"7"}},
                {"kind":"inline-handler-argument-literal","role":"copied",
                    "generated":{"start":19,"end":23,"text":"true"},"source":{"start":18,"end":22,"text":"true"}},
                {"kind":"inline-handler-argument-literal","role":"copied",
                    "generated":{"start":25,"end":29,"text":"null"},"source":{"start":24,"end":28,"text":"null"}}]},
        {"id":"on-1","kind":"inline-handler-callee","sourceId":"page","inlineId":"i1",
            "expression":{"start":31,"end":38,"text":"jump(2)"},
            "callee":{"start":31,"end":35,"name":"jump"},"fragments":[
                {"kind":"inline-handler-argument-literal","role":"copied",
                    "generated":{"start":10,"end":11,"text":"2"},"source":{"start":36,"end":37,"text":"2"}}]}
    ]})
}

fn request(provenance: Option<Value>) -> Request {
    let mut raw: Value = serde_json::from_str(include_str!("../fixtures/request.json")).unwrap();
    if let Some(provenance) = provenance {
        raw["provenance"] = provenance;
    }
    let mut req = Request::parse(&raw.to_string()).unwrap();
    req.options["inlineExpressions"] = json!([
        {"id":"i0","expression":"_ctx.jump('😀', 7, true, null)","scopeKeys":[],
            "parameterNames":{"context":"_ctx","scope":"_scope","event":"_event"}},
        {"id":"i1","expression":"_ctx.jump(2)","scopeKeys":[],
            "parameterNames":{"context":"_ctx","scope":"_scope","event":"_event"}},
        {"id":"i2","expression":"_ctx.unmapped('keep')","scopeKeys":[],
            "parameterNames":{"context":"_ctx","scope":"_scope","event":"_event"}}
    ]);
    req
}

#[test]
fn validates_utf16_literal_contract_and_rejects_invalid_token_ownership() {
    let source = "export default {}";
    let c: SourceContract = serde_json::from_value(fixture()).unwrap();
    assert!(InlineOrigins::new(source, &c).is_ok());
    for mutation in 0..11 {
        let mut raw = fixture();
        let fragments = &mut raw["occurrences"][0]["fragments"];
        match mutation {
            0 => {
                fragments.as_array_mut().unwrap().pop();
            }
            1 => fragments[1] = fragments[0].clone(),
            2 => fragments.as_array_mut().unwrap().swap(0, 1),
            3 => fragments[0]["source"]["start"] = json!(11),
            4 => fragments[0]["source"]["end"] = json!(99),
            5 => fragments[0]["generated"]["end"] = json!(10),
            6 => fragments[1]["generated"]["start"] = json!(13),
            7 => fragments[0]["generated"]["text"] = json!("'changed'"),
            8 => fragments[0]["kind"] = json!("inline-handler-argument-member-property"),
            9 => fragments[0]["role"] = json!("guessed"),
            _ => {
                fragments.as_array_mut().unwrap().clear();
            }
        }
        let c = serde_json::from_value(raw).unwrap();
        assert!(
            InlineOrigins::new(source, &c).is_err(),
            "mutation {mutation}"
        );
    }
}

#[test]
fn rejects_complex_or_wrapped_arguments_in_a_fragment_contract() {
    for expression in [
        "jump(1, row.value)",
        "jump((1))",
        "jump(...values)",
        "(jump(1))",
        "jump(1 as number)",
    ] {
        let raw = json!({"schemaVersion":1,"coordinateEncoding":"utf16",
            "sources":[{"id":"page","filename":"page.vue","content":expression}],
            "occurrences":[{"id":"on","kind":"inline-handler-callee","sourceId":"page","inlineId":"i0",
                "expression":{"start":0,"end":expression.len(),"text":expression},
                "callee":{"start":0,"end":4,"name":"jump"},"fragments":[
                    {"kind":"inline-handler-argument-literal","role":"copied",
                        "generated":{"start":10,"end":11,"text":"1"},"source":{"start":5,"end":6,"text":"1"}}]}]});
        let c = serde_json::from_value(raw).unwrap();
        assert!(
            InlineOrigins::new("export default {}", &c).is_err(),
            "{expression}"
        );
    }
}

#[derive(Default)]
struct Arguments {
    mapped: Vec<Span>,
    unmapped: Vec<Span>,
}
impl<'a> Visit<'a> for Arguments {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if let Expression::StaticMemberExpression(member) = &call.callee
            && matches!(&member.object, Expression::Identifier(id) if id.name == "_ctx")
        {
            let values = if member.property.name == "jump" {
                &mut self.mapped
            } else {
                &mut self.unmapped
            };
            values.extend(call.arguments.iter().map(GetSpan::span));
        }
        walk::walk_call_expression(self, call);
    }
}

fn position(code: &str, byte: u32) -> (u32, u32) {
    let prefix = &code[..byte as usize];
    (
        prefix.bytes().filter(|byte| *byte == b'\n').count() as u32,
        prefix.rsplit('\n').next().unwrap().encode_utf16().count() as u32,
    )
}

fn output(source: &str, req: Request) -> Value {
    let result = run(source, req).unwrap();
    assert_eq!(result.status, "ok");
    serde_json::from_str(result.result_json.as_ref().unwrap()).unwrap()
}

#[test]
fn maps_literal_arguments_by_ast_order_without_changing_code_or_uncovered_assets() {
    let source = "const user=1; export default {setup(){return {user}}}";
    for minify in [false, true] {
        let mut baseline = request(None);
        baseline.options["minify"] = json!(minify);
        let baseline = output(source, baseline);
        let mut req = request(Some(fixture()));
        req.options["minify"] = json!(minify);
        let mapped = output(source, req);
        assert_eq!(mapped["code"], baseline["code"]);
        let code = mapped["code"].as_str().unwrap();
        let allocator = Allocator::default();
        let parsed = Parser::new(&allocator, code, SourceType::mjs()).parse();
        assert!(parsed.diagnostics.is_empty());
        let mut args = Arguments::default();
        args.visit_program(&parsed.program);
        assert_eq!(args.mapped.len(), 5);
        assert_eq!(args.unmapped.len(), 1);
        let map_json = mapped["map"].to_string();
        let map = oxc_sourcemap::SourceMap::from_json_string(&map_json).unwrap();
        let table = map.generate_lookup_table();
        for (span, expected) in args
            .mapped
            .iter()
            .zip([(1, 5), (1, 11), (1, 14), (1, 20), (2, 5)])
        {
            let at = position(code, span.start);
            let tokens: Vec<_> = map
                .get_tokens()
                .filter(|token| (token.get_dst_line(), token.get_dst_col()) == at)
                .collect();
            assert_eq!(tokens.len(), 1, "{at:?}: {code}");
            assert_eq!(
                (tokens[0].get_src_line(), tokens[0].get_src_col()),
                expected
            );
            let consumed = map.lookup_source_view_token(&table, at.0, at.1).unwrap();
            assert_eq!(consumed.get_source(), Some("pages/test.vue"));
            assert_eq!((consumed.get_src_line(), consumed.get_src_col()), expected);
        }
        for span in args.unmapped {
            let at = position(code, span.start);
            assert_eq!(
                map.lookup_source_view_token(&table, at.0, at.1)
                    .and_then(|token| token.get_source()),
                None
            );
        }
        let mut req = request(Some(fixture()));
        req.options["minify"] = json!(minify);
        req.options["sourceMap"] = json!(false);
        let no_map = output(source, req);
        assert_eq!(no_map["code"], mapped["code"]);
        assert_eq!(no_map["map"], Value::Null);
    }
}

#[test]
fn rejects_bad_asset_ranges_changed_values_and_unused_fragments() {
    for mutation in 0..5 {
        let mut raw = fixture();
        match mutation {
            0 => {
                raw["occurrences"][0]["fragments"][0]["generated"]["start"] = json!(12);
                raw["occurrences"][0]["fragments"][0]["generated"]["end"] = json!(16);
            }
            1 => raw["occurrences"][0]["inlineId"] = json!("absent"),
            _ => {}
        }
        let mut req = request(Some(raw));
        match mutation {
            2 => {
                req.options["inlineExpressions"][0]["expression"] =
                    json!("_ctx.jump('😀', 8, true, null)")
            }
            3 => {
                req.options["inlineExpressions"][0]["expression"] =
                    json!("_ctx.jump('😀', 7, true, null, 2)")
            }
            4 => {
                req.options["inlineExpressions"][0]["expression"] =
                    json!("_ctx.jump('😀', _ctx.value, true, null)")
            }
            _ => {}
        }
        assert!(
            run("export default {}", req).is_err(),
            "mutation {mutation}"
        );
    }
}
