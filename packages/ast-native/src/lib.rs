use std::{
    collections::{BTreeMap, HashMap, HashSet},
    path::Path,
};

use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, ArrowFunctionBody, ArrowFunctionExpression, CallExpression, Expression, Function,
    ImportDeclarationSpecifier, ModuleExportName, ObjectProperty, Program, PropertyKey, PropertyKind,
    Statement,
};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_span::{GetSpan, SourceType};
use oxc_syntax::scope::ScopeFlags;

mod vue_sfc_signature;
pub use vue_sfc_signature::get_vue_sfc_signature_payload_native;

#[cfg(feature = "experimental-chunk-analysis")]
mod chunk_analysis;

#[cfg(feature = "experimental-binding-analysis")]
mod binding_analysis;

#[cfg(feature = "experimental-script-transform")]
mod script_transform;

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
    pub on_page_scroll_diagnostics: Option<Vec<NativeOnPageScrollDiagnostic>>,
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
) -> napi::Result<Program<'a>> {
    let filename = filename.unwrap_or_else(|| "inline.ts".to_string());
    let source_type =
        SourceType::from_path(Path::new(&filename)).unwrap_or_else(|_| SourceType::ts());
    let parsed = Parser::new(allocator, code, source_type).parse();
    if parsed.fatal_error || !parsed.diagnostics.is_empty() {
        return Err(napi::Error::from_reason("Native AST parsing failed"));
    }
    Ok(parsed.program)
}

struct LineStarts<'a> {
    code: &'a str,
    starts: Vec<usize>,
}

impl<'a> LineStarts<'a> {
    fn new(code: &'a str) -> Self {
        let mut starts = vec![0];
        let mut chars = code.char_indices().peekable();
        while let Some((index, character)) = chars.next() {
            if character == '\r' && chars.peek().is_some_and(|(_, next)| *next == '\n') {
                continue;
            }
            if matches!(character, '\n' | '\r' | '\u{2028}' | '\u{2029}') {
                starts.push(index + character.len_utf8());
            }
        }
        Self { code, starts }
    }

    fn location(&self, offset: u32) -> (u32, u32) {
        let offset = offset as usize;
        let line_index = match self.starts.binary_search(&offset) {
            Ok(index) => index,
            Err(index) => index.saturating_sub(1),
        };
        (
            (line_index + 1) as u32,
            (self.code[self.starts[line_index]..offset].encode_utf16().count() + 1) as u32,
        )
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
    // 根回调通过 walk 直接检查参数与函数体，后续函数节点均为嵌套作用域。
    fn visit_function(&mut self, _function: &Function<'a>, _flags: ScopeFlags) {}

    fn visit_arrow_function_expression(&mut self, _arrow: &ArrowFunctionExpression<'a>) {}

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if callee_name(&call.callee) == Some("setData") {
            self.inspection.has_set_data_call = true;
        }

        if let Some((object, name)) = scroll_member(&call.callee)
            && is_identifier_expression(object.without_parentheses(), "wx")
            && name.ends_with("Sync")
        {
            let api = format!("wx.{name}");
            if !self.inspection.sync_apis.contains(&api) {
                self.inspection.sync_apis.push(api);
            }
        }

        walk::walk_call_expression(self, call);
    }
}

struct OnPageScrollVisitor<'a> {
    hook_names: HashSet<String>,
    namespace_imports: HashSet<String>,
    diagnostics: Vec<NativeOnPageScrollDiagnostic>,
    line_starts: &'a LineStarts<'a>,
}

impl<'a> OnPageScrollVisitor<'a> {
    fn report_inspection(&mut self, inspection: Inspection, source_label: &str, start: u32) {
        let (line, column) = self.line_starts.location(start);
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
            let mut inspector = PageScrollInspectionVisitor::new(body.statements.is_empty());
            walk::walk_function(&mut inspector, function, ScopeFlags::empty());
            self.report_inspection(inspector.inspection, source_label, start);
        }
    }

    fn report_arrow_function(
        &mut self,
        arrow: &ArrowFunctionExpression<'a>,
        source_label: &str,
        start: u32,
    ) {
        let empty = matches!(&arrow.body, ArrowFunctionBody::FunctionBody(body) if body.statements.is_empty());
        let mut inspector = PageScrollInspectionVisitor::new(empty);
        walk::walk_arrow_function_expression(&mut inspector, arrow);
        self.report_inspection(inspector.inspection, source_label, start);
    }
}

impl<'a> Visit<'a> for OnPageScrollVisitor<'a> {
    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        let method = property.method || property.kind != PropertyKind::Init;
        if (method || !property.computed) && static_property_name(&property.key) == Some("onPageScroll") {
            let value = property.value.without_parentheses();
            let start = if method {
                property.span.start
            } else {
                value.span().start
            };
            match value {
                Expression::FunctionExpression(function) => {
                    self.report_function_expression(function, "onPageScroll", start);
                }
                Expression::ArrowFunctionExpression(arrow) => {
                    self.report_arrow_function(arrow, "onPageScroll", start);
                }
                _ => {}
            }
        }

        walk::walk_object_property(self, property);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if is_on_page_scroll_callee(&call.callee, &self.hook_names, &self.namespace_imports)
            && let Some(argument) = call.arguments.first()
            && let Some(expression) = argument.as_expression()
        {
            match expression.without_parentheses() {
                Expression::FunctionExpression(function) => {
                    self.report_function_expression(
                        function,
                        "onPageScroll(...)",
                        function.span.start,
                    );
                }
                Expression::ArrowFunctionExpression(arrow) => {
                    self.report_arrow_function(arrow, "onPageScroll(...)", arrow.span.start);
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
) -> napi::Result<Vec<NativeOnPageScrollDiagnostic>> {
    if !code.contains("onPageScroll") {
        return Ok(Vec::new());
    }

    let allocator = Allocator::default();
    let program = parse_program(&allocator, &code, filename)?;
    Ok(collect_scroll_diagnostics(&program, &code))
}

fn collect_scroll_diagnostics(program: &Program, code: &str) -> Vec<NativeOnPageScrollDiagnostic> {
    let (hook_names, namespace_imports) = collect_wevu_scroll_imports(program);
    let line_starts = LineStarts::new(code);
    let mut visitor = OnPageScrollVisitor {
        hook_names,
        namespace_imports,
        diagnostics: Vec::new(),
        line_starts: &line_starts,
    };
    visitor.visit_program(program);
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
pub fn may_contain_static_require_literal_native(code: String, filename: Option<String>) -> napi::Result<bool> {
    if !code.contains("require(") && !code.contains("require (") && !code.contains("require`") {
        return Ok(false);
    }
    let allocator = Allocator::default();
    let program = parse_program(&allocator, &code, filename)?;
    let mut visitor = StaticRequireVisitor { found: false };
    visitor.visit_program(&program);
    Ok(visitor.found)
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
pub fn may_contain_platform_api_access_native(code: String, filename: Option<String>) -> napi::Result<bool> {
    if !may_contain_platform_api_text(&code) {
        return Ok(false);
    }
    let allocator = Allocator::default();
    let program = parse_program(&allocator, &code, filename)?;
    let mut visitor = PlatformApiVisitor { found: false };
    visitor.visit_program(&program);
    Ok(visitor.found)
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
) -> napi::Result<Vec<String>> {
    if !code.contains(&module_id) {
        return Ok(Vec::new());
    }

    let Ok(hook_to_feature) =
        serde_json::from_str::<HashMap<String, String>>(&hook_to_feature_json)
    else {
        return Ok(Vec::new());
    };
    if hook_to_feature.is_empty() || !hook_to_feature.keys().any(|hook| code.contains(hook)) {
        return Ok(Vec::new());
    }

    let allocator = Allocator::default();
    let program = parse_program(&allocator, &code, filename)?;
    let (named_hook_locals, namespace_locals) =
        collect_feature_flag_imports(&program, &module_id, &hook_to_feature);
    if named_hook_locals.is_empty() && namespace_locals.is_empty() {
        return Ok(Vec::new());
    }

    let mut visitor = FeatureFlagVisitor {
        named_hook_locals,
        namespace_locals,
        hook_to_feature,
        enabled: BTreeMap::new(),
    };
    visitor.visit_program(&program);
    Ok(visitor.enabled.keys().cloned().collect())
}

#[napi(js_name = "analyzeScriptNative")]
pub fn analyze_script_native(
    code: String,
    module_id: Option<String>,
    hook_to_feature_json: Option<String>,
    filename: Option<String>,
) -> napi::Result<NativeScriptAnalysis> {
    analyze_script_impl(&code, module_id, hook_to_feature_json, filename)
}

#[napi(js_name = "analyzeScriptsNative")]
pub fn analyze_scripts_native(inputs: Vec<NativeScriptAnalysisInput>) -> napi::Result<Vec<NativeScriptAnalysis>> {
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
) -> napi::Result<NativeScriptAnalysis> {
    let wants_static_require =
        code.contains("require(") || code.contains("require (") || code.contains("require`");
    let wants_platform_api = may_contain_platform_api_text(code);
    let wants_scroll_diagnostics = code.contains("onPageScroll");
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

    if !wants_static_require && !wants_platform_api && !wants_scroll_diagnostics && feature_config.is_none() {
        return Ok(NativeScriptAnalysis {
            has_static_require_literal: false,
            has_platform_api_access: false,
            feature_flags: Vec::new(),
            on_page_scroll_diagnostics: None,
        });
    }

    let allocator = Allocator::default();
    let program = parse_program(&allocator, code, filename)?;
    // 诊断与脚本分析共享一次 parse；没有滚动 hook 时不创建诊断遍历器。
    let on_page_scroll_diagnostics = wants_scroll_diagnostics
        .then(|| collect_scroll_diagnostics(&program, code));

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

    Ok(NativeScriptAnalysis {
        has_static_require_literal: wants_static_require && visitor.has_static_require_literal,
        has_platform_api_access: wants_platform_api && visitor.has_platform_api_access,
        feature_flags: visitor
            .feature_flags
            .map(|feature_flags| feature_flags.enabled.keys().cloned().collect())
            .unwrap_or_default(),
        on_page_scroll_diagnostics,
    })
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
                    if !matches!(&import_specifier.imported, ModuleExportName::StringLiteral(_))
                        && module_export_name(&import_specifier.imported) == Some("onPageScroll") =>
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
        PropertyKey::Identifier(identifier) => Some(identifier.name.as_str()),
        PropertyKey::StringLiteral(literal) => Some(literal.value.as_str()),
        _ => None,
    }
}

fn callee_name<'a>(callee: &'a Expression<'a>) -> Option<&'a str> {
    match callee.without_parentheses() {
        Expression::Identifier(identifier) => Some(identifier.name.as_str()),
        _ => scroll_member(callee).map(|(_, name)| name),
    }
}

fn scroll_member<'a>(expression: &'a Expression<'a>) -> Option<(&'a Expression<'a>, &'a str)> {
    match expression.without_parentheses() {
        Expression::StaticMemberExpression(member) => Some((&member.object, member.property.name.as_str())),
        Expression::ComputedMemberExpression(member) => {
            if let Expression::StringLiteral(literal) = member.expression.without_parentheses() {
                Some((&member.object, literal.value.as_str()))
            } else {
                None
            }
        }
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
    match callee.without_parentheses() {
        Expression::Identifier(identifier) => hook_names.contains(identifier.name.as_str()),
        _ => scroll_member(callee).is_some_and(|(object, name)| {
            is_identifier_expression_set(object.without_parentheses(), namespace_imports)
                && name == "onPageScroll"
        }),
    }
}

fn is_identifier_expression_set(expression: &Expression, names: &HashSet<String>) -> bool {
    matches!(expression, Expression::Identifier(identifier) if names.contains(identifier.name.as_str()))
}
