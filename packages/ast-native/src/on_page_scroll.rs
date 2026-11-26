use std::collections::HashSet;

use napi_derive::napi;
use oxc_ast::ast::{
    Argument, ArrowFunctionBody, ArrowFunctionExpression, CallExpression, Expression, Function,
    FunctionBody, ImportDeclarationSpecifier, ModuleExportName, ObjectProperty, Program,
    PropertyKey, Statement,
};
use oxc_ast_visit::{Visit, walk};
use oxc_span::GetSpan;
use oxc_syntax::scope::ScopeFlags;

use crate::parse_program;

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeOnPageScrollDiagnostic {
    pub kind: String,
    pub line: u32,
    pub column: u32,
    pub source_label: String,
    pub sync_api: Option<String>,
}

struct LineStarts {
    starts: Vec<usize>,
}

impl LineStarts {
    fn new(code: &str) -> Self {
        let mut starts = vec![0];
        for (index, byte) in code.bytes().enumerate() {
            if byte == b'\n' || (byte == b'\r' && code.as_bytes().get(index + 1) != Some(&b'\n')) {
                starts.push(index + 1);
            }
        }
        Self { starts }
    }

    fn location(&self, code: &str, offset: u32) -> (u32, u32) {
        let offset = offset as usize;
        let line_index = match self.starts.binary_search(&offset) {
            Ok(index) => index,
            Err(index) => index.saturating_sub(1),
        };
        let line_start = self.starts[line_index];
        let column = code
            .get(line_start..offset)
            .map(|prefix| prefix.encode_utf16().count())
            .unwrap_or(offset - line_start);
        ((line_index + 1) as u32, (column + 1) as u32)
    }
}

struct Inspection {
    empty: bool,
    has_set_data_call: bool,
    sync_apis: Vec<String>,
}

struct PageScrollInspectionVisitor {
    inspection: Inspection,
}

impl PageScrollInspectionVisitor {
    fn new(empty: bool) -> Self {
        Self {
            inspection: Inspection {
                empty,
                has_set_data_call: false,
                sync_apis: Vec::new(),
            },
        }
    }
}

impl<'a> Visit<'a> for PageScrollInspectionVisitor {
    // 遍历从回调体开始，函数节点始终属于不应进入的嵌套作用域。
    fn visit_function(&mut self, _function: &Function<'a>, _flags: ScopeFlags) {}

    fn visit_arrow_function_expression(&mut self, _arrow: &ArrowFunctionExpression<'a>) {}

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if callee_name(&call.callee) == Some("setData") {
            self.inspection.has_set_data_call = true;
        }

        if let Expression::StaticMemberExpression(member) = &call.callee
            && is_identifier_expression(&member.object, "wx")
            && member.property.name.as_str().ends_with("Sync")
        {
            let sync_api = format!("wx.{}", member.property.name.as_str());
            if !self.inspection.sync_apis.contains(&sync_api) {
                self.inspection.sync_apis.push(sync_api);
            }
        }

        walk::walk_call_expression(self, call);
    }
}

struct OnPageScrollVisitor<'a> {
    code: &'a str,
    hook_names: HashSet<String>,
    namespace_imports: HashSet<String>,
    diagnostics: Vec<NativeOnPageScrollDiagnostic>,
    line_starts: &'a LineStarts,
}

impl<'a> OnPageScrollVisitor<'a> {
    fn report_function_body(&mut self, body: &FunctionBody<'a>, source_label: &str, start: u32) {
        let mut inspector = PageScrollInspectionVisitor::new(body.statements.is_empty());
        inspector.visit_function_body(body);
        self.report_inspection(inspector.inspection, source_label, start);
    }

    fn report_inspection(&mut self, inspection: Inspection, source_label: &str, start: u32) {
        // 所有告警按回调定位，以保持 Babel fallback 的显示位置。
        let (line, column) = self.line_starts.location(self.code, start);
        if inspection.empty {
            self.diagnostics.push(NativeOnPageScrollDiagnostic {
                kind: "empty".to_string(),
                line,
                column,
                source_label: source_label.to_string(),
                sync_api: None,
            });
        }
        if inspection.has_set_data_call {
            self.diagnostics.push(NativeOnPageScrollDiagnostic {
                kind: "setData".to_string(),
                line,
                column,
                source_label: source_label.to_string(),
                sync_api: None,
            });
        }

        for sync_api in inspection.sync_apis {
            self.diagnostics.push(NativeOnPageScrollDiagnostic {
                kind: "syncApi".to_string(),
                line,
                column,
                source_label: source_label.to_string(),
                sync_api: Some(sync_api),
            });
        }
    }

    fn report_function_expression(
        &mut self,
        function: &Function<'a>,
        source_label: &str,
        start: u32,
    ) {
        if let Some(body) = &function.body {
            self.report_function_body(body, source_label, start);
        }
    }

    fn report_arrow_function(
        &mut self,
        arrow: &ArrowFunctionExpression<'a>,
        source_label: &str,
        start: u32,
    ) {
        if let ArrowFunctionBody::FunctionBody(body) = &arrow.body {
            self.report_function_body(body, source_label, start);
            return;
        }

        let mut inspector = PageScrollInspectionVisitor::new(false);
        inspector.visit_arrow_function_body(&arrow.body);
        self.report_inspection(inspector.inspection, source_label, start);
    }
}

impl<'a> Visit<'a> for OnPageScrollVisitor<'a> {
    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        if static_property_name(&property.key) == Some("onPageScroll") {
            let start = if property.method {
                property.key.span().start
            } else {
                property.value.span().start
            };
            match &property.value {
                Expression::FunctionExpression(function) => {
                    self.report_function_expression(function, "onPageScroll", start);
                    return;
                }
                Expression::ArrowFunctionExpression(arrow) => {
                    self.report_arrow_function(arrow, "onPageScroll", start);
                    return;
                }
                _ => {}
            }
        }

        walk::walk_object_property(self, property);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if is_on_page_scroll_callee(&call.callee, &self.hook_names, &self.namespace_imports)
            && let Some(argument) = call.arguments.first()
        {
            match argument {
                Argument::FunctionExpression(function) => {
                    self.report_function_expression(
                        function,
                        "onPageScroll(...)",
                        function.span.start,
                    );
                    return;
                }
                Argument::ArrowFunctionExpression(arrow) => {
                    self.report_arrow_function(arrow, "onPageScroll(...)", arrow.span.start);
                    return;
                }
                _ => {}
            }
        }

        walk::walk_call_expression(self, call);
    }
}

fn collect_wevu_scroll_imports(program: &Program) -> (HashSet<String>, HashSet<String>) {
    let mut hook_names = HashSet::from(["onPageScroll".to_string()]);
    let mut namespace_imports = HashSet::new();

    for statement in &program.body {
        let Statement::ImportDeclaration(import_decl) = statement else {
            continue;
        };
        if import_decl.source.value.as_str() != Some("wevu") {
            continue;
        }
        let Some(specifiers) = &import_decl.specifiers else {
            continue;
        };
        for specifier in specifiers {
            match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(import_specifier)
                    if module_export_name(&import_specifier.imported) == Some("onPageScroll") =>
                {
                    hook_names.insert(import_specifier.local.name.as_str().to_string());
                }
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(namespace_specifier) => {
                    namespace_imports.insert(namespace_specifier.local.name.as_str().to_string());
                }
                _ => {}
            }
        }
    }

    (hook_names, namespace_imports)
}

fn module_export_name<'a>(name: &'a ModuleExportName<'a>) -> Option<&'a str> {
    match name {
        ModuleExportName::IdentifierName(value) => Some(value.name.as_str()),
        ModuleExportName::IdentifierReference(value) => Some(value.name.as_str()),
        ModuleExportName::StringLiteral(value) => value.value.as_str(),
    }
}

pub fn collect_on_page_scroll_diagnostics_from_program(
    program: &Program,
    code: &str,
) -> Vec<NativeOnPageScrollDiagnostic> {
    if !code.contains("onPageScroll") {
        return Vec::new();
    }

    let (hook_names, namespace_imports) = collect_wevu_scroll_imports(program);
    let line_starts = LineStarts::new(code);
    let mut visitor = OnPageScrollVisitor {
        code,
        hook_names,
        namespace_imports,
        diagnostics: Vec::new(),
        line_starts: &line_starts,
    };
    visitor.visit_program(program);
    visitor.diagnostics
}

#[napi(js_name = "collectOnPageScrollDiagnosticsNative")]
pub fn collect_on_page_scroll_diagnostics_native(
    code: String,
    filename: Option<String>,
) -> Vec<NativeOnPageScrollDiagnostic> {
    if !code.contains("onPageScroll") {
        return Vec::new();
    }

    let allocator = oxc_allocator::Allocator::default();
    let Some(program) = parse_program(&allocator, &code, filename, false) else {
        return Vec::new();
    };
    collect_on_page_scroll_diagnostics_from_program(&program, &code)
}

fn static_property_name<'a>(key: &'a PropertyKey<'a>) -> Option<&'a str> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.as_str()),
        PropertyKey::StaticStringLiteral(literal) => literal.value.as_str(),
        _ => None,
    }
}

fn callee_name<'a>(callee: &'a Expression<'a>) -> Option<&'a str> {
    match callee {
        Expression::Identifier(identifier) => Some(identifier.name.as_str()),
        Expression::StaticMemberExpression(member) => Some(member.property.name.as_str()),
        _ => None,
    }
}

fn is_identifier_expression(expression: &Expression, name: &str) -> bool {
    matches!(expression, Expression::Identifier(identifier) if identifier.name.as_str() == name)
}

fn is_on_page_scroll_callee(
    callee: &Expression,
    hook_names: &HashSet<String>,
    namespace_imports: &HashSet<String>,
) -> bool {
    match callee {
        Expression::Identifier(identifier) => hook_names.contains(identifier.name.as_str()),
        Expression::StaticMemberExpression(member) => {
            is_identifier_expression_set(&member.object, namespace_imports)
                && member.property.name.as_str() == "onPageScroll"
        }
        _ => false,
    }
}

fn is_identifier_expression_set(expression: &Expression, names: &HashSet<String>) -> bool {
    matches!(expression, Expression::Identifier(identifier) if names.contains(identifier.name.as_str()))
}
