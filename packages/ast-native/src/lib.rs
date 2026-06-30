use std::{
    collections::{BTreeMap, HashMap, HashSet},
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

mod vue_sfc_signature;
pub use vue_sfc_signature::get_vue_sfc_signature_payload_native;

#[napi(object)]
pub struct NativeOnPageScrollDiagnostic {
    pub kind: String,
    pub line: u32,
    pub column: u32,
    pub source_label: String,
    pub sync_api: Option<String>,
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
) -> Option<Program<'a>> {
    let filename = filename.unwrap_or_else(|| "inline.ts".to_string());
    let source_type =
        SourceType::from_path(Path::new(&filename)).unwrap_or_else(|_| SourceType::ts());
    let parsed = Parser::new(allocator, code, source_type).parse();
    if parsed.panicked {
        return None;
    }
    Some(parsed.program)
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
    let Some(program) = parse_program(&allocator, &code, filename) else {
        return Vec::new();
    };

    let (hook_names, namespace_imports) = collect_wevu_scroll_imports(&program);
    let line_starts = LineStarts::new(&code);
    let mut visitor = OnPageScrollVisitor {
        hook_names,
        namespace_imports,
        diagnostics: Vec::new(),
        line_starts: &line_starts,
    };
    visitor.visit_program(&program);
    visitor.diagnostics
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
    let Some(program) = parse_program(&allocator, &code, filename) else {
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
    let Some(program) = parse_program(&allocator, &code, filename) else {
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
    let Some(program) = parse_program(&allocator, &code, filename) else {
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
    inputs
        .into_iter()
        .map(|input| {
            analyze_script_impl(
                &input.code,
                input.module_id,
                input.hook_to_feature_json,
                input.filename,
            )
        })
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

    if !wants_static_require && !wants_platform_api && feature_config.is_none() {
        return NativeScriptAnalysis {
            has_static_require_literal: false,
            has_platform_api_access: false,
            feature_flags: Vec::new(),
        };
    }

    let allocator = Allocator::default();
    let Some(program) = parse_program(&allocator, code, filename) else {
        return NativeScriptAnalysis {
            has_static_require_literal: false,
            has_platform_api_access: false,
            feature_flags: Vec::new(),
        };
    };

    let feature_flags = feature_config.and_then(|(module_id, hook_to_feature)| {
        let (named_hook_locals, namespace_locals) =
            collect_feature_flag_imports(&program, &module_id, &hook_to_feature);
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
    visitor.visit_program(&program);

    NativeScriptAnalysis {
        has_static_require_literal: wants_static_require && visitor.has_static_require_literal,
        has_platform_api_access: wants_platform_api && visitor.has_platform_api_access,
        feature_flags: visitor
            .feature_flags
            .map(|feature_flags| feature_flags.enabled.keys().cloned().collect())
            .unwrap_or_default(),
    }
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
        if import_decl.source.value.as_str() != module_id {
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
        ModuleExportName::StringLiteral(literal) => Some(literal.value.as_str()),
    }
}

fn static_string_literal_value<'a>(expression: &'a Expression<'a>) -> Option<&'a str> {
    match expression {
        Expression::StringLiteral(literal) => Some(literal.value.as_str()),
        Expression::TemplateLiteral(template)
            if template.expressions.is_empty() && template.quasis.len() == 1 =>
        {
            Some(template.quasis[0].value.cooked.as_ref()?.as_str())
        }
        _ => None,
    }
}

fn argument_static_string_literal_value<'a>(argument: &'a Argument<'a>) -> Option<&'a str> {
    match argument {
        Argument::StringLiteral(literal) => Some(literal.value.as_str()),
        Argument::TemplateLiteral(template)
            if template.expressions.is_empty() && template.quasis.len() == 1 =>
        {
            Some(template.quasis[0].value.cooked.as_ref()?.as_str())
        }
        _ => None,
    }
}

fn is_static_require_call(call: &CallExpression) -> bool {
    matches!(&call.callee, Expression::Identifier(identifier) if identifier.name.as_str() == "require")
        && call
            .arguments
            .first()
            .and_then(argument_static_string_literal_value)
            .is_some()
}

fn may_contain_platform_api_text(code: &str) -> bool {
    ["wx.", "my.", "tt.", "swan.", "jd.", "xhs."]
        .iter()
        .any(|needle| code.contains(needle))
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
                && static_string_literal_value(&member.expression).is_some()
        }
        _ => false,
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
