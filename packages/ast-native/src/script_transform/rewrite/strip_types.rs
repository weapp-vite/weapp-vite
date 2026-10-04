use oxc_allocator::{Allocator, TakeIn, Vec};
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_ast_visit::{VisitMut, walk_mut};
use oxc_span::SPAN;
use oxc_syntax::scope::ScopeFlags;

pub(super) struct StripTypes<'a> {
    allocator: &'a Allocator,
    pub transformed: bool,
    pub vue_cleanup: bool,
    pub unsupported: Option<String>,
}

impl<'a> StripTypes<'a> {
    pub fn new(allocator: &'a Allocator) -> Self {
        Self { allocator, transformed: false, vue_cleanup: false, unsupported: None }
    }

    fn remove_statement(&mut self, statement: &Statement<'a>) -> bool {
        let type_only = matches!(statement, Statement::TSTypeAliasDeclaration(_) | Statement::TSInterfaceDeclaration(_)
            | Statement::TSEnumDeclaration(_) | Statement::TSExternalModuleDeclaration(_)
            | Statement::TSNamespaceDeclaration(_) | Statement::TSGlobalDeclaration(_) | Statement::TSImportEqualsDeclaration(_))
            || matches!(statement, Statement::ExportDeclaration(export) if erased_declaration(&export.declaration))
            || matches!(statement, Statement::ExportDefaultDeclaration(export) if matches!(export.declaration, ExportDefaultDeclarationKind::TSInterfaceDeclaration(_)))
            || matches!(statement, Statement::ExportNamedDeclaration(export) if export.export_kind == ImportOrExportKind::Type
                || !export.specifiers.is_empty() && export.specifiers.iter().all(|specifier| specifier.export_kind == ImportOrExportKind::Type))
            || matches!(statement, Statement::ExportFromDeclaration(export) if export.export_kind == ImportOrExportKind::Type
                || !export.specifiers.is_empty() && export.specifiers.iter().all(|specifier| specifier.export_kind == ImportOrExportKind::Type));
        self.transformed |= type_only;
        let vue_marker = is_vue_marker_statement(statement);
        self.vue_cleanup |= vue_marker;
        type_only || vue_marker
    }
}

fn erased_declaration(declaration: &Declaration<'_>) -> bool {
    matches!(declaration, Declaration::TSTypeAliasDeclaration(_) | Declaration::TSInterfaceDeclaration(_)
        | Declaration::TSEnumDeclaration(_) | Declaration::TSExternalModuleDeclaration(_)
        | Declaration::TSNamespaceDeclaration(_) | Declaration::TSGlobalDeclaration(_) | Declaration::TSImportEqualsDeclaration(_))
}

fn is_vue_marker_statement(statement: &Statement<'_>) -> bool {
    let Statement::ExpressionStatement(statement) = statement else { return false };
    let Expression::CallExpression(call) = &statement.expression else { return false };
    if matches!(&call.callee, Expression::Identifier(name) if name.name == "__expose") && call.arguments.is_empty() {
        return true;
    }
    let member = match &call.callee {
        Expression::StaticMemberExpression(member) => matches!(&member.object, Expression::Identifier(id) if id.name == "Object") && member.property.name == "defineProperty",
        Expression::ComputedMemberExpression(member) => matches!(&member.object, Expression::Identifier(id) if id.name == "Object") && matches!(&member.expression, Expression::Identifier(id) if id.name == "defineProperty"),
        _ => false,
    };
    member && matches!(call.arguments.first(), Some(Argument::Identifier(id)) if id.name == "__returned__")
        && matches!(call.arguments.get(1), Some(Argument::StringLiteral(value)) if value.value == "__isScriptSetup")
}

impl<'a> VisitMut<'a> for StripTypes<'a> {
    fn visit_statements(&mut self, statements: &mut Vec<'a, Statement<'a>>) {
        statements.retain(|statement| !self.remove_statement(statement));
        walk_mut::walk_statements(self, statements);
    }

    fn visit_statement(&mut self, statement: &mut Statement<'a>) {
        if matches!(statement, Statement::TSExportAssignment(_) | Statement::TSNamespaceExportDeclaration(_)) {
            self.unsupported = Some("TypeScript export assignment/namespace syntax is not supported".to_string());
        }
        if self.remove_statement(statement) {
            *statement = Statement::new_empty_statement(SPAN, &AstBuilder::new(self.allocator));
            return;
        }
        walk_mut::walk_statement(self, statement);
    }

    fn visit_expression(&mut self, expression: &mut Expression<'a>) {
        loop {
            let inner = match expression {
                Expression::TSAsExpression(node) => Some(node.expression.take_in(&self.allocator)),
                Expression::TSSatisfiesExpression(node) => Some(node.expression.take_in(&self.allocator)),
                Expression::TSTypeAssertion(node) => Some(node.expression.take_in(&self.allocator)),
                Expression::TSNonNullExpression(node) => Some(node.expression.take_in(&self.allocator)),
                _ => None,
            };
            let Some(inner) = inner else { break };
            self.transformed = true;
            *expression = inner;
        }
        if matches!(expression, Expression::JSXElement(_) | Expression::JSXFragment(_) | Expression::TSInstantiationExpression(_)) {
            self.unsupported = Some("Unlowered JSX or standalone TypeScript instantiation expression".to_string());
        }
        walk_mut::walk_expression(self, expression);
    }

    fn visit_object_expression(&mut self, object: &mut ObjectExpression<'a>) {
        object.properties.retain(|property| {
            let ObjectPropertyKind::ObjectProperty(property) = property else { return true };
            if property.method || property.kind != PropertyKind::Init { return true; }
            let removed = super::component::key_name(&property.key) == Some("__name");
            // Identifier 形式先被 Vue 的 ObjectExpression visitor 删除，不设置 transformed。
            self.transformed |= removed && matches!(property.key, PropertyKey::StringLiteral(_));
            self.vue_cleanup |= removed;
            !removed
        });
        walk_mut::walk_object_expression(self, object);
    }

    fn visit_variable_declarator(&mut self, node: &mut VariableDeclarator<'a>) {
        if node.definite {
            self.unsupported = Some("Definite assignment declarations require separate parity coverage".to_string());
        }
        self.transformed |= node.type_annotation.take().is_some();
        walk_mut::walk_variable_declarator(self, node);
    }

    fn visit_call_expression(&mut self, node: &mut CallExpression<'a>) {
        self.transformed |= node.type_arguments.take().is_some();
        walk_mut::walk_call_expression(self, node);
    }

    fn visit_new_expression(&mut self, node: &mut NewExpression<'a>) {
        self.transformed |= node.type_arguments.take().is_some();
        walk_mut::walk_new_expression(self, node);
    }

    fn visit_function(&mut self, node: &mut Function<'a>, flags: ScopeFlags) {
        self.transformed |= node.type_parameters.take().is_some();
        self.transformed |= node.return_type.take().is_some();
        self.transformed |= node.this_param.take().is_some();
        if node.declare || node.body.is_none() {
            self.unsupported = Some("Ambient functions and overload declarations require separate parity coverage".to_string());
        }
        walk_mut::walk_function(self, node, flags);
    }

    fn visit_arrow_function_expression(&mut self, node: &mut ArrowFunctionExpression<'a>) {
        self.transformed |= node.type_parameters.take().is_some();
        self.transformed |= node.return_type.take().is_some();
        walk_mut::walk_arrow_function_expression(self, node);
    }

    fn visit_formal_parameter(&mut self, node: &mut FormalParameter<'a>) {
        self.transformed |= node.type_annotation.take().is_some() || node.optional;
        self.transformed |= node.accessibility.take().is_some() || node.readonly || node.r#override;
        node.optional = false;
        node.readonly = false;
        node.r#override = false;
        if !node.decorators.is_empty() {
            self.unsupported = Some("Decorated parameter syntax is not supported".to_string());
        }
        walk_mut::walk_formal_parameter(self, node);
    }

    fn visit_formal_parameter_rest(&mut self, node: &mut FormalParameterRest<'a>) {
        if !node.decorators.is_empty() {
            self.unsupported = Some("Decorated rest parameter syntax is not supported".to_string());
        }
        self.transformed |= node.type_annotation.take().is_some();
        walk_mut::walk_formal_parameter_rest(self, node);
    }

    fn visit_catch_parameter(&mut self, node: &mut CatchParameter<'a>) {
        self.transformed |= node.type_annotation.take().is_some();
        walk_mut::walk_catch_parameter(self, node);
    }

    fn visit_property_definition(&mut self, node: &mut PropertyDefinition<'a>) {
        if node.declare || node.r#override || node.readonly || node.definite || node.accessibility.is_some()
            || node.r#type == PropertyDefinitionType::TSAbstractPropertyDefinition || !node.decorators.is_empty()
        {
            self.unsupported = Some("Class property modifiers require separate parity coverage".to_string());
        }
        self.transformed |= node.type_annotation.take().is_some() || node.optional;
        node.optional = false;
        walk_mut::walk_property_definition(self, node);
    }

    fn visit_method_definition(&mut self, node: &mut MethodDefinition<'a>) {
        if node.r#override || node.accessibility.is_some() || !node.decorators.is_empty()
            || node.r#type == MethodDefinitionType::TSAbstractMethodDefinition
        {
            self.unsupported = Some("Class method modifiers require separate parity coverage".to_string());
        }
        self.transformed |= node.optional;
        node.optional = false;
        walk_mut::walk_method_definition(self, node);
    }

    fn visit_accessor_property(&mut self, node: &mut AccessorProperty<'a>) {
        self.unsupported = Some("Class accessor syntax requires separate parity coverage".to_string());
        self.transformed |= node.type_annotation.take().is_some();
        walk_mut::walk_accessor_property(self, node);
    }

    fn visit_variable_declaration(&mut self, node: &mut VariableDeclaration<'a>) {
        if node.declare {
            self.unsupported = Some("Ambient variable declarations require separate parity coverage".to_string());
        }
        walk_mut::walk_variable_declaration(self, node);
    }

    fn visit_class(&mut self, node: &mut Class<'a>) {
        if node.declare || node.r#abstract || node.type_parameters.is_some() || !node.implements.is_empty()
            || !node.decorators.is_empty() || node.heritage.as_ref().is_some_and(|heritage| heritage.type_arguments.is_some())
            || node.body.body.iter().any(|element| matches!(element, ClassElement::TSIndexSignature(_)))
        {
            self.unsupported = Some("Class type/decorator syntax requires separate parity coverage".to_string());
        }
        walk_mut::walk_class(self, node);
    }

    fn visit_simple_assignment_target(&mut self, node: &mut SimpleAssignmentTarget<'a>) {
        if matches!(node, SimpleAssignmentTarget::TSAsExpression(_) | SimpleAssignmentTarget::TSSatisfiesExpression(_)
            | SimpleAssignmentTarget::TSNonNullExpression(_) | SimpleAssignmentTarget::TSTypeAssertion(_))
        {
            self.unsupported = Some("Type assertions in assignment targets require separate parity coverage".to_string());
        }
        walk_mut::walk_simple_assignment_target(self, node);
    }

    fn visit_export_named_declaration(&mut self, node: &mut ExportNamedDeclaration<'a>) {
        let previous = node.specifiers.len();
        node.specifiers.retain(|specifier| specifier.export_kind != ImportOrExportKind::Type);
        self.transformed |= previous != node.specifiers.len();
        walk_mut::walk_export_named_declaration(self, node);
    }

    fn visit_export_from_declaration(&mut self, node: &mut ExportFromDeclaration<'a>) {
        let previous = node.specifiers.len();
        node.specifiers.retain(|specifier| specifier.export_kind != ImportOrExportKind::Type);
        self.transformed |= previous != node.specifiers.len();
        walk_mut::walk_export_from_declaration(self, node);
    }
}
