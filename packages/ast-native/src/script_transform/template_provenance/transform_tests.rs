use super::*;

fn request(provenance: bool) -> Request {
    let mut raw: Value = serde_json::from_str(include_str!("../fixtures/request.json")).unwrap();
    if provenance {
        let prefix = "<template>\r\n<!-- 😀 -->\r\n<view @tap=\"";
        let content = format!("{prefix}jump(1)\"/></template>");
        let start = prefix.encode_utf16().count();
        raw["provenance"] = json!({"schemaVersion":1,"coordinateEncoding":"utf16",
            "sources":[{"id":"page","filename":"pages/test.vue","content":content}],
            "occurrences":[{"id":"directive-0","kind":"inline-handler-callee","sourceId":"page","inlineId":"i0",
                "expression":{"start":start,"end":start+7,"text":"jump(1)"},
                "callee":{"start":start,"end":start+4,"name":"jump"}}]});
    }
    let mut req = Request::parse(&raw.to_string()).unwrap();
    req.options["inlineExpressions"] = json!([{"id":"i0","expression":"_ctx.jump(1)","scopeKeys":[],
        "parameterNames":{"context":"_ctx","scope":"_scope","event":"_event"}}]);
    req
}
fn output(source: &str, req: Request) -> Value {
    let result = run(source, req).unwrap();
    assert_eq!(result.status, "ok");
    serde_json::from_str(result.result_json.as_ref().unwrap()).unwrap()
}

#[test]
fn full_transform_consumes_provenance_without_changing_emitted_code() {
    let source = "const user = 1; export default {setup(){return {user}}}";
    for minify in [false, true] {
        let mut before = request(false);
        before.options["minify"] = json!(minify);
        let expected = output(source, before);
        let mut req = request(true);
        req.options["minify"] = json!(minify);
        let mapped = output(source, req);
        assert_eq!(mapped["code"], expected["code"]);
        assert_eq!(
            mapped["map"]["sources"],
            json!(["inline.ts", "pages/test.vue"])
        );
        assert_eq!(mapped["map"]["sourcesContent"][0], json!(source));
        let map_json = mapped["map"].to_string();
        let map = oxc_sourcemap::SourceMap::from_json_string(&map_json).unwrap();
        let code = mapped["code"].as_str().unwrap();
        let table = map.generate_lookup_table();
        let lookup = |needle: &str| {
            let prefix = &code[..code.find(needle).unwrap()];
            map.lookup_source_view_token(
                &table,
                prefix.bytes().filter(|b| *b == b'\n').count() as u32,
                prefix.rsplit('\n').next().unwrap().encode_utf16().count() as u32,
            )
        };
        assert_eq!(lookup("jump").unwrap().get_source(), Some("pages/test.vue"));
        assert_eq!(
            (
                lookup("jump").unwrap().get_src_line(),
                lookup("jump").unwrap().get_src_col()
            ),
            (2, 12)
        );
        assert_eq!(
            lookup("_ctx.jump").and_then(|token| token.get_source()),
            None
        );
        assert_eq!(
            lookup("createWevuComponent(").and_then(|token| token.get_source()),
            None
        );
        assert_eq!(lookup("user").unwrap().get_source(), Some("inline.ts"));
        let mut no_map = request(true);
        no_map.options["minify"] = json!(minify);
        no_map.options["sourceMap"] = json!(false);
        let no_map = output(source, no_map);
        assert_eq!(no_map["code"], mapped["code"]);
        assert_eq!(no_map["map"], Value::Null);
    }
}

#[test]
fn malformed_uninjected_or_unknown_ownership_fails_the_complete_native_stage() {
    for kind in 0..7 {
        let mut req = request(true);
        let mut source = "export default {}";
        match kind {
            0 => req.provenance.as_mut().unwrap().occurrences[0].inline_id = "absent".to_owned(),
            1 => req.options["inlineExpressions"] = json!([]),
            2 => source = "export default {methods: factory()}",
            3 => req.options["inlineExpressions"][0]["expression"] = json!("_ctx.other()"),
            4 => req.options["inlineExpressions"][0]["expression"] = json!("("),
            5 => {
                let entry = req.options["inlineExpressions"][0].clone();
                req.options["inlineExpressions"]
                    .as_array_mut()
                    .unwrap()
                    .push(entry);
            }
            _ => {
                req.provenance.as_mut().unwrap().occurrences[0]
                    .expression
                    .text = "jump(2)".to_owned()
            }
        }
        assert!(run(source, req).is_err(), "case {kind}");
    }
}
