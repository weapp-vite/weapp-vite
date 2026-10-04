use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;
use serde_json::json;

use super::{collect, resolve};
use crate::script_transform::{request::Request, rewrite::RewriteContract};

fn request() -> Request {
    Request {
        options: json!({"isPage":true}),
        contract: json!({
            "markers":{"WEVU_DEFINE_PAGE_META_MACRO":"definePageMeta"},
            "runtime":{
                "apis":{"defineAppSetup":"defineAppSetup", "defineComponent":"defineComponent"},
                "pageFeatureModules":["wevu", "wevu/router", "wevu/dev/router"],
                "pageHookToFeature":{"onShareAppMessage":"enableOnShareAppMessage", "onShareTimeline":"enableOnShareTimeline"},
                "capabilityOrder":["patchStrategy", "setDataHighFrequencyWarning"],
                "capabilityInstallers":{}
            }
        }),
        omitted_undefined: Vec::new(),
    }
}

fn contract() -> RewriteContract {
    RewriteContract {
        define_component: "defineComponent".to_owned(),
        public_module: "wevu".to_owned(),
        recognized_modules: ["wevu".to_owned()].into(),
        runtime_import_routes: Default::default(),
        movable_wevu_imports: Default::default(),
        moved_vue_imports: Default::default(),
        template_component_names: Default::default(),
    }
}

fn flags(source: &str) -> Result<Vec<String>, String> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, SourceType::ts()).parse();
    assert!(parsed.diagnostics.is_empty(), "{:?}", parsed.diagnostics);
    collect(&parsed.program, &request(), &contract()).map(|facts| facts.flags)
}

#[test]
fn router_entry_hooks_follow_contract_and_keep_encounter_order() {
    for module in ["wevu/router", "wevu/dev/router"] {
        let source = format!("import {{onShareAppMessage as share, onShareTimeline as timeline}} from '{module}'; export default {{setup(){{timeline?.(()=>({{}}));share(()=>({{}}));return {{}}}}}};");
        assert_eq!(flags(&source).unwrap(), ["enableOnShareTimeline", "enableOnShareAppMessage"]);
    }
    assert!(flags("import {onShareAppMessage} from './unrelated'; onShareAppMessage(); export default {};").unwrap().is_empty());
}

#[test]
fn router_namespace_hooks_match_production_optional_call_boundaries() {
    assert_eq!(flags("import * as router from 'wevu/router'; router.onShareAppMessage?.(); export default {};").unwrap(), ["enableOnShareAppMessage"]);
    assert!(flags("import * as router from 'wevu/router'; router?.onShareAppMessage(); export default {};").unwrap().is_empty());
    assert!(flags("import * as router from 'wevu/router'; router['onShareAppMessage'](); export default {};").unwrap().is_empty());
}

#[test]
fn retains_production_type_only_hook_collection() {
    assert_eq!(flags("import type {onShareAppMessage as hook} from 'wevu/router'; hook(); export default {};").unwrap(), ["enableOnShareAppMessage"]);
    assert_eq!(flags("import {type onShareAppMessage as hook} from 'wevu'; hook(); export default {};").unwrap(), ["enableOnShareAppMessage"]);
}

#[test]
fn rejects_unimplemented_macros_import_aliases_and_escaped_references() {
    for source in [
        "definePageMeta({}); export default {};",
        "defineAppSetup(()=>({})); export default {};",
        "import {definePageMeta as meta} from 'wevu'; meta({}); export default {};",
        "import {defineAppSetup as setupApp} from 'wevu'; setupApp(()=>({})); export default {};",
        "const alias = definePageMeta; alias({}); export default {};",
        "import {'definePageMeta' as meta} from 'wevu'; meta({}); export default {};",
    ] {
        assert!(flags(source).is_err(), "{source}");
    }
}

#[test]
fn rejects_duplicate_set_data_options_instead_of_accumulating_overridden_capabilities() {
    let allocator = Allocator::default();
    for source in [
        "{setData:{strategy:'patch',strategy:'full'}}",
        "{setData:{highFrequencyWarning:true,highFrequencyWarning:false}}",
    ] {
        let expression = Parser::new(&allocator, source, SourceType::mjs()).parse_expression().unwrap();
        let oxc_ast::ast::Expression::ObjectExpression(object) = expression else { panic!() };
        let error = resolve(&object, &request()).unwrap_err();
        assert!(error.contains("duplicate setData"), "{error}");
    }
}
