use std::collections::HashMap;

use oxc_allocator::{Allocator, CloneIn, TakeIn};
use oxc_ast::ast::*;
use oxc_ast_visit::{VisitMut, walk_mut};

use super::RewriteContract;

pub(super) fn key_name<'n>(key: &'n PropertyKey<'_>) -> Option<&'n str> {
    match key {
        PropertyKey::StaticIdentifier(id) => Some(id.name.as_str()),
        PropertyKey::Identifier(id) => Some(id.name.as_str()),
        PropertyKey::StringLiteral(value) => Some(value.value.as_str()),
        _ => None,
    }
}

fn is_object_assign(call: &CallExpression<'_>) -> bool {
    match &call.callee {
        Expression::StaticMemberExpression(member) =>
            matches!(&member.object, Expression::Identifier(id) if id.name == "Object") && member.property.name == "assign",
        Expression::ComputedMemberExpression(member) =>
            matches!(&member.object, Expression::Identifier(id) if id.name == "Object") && matches!(&member.expression, Expression::Identifier(id) if id.name == "assign"),
        _ => false,
    }
}

fn unwrap_type_like<'n, 'a>(expression: &'n mut Expression<'a>) -> &'n mut Expression<'a> {
    match expression {
        Expression::ParenthesizedExpression(node) => unwrap_type_like(&mut node.expression),
        Expression::TSAsExpression(node) => unwrap_type_like(&mut node.expression),
        Expression::TSSatisfiesExpression(node) => unwrap_type_like(&mut node.expression),
        Expression::TSNonNullExpression(node) => unwrap_type_like(&mut node.expression),
        _ => expression,
    }
}

pub fn options_object_mut<'n, 'a>(expression: &'n mut Expression<'a>) -> Option<&'n mut ObjectExpression<'a>> {
    match unwrap_type_like(expression) {
        Expression::ObjectExpression(object) => Some(object),
        Expression::CallExpression(call) if is_object_assign(call) => {
            for argument in call.arguments.iter_mut().rev() {
                if let Some(expression) = argument.as_expression_mut()
                    && let Expression::ObjectExpression(object) = unwrap_type_like(expression)
                {
                    return Some(object);
                }
            }
            None
        }
        _ => None,
    }
}

pub(super) struct ComponentResult<'a> {
    pub expression: Option<Expression<'a>>,
    pub default_export_index: Option<usize>,
    pub transformed: bool,
}

struct ComponentDeclarations<'a, 'c> {
    allocator: &'a Allocator,
    contract: &'c RewriteContract,
    objects: HashMap<String, Expression<'a>>,
    transformed: bool,
}

impl ComponentDeclarations<'_, '_> {
    fn is_define_component(&self, call: &CallExpression<'_>) -> bool {
        matches!(&call.callee, Expression::Identifier(id)
            if id.name.as_str() == self.contract.define_component || id.name.as_str().strip_prefix('_') == Some(self.contract.define_component.as_str()))
    }
}

impl<'a> VisitMut<'a> for ComponentDeclarations<'a, '_> {
    fn visit_variable_declarator(&mut self, node: &mut VariableDeclarator<'a>) {
        if let BindingPattern::BindingIdentifier(id) = &node.id && let Some(init) = &mut node.init {
            if let Expression::CallExpression(call) = init && self.is_define_component(call)
                && matches!(call.arguments.first(), Some(Argument::ObjectExpression(_)))
            {
                *init = call.arguments.remove(0).into_expression();
                self.transformed = true;
            }
            if matches!(init, Expression::ObjectExpression(_)) {
                self.objects.insert(id.name.to_string(), init.clone_in(self.allocator));
            }
        }
        walk_mut::walk_variable_declarator(self, node);
    }
}

pub(super) fn take_component<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    contract: &RewriteContract,
    alias_clone_may_differ: bool,
) -> Result<ComponentResult<'a>, String> {
    let mut declarations = ComponentDeclarations { allocator, contract, objects: HashMap::new(), transformed: false };
    declarations.visit_program(program);
    let index = program.body.iter().position(|statement| matches!(statement, Statement::ExportDefaultDeclaration(_)));
    let Some(index) = index else {
        return Ok(ComponentResult { expression: None, default_export_index: None, transformed: declarations.transformed });
    };
    let Statement::ExportDefaultDeclaration(export) = &mut program.body[index] else { unreachable!() };
    let Some(source) = export.declaration.as_expression_mut() else {
        return Err("Default function/class declarations are outside the component experiment".to_string());
    };
    let aliased = matches!(source, Expression::Identifier(_))
        || matches!(source, Expression::CallExpression(call) if declarations.is_define_component(call)
            && matches!(call.arguments.first(), Some(Argument::Identifier(_))));
    // Babel 在进入变量声明时 clone，子节点改写发生在 clone 之后；尚未覆盖时不悄悄改变这个边界。
    if aliased && alias_clone_may_differ {
        return Err("Aliased components with type/Vue cleanup require clone-order parity coverage".to_string());
    }
    let expression = match source {
        Expression::ObjectExpression(_) => Some(source.take_in(&allocator)),
        Expression::Identifier(id) => declarations.objects.get(id.name.as_str()).map(|object| object.clone_in(allocator)),
        Expression::CallExpression(call) if declarations.is_define_component(call) => {
            match call.arguments.first() {
                Some(Argument::Identifier(id)) => declarations.objects.get(id.name.as_str()).map(|object| object.clone_in(allocator)),
                Some(argument) if argument.is_expression() => Some(call.arguments.remove(0).into_expression()),
                _ => None,
            }
        }
        Expression::CallExpression(call) if is_object_assign(call) => Some(source.take_in(&allocator)),
        _ => None,
    };
    if expression.is_some() { program.body.remove(index); }
    Ok(ComponentResult {
        default_export_index: expression.as_ref().map(|_| index),
        expression,
        transformed: declarations.transformed,
    })
}
