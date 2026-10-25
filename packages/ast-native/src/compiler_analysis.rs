use std::collections::HashMap;

use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_ast::ast::{
    Expression, ImportDeclarationSpecifier, ImportOrExportKind, ModuleExportName, Program,
    Statement,
};
use oxc_ast_visit::{Visit, walk};

use crate::parse_program;

mod components;
use components::{NativeCompilerRegisteredComponent, collect_registered_components};
mod reserved_props;
use reserved_props::{NativeReservedPropsDiagnostic, ReservedPropsAnalysis};

#[napi(object)]
pub struct NativeCompilerScriptInput {
    pub code: Utf16String,
    pub filename: Option<String>,
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
    pub define_options_statements: Vec<NativeCompilerScriptSpan>,
    pub registered_components: Option<Vec<NativeCompilerRegisteredComponent>>,
    pub reserved_props_diagnostic: Option<NativeReservedPropsDiagnostic>,
}

#[derive(Default)]
struct CompilerDiagnosticVisitor {
    has_lone_surrogate_literal: bool,
    has_default_export: bool,
    has_ts_module_declaration: bool,
    reserved_props: ReservedPropsAnalysis,
}

impl<'a> Visit<'a> for CompilerDiagnosticVisitor {
    fn visit_export_default_declaration(
        &mut self,
        export: &oxc_ast::ast::ExportDefaultDeclaration<'a>,
    ) {
        // 只为受支持源码收集事实；模块声明由整项 fallback 保留原 Babel 语义。
        self.has_default_export = true;
        walk::walk_export_default_declaration(self, export);
    }

    fn visit_ts_external_module_declaration(
        &mut self,
        _module: &oxc_ast::ast::TSExternalModuleDeclaration<'a>,
    ) {
        // 原 Babel 消费者遍历模块内的导入和默认导出，顶层摘要不能证明同等语义。
        // 整项交回原路径，避免回退组件注册时仍复用不完整的导入摘要。
        self.has_ts_module_declaration = true;
    }

    fn visit_ts_namespace_declaration(
        &mut self,
        _module: &oxc_ast::ast::TSNamespaceDeclaration<'a>,
    ) {
        self.has_ts_module_declaration = true;
    }

    fn visit_ts_global_declaration(&mut self, _module: &oxc_ast::ast::TSGlobalDeclaration<'a>) {
        self.has_ts_module_declaration = true;
    }

    fn visit_string_literal(&mut self, literal: &oxc_ast::ast::StringLiteral<'a>) {
        // Oxc JSStr 保留孤立代理项，不能通过 Rust String 无损返回 JS。
        // 校验解析后的值，覆盖模块名、导入名、属性键及宏字符串。
        self.has_lone_surrogate_literal |= !literal.is_string_well_formed_unicode();
    }

    fn visit_call_expression(&mut self, call: &oxc_ast::ast::CallExpression<'a>) {
        self.reserved_props.inspect_call(call);
        walk::walk_call_expression(self, call);
    }
}

fn module_export_name(name: &ModuleExportName<'_>) -> Option<String> {
    match name {
        ModuleExportName::IdentifierName(value) => Some(value.name.to_string()),
        ModuleExportName::IdentifierReference(value) => Some(value.name.to_string()),
        ModuleExportName::StringLiteral(value) => value.value.as_str().map(str::to_owned),
    }
}

fn collect_imports(program: &Program<'_>) -> Option<Vec<NativeCompilerScriptImport>> {
    let mut imports = Vec::new();
    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };
        let source = import.source.value.as_str()?.to_owned();
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
    Some(imports)
}

fn analyze_compiler_script_program(
    program: &Program<'_>,
    code: &str,
) -> Option<NativeCompilerScriptAnalysis> {
    let mut diagnostics = CompilerDiagnosticVisitor::default();
    diagnostics.visit_program(program);
    if diagnostics.has_lone_surrogate_literal || diagnostics.has_ts_module_declaration {
        return None;
    }
    Some(NativeCompilerScriptAnalysis {
        imports: collect_imports(program)?,
        has_default_export: diagnostics.has_default_export,
        define_options_statements: collect_define_options_statements(program, code),
        registered_components: collect_registered_components(program),
        reserved_props_diagnostic: diagnostics.reserved_props.finish(code),
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
        // 有恢复诊断的 AST 不能证明宏诊断完整，逐项交回原编译器处理。
        let Some(program) = parse_program(&allocator, &code, filename, true) else {
            continue;
        };
        let analysis = analyze_compiler_script_program(&program, &code);
        for index in matching {
            results[index] = analysis.clone();
        }
    }
    results
}

#[cfg(test)]
mod default_export_tests;
#[cfg(test)]
mod tests;
