use std::{cell::Cell, collections::HashMap};

use oxc_ast::ast::{
    Argument, AssignmentExpression, AssignmentTarget, BindingPattern, CallExpression, ChainElement,
    ChainExpression, ComputedMemberExpression, Expression, StaticMemberExpression, StringLiteral,
    TemplateElement, VariableDeclarator,
};
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::{IsGlobalReference, ScopeFlags, ScopeId, Scoping};
use oxc_span::{GetSpan, Span};

use super::types::{
    NativeNpmChunkAnalysis, NativeNpmLocalRootFact, NativeNpmPlatformApiFact, NativeNpmRequireFact,
};

pub struct NpmChunkVisitor<'s> {
    scoping: &'s Scoping,
    utf16_deltas: Vec<(u32, u32)>,
    scopes: Vec<ScopeId>,
    parent_bindings: HashMap<(u32, u32), String>,
    analysis: NativeNpmChunkAnalysis,
    unsupported: bool,
}

impl<'s> NpmChunkVisitor<'s> {
    pub fn new(scoping: &'s Scoping, source: &str) -> Self {
        let mut utf16_deltas = Vec::new();
        let mut delta = 0;
        for (start, character) in source.char_indices() {
            if !character.is_ascii() {
                let end = start + character.len_utf8();
                delta += (character.len_utf8() - character.len_utf16()) as u32;
                utf16_deltas.push((end as u32, delta));
            }
        }
        Self {
            scoping,
            utf16_deltas,
            scopes: Vec::new(),
            parent_bindings: HashMap::new(),
            analysis: NativeNpmChunkAnalysis {
                requires: Vec::new(),
                platform_api_ranges: Vec::new(),
                local_root_facts: Vec::new(),
            },
            unsupported: false,
        }
    }

    pub fn finish(self) -> Option<NativeNpmChunkAnalysis> {
        (!self.unsupported).then_some(self.analysis)
    }

    fn utf16_span(&self, span: Span) -> (u32, u32) {
        (self.utf16_offset(span.start), self.utf16_offset(span.end))
    }

    fn utf16_offset(&self, offset: u32) -> u32 {
        let index = self.utf16_deltas.partition_point(|(end, _)| *end <= offset);
        let delta = index
            .checked_sub(1)
            .map_or(0, |index| self.utf16_deltas[index].1);
        offset - delta
    }

    fn require_is_shadowed(&self) -> bool {
        self.scopes.last().is_none_or(|scope| {
            self.scoping
                .find_binding(*scope, "require".into())
                .is_some()
        })
    }

    fn push_alias(&mut self, name: &str, expression: &Expression<'_>) {
        if self.require_is_shadowed() {
            return;
        }
        let (reference_name, importee) = expression_source(expression);
        if reference_name.is_none() && importee.is_none() {
            return;
        }
        self.analysis.local_root_facts.push(NativeNpmLocalRootFact {
            kind: "alias".to_string(),
            binding_name: Some(name.to_string()),
            reference_name,
            importee,
            require_index: None,
            second_argument_start: None,
            second_argument_end: None,
        });
    }

    fn push_require(&mut self, call: &CallExpression<'_>) {
        let Expression::Identifier(identifier) = call.callee.without_parentheses() else {
            return;
        };
        if call.optional || identifier.name != "require" || self.require_is_shadowed() {
            return;
        }
        let Some(argument) = call.arguments.first() else {
            return;
        };
        let Some(expression) = argument
            .as_expression()
            .map(Expression::without_parentheses)
        else {
            return;
        };
        let Some(importee) = crate::static_string_literal_value(expression) else {
            return;
        };
        let (start, end) = self.utf16_span(expression.span());
        let require_index = self.analysis.requires.len() as u32;
        self.analysis.requires.push(NativeNpmRequireFact {
            start,
            end,
            importee: importee.to_string(),
        });
        self.analysis.local_root_facts.push(NativeNpmLocalRootFact {
            kind: "require".to_string(),
            require_index: Some(require_index),
            binding_name: self
                .parent_bindings
                .get(&(call.span.start, call.span.end))
                .cloned(),
            reference_name: None,
            importee: None,
            second_argument_start: None,
            second_argument_end: None,
        });
    }

    fn push_interop(&mut self, call: &CallExpression<'_>) {
        let is_to_esm = match call.callee.without_parentheses() {
            Expression::Identifier(identifier) => identifier.name == "__toESM",
            Expression::StaticMemberExpression(member) => member.property.name == "__toESM",
            _ => false,
        };
        if is_to_esm
            && matches!(
                call.arguments.get(1),
                Some(Argument::ParenthesizedExpression(_))
            )
        {
            // 原 Babel 折叠括号后的删除范围存在特殊行为，实验不改变该边界。
            self.unsupported = true;
            return;
        }
        if call.optional
            || !is_to_esm
            || !matches!(call.arguments.get(1), Some(Argument::NumericLiteral(value)) if value.value == 1.0)
        {
            return;
        }
        let Some(expression) = call.arguments.first().and_then(Argument::as_expression) else {
            return;
        };
        let (reference_name, importee) = expression_source(expression);
        if reference_name.is_none() && importee.is_none() {
            return;
        }
        let (start, end) = self.utf16_span(call.arguments[1].span());
        self.analysis.local_root_facts.push(NativeNpmLocalRootFact {
            kind: "interop".to_string(),
            require_index: None,
            binding_name: None,
            reference_name,
            importee,
            second_argument_start: Some(start),
            second_argument_end: Some(end),
        });
    }

    fn push_platform_api(&mut self, object: &Expression<'_>) {
        if let Expression::Identifier(identifier) = object.without_parentheses()
            && crate::is_platform_api_identifier(identifier.name.as_str())
            && identifier.is_global_reference(self.scoping)
        {
            let (start, end) = self.utf16_span(identifier.span);
            self.analysis
                .platform_api_ranges
                .push(NativeNpmPlatformApiFact { start, end });
        }
    }
}

fn expression_source(expression: &Expression<'_>) -> (Option<String>, Option<String>) {
    match expression.without_parentheses() {
        Expression::Identifier(identifier) => (Some(identifier.name.to_string()), None),
        Expression::CallExpression(call)
            if !call.optional
                && matches!(call.callee.without_parentheses(), Expression::Identifier(identifier) if identifier.name == "require") =>
        {
            (
                None,
                call.arguments
                    .first()
                    .and_then(Argument::as_expression)
                    .map(Expression::without_parentheses)
                    .and_then(crate::static_string_literal_value)
                    .map(str::to_string),
            )
        }
        _ => (None, None),
    }
}

impl<'a> Visit<'a> for NpmChunkVisitor<'_> {
    fn enter_scope(&mut self, _flags: ScopeFlags, scope_id: &Cell<Option<ScopeId>>) {
        if let Some(scope) = scope_id.get() {
            self.scopes.push(scope);
        } else {
            self.unsupported = true;
        }
    }

    fn leave_scope(&mut self) {
        self.scopes.pop();
    }

    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let BindingPattern::BindingIdentifier(identifier) = &declarator.id
            && let Some(init) = &declarator.init
        {
            self.push_alias(identifier.name.as_str(), init);
            if let Expression::CallExpression(call) = init.without_parentheses() {
                self.parent_bindings.insert(
                    (call.span.start, call.span.end),
                    identifier.name.to_string(),
                );
            }
        }
        walk::walk_variable_declarator(self, declarator);
    }

    fn visit_assignment_expression(&mut self, assignment: &AssignmentExpression<'a>) {
        if let AssignmentTarget::AssignmentTargetIdentifier(identifier) = &assignment.left {
            self.push_alias(identifier.name.as_str(), &assignment.right);
            if let Expression::CallExpression(call) = assignment.right.without_parentheses() {
                self.parent_bindings.insert(
                    (call.span.start, call.span.end),
                    identifier.name.to_string(),
                );
            }
        }
        walk::walk_assignment_expression(self, assignment);
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        self.push_require(call);
        self.push_interop(call);
        walk::walk_call_expression(self, call);
    }

    fn visit_chain_expression(&mut self, chain: &ChainExpression<'a>) {
        if matches!(&chain.expression, ChainElement::CallExpression(call)
            if matches!(call.callee.without_parentheses(), Expression::Identifier(identifier) if identifier.name == "require")
                || matches!(call.callee.without_parentheses(), Expression::StaticMemberExpression(member) if member.property.name == "__toESM"))
        {
            self.unsupported = true;
        }
        walk::walk_chain_expression(self, chain);
    }

    fn visit_static_member_expression(&mut self, member: &StaticMemberExpression<'a>) {
        self.push_platform_api(&member.object);
        walk::walk_static_member_expression(self, member);
    }

    fn visit_computed_member_expression(&mut self, member: &ComputedMemberExpression<'a>) {
        self.push_platform_api(&member.object);
        walk::walk_computed_member_expression(self, member);
    }

    fn visit_string_literal(&mut self, literal: &StringLiteral<'a>) {
        self.unsupported |= literal.lone_surrogates;
    }

    fn visit_template_element(&mut self, element: &TemplateElement<'a>) {
        self.unsupported |= element.lone_surrogates;
    }
}
