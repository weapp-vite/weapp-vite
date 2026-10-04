use super::*;

fn request() -> Request {
    Request::parse(include_str!("fixtures/request.json")).unwrap()
}
fn output(source: &str) -> Value {
    let result = run(source, request()).unwrap();
    assert_eq!(result.status, "ok");
    serde_json::from_str(result.result_json.as_ref().unwrap()).unwrap()
}
#[test]
fn rewrites_a_full_component_without_executing_its_setup() {
    let out = output(
        "import {defineComponent as _defineComponent} from 'vue'; import {ref} from 'wevu'; export default _defineComponent({setup(__props,{expose:__expose}){__expose();const count=ref<number>(0);const text='💡';const state={count,text};return state;}})",
    );
    let code = out["code"].as_str().unwrap();
    assert!(code.contains("createWevuComponent(__wevuOptions)"));
    assert!(code.contains("virtualHost: false") || code.contains("\"virtualHost\": false"));
    assert!(code.contains("data()"));
    assert!(!code.contains("<number>"));
    assert!(code.contains("expose()"));
    assert_eq!(
        out["componentStyleOptions"],
        json!({"styleIsolation":{"kind":"absent"},"addGlobalClass":{"kind":"absent"}})
    );
    assert_eq!(out["map"]["sources"][0], "inline.ts");
    assert!(
        out["map"]["sourcesContent"][0]
            .as_str()
            .unwrap()
            .contains("💡")
    );
}
#[test]
fn rejects_options_that_cannot_be_transferred_without_semantic_loss() {
    let base: Value = serde_json::from_str(include_str!("fixtures/request.json")).unwrap();
    for (key, tag) in [
        ("unknownOption", json!({"kind":"undefined"})),
        ("minify", json!({"kind":"number","value":"-0"})),
        (
            "templateRefs",
            json!({"kind":"object","prototype":"Array","properties":[{"key":"length","enumerable":false,"configurable":false,"writable":true,"value":{"kind":"number","value":"2"}}]}),
        ),
    ] {
        let mut raw = base.clone();
        raw["options"]["properties"].as_array_mut().unwrap().push(
            json!({"key":key,"enumerable":true,"configurable":true,"writable":true,"value":tag}),
        );
        assert!(Request::parse(&raw.to_string()).is_err(), "{key}");
    }
}
#[test]
fn preserves_explicit_no_map_and_skip_registration() {
    let mut req = request();
    req.options["sourceMap"] = json!(false);
    req.options["skipComponentTransform"] = json!(true);
    let result = run("export default {setup(){return {answer:42}}}", req).unwrap();
    let out: Value = serde_json::from_str(result.result_json.as_ref().unwrap()).unwrap();
    assert_eq!(out["map"], Value::Null);
    assert!(out.get("componentStyleOptions").is_none());
    assert!(
        !out["code"]
            .as_str()
            .unwrap()
            .contains("createWevuComponent")
    );
}
#[test]
fn refuses_dynamic_defaults_and_component_features_atomically() {
    for source in [
        "export default {...options}",
        "export default {mixins:[other]}",
        "export default {options: external}",
        "export default {setData:external}",
    ] {
        assert!(run(source, request()).is_err(), "{source}");
    }
    let bad = run("export default {", request()).unwrap();
    assert_eq!(bad.status, "parse-error");
    assert!(bad.result_json.is_none());
    assert!(bad.warnings.is_empty());
}
#[test]
fn buffers_metadata_warning_until_success_and_rejects_unimplemented_options() {
    let mut req = request();
    req.options["inlineExpressions"] = json!([{"id":"tap","expression":"ctx.count++","scopeKeys":[],"parameterNames":{"context":"ctx","scope":"scope","event":"event"}}]);
    let result = run("export default {methods: factory()}", req).unwrap();
    assert_eq!(result.status, "ok");
    assert_eq!(result.warnings.len(), 1);
    let mut raw: Value = serde_json::from_str(include_str!("fixtures/request.json")).unwrap();
    raw["options"]["properties"].as_array_mut().unwrap().push(json!({"key":"isApp","enumerable":true,"configurable":true,"writable":true,"value":{"kind":"boolean","value":true}}));
    assert!(Request::parse(&raw.to_string()).is_err());
}

#[test]
fn rejects_non_enumerable_defaults_instead_of_injecting_ignored_json_properties() {
    let mut raw: Value = serde_json::from_str(include_str!("fixtures/request.json")).unwrap();
    raw["options"]["properties"][1]["value"]["properties"][0]["enumerable"] = json!(false);
    let reason = Request::parse(&raw.to_string()).err().unwrap();
    assert!(
        reason.contains("Non-enumerable defaults require fallback at $.wevuDefaults.component")
    );
}
