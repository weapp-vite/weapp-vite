use oxc_allocator::{Allocator, TakeIn};
use oxc_ast::ast::{ArrowFunctionExpression, Expression, FormalParameters, Function, SimpleAssignmentTarget};
use oxc_ast_visit::{VisitMut, walk_mut};
use oxc_syntax::scope::ScopeFlags;

// 与 parseBabelExpressionFile 保持相同的有限 TS 去除规则，保留 satisfies 等节点。
pub(super) struct NormalizeTypes<'a> {
    pub allocator: &'a Allocator,
    pub unsupported: bool,
}

fn strip_parameters(parameters: &mut FormalParameters<'_>) {
    for parameter in &mut parameters.items {
        parameter.type_annotation = None;
        parameter.optional = false;
    }
    if let Some(rest) = &mut parameters.rest {
        rest.type_annotation = None;
    }
}

impl<'a> VisitMut<'a> for NormalizeTypes<'a> {
    fn visit_expression(&mut self, expression: &mut Expression<'a>) {
        loop {
            let inner = match expression {
                Expression::TSAsExpression(node) => &mut node.expression,
                Expression::TSNonNullExpression(node) => &mut node.expression,
                Expression::TSTypeAssertion(node) => &mut node.expression,
                _ => break,
            };
            *expression = inner.take_in(&self.allocator);
        }
        walk_mut::walk_expression(self, expression);
    }

    fn visit_simple_assignment_target(&mut self, target: &mut SimpleAssignmentTarget<'a>) {
        let inner = match target {
            SimpleAssignmentTarget::TSAsExpression(node) => Some(&mut node.expression),
            SimpleAssignmentTarget::TSNonNullExpression(node) => Some(&mut node.expression),
            SimpleAssignmentTarget::TSTypeAssertion(node) => Some(&mut node.expression),
            _ => None,
        };
        if let Some(inner) = inner {
            self.visit_expression(inner);
            *target = match inner.take_in(&self.allocator) {
                Expression::Identifier(node) => SimpleAssignmentTarget::AssignmentTargetIdentifier(node),
                Expression::StaticMemberExpression(node) => SimpleAssignmentTarget::StaticMemberExpression(node),
                Expression::ComputedMemberExpression(node) => SimpleAssignmentTarget::ComputedMemberExpression(node),
                Expression::PrivateFieldExpression(node) => SimpleAssignmentTarget::PrivateFieldExpression(node),
                _ => {
                    self.unsupported = true;
                    return;
                }
            };
        }
        walk_mut::walk_simple_assignment_target(self, target);
    }

    fn visit_function(&mut self, function: &mut Function<'a>, flags: ScopeFlags) {
        function.type_parameters = None;
        function.return_type = None;
        function.this_param = None;
        strip_parameters(&mut function.params);
        walk_mut::walk_function(self, function, flags);
    }

    fn visit_arrow_function_expression(&mut self, function: &mut ArrowFunctionExpression<'a>) {
        function.type_parameters = None;
        function.return_type = None;
        strip_parameters(&mut function.params);
        walk_mut::walk_arrow_function_expression(self, function);
    }
}
