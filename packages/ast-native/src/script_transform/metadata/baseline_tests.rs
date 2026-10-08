use std::{path::Path, process::Command};

use serde_json::{Value, json};

use super::tests::{execute, output};

// 直接调用当前 TypeScript 实现作为 oracle，避免冻结一份手写期望重复 Rust 的实现错误。
fn baseline(options: &Value, component: &str) -> String {
    let script = format!(
        r#"
import {{ WEVU_INLINE_MAP_KEY }} from '@weapp-core/constants';
import {{ generate }} from './packages-runtime/wevu-compiler/src/utils/babel.ts';
import {{ parseBabelExpression }} from './packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/parse.ts';
import {{ injectClassStyleComputed }} from './packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite/classStyle.ts';
import {{ injectInlineExpressions }} from './packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/rewrite/inlineExpressions.ts';
const options = {options};
const expressionKeys = new Set(['expAst','rawExpAst','listExpAst','rawListExpAst','projectedListExpAst']);
const decode = value => {{
  if (Array.isArray(value)) return value.map(decode);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,expressionKeys.has(key) ? parseBabelExpression(item.source) : decode(item)]));
}};
const decoded = decode(options);
const component = parseBabelExpression({component});
if(decoded.classStyleBindings?.length) injectClassStyleComputed(component,decoded.classStyleBindings);
if(decoded.inlineExpressions?.length) injectInlineExpressions(component,decoded.inlineExpressions);
process.stdout.write(JSON.stringify({{ code:generate(component).code, mapKey:WEVU_INLINE_MAP_KEY }}));
"#,
        options = options,
        component = serde_json::to_string(component).unwrap()
    );
    let result = Command::new("node")
        .args(["--import", "tsx", "--input-type=module", "-e", &script])
        .current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join("../.."))
        .output()
        .expect("Node and workspace dependencies are required for metadata parity");
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let result: Value = serde_json::from_slice(&result.stdout).unwrap();
    format!(
        "(()=>{{const __wevuUnref=unref,__wevuResolvePropValue=resolvePropValue,__wevuNormalizeClass=normalizeClass,__wevuNormalizeStyle=normalizeStyle;const component=({});if(component.methods)component.methods.inlineMap=component.methods[{}];return component;}})()",
        result["code"].as_str().unwrap(),
        result["mapKey"]
    )
}

#[test]
fn agrees_with_current_typescript_for_both_complete_metadata_inputs() {
    for fixture in [
        include_str!("fixtures/sfc-wevu.json"),
        include_str!("fixtures/sfc-retail.json"),
    ] {
        let options: Value = serde_json::from_str(fixture).unwrap();
        let (native, _) = output(options.clone(), "({})");
        let baseline = baseline(&options, "({})");
        let native = format!(
            "(()=>{{const __wevuUnref=unref,__wevuResolvePropValue=resolvePropValue;return {native}}})()"
        );
        let assertions = format!(
            r#"
const baseline={baseline};
function observe(component) {{
  const errors=[];const warnings=[];
  console.error=(...args)=>errors.push(args.map(value=>value instanceof Error ? value.name : value));
  console.warn=(...args)=>warnings.push(args);
  const contexts=[
    {{filterList:[{{key:'all'}},{{key:'x'}}],activeCategory:'all',selectedAttrStr:'',commentsStatistics:{{commentCount:4}},commentsList:[{{goodsSpu:'a'}},{{goodsSpu:0}},null,4]}},
    {{filterList:{{first:{{key:'all'}},second:{{key:'x'}}}},activeCategory:'x',selectedAttrStr:'red',commentsStatistics:{{commentCount:1}},commentsList:{{first:{{goodsSpu:'a'}},second:{{goodsSpu:''}}}}}},
    {{filterList:2.9,activeCategory:'none',selectedAttrStr:false,commentsStatistics:{{commentCount:0}},commentsList:[]}},
    {{filterList:null,activeCategory:'none',selectedAttrStr:null,commentsStatistics:{{commentCount:1}},commentsList:[{{__wv_key_0:'conflict',goodsSpu:'own'}}]}}
  ];
  const computed=contexts.map(context=>Object.fromEntries(Object.entries(component.computed).map(([name,fn])=>[name,fn.call(context)])));
  const context=new Proxy({{}},{{get:(_,method)=>(...args)=>[method,args]}});
  const scope={{filter:{{key:'all'}},category:{{demoPath:'/demo',key:'expanded'}}}};
  const inline=Object.entries(component.methods.inlineMap).map(([id,entry])=>[id,entry.keys,entry.indexKeys,entry.scopeResolvers,entry.fn(context,scope,{{detail:3}})]);
  return {{computed,inline,errors,warnings}};
}}
assert.deepEqual(observe(output),observe(baseline));
"#
        );
        execute(&native, &assertions);
    }
}

#[test]
fn agrees_with_typescript_for_nested_loops_and_raw_projected_conditions() {
    let expression = |role: &str, source: &str| json!({"role":role,"source":source});
    for kind in ["class", "style", "bind"] {
        for diagnostic in ["rows", "v-for :key item.id"] {
            let options = json!({"classStyleBindings":[{
                "name":"generated","type":kind,"exp":diagnostic,"expAst":expression("expAst","[item,rowKey,rowIndex,cell,column]"),"errorFallback":"fallback",
                "forStack":[
                    {"listExp":"rows","listExpAst":expression("listExpAst","this.rows"),"rawListExpAst":expression("rawListExpAst","this.raw"),"projectedListExpAst":expression("projectedListExpAst","this.projected"),"item":"item","key":"rowKey","index":"rowIndex"},
                    {"listExp":"item.cells","listExpAst":expression("listExpAst","item.cells"),"item":"cell","index":"column"}
                ],
                "conditions":[
                    {"forDepth":0,"expAst":expression("expAst","this.visible"),"rawExpAst":expression("rawExpAst","true")},
                    {"forDepth":1,"expAst":expression("expAst","item.visible")},
                    {"forDepth":2,"expAst":expression("expAst","cell !== 2")}
                ]
            }]});
            let (native, _) = output(options.clone(), "({})");
            let baseline = baseline(&options, "({})");
            execute(
                &native,
                &format!(
                    "const baseline={baseline};for(const visible of [true,false]){{const rows=[{{visible:true,cells:[1,2,3]}},{{visible:false,cells:null}}];const context={{rows,raw:rows,projected:{{first:rows[0]}},visible}};assert.deepEqual(output.computed.generated.call(context),baseline.computed.generated.call(context));}}"
                ),
            );
        }
    }
}
