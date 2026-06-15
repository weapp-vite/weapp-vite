use std::{
    collections::{BTreeMap, HashSet},
    path::Path,
};

use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, ArrowFunctionExpression, CallExpression, Expression, Function, FunctionBody,
    ImportDeclarationSpecifier, ModuleExportName, ObjectProperty, Program, PropertyKey, Statement,
};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType, Span};
use oxc_syntax::scope::ScopeFlags;

#[napi(object)]
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
            if byte == b'\n' {
                starts.push(index + 1);
            }
        }
        Self { starts }
    }

    fn location(&self, offset: u32) -> (u32, u32) {
        let offset = offset as usize;
        let line_index = match self.starts.binary_search(&offset) {
            Ok(index) => index,
            Err(index) => index.saturating_sub(1),
        };
        (
            (line_index + 1) as u32,
            (offset - self.starts[line_index] + 1) as u32,
        )
    }
}

struct Inspection {
    empty: bool,
    first_set_data_call_start: Option<u32>,
    sync_api_call_starts: BTreeMap<String, u32>,
}

struct PageScrollInspectionVisitor {
    root_span: Span,
    depth: usize,
    inspection: Inspection,
}

impl PageScrollInspectionVisitor {
    fn new(root: &FunctionBody) -> Self {
        Self {
            root_span: root.span,
            depth: 0,
            inspection: Inspection {
                empty: root.statements.is_empty(),
                first_set_data_call_start: None,
                sync_api_call_starts: BTreeMap::new(),
            },
        }
    }
}

impl<'a> Visit<'a> for PageScrollInspectionVisitor {
    fn visit_function(&mut self, function: &Function<'a>, _flags: ScopeFlags) {
        if self.depth > 0 || function.span != self.root_span {
            return;
        }
        walk::walk_function(self, function, ScopeFlags::Function);
    }

    fn visit_arrow_function_expression(&mut self, arrow: &ArrowFunctionExpression<'a>) {
        if self.depth > 0 || arrow.body.span != self.root_span {
            return;
        }
        walk::walk_arrow_function_expression(self, arrow);
    }

    fn visit_function_body(&mut self, body: &FunctionBody<'a>) {
        if self.depth > 0 && body.span != self.root_span {
            return;
        }

        self.depth += 1;
        walk::walk_function_body(self, body);
        self.depth -= 1;
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if callee_name(&call.callee) == Some("setData") {
            self.inspection
                .first_set_data_call_start
                .get_or_insert(call.callee.span().start);
        }

        if let Expression::StaticMemberExpression(member) = &call.callee
            && is_identifier_expression(&member.object, "wx")
            && member.property.name.as_str().ends_with("Sync")
        {
            self.inspection
                .sync_api_call_starts
                .entry(format!("wx.{}", member.property.name.as_str()))
                .or_insert(call.callee.span().start);
        }

        walk::walk_call_expression(self, call);
    }
}

struct OnPageScrollVisitor<'a> {
    hook_names: HashSet<String>,
    namespace_imports: HashSet<String>,
    diagnostics: Vec<NativeOnPageScrollDiagnostic>,
    line_starts: &'a LineStarts,
}

impl<'a> OnPageScrollVisitor<'a> {
    fn report_function_body(&mut self, body: &FunctionBody<'a>, source_label: &str, start: u32) {
        let mut inspector = PageScrollInspectionVisitor::new(body);
        inspector.visit_function_body(body);

        let (line, column) = self.line_starts.location(start);
        if inspector.inspection.empty {
            self.diagnostics.push(NativeOnPageScrollDiagnostic {
                kind: "empty".to_string(),
                line,
                column,
                source_label: source_label.to_string(),
                sync_api: None,
            });
        }
        if let Some(start) = inspector.inspection.first_set_data_call_start {
            let (line, column) = self.line_starts.location(start);
            self.diagnostics.push(NativeOnPageScrollDiagnostic {
                kind: "setData".to_string(),
                line,
                column,
                source_label: source_label.to_string(),
                sync_api: None,
            });
        }

        for (sync_api, start) in inspector.inspection.sync_api_call_starts {
            let (line, column) = self.line_starts.location(start);
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
        self.report_function_body(&arrow.body, source_label, start);
    }
}

impl<'a> Visit<'a> for OnPageScrollVisitor<'a> {
    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        if !property.computed && static_property_name(&property.key) == Some("onPageScroll") {
            let start = if property.method {
                property.key.span().end
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

#[napi(js_name = "collectOnPageScrollDiagnosticsNative")]
pub fn collect_on_page_scroll_diagnostics_native(
    code: String,
    filename: Option<String>,
) -> Vec<NativeOnPageScrollDiagnostic> {
    if !code.contains("onPageScroll") {
        return Vec::new();
    }

    let allocator = Allocator::default();
    let filename = filename.unwrap_or_else(|| "inline.ts".to_string());
    let source_type =
        SourceType::from_path(Path::new(&filename)).unwrap_or_else(|_| SourceType::ts());
    let parsed = Parser::new(&allocator, &code, source_type).parse();
    if parsed.panicked {
        return Vec::new();
    }

    let (hook_names, namespace_imports) = collect_wevu_scroll_imports(&parsed.program);
    let line_starts = LineStarts::new(&code);
    let mut visitor = OnPageScrollVisitor {
        hook_names,
        namespace_imports,
        diagnostics: Vec::new(),
        line_starts: &line_starts,
    };
    visitor.visit_program(&parsed.program);
    visitor.diagnostics
}

fn collect_wevu_scroll_imports(program: &Program) -> (HashSet<String>, HashSet<String>) {
    let mut hook_names = HashSet::from(["onPageScroll".to_string()]);
    let mut namespace_imports = HashSet::new();

    for statement in &program.body {
        let Statement::ImportDeclaration(import_decl) = statement else {
            continue;
        };
        if import_decl.source.value.as_str() != "wevu" {
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
        ModuleExportName::IdentifierName(identifier) => Some(identifier.name.as_str()),
        ModuleExportName::IdentifierReference(identifier) => Some(identifier.name.as_str()),
        ModuleExportName::StringLiteral(literal) => Some(literal.value.as_str()),
    }
}

fn static_property_name<'a>(key: &'a PropertyKey<'a>) -> Option<&'a str> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.as_str()),
        PropertyKey::StringLiteral(literal) => Some(literal.value.as_str()),
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
