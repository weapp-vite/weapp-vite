use std::{path::Path, process::Command};

use super::tests::rewrite;

/// 直接比较现有 TS transformScript 的 setup AST，覆盖其 visitor 次序而非手写 Rust 期望。
fn assert_setup_matches_typescript(source: &str) {
    let (native, _) = rewrite(source);
    let source = serde_json::to_string(source).unwrap();
    let native = serde_json::to_string(&native).unwrap();
    let script = format!(r#"
import assert from 'node:assert/strict';
import {{ transformScript }} from './packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript/index.ts';
import {{ parse }} from '@weapp-vite/ast/babel';
import * as t from '@weapp-vite/ast/babelTypes';
const baseline = transformScript({source}, {{ skipComponentTransform:true, sourceMap:false }}).code;
const ignored = new Set(['start','end','loc','extra','leadingComments','trailingComments','innerComments']);
const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !ignored.has(key)).map(([key,item]) => [key,normalize(item)])) : value;
function setups(code) {{
  const found=[];
  t.traverseFast(parse(code,{{sourceType:'module'}}), node => {{
    if(t.isObjectMethod(node) && (t.isIdentifier(node.key,{{name:'setup'}}) || t.isStringLiteral(node.key,{{value:'setup'}}))) found.push(normalize(node));
  }});
  assert.ok(found.length > 0, code);
  return found;
}}
assert.deepEqual(setups({native}), setups(baseline));
"#);
    let result = Command::new("node")
        .args(["--import", "tsx", "--input-type=module", "-e", &script])
        .current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join("../.."))
        .output()
        .expect("Node and workspace dependencies are required for expose parity");
    assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stderr));
}

#[test]
fn explicit_this_parameter_preserves_original_context_position_until_type_cleanup() {
    assert_setup_matches_typescript("export default {setup(this: unknown, props, {expose:__expose}) {__expose();__expose({value:1});return {}}}");
    assert_setup_matches_typescript("export default {setup(this: unknown, {expose:__expose}) {__expose();__expose({value:1});return {}}}");
}

#[test]
fn type_names_do_not_block_value_renaming_or_hide_outer_value_bindings() {
    for source in [
        "type expose = string; export default {setup(_, {expose:__expose}){__expose();__expose({value:1});return {}}}",
        "interface expose {} export default {setup(_, {expose:__expose}){__expose();__expose({value:1});return {}}}",
        "import type {expose} from './types'; export default {setup(_, {expose:__expose}){__expose();__expose({value:1});return {}}}",
        "export default {setup<expose>(_, {expose:__expose}){__expose();__expose({value:1});return {}}}",
        "const expose = 1; export default {setup(_, {expose:__expose}){type expose = string;__expose();__expose({value:1});return {}}}",
    ] {
        assert_setup_matches_typescript(source);
    }
}
