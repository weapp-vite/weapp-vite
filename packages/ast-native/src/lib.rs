use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
};

#[cfg(test)]
use std::cell::Cell;

use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, CallExpression, Expression, ImportDeclarationSpecifier, ModuleExportName, Program,
    PropertyKey, Statement,
};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::SourceType;

mod vue_sfc_signature;
pub use vue_sfc_signature::get_vue_sfc_signature_payload_native;

mod compiler_analysis;
mod npm_chunk_analysis;
mod on_page_scroll;
pub use on_page_scroll::NativeOnPageScrollDiagnostic;
#[cfg(test)]
mod script_analysis_tests;

#[cfg(test)]
thread_local! {
    pub static SCRIPT_PARSE_COUNT: Cell<usize> = const { Cell::new(0) };
}

#[napi(object)]
pub struct NativeScriptAnalysis {
    pub has_static_require_literal: bool,
    pub has_platform_api_access: bool,
    pub feature_flags: Vec<String>,
}

#[napi(object)]
pub struct NativeScriptAnalysisInput {
    pub code: String,
    pub module_id: Option<String>,
    pub hook_to_feature_json: Option<String>,
    pub filename: Option<String>,
}

fn parse_program<'a>(
    allocator: &'a Allocator,
    code: &'a str,
    filename: Option<String>,
    reject_diagnostics: bool,
) -> Option<Program<'a>> {
    #[cfg(test)]
    SCRIPT_PARSE_COUNT.with(|count| count.set(count.get() + 1));
    let filename = filename.unwrap_or_else(|| "inline.ts".to_string());
    let source_type =
        SourceType::from_path(Path::new(&filename)).unwrap_or_else(|_| SourceType::ts());
    let parsed = Parser::new(allocator, code, source_type).parse();
    if parsed.fatal_error || (reject_diagnostics && !parsed.diagnostics.is_empty()) {
        return None;
    }
    Some(parsed.program)
}

struct StaticRequireVisitor {
    found: bool,
}

impl<'a> Visit<'a> for StaticRequireVisitor {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if self.found {
            return;
        }
        if is_static_require_call(call) {
            self.found = true;
            return;
        }
        walk::walk_call_expression(self, call);
    }
}

#[napi(js_name = "mayContainStaticRequireLiteralNative")]
pub fn may_contain_static_require_literal_native(code: String, filename: Option<String>) -> bool {
    if !code.contains("require(") && !code.contains("require (") && !code.contains("require`") {
        return false;
    }
    let allocator = Allocator::default();
    let Some(program) = parse_program(&allocator, &code, filename, false) else {
        return false;
    };
    let mut visitor = StaticRequireVisitor { found: false };
    visitor.visit_program(&program);
    visitor.found
}

struct PlatformApiVisitor {
    found: bool,
}

impl<'a> Visit<'a> for PlatformApiVisitor {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if self.found {
            return;
        }
        if has_platform_api_member_expression(&call.callee) {
            self.found = true;
            return;
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_expression(&mut self, expression: &Expression<'a>) {
        if self.found {
            return;
        }
        if has_platform_api_member_expression(expression) {
            self.found = true;
            return;
        }
        walk::walk_expression(self, expression);
    }
}

#[napi(js_name = "mayContainPlatformApiAccessNative")]
pub fn may_contain_platform_api_access_native(code: String, filename: Option<String>) -> bool {
    if !may_contain_platform_api_text(&code) {
        return false;
    }
    let allocator = Allocator::default();
    let Some(program) = parse_program(&allocator, &code, filename, false) else {
        return false;
    };
    let mut visitor = PlatformApiVisitor { found: false };
    visitor.visit_program(&program);
    visitor.found
}

struct FeatureFlagVisitor {
    named_hook_locals: HashMap<String, String>,
    namespace_locals: HashSet<String>,
    hook_to_feature: HashMap<String, String>,
    enabled: BTreeMap<String, ()>,
}

struct ScriptAnalysisVisitor {
    has_static_require_literal: bool,
    has_platform_api_access: bool,
    feature_flags: Option<FeatureFlagVisitor>,
}

impl<'a> Visit<'a> for ScriptAnalysisVisitor {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if !self.has_static_require_literal && is_static_require_call(call) {
            self.has_static_require_literal = true;
        }

        if !self.has_platform_api_access && has_platform_api_member_expression(&call.callee) {
            self.has_platform_api_access = true;
        }

        if let Some(feature_flags) = &mut self.feature_flags {
            match &call.callee {
                Expression::Identifier(identifier) => {
                    feature_flags.consume_named(identifier.name.as_str());
                }
                Expression::StaticMemberExpression(member) => {
                    if let Expression::Identifier(object) = &member.object {
                        feature_flags
                            .consume_namespace(object.name.as_str(), member.property.name.as_str());
                    }
                }
                _ => {}
            }
        }

        walk::walk_call_expression(self, call);
    }

    fn visit_expression(&mut self, expression: &Expression<'a>) {
        if !self.has_platform_api_access && has_platform_api_member_expression(expression) {
            self.has_platform_api_access = true;
        }
        walk::walk_expression(self, expression);
    }
}

impl FeatureFlagVisitor {
    fn consume_named(&mut self, name: &str) {
        if let Some(feature) = self.named_hook_locals.get(name) {
            self.enabled.insert(feature.to_string(), ());
        }
    }

    fn consume_namespace(&mut self, namespace: &str, hook_name: &str) {
        if !self.namespace_locals.contains(namespace) {
            return;
        }
        if let Some(feature) = self.hook_to_feature.get(hook_name) {
            self.enabled.insert(feature.to_string(), ());
        }
    }
}

impl<'a> Visit<'a> for FeatureFlagVisitor {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        match &call.callee {
            Expression::Identifier(identifier) => {
                self.consume_named(identifier.name.as_str());
            }
            Expression::StaticMemberExpression(member) => {
                if let Expression::Identifier(object) = &member.object {
                    self.consume_namespace(object.name.as_str(), member.property.name.as_str());
                }
            }
            _ => {}
        }
        walk::walk_call_expression(self, call);
    }
}

#[napi(js_name = "collectFeatureFlagsNative")]
pub fn collect_feature_flags_native(
    code: String,
    module_id: String,
    hook_to_feature_json: String,
    filename: Option<String>,
) -> Vec<String> {
    if !code.contains(&module_id) {
        return Vec::new();
    }

    let Ok(hook_to_feature) =
        serde_json::from_str::<HashMap<String, String>>(&hook_to_feature_json)
    else {
        return Vec::new();
    };
    if hook_to_feature.is_empty() || !hook_to_feature.keys().any(|hook| code.contains(hook)) {
        return Vec::new();
    }

    let allocator = Allocator::default();
    let Some(program) = parse_program(&allocator, &code, filename, false) else {
        return Vec::new();
    };
    let (named_hook_locals, namespace_locals) =
        collect_feature_flag_imports(&program, &module_id, &hook_to_feature);
    if named_hook_locals.is_empty() && namespace_locals.is_empty() {
        return Vec::new();
    }

    let mut visitor = FeatureFlagVisitor {
        named_hook_locals,
        namespace_locals,
        hook_to_feature,
        enabled: BTreeMap::new(),
    };
    visitor.visit_program(&program);
    visitor.enabled.keys().cloned().collect()
}

#[napi(js_name = "analyzeScriptNative")]
pub fn analyze_script_native(
    code: String,
    module_id: Option<String>,
    hook_to_feature_json: Option<String>,
    filename: Option<String>,
) -> NativeScriptAnalysis {
    analyze_script_impl(&code, module_id, hook_to_feature_json, filename)
}

#[napi(js_name = "analyzeScriptsNative")]
pub fn analyze_scripts_native(inputs: Vec<NativeScriptAnalysisInput>) -> Vec<NativeScriptAnalysis> {
    let mut results: Vec<Option<NativeScriptAnalysis>> = (0..inputs.len()).map(|_| None).collect();
    let mut groups: HashMap<(String, Option<String>), Vec<usize>> = HashMap::new();
    for (index, input) in inputs.iter().enumerate() {
        groups
            .entry((input.code.clone(), input.filename.clone()))
            .or_default()
            .push(index);
    }

    for ((code, filename), matching) in groups {
        let allocator = Allocator::default();
        let Some(program) = parse_program(&allocator, &code, filename, false) else {
            for index in matching {
                results[index] = Some(NativeScriptAnalysis {
                    has_static_require_literal: false,
                    has_platform_api_access: false,
                    feature_flags: Vec::new(),
                });
            }
            continue;
        };
        for index in matching {
            let input = &inputs[index];
            results[index] = Some(analyze_script_program(
                &program,
                &code,
                input.module_id.clone(),
                input.hook_to_feature_json.clone(),
            ));
        }
    }

    results
        .into_iter()
        .map(|result| result.expect("native script analysis result must be populated"))
        .collect()
}

fn analyze_script_impl(
    code: &str,
    module_id: Option<String>,
    hook_to_feature_json: Option<String>,
    filename: Option<String>,
) -> NativeScriptAnalysis {
    let wants_static_require =
        code.contains("require(") || code.contains("require (") || code.contains("require`");
    let wants_platform_api = may_contain_platform_api_text(code);
    let feature_config = module_id
        .clone()
        .zip(hook_to_feature_json.clone())
        .and_then(|(module_id, hook_to_feature_json)| {
            if !code.contains(&module_id) {
                return None;
            }
            let hook_to_feature =
                serde_json::from_str::<HashMap<String, String>>(&hook_to_feature_json).ok()?;
            if hook_to_feature.is_empty() || !hook_to_feature.keys().any(|hook| code.contains(hook))
            {
                return None;
            }
            Some((module_id, hook_to_feature))
        });

    if !wants_static_require && !wants_platform_api && feature_config.is_none() {
        return NativeScriptAnalysis {
            has_static_require_literal: false,
            has_platform_api_access: false,
            feature_flags: Vec::new(),
        };
    }

    let allocator = Allocator::default();
    let Some(program) = parse_program(&allocator, code, filename, false) else {
        return NativeScriptAnalysis {
            has_static_require_literal: false,
            has_platform_api_access: false,
            feature_flags: Vec::new(),
        };
    };

    analyze_script_program(&program, code, module_id, hook_to_feature_json)
}

fn analyze_script_program(
    program: &Program,
    code: &str,
    module_id: Option<String>,
    hook_to_feature_json: Option<String>,
) -> NativeScriptAnalysis {
    let wants_static_require =
        code.contains("require(") || code.contains("require (") || code.contains("require`");
    let wants_platform_api = may_contain_platform_api_text(code);
    let feature_config =
        module_id
            .zip(hook_to_feature_json)
            .and_then(|(module_id, hook_to_feature_json)| {
                if !code.contains(&module_id) {
                    return None;
                }
                let hook_to_feature =
                    serde_json::from_str::<HashMap<String, String>>(&hook_to_feature_json).ok()?;
                if hook_to_feature.is_empty()
                    || !hook_to_feature.keys().any(|hook| code.contains(hook))
                {
                    return None;
                }
                Some((module_id, hook_to_feature))
            });

    let feature_flags = feature_config.and_then(|(module_id, hook_to_feature)| {
        let (named_hook_locals, namespace_locals) =
            collect_feature_flag_imports(program, &module_id, &hook_to_feature);
        if named_hook_locals.is_empty() && namespace_locals.is_empty() {
            return None;
        }
        Some(FeatureFlagVisitor {
            named_hook_locals,
            namespace_locals,
            hook_to_feature,
            enabled: BTreeMap::new(),
        })
    });

    let mut visitor = ScriptAnalysisVisitor {
        has_static_require_literal: false,
        has_platform_api_access: false,
        feature_flags,
    };
    visitor.visit_program(program);

    NativeScriptAnalysis {
        has_static_require_literal: wants_static_require && visitor.has_static_require_literal,
        has_platform_api_access: wants_platform_api && visitor.has_platform_api_access,
        feature_flags: visitor
            .feature_flags
            .map(|feature_flags| feature_flags.enabled.keys().cloned().collect())
            .unwrap_or_default(),
    }
}

fn collect_feature_flag_imports(
    program: &Program,
    module_id: &str,
    hook_to_feature: &HashMap<String, String>,
) -> (HashMap<String, String>, HashSet<String>) {
    let mut named_hook_locals = HashMap::new();
    let mut namespace_locals = HashSet::new();

    for statement in &program.body {
        let Statement::ImportDeclaration(import_decl) = statement else {
            continue;
        };
        if import_decl.source.value.as_str() != Some(module_id) {
            continue;
        }
        let Some(specifiers) = &import_decl.specifiers else {
            continue;
        };
        for specifier in specifiers {
            match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(import_specifier) => {
                    let Some(imported_name) = module_export_name(&import_specifier.imported) else {
                        continue;
                    };
                    let Some(feature) = hook_to_feature.get(imported_name) else {
                        continue;
                    };
                    named_hook_locals.insert(
                        import_specifier.local.name.as_str().to_string(),
                        feature.to_string(),
                    );
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(namespace_specifier) => {
                    namespace_locals.insert(namespace_specifier.local.name.as_str().to_string());
                }
                _ => {}
            }
        }
    }

    (named_hook_locals, namespace_locals)
}

fn module_export_name<'a>(name: &'a ModuleExportName<'a>) -> Option<&'a str> {
    match name {
        ModuleExportName::IdentifierName(identifier) => Some(identifier.name.as_str()),
        ModuleExportName::IdentifierReference(identifier) => Some(identifier.name.as_str()),
        ModuleExportName::StringLiteral(literal) => literal.value.as_str(),
    }
}

fn static_string_literal_value<'a>(expression: &'a Expression<'a>) -> Option<&'a str> {
    match expression {
        Expression::StringLiteral(literal) => literal.value.as_str(),
        Expression::TemplateLiteral(template)
            if template.expressions.is_empty() && template.quasis.len() == 1 =>
        {
            template.quasis[0].value.cooked.as_ref()?.as_str()
        }
        _ => None,
    }
}

// 布尔预判只检查语法形状，不要求 JS 字符串能无损转换为 Rust UTF-8。
fn is_static_string_literal(expression: &Expression<'_>) -> bool {
    match expression {
        Expression::StringLiteral(_) => true,
        Expression::TemplateLiteral(template) => {
            template.expressions.is_empty()
                && template.quasis.len() == 1
                && template.quasis[0].value.cooked.is_some()
        }
        _ => false,
    }
}

fn is_static_require_call(call: &CallExpression) -> bool {
    matches!(&call.callee, Expression::Identifier(identifier) if identifier.name.as_str() == "require")
        && call
            .arguments
            .first()
            .and_then(Argument::as_expression)
            .is_some_and(is_static_string_literal)
}

fn may_contain_platform_api_text(code: &str) -> bool {
    ["wx.", "my.", "tt.", "swan.", "jd.", "xhs."]
        .iter()
        .any(|needle| code.contains(needle))
}

pub(crate) fn static_property_name<'a>(key: &'a PropertyKey<'a>) -> Option<&'a str> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.as_str()),
        PropertyKey::StaticStringLiteral(literal) => literal.value.as_str(),
        _ => None,
    }
}

fn is_platform_api_identifier(name: &str) -> bool {
    matches!(name, "wx" | "my" | "tt" | "swan" | "jd" | "xhs")
}

fn has_platform_api_member_expression(expression: &Expression) -> bool {
    match expression {
        Expression::StaticMemberExpression(member) => {
            matches!(&member.object, Expression::Identifier(identifier) if is_platform_api_identifier(identifier.name.as_str()))
        }
        Expression::ComputedMemberExpression(member) => {
            matches!(&member.object, Expression::Identifier(identifier) if is_platform_api_identifier(identifier.name.as_str()))
                && is_static_string_literal(&member.expression)
        }
        _ => false,
    }
}
