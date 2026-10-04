use oxc_allocator::Allocator;
use oxc_ast::ast::Statement;
use oxc_ast::builder::AstBuilder;
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::{SPAN, SourceType};

use super::{RewriteContract, prepare_program};

fn contract() -> RewriteContract {
    RewriteContract {
        define_component: "defineComponent".to_string(),
        public_module: "wevu".to_string(),
        recognized_modules: ["wevu", "wevu/internal/shared", "wevu/internal/instance"].into_iter().map(str::to_string).collect(),
        runtime_import_routes: [("ref", "wevu/internal/shared"), ("computed", "wevu/internal/shared"),
            ("useSlots", "wevu/internal/instance"), ("transformOn", "wevu/internal/shared")]
            .into_iter().map(|(key, value)| (key.to_string(), value.to_string())).collect(),
        movable_wevu_imports: ["ref", "computed", "useSlots"].into_iter().map(str::to_string).collect(),
        moved_vue_imports: ["useSlots"].into_iter().map(str::to_string).collect(),
        template_component_names: Default::default(),
    }
}

fn rewrite_with_contract(source: &str, contract: &RewriteContract) -> Result<(String, bool), String> {
    let allocator = Allocator::default();
    let mut parsed = Parser::new(&allocator, source, SourceType::ts()).parse();
    assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
    let built = SemanticBuilder::new().with_check_syntax_error(true).build(&parsed.program);
    assert!(built.diagnostics.is_empty(), "{:?}", built.diagnostics);
    let scoping = built.semantic.into_scoping();
    let prepared = prepare_program(&mut parsed.program, &allocator, contract, &scoping)?;
    if let Some(expression) = prepared.expression {
        parsed.program.body.insert(prepared.default_export_index.unwrap(), Statement::new_export_default_declaration(
            SPAN, expression.into(), &AstBuilder::new(&allocator),
        ));
    }
    let code = Codegen::new().build(&parsed.program).code;
    let validation_allocator = Allocator::default();
    let validation = Parser::new(&validation_allocator, &code, SourceType::mjs()).parse();
    assert!(validation.diagnostics.is_empty(), "{code}\n{:?}", validation.diagnostics);
    Ok((code, prepared.uses_slots))
}

pub(super) fn rewrite(source: &str) -> (String, bool) {
    rewrite_with_contract(source, &contract()).unwrap()
}

#[test]
fn erases_types_enums_namespaces_and_generic_syntax_without_lowering() {
    let (code, _) = rewrite(r#"
import type { Removed } from './types';
import { type Other, useful } from './values';
interface Item { value: number }
type Choice = Item | null;
enum Mode { A = 1, B }
namespace Private { export const removed = true }
export default {
  setup(this: unknown, { value }: { value?: number }) {
    const list: Item[] = useful<Item[]>([]) as Item[];
    const copy = (item?: Item): number => item!.value;
    return { list, copy, value } satisfies object;
  }
}
"#);
    for removed in ["./types", "Other", "interface", "type Choice", "Mode", "Private", "satisfies", "useful<Item", "this:", "Item"] {
        assert!(!code.contains(removed), "unexpected {removed}: {code}");
    }
    assert!(code.contains("import { useful }"));
    assert!(code.contains("item.value"));
}

#[test]
fn renames_expose_before_removing_empty_generated_calls_and_respects_shadowing() {
    let (code, _) = rewrite(r#"
export default { __name: 'page', setup(_, { expose: __expose }) {
  __expose(); __expose({ count: 1 });
  const capture = { __expose };
  ({ __expose } = capture);
  ({ __expose = __expose } = capture);
  function inner(__expose) { __expose({ local: true }); }
  const __returned__ = { capture, inner };
  Object.defineProperty(__returned__, '__isScriptSetup', { value: true });
  return __returned__;
} };
"#);
    assert!(code.contains("{ expose }"), "{code}");
    assert!(code.contains("expose();"), "{code}");
    assert!(code.contains("__expose: expose"), "{code}");
    assert!(code.contains("__expose: expose = expose"), "{code}");
    assert!(code.contains("function inner(__expose)"), "{code}");
    assert!(!code.contains("__isScriptSetup"));
    assert!(!code.contains("__name"));
}

#[test]
fn keeps_expose_alias_when_an_expose_binding_exists() {
    let (code, _) = rewrite("const expose = 1; export default { setup(_, { expose: __expose }) { __expose(); __expose({ expose }); } }");
    assert!(code.contains("expose: __expose"), "{code}");
    assert!(!code.contains("__expose();"), "{code}");
    assert!(code.contains("__expose({ expose })"), "{code}");
}

#[test]
fn applies_vue_cleanup_to_computed_identifier_keys_like_the_existing_visitors() {
    let (code, _) = rewrite(r#"
export default { setup() {
  const values = { [__name]: 1, ['__name']: 2, retained: 3 };
  const nested = { [setup](_, { expose: __expose }) { __expose({ retained: true }); } };
  return { values, nested };
} };
"#);
    assert!(!code.contains("__name"), "{code}");
    assert!(!code.contains("__expose"), "{code}");
    assert!(code.contains("[setup](_, { expose })"), "{code}");
    assert!(code.contains("retained: 3"), "{code}");
}

#[test]
fn routes_imports_and_preserves_unrecognized_default_namespace_and_string_names() {
    let (code, uses_slots) = rewrite(r#"
import { defineComponent as _defineComponent, useSlots as slots, ref as vueRef } from 'vue';
import wevuDefault, { ref as value, computed, mystery, 'ref' as stringRef, type Removed } from 'wevu';
import * as namespace from 'wevu';
import './side-effect';
import helper from '@vue/babel-helper-vue-transform-on';
export default _defineComponent({ setup() { return { slots: slots(), value, computed, vueRef, wevuDefault, mystery, namespace, stringRef, helper }; } });
"#);
    assert!(uses_slots);
    assert!(code.contains("import { ref as value, computed, transformOn as helper } from \"wevu/internal/shared\""), "{code}");
    assert!(code.contains("import { useSlots as slots } from \"wevu/internal/instance\""), "{code}");
    assert!(code.contains("import { ref as vueRef } from \"vue\""), "{code}");
    assert!(code.contains("import * as namespace from \"wevu\""), "{code}");
    assert!(code.contains("./side-effect"));
    assert!(!code.contains("defineComponent"));
    assert!(!code.contains("Removed"));
}

#[test]
fn extracts_component_aliases_and_object_assign_metadata_target() {
    let (code, _) = rewrite("const source = defineComponent({ setup() { return {}; } }); export default source;");
    assert!(!code.contains("defineComponent"), "{code}");
    assert!(code.contains("export default {"), "{code}");
    let (code, _) = rewrite("export default Object.assign({ base: true }, { setup() { return {}; } });");
    assert!(code.contains("export default Object.assign("), "{code}");
}

#[test]
fn removes_fully_type_only_export_lists_and_preserves_explicit_empty_export() {
    let (code, _) = rewrite("type Foo = number; export { type Foo }; export type { Other } from './types'; export { type Remote } from './remote'; export {}; export const keep = true;");
    assert!(!code.contains("Foo"), "{code}");
    assert!(!code.contains("./types"), "{code}");
    assert!(!code.contains("./remote"), "{code}");
    assert!(code.contains("export {};"), "{code}");
    assert!(code.contains("export const keep = true;"), "{code}");
}

#[test]
fn reuses_existing_runtime_imports_without_duplicate_specifiers() {
    let (code, _) = rewrite("import { ref } from 'wevu'; import { computed } from 'wevu/internal/shared'; export default { setup() { return { ref, computed }; } };");
    assert_eq!(code.matches("from \"wevu/internal/shared\"").count(), 1, "{code}");
    assert!(code.contains("{ computed, ref }"), "{code}");
}

#[test]
fn rejects_unknown_routes_and_unproven_alias_clone_order() {
    let mut routing = contract();
    routing.runtime_import_routes.remove("ref");
    let error = rewrite_with_contract("import { ref } from 'wevu'; export default {};", &routing).unwrap_err();
    assert!(error.contains("Missing runtime import route for ref"));
    for source in [
        "const component = { setup() { const value: number = 1; return { value }; } }; export default component;",
        "const component = { __name: 'page' }; export default defineComponent(component);",
        "const component = { setup(_, { expose: __expose }) { __expose(); return {}; } }; export default component;",
    ] {
        let error = rewrite_with_contract(source, &contract()).unwrap_err();
        assert!(error.contains("clone-order parity"), "{error}");
    }
}
