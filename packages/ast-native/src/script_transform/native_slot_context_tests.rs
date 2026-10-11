use super::*;

fn raw_request(value: Value) -> Value {
    let mut raw: Value = serde_json::from_str(include_str!("fixtures/request.json")).unwrap();
    raw["options"]["properties"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "key":"nativeSlotContext", "enumerable":true, "configurable":true, "writable":true,
            "value":value,
        }));
    raw
}

fn request() -> Request {
    let mut raw = raw_request(json!({"kind":"boolean","value":true}));
    raw["contract"]["markers"]["WEVU_NATIVE_SLOT_CONTEXT_KEY"] = json!("nativeSlotMarker");
    Request::parse(&raw.to_string()).unwrap()
}

#[test]
fn native_slot_context_appends_contract_marker_before_manifest_with_or_without_registration() {
    for skip in [false, true] {
        let mut req = request();
        req.options["skipComponentTransform"] = json!(skip);
        req.options["bindingManifest"] = json!({"sourceFile":"component.vue","bindings":[]});
        let manifest = req.marker("WEVU_BINDING_MANIFEST_KEY").unwrap();
        let result = run(
            "export default {nativeSlotMarker:false,setup(){return {answer:42}}}",
            req,
        )
        .unwrap();
        assert_eq!(result.status, "ok");
        let out: Value = serde_json::from_str(result.result_json.as_ref().unwrap()).unwrap();
        let code = out["code"].as_str().unwrap();
        let old = code.find("nativeSlotMarker: false").unwrap();
        let new = code.find("nativeSlotMarker: true").unwrap();
        assert_eq!(code.matches("nativeSlotMarker:").count(), 2);
        assert!(old < new && new < code.find(&manifest).unwrap(), "{code}");
        assert_eq!(code.contains("createWevuComponent("), !skip);
        assert!(result.warnings.is_empty());

        let map_json = out["map"].to_string();
        let map = oxc_sourcemap::SourceMap::from_json_string(&map_json).unwrap();
        let prefix = &code[..new];
        let line = prefix.bytes().filter(|byte| *byte == b'\n').count() as u32;
        let column = prefix.rsplit('\n').next().unwrap().encode_utf16().count() as u32;
        let table = map.generate_lookup_table();
        let token = map.lookup_source_view_token(&table, line, column);
        assert_eq!(token.as_ref().and_then(|token| token.get_source()), None);
        assert_eq!(token.as_ref().and_then(|token| token.get_name()), None);
    }
}

#[test]
fn native_slot_context_disabled_or_undefined_preserves_existing_marker_without_contract() {
    for value in [
        json!({"kind":"boolean","value":false}),
        json!({"kind":"undefined"}),
    ] {
        let req = Request::parse(&raw_request(value).to_string()).unwrap();
        let result = run("export default {nativeSlotMarker:false}", req).unwrap();
        let out: Value = serde_json::from_str(result.result_json.as_ref().unwrap()).unwrap();
        let code = out["code"].as_str().unwrap();
        assert!(code.contains("nativeSlotMarker: false"));
        assert_eq!(code.matches("nativeSlotMarker:").count(), 1);
    }
}

#[test]
fn native_slot_context_requires_boolean_and_fails_closed_without_contract() {
    for value in [
        json!({"kind":"string","value":"true"}),
        json!({"kind":"null"}),
    ] {
        let error = Request::parse(&raw_request(value).to_string())
            .err()
            .unwrap();
        assert_eq!(error, "Invalid boolean option: nativeSlotContext");
    }
    let req =
        Request::parse(&raw_request(json!({"kind":"boolean","value":true})).to_string()).unwrap();
    let error = run("export default {}", req).err().unwrap();
    assert_eq!(
        error,
        "Missing contract string: WEVU_NATIVE_SLOT_CONTEXT_KEY"
    );
}

#[test]
fn native_slot_context_does_not_enable_unknown_options_or_app_transform() {
    for (key, expected) in [
        ("unknownOption", "Unknown script option: unknownOption"),
        (
            "isApp",
            "App/defaults installation and automatic setData picking are deferred",
        ),
    ] {
        let mut raw = raw_request(json!({"kind":"boolean","value":true}));
        raw["options"]["properties"]
            .as_array_mut()
            .unwrap()
            .push(json!({
                "key":key, "enumerable":true, "configurable":true, "writable":true,
                "value":{"kind":"boolean","value":true},
            }));
        assert_eq!(Request::parse(&raw.to_string()).err().unwrap(), expected);
    }
}
