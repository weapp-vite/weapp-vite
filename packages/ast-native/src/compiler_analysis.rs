use std::collections::HashMap;

use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_ast::ast::{
    Expression, ImportDeclarationSpecifier, ImportOrExportKind, ModuleExportName, Program,
    PropertyKind, Statement,
};
use oxc_ast_visit::{Visit, walk};

use crate::{NativeScriptAnalysis, analyze_script_program, parse_program, static_property_name};

mod components;
use components::{NativeCompilerRegisteredComponent, collect_registered_components};

#[napi(object)]
pub struct NativeCompilerScriptInput {
    pub code: Utf16String,
    pub filename: Option<String>,
    pub module_id: Option<String>,
    pub hook_to_feature_json: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeCompilerScriptImport {
    pub local: String,
    pub imported: Option<String>,
    pub source: String,
    pub kind: String,
    pub type_only: bool,
}

#[napi(object)]
#[derive(Clone)]
pub struct NativeCompilerScriptSpan {
    pub start: u32,
    pub end: u32,
}

#[napi(object)]
#[derive(Clone)]
pub struct NativeCompilerScriptAnalysis {
    pub imports: Vec<NativeCompilerScriptImport>,
    pub has_default_export: bool,
    pub define_options_name: Option<String>,
    pub define_options_statements: Vec<NativeCompilerScriptSpan>,
    pub registered_components: Option<Vec<NativeCompilerRegisteredComponent>>,
    pub is_mini_program_component: bool,
    pub has_static_require_literal: bool,
    pub has_platform_api_access: bool,
    pub feature_flags: Vec<String>,
}

struct MacroVisitor {
    define_options_name: Option<String>,
    is_mini_program_component: bool,
    has_lone_surrogate_literal: bool,
}

impl MacroVisitor {
    fn new() -> Self {
        Self {
            define_options_name: None,
            is_mini_program_component: false,
            has_lone_surrogate_literal: false,
        }
    }

    fn inspect_macro(&mut self, name: &str, argument: &Expression<'_>) {
        let Expression::ObjectExpression(object) = argument.without_parentheses() else {
            return;
        };
        for property in &object.properties {
            let oxc_ast::ast::ObjectPropertyKind::ObjectProperty(property) = property else {
                continue;
            };
            if property.kind != PropertyKind::Init || property.computed {
                continue;
            }
            let Some(key) = static_property_name(&property.key) else {
                continue;
            };
            if name == "defineOptions"
                && key == "name"
                && self.define_options_name.is_none()
                && let Expression::StringLiteral(value) = property.value.without_parentheses()
            {
                self.define_options_name = Some(value.value.to_string());
            }
            if name == "defineComponentJson"
                && key == "component"
                && matches!(property.value.without_parentheses(), Expression::BooleanLiteral(value) if value.value)
            {
                self.is_mini_program_component = true;
            }
        }
    }
}

impl<'a> Visit<'a> for MacroVisitor {
    fn visit_string_literal(&mut self, literal: &oxc_ast::ast::StringLiteral<'a>) {
        // Oxc 对孤立代理项使用内部编码，不能通过 Rust String 无损返回 JS。
        // 同一次遍历校验解析后的值，覆盖模块名、导入名、属性键及宏字符串。
        self.has_lone_surrogate_literal |= literal.lone_surrogates;
    }

    fn visit_call_expression(&mut self, call: &oxc_ast::ast::CallExpression<'a>) {
        if let Expression::Identifier(callee) = call.callee.without_parentheses()
            && let Some(argument) = call
                .arguments
                .first()
                .and_then(|value| value.as_expression())
        {
            self.inspect_macro(callee.name.as_str(), argument);
        }
        walk::walk_call_expression(self, call);
    }
}

fn module_export_name(name: &ModuleExportName<'_>) -> Option<String> {
    match name {
        ModuleExportName::IdentifierName(value) => Some(value.name.to_string()),
        ModuleExportName::IdentifierReference(value) => Some(value.name.to_string()),
        ModuleExportName::StringLiteral(value) => Some(value.value.to_string()),
    }
}

fn collect_imports(program: &Program<'_>) -> Vec<NativeCompilerScriptImport> {
    let mut imports = Vec::new();
    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };
        let source = import.source.value.to_string();
        for specifier in import.specifiers.iter().flatten() {
            let (local, imported, kind, type_only) = match specifier {
                ImportDeclarationSpecifier::ImportDefaultSpecifier(specifier) => (
                    specifier.local.name.to_string(),
                    Some("default".to_string()),
                    "default".to_string(),
                    import.import_kind == ImportOrExportKind::Type,
                ),
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(specifier) => (
                    specifier.local.name.to_string(),
                    None,
                    "namespace".to_string(),
                    import.import_kind == ImportOrExportKind::Type,
                ),
                ImportDeclarationSpecifier::ImportSpecifier(specifier) => (
                    specifier.local.name.to_string(),
                    module_export_name(&specifier.imported),
                    "named".to_string(),
                    import.import_kind == ImportOrExportKind::Type
                        || specifier.import_kind == ImportOrExportKind::Type,
                ),
            };
            imports.push(NativeCompilerScriptImport {
                local,
                imported,
                source: source.clone(),
                kind,
                type_only,
            });
        }
    }
    imports
}

fn analyze_compiler_script_program(
    program: &Program<'_>,
    code: &str,
    input: &NativeCompilerScriptInput,
) -> Option<NativeCompilerScriptAnalysis> {
    let mut macros = MacroVisitor::new();
    macros.visit_program(program);
    if macros.has_lone_surrogate_literal {
        return None;
    }
    let script_analysis: NativeScriptAnalysis = analyze_script_program(
        program,
        code,
        input.module_id.clone(),
        input.hook_to_feature_json.clone(),
    );
    Some(NativeCompilerScriptAnalysis {
        imports: collect_imports(program),
        has_default_export: program
            .body
            .iter()
            .any(|statement| matches!(statement, Statement::ExportDefaultDeclaration(_))),
        define_options_name: macros.define_options_name,
        define_options_statements: collect_define_options_statements(program, code),
        registered_components: collect_registered_components(program),
        is_mini_program_component: macros.is_mini_program_component,
        has_static_require_literal: script_analysis.has_static_require_literal,
        has_platform_api_access: script_analysis.has_platform_api_access,
        feature_flags: script_analysis.feature_flags,
    })
}

fn collect_define_options_statements(
    program: &Program<'_>,
    code: &str,
) -> Vec<NativeCompilerScriptSpan> {
    let mut spans = Vec::new();
    let mut previous_end = 0;
    let mut utf16_offset = 0;
    // Babel 默认折叠括号，但保留完整表达式语句的范围；类型包装不属于直接调用。
    for statement in &program.body {
        let Statement::ExpressionStatement(statement) = statement else {
            continue;
        };
        let Expression::CallExpression(call) = statement.expression.without_parentheses() else {
            continue;
        };
        if call.optional
            || !matches!(call.callee.without_parentheses(), Expression::Identifier(callee) if callee.name == "defineOptions")
        {
            continue;
        }
        let start = statement.span.start as usize;
        let end = statement.span.end as usize;
        utf16_offset += code[previous_end..start].encode_utf16().count() as u32;
        let utf16_start = utf16_offset;
        utf16_offset += code[start..end].encode_utf16().count() as u32;
        spans.push(NativeCompilerScriptSpan {
            start: utf16_start,
            end: utf16_offset,
        });
        previous_end = end;
    }
    spans
}

/// 编译器前端的粗粒度脚本摘要入口；每份源码只解析一次，不返回 AST。
#[napi(js_name = "analyzeCompilerScriptsNative")]
pub fn analyze_compiler_scripts_native(
    inputs: Vec<NativeCompilerScriptInput>,
) -> Vec<Option<NativeCompilerScriptAnalysis>> {
    let mut results: Vec<Option<NativeCompilerScriptAnalysis>> =
        (0..inputs.len()).map(|_| None).collect();
    let mut groups: HashMap<(String, Option<String>), Vec<usize>> = HashMap::new();
    for (index, input) in inputs.iter().enumerate() {
        let Ok(code) = String::from_utf16(&input.code) else {
            continue;
        };
        let key = (code, input.filename.clone());
        groups.entry(key).or_default().push(index);
    }

    for ((code, filename), matching) in groups {
        let allocator = oxc_allocator::Allocator::default();
        let Ok(program) = parse_program(&allocator, &code, filename) else {
            continue;
        };
        for index in matching {
            results[index] = analyze_compiler_script_program(&program, &code, &inputs[index]);
        }
    }
    results
}

#[cfg(test)]
mod tests;
