use std::process::Command;

use oxc_allocator::Allocator;
use oxc_ast::ast::Expression;
use oxc_codegen::Codegen;
use serde_json::{Value, json};

use super::{MetadataSymbols, apply_to_component, build, expression};

pub(super) fn symbols() -> MetadataSymbols {
    serde_json::from_value(json!({
        "normalizeClass": "normalizeClass", "normalizeStyle": "normalizeStyle",
        "unref": "unref", "resolvePropValue": "resolvePropValue", "propsKey": "props",
        "slotOwnerKey": "slotOwner", "slotOwnerProxyKey": "slotOwnerProxy",
        "slotPropsDataKey": "slotData", "inlineMapKey": "inlineMap",
        "expressionErrorIdentifier": "expressionError"
    }))
    .unwrap()
}

fn exp(role: &str, source: &str) -> Value {
    json!({ "role": role, "source": source })
}

fn binding(kind: &str, source: &str) -> Value {
    json!({ "name": "generated", "type": kind, "exp": source, "expAst": exp("expAst", source) })
}

pub(super) fn output(options: Value, component: &str) -> (String, super::MetadataApplied) {
    let allocator = Allocator::default();
    let mut expression = expression::parse(&allocator, component).unwrap();
    let Expression::ObjectExpression(object) = &mut expression else {
        panic!("component must be object")
    };
    let applied =
        apply_to_component(build(&options, &symbols()).unwrap(), object, &allocator).unwrap();
    let mut codegen = Codegen::new();
    codegen.print_expression(&expression);
    (codegen.into_source_text(), applied)
}

pub(super) fn execute(code: &str, assertions: &str) {
    let script = format!(
        "const assert=require('node:assert/strict');const unref=x=>x&&x.ref?x.value:x;const normalizeClass=x=>x;const normalizeStyle=x=>x;const resolvePropValue=(o,k,v)=>v;const output=({code});{assertions}"
    );
    let result = Command::new("node")
        .arg("-e")
        .arg(script)
        .output()
        .expect("Node is required for metadata execution tests");
    assert!(
        result.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&result.stderr),
        code
    );
}

#[test]
fn preserves_array_object_number_and_condition_semantics() {
    let mut entry = binding("bind", "[item,index,key]");
    entry["forStack"] = json!([{ "listExp": "this.list", "listExpAst": exp("listExpAst", "this.list"), "item": "item", "index": "index", "key": "key" }]);
    entry["conditions"] = json!([{ "expAst": exp("expAst", "this.visible"), "forDepth": 0 }, { "expAst": exp("expAst", "item !== 2"), "forDepth": 1 }]);
    let (code, applied) = output(json!({"classStyleBindings": [entry]}), "({})");
    assert!(applied.computed_injected);
    assert_eq!(applied.imports.len(), 4);
    execute(
        &code,
        "const run=(list,visible=true)=>output.computed.generated.call({list,visible});assert.deepEqual(run([1,2,3]),[[1,0,0],undefined,[3,2,2]]);assert.deepEqual(run({a:1,b:3}),{a:[1,0,'a'],b:[3,1,'b']});assert.deepEqual(run(3.9),[[0,0,0],[1,1,1],undefined]);assert.deepEqual(run(-1),[]);assert.deepEqual(run(Infinity),[]);assert.deepEqual(run(null),[]);assert.deepEqual(run([1],false),[]);",
    );
}

#[test]
fn key_projection_uses_raw_list_and_condition() {
    let mut entry = binding("bind", "item.id");
    entry["exp"] = json!("v-for :key item.id");
    entry["forStack"] = json!([{ "listExpAst": exp("listExpAst", "this.projected"), "rawListExpAst": exp("rawListExpAst", "this.raw"), "projectedListExpAst": exp("projectedListExpAst", "this.projected"), "item": "item" }]);
    entry["conditions"] = json!([{ "expAst": exp("expAst", "false"), "rawExpAst": exp("rawExpAst", "true"), "forDepth": 0 }]);
    let (code, _) = output(json!({"classStyleBindings": [entry]}), "({})");
    execute(
        &code,
        "assert.deepEqual(output.computed.generated.call({raw:[{id:7}],projected:[{id:9}]}),[7]);",
    );
}

#[test]
fn preserves_data_rewrite_boundaries_and_owned_undefined_prop() {
    let entry = binding(
        "class",
        "[data,{data},data[data],()=>data,...[data],({ ...data })]",
    );
    let (code, _) = output(json!({"classStyleBindings": [entry]}), "({})");
    execute(
        &code,
        "global.data='source';const actual=output.computed.generated.call({data:{source:'fallback'},props:{data:{source:'prop'}}});assert.deepEqual(actual.slice(0,3),[{source:'prop'},{data:{source:'prop'}},'prop']);assert.equal(actual[3](),'source');assert.equal(actual[4],'source');assert.deepEqual(actual[5],{0:'s',1:'o',2:'u',3:'r',4:'c',5:'e'});",
    );
    let (code, _) = output(
        json!({"classStyleBindings": [binding("class", "data")]}),
        "({})",
    );
    execute(
        &code,
        "assert.equal(output.computed.generated.call({data:'fallback',props:{data:undefined}}),undefined);assert.equal(output.computed.generated.call({data:'fallback',props:{}}),'fallback');",
    );
}

#[test]
fn preserves_existing_computed_precedence_and_reports_unsupported_merge() {
    let options = json!({"classStyleBindings": [binding("class", "'new'")]});
    let (code, _) = output(options.clone(), "({computed:{generated(){return 'old'}}})");
    execute(&code, "assert.equal(output.computed.generated(),'new');");
    let (code, _) = output(options.clone(), "({computed:global.existing})");
    execute(
        &format!("(()=>{{global.existing={{generated:()=> 'old'}};return {code}}})()"),
        "assert.equal(output.computed.generated(),'old');",
    );
    let (_, applied) = output(options, "({computed:makeComputed()})");
    assert!(!applied.computed_injected);
    assert_eq!(
        applied.warnings,
        ["无法自动注入 class/style 计算属性，请手动合并 computed。"]
    );
}

fn inline() -> Value {
    json!({ "id": "i0", "expression": "ctx.call(scope.second,event)", "scopeKeys": ["second","first","missing"], "parameterNames": {"context":"ctx","scope":"scope","event":"event"}, "indexBindings":[{"key":"j"},{"key":"i"}], "scopeResolvers":[{"key":"first","expression":"1"},{"key":"second","expression":"2"},{"key":"first","expression":"3"}] })
}

#[test]
fn preserves_inline_scope_parameter_resolver_and_index_order() {
    let (code, applied) = output(
        json!({"inlineExpressions": [inline()]}),
        "({methods:{existing(){return 1},inlineMap:{old:{}}}})",
    );
    assert!(applied.inline_injected);
    execute(
        &code,
        "const map=output.methods.inlineMap;assert.ok(map.old);assert.equal(output.methods.existing(),1);assert.deepEqual(map.i0.keys,['second','first','missing']);assert.deepEqual(map.i0.indexKeys,['j','i']);assert.deepEqual(map.i0.scopeResolvers,[2,3,undefined]);assert.equal(map.i0.fn({call:(a,b)=>a+b},{second:4},5),9);",
    );
}

#[test]
fn merges_methods_from_spreads_and_warns_without_overwriting_nonobjects() {
    let (code, _) = output(
        json!({"inlineExpressions": [inline()]}),
        "({...global.first,...global.second})",
    );
    execute(
        &format!(
            "(()=>{{global.first={{methods:{{a:1,shared:'first'}}}};global.second={{methods:{{b:2,shared:'second'}}}};return {code}}})()"
        ),
        "assert.equal(output.methods.a,1);assert.equal(output.methods.b,2);assert.equal(output.methods.shared,'second');assert.ok(output.methods.inlineMap.i0);",
    );
    for component in [
        "({methods:global.methods})",
        "({methods:{inlineMap:global.map}})",
    ] {
        let (_, applied) = output(json!({"inlineExpressions": [inline()]}), component);
        assert!(!applied.inline_injected);
        assert_eq!(
            applied.warnings,
            ["无法自动注入内联表达式元数据：methods 不是对象字面量。"]
        );
    }
}

#[test]
fn rejects_unknown_expression_roles_and_ts_inline_instead_of_corrupting_valid_ts() {
    let mut entry = binding("class", "1");
    entry["expAst"]["role"] = json!("rawExpAst");
    assert!(build(&json!({"classStyleBindings":[entry]}), &symbols()).is_err());
    let mut entry = inline();
    entry["expression"] = json!("ctx.value as number");
    assert!(build(&json!({"inlineExpressions":[entry]}), &symbols()).is_err());
    entry["expression"] = json!("(");
    let (code, _) = output(json!({"inlineExpressions":[entry]}), "({})");
    execute(
        &code,
        "assert.equal(output.methods.inlineMap.i0.fn(),undefined);",
    );
}

#[test]
fn executes_full_wevu_and_retail_metadata_captures() {
    for (fixture, expected_computed, expected_inline) in [
        (include_str!("fixtures/sfc-wevu.json"), 1, 7),
        (include_str!("fixtures/sfc-retail.json"), 2, 14),
    ] {
        let options: Value = serde_json::from_str(fixture).unwrap();
        let (code, applied) = output(options, "({})");
        assert!(applied.computed_injected && applied.inline_injected);
        assert!(applied.warnings.is_empty());
        let code = format!(
            "(()=>{{const __wevuUnref=unref,__wevuResolvePropValue=resolvePropValue;return {code}}})()"
        );
        execute(
            &code,
            &format!(
                "assert.equal(Object.keys(output.computed).length,{expected_computed});assert.equal(Object.keys(output.methods.inlineMap).length,{expected_inline});"
            ),
        );
        if expected_inline == 7 {
            execute(
                &code,
                "const context={filterList:[{key:'all'},{key:'other'}],activeCategory:'all'};assert.deepEqual(output.computed.__wv_cls_0.call(context),[['filter',[{active:true}]],['filter',[{active:false}]]]);assert.equal(output.methods.inlineMap.i0.fn({selectCategory:k=>k},{filter:{key:'all'}}),'all');assert.equal(output.methods.inlineMap.i6.fn({toggleExpand:k=>k},{category:{key:'expanded'}}),'expanded');",
            );
        } else {
            execute(
                &code,
                "assert.equal(output.computed.__wv_cls_0.call({selectedAttrStr:''}),'tintColor');assert.equal(output.computed.__wv_cls_0.call({selectedAttrStr:'red'}),'');assert.equal(output.computed.__wv_bind_0.call({commentsStatistics:{commentCount:0}}),undefined);const projected=output.computed.__wv_bind_0.call({commentsStatistics:{commentCount:2},commentsList:[{goodsSpu:'a'},{goodsSpu:'b'}]});assert.equal(projected.length,2);assert.equal(projected[0].goodsSpu,'a');const event={detail:1};assert.equal(output.methods.inlineMap.id.fn({promotionChange:e=>e},{},event),event);",
            );
        }
    }
}

#[test]
fn suppresses_slot_owner_errors_but_logs_ordinary_binding_and_list_errors() {
    let mut failed_class = binding("class", "this.missing.value");
    failed_class["name"] = json!("failedClass");
    failed_class["errorFallback"] = json!("fallback");
    let mut failed_binding = binding("bind", "this.missing.value");
    failed_binding["name"] = json!("failedBinding");
    let mut slot_binding = binding("bind", "this.slotOwner.value");
    slot_binding["name"] = json!("slotBinding");
    let mut failed_list = binding("bind", "item");
    failed_list["name"] = json!("failedList");
    failed_list["forStack"] = json!([{ "listExp": "missing.value", "listExpAst": exp("listExpAst", "this.missing.value"), "item": "item" }]);
    let mut slot_list = failed_list.clone();
    slot_list["name"] = json!("slotList");
    slot_list["forStack"][0]["listExp"] = json!("slotData.rows");
    let (code, _) = output(
        json!({"classStyleBindings":[failed_class,failed_binding,slot_binding,failed_list,slot_list]}),
        "({})",
    );
    execute(
        &code,
        "const errors=[];console.error=(...args)=>errors.push(args);assert.equal(output.computed.failedClass.call({}),'fallback');assert.equal(output.computed.failedBinding.call({}),undefined);assert.equal(output.computed.slotBinding.call({}),undefined);assert.deepEqual(output.computed.failedList.call({}),[]);assert.deepEqual(output.computed.slotList.call({}),[]);assert.equal(errors.length,2);assert.match(errors[0][0],/failedBinding/);assert.match(errors[1][0],/missing.value/);",
    );
}

#[test]
fn preserves_original_component_node_spans_and_clears_generated_spans() {
    let allocator = Allocator::default();
    let source = "({computed: existing, methods: {original: handler}})";
    let mut parsed = expression::parse(&allocator, source).unwrap();
    let Expression::ObjectExpression(object) = &mut parsed else {
        unreachable!()
    };
    let original_span = object.span;
    let plan = build(
        &json!({"classStyleBindings":[binding("class","1")],"inlineExpressions":[inline()]}),
        &symbols(),
    )
    .unwrap();
    apply_to_component(plan, object, &allocator).unwrap();
    assert_eq!(object.span, original_span);
    use oxc_ast_visit::{Visit, walk};
    struct Identifiers(Vec<(String, oxc_span::Span)>);
    impl<'a> Visit<'a> for Identifiers {
        fn visit_identifier_reference(&mut self, id: &oxc_ast::ast::IdentifierReference<'a>) {
            self.0.push((id.name.to_string(), id.span));
            walk::walk_identifier_reference(self, id);
        }
    }
    let mut references = Identifiers(Vec::new());
    references.visit_expression(&parsed);
    for (name, span) in references.0 {
        if name == "existing" || name == "handler" {
            assert_eq!(&source[span.start as usize..span.end as usize], name);
        } else {
            assert_eq!(
                span,
                oxc_span::SPAN,
                "generated {name} must not map to source offset"
            );
        }
    }
}
