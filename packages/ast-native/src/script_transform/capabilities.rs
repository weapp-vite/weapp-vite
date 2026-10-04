use super::{
    fragments as f,
    request::{Request, string},
    rewrite::{RewriteContract, ensure_runtime_import},
};
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct SourceFacts {
    named: HashMap<String, String>,
    namespaces: HashSet<String>,
    hook_features: HashMap<String, String>,
    unsupported_macros: HashSet<String>,
    unsupported: Option<String>,
    pub flags: Vec<String>,
    pub bindings: HashSet<String>,
}
impl<'a> Visit<'a> for SourceFacts {
    fn visit_binding_identifier(&mut self, id: &BindingIdentifier<'a>) {
        self.bindings.insert(id.name.to_string());
    }
    fn visit_identifier_reference(&mut self, id: &IdentifierReference<'a>) {
        if self.unsupported_macros.contains(id.name.as_str()) {
            self.unsupported = Some(format!(
                "Compiler macro {} is not implemented in this experiment",
                id.name
            ));
        }
    }
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        let feature = match &call.callee {
            Expression::Identifier(id) => self.named.get(id.name.as_str()),
            Expression::StaticMemberExpression(m)
                if !m.optional
                    && matches!(&m.object, Expression::Identifier(id) if self.namespaces.contains(id.name.as_str())) =>
            {
                self.hook_features.get(m.property.name.as_str())
            }
            _ => None,
        };
        if let Some(feature) = feature
            && !self.flags.contains(feature)
        {
            self.flags.push(feature.clone());
        }
        walk::walk_call_expression(self, call);
    }
}

pub fn collect(
    program: &Program<'_>,
    request: &Request,
    contract: &RewriteContract,
) -> Result<SourceFacts, String> {
    let mut facts = SourceFacts {
        hook_features: serde_json::from_value(request.runtime()["pageHookToFeature"].clone())
            .map_err(|e| e.to_string())?,
        ..SourceFacts::default()
    };
    let page_meta = request.marker("WEVU_DEFINE_PAGE_META_MACRO")?;
    facts.unsupported_macros.insert(page_meta.clone());
    facts
        .unsupported_macros
        .insert(string(&request.runtime()["apis"], "defineAppSetup")?);
    let feature_modules: HashSet<String> = request
        .runtime()
        .get("pageFeatureModules")
        .map(|modules| serde_json::from_value(modules.clone()).map_err(|e| e.to_string()))
        .transpose()?
        .unwrap_or_default();
    let factory_names = [
        "createApp",
        "createWevuComponent",
        "createWevuScopedSlotComponent",
        "defineComponent",
        "setWevuDefaults",
    ];
    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };
        let runtime_module = contract
            .recognized_modules
            .contains(import.source.value.as_str());
        let feature_module =
            runtime_module || feature_modules.contains(import.source.value.as_str());
        if !feature_module {
            continue;
        }
        for specifier in import.specifiers.iter().flatten() {
            match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(specifier) => {
                    let value_import = import.import_kind != ImportOrExportKind::Type
                        && specifier.import_kind != ImportOrExportKind::Type;
                    if runtime_module
                        && value_import
                        && matches!(&specifier.imported,
                        ModuleExportName::IdentifierName(name) if facts.unsupported_macros.contains(name.name.as_str()))
                    {
                        return Err("Compiler macro imports and aliases are not implemented in this experiment".to_owned());
                    }
                    // 页面特性分析保留生产行为：其导入收集包含 type-only specifier。
                    if let ModuleExportName::IdentifierName(name) = &specifier.imported
                        && let Some(flag) = facts.hook_features.get(name.name.as_str())
                    {
                        facts
                            .named
                            .insert(specifier.local.name.to_string(), flag.clone());
                    }
                    if !runtime_module || !value_import {
                        continue;
                    }
                    let ModuleExportName::IdentifierName(name) = &specifier.imported else {
                        return Err("String-named runtime imports are deferred".to_owned());
                    };
                    if factory_names
                        .iter()
                        .any(|k| request.runtime()["apis"][k].as_str() == Some(name.name.as_str()))
                        || request.runtime()["capabilityInstallers"]
                            .as_object()
                            .is_some_and(|o| {
                                o.values().any(|v| v.as_str() == Some(name.name.as_str()))
                            })
                    {
                        return Err("Source runtime factories/installers require additional capability analysis".to_owned());
                    }
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(specifier) => {
                    if runtime_module && import.import_kind != ImportOrExportKind::Type {
                        return Err("Runtime namespace escape analysis is deferred".to_owned());
                    }
                    facts.namespaces.insert(specifier.local.name.to_string());
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {
                    if runtime_module && import.import_kind != ImportOrExportKind::Type {
                        return Err("Runtime default escape analysis is deferred".to_owned());
                    }
                }
            }
        }
    }
    facts.visit_program(program);
    if let Some(reason) = facts.unsupported.take() {
        return Err(reason);
    }
    if request.options["isPage"] != true {
        facts.flags.clear();
    }
    Ok(facts)
}

pub fn resolve(object: &ObjectExpression<'_>, request: &Request) -> Result<Option<Value>, String> {
    let order: Vec<String> = serde_json::from_value(request.runtime()["capabilityOrder"].clone())
        .map_err(|e| e.to_string())?;
    let mut required = HashSet::new();
    let mut conservative = HashSet::new();
    if let Some(metadata) = request.options.get("runtimeCapabilities") {
        for key in ["required", "conservative"] {
            if let Some(items) = metadata.get(key) {
                for value in items.as_array().ok_or("Invalid capability array")? {
                    let name = value.as_str().ok_or("Invalid capability name")?;
                    if !order.iter().any(|v| v == name) {
                        return Err("Unknown capability".to_owned());
                    }
                    if key == "required" {
                        required.insert(name.to_owned());
                    } else {
                        conservative.insert(name.to_owned());
                    }
                }
            }
        }
    }
    if request.options["inlineExpressions"]
        .as_array()
        .is_some_and(|v| !v.is_empty())
    {
        required.insert("inlineEvents".to_owned());
    }
    if required.contains("scopedSlots") {
        return Err("Scoped-slot component injection is deferred".to_owned());
    }
    if required.contains("layout") {
        required.insert("templateRefs".to_owned());
    }
    // 该边界先覆盖静态 direct options；复杂继承/别名由调用层整段回退。
    if let Some(set_data) = f::find(object, "setData") {
        let Expression::ObjectExpression(options) = &set_data.value else {
            return Err("Dynamic setData capabilities are deferred".to_owned());
        };
        if !super::component_options::safe_object(options) {
            return Err("Dynamic or duplicate setData options are deferred".to_owned());
        }
        for prop in &options.properties {
            let ObjectPropertyKind::ObjectProperty(prop) = prop else {
                return Err("Spread setData capabilities are deferred".to_owned());
            };
            if prop.computed || prop.method {
                return Err("Computed setData capabilities are deferred".to_owned());
            }
            match prop.key.static_name().as_deref() {
                Some("strategy") => match &prop.value {
                    Expression::StringLiteral(v) if v.value == "patch" => {
                        required.insert("patchStrategy".to_owned());
                    }
                    Expression::StringLiteral(_)
                    | Expression::BooleanLiteral(_)
                    | Expression::NullLiteral(_)
                    | Expression::NumericLiteral(_) => {}
                    _ => return Err("Non-literal setData strategy is deferred".to_owned()),
                },
                Some("highFrequencyWarning") => match &prop.value {
                    Expression::BooleanLiteral(v) if v.value => {
                        required.insert("setDataHighFrequencyWarning".to_owned());
                    }
                    Expression::BooleanLiteral(_)
                    | Expression::NullLiteral(_)
                    | Expression::StringLiteral(_)
                    | Expression::NumericLiteral(_) => {}
                    _ => return Err("Structured high-frequency warnings are deferred".to_owned()),
                },
                _ => {}
            }
        }
    }
    let sorted: Vec<_> = order
        .iter()
        .filter(|v| required.contains(*v))
        .cloned()
        .collect();
    if sorted.is_empty() {
        return Ok(None);
    }
    let conservative: Vec<_> = sorted
        .iter()
        .filter(|v| conservative.contains(*v))
        .cloned()
        .collect();
    let mut metadata = json!({"required": sorted});
    if !conservative.is_empty() {
        metadata["conservative"] = json!(conservative);
    }
    Ok(Some(metadata))
}

#[cfg(test)]
#[path = "capability_guard_tests.rs"]
mod tests;

pub fn install<'a>(
    program: &mut Program<'a>,
    request: &Request,
    contract: &RewriteContract,
    metadata: &Value,
    mut used: HashSet<String>,
    allocator: &'a Allocator,
) -> Result<(), String> {
    let mut calls = Vec::new();
    for capability in metadata["required"]
        .as_array()
        .ok_or("Missing required capabilities")?
    {
        let name = capability
            .as_str()
            .ok_or("Non-string required capability")?;
        let imported = string(&request.runtime()["capabilityInstallers"], name)?;
        let base = string(&request.runtime()["installerLocalNames"], name)?;
        let mut local = base.clone();
        let mut suffix = 2;
        while used.contains(&local) {
            local = format!("{base}{suffix}");
            suffix += 1;
        }
        used.insert(local.clone());
        ensure_runtime_import(program, allocator, contract, &imported, &local)?;
        calls.push(format!("{local}();"));
    }
    let at = program
        .body
        .iter()
        .take_while(|s| matches!(s, Statement::ImportDeclaration(_)))
        .count();
    for (offset, statement) in f::statements(&calls.join("\n"), allocator)?
        .into_iter()
        .enumerate()
    {
        program.body.insert(at + offset, statement);
    }
    Ok(())
}
