use std::collections::HashSet;

use oxc_allocator::Allocator;
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_ast_visit::{Visit, VisitMut, walk, walk_mut};
use oxc_semantic::Scoping;
use oxc_syntax::scope::ScopeId;
use oxc_syntax::symbol::SymbolId;

struct ExposeBindings<'s> {
    scoping: &'s Scoping,
    symbols: HashSet<SymbolId>,
}

impl ExposeBindings<'_> {
    fn has_value_binding(&self, scope: ScopeId) -> bool {
        // TS 的类型命名空间不阻止 Babel 重命名；遇到同名类型仍继续查找外层值绑定。
        self.scoping.scope_ancestors(scope).any(|ancestor| {
            self.scoping
                .get_binding(ancestor, "expose".into())
                .is_some_and(|symbol| self.scoping.symbol_flags(symbol).is_value())
        })
    }
}

impl<'a> Visit<'a> for ExposeBindings<'_> {
    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
        if property.method && super::component::key_name(&property.key) == Some("setup")
            && let Expression::FunctionExpression(function) = &property.value
            && let Some(scope) = function.scope_id.get()
            && !self.has_value_binding(scope)
            // Babel 的 params 此时仍含 this；Oxc 单独存储它，所以要还原第二个参数的位置。
            && let Some(parameter) = function.params.items.get(usize::from(function.this_param.is_none()))
            && let BindingPattern::ObjectPattern(pattern) = &parameter.pattern
        {
            for binding in &pattern.properties {
                if matches!(&binding.key, PropertyKey::StaticIdentifier(key) if key.name == "expose")
                    && let BindingPattern::BindingIdentifier(identifier) = &binding.value
                    && identifier.name == "__expose"
                    && let Some(symbol) = identifier.symbol_id.get()
                {
                    self.symbols.insert(symbol);
                }
            }
        }
        walk::walk_object_property(self, property);
    }
}

struct RenameExpose<'a, 's> {
    allocator: &'a Allocator,
    scoping: &'s Scoping,
    symbols: HashSet<SymbolId>,
}

impl<'a> VisitMut<'a> for RenameExpose<'a, '_> {
    fn visit_assignment_target_property(&mut self, property: &mut AssignmentTargetProperty<'a>) {
        if let AssignmentTargetProperty::AssignmentTargetPropertyIdentifier(original) = property
            && original
                .binding
                .reference_id
                .get()
                .and_then(|reference| self.scoping.get_reference(reference).symbol_id())
                .is_some_and(|symbol| self.symbols.contains(&symbol))
        {
            let builder = AstBuilder::new(self.allocator);
            let key = PropertyKey::new_static_identifier(
                original.binding.span,
                original.binding.name,
                &builder,
            );
            let target = AssignmentTarget::new_assignment_target_identifier(
                original.binding.span,
                "expose",
                &builder,
            );
            let binding = match original.init.take() {
                Some(init) => AssignmentTargetMaybeDefault::new_assignment_target_with_default(
                    original.span,
                    target,
                    init,
                    &builder,
                ),
                None => target.into(),
            };
            *property = AssignmentTargetProperty::new_assignment_target_property_property(
                original.span,
                key,
                binding,
                false,
                &builder,
            );
        }
        walk_mut::walk_assignment_target_property(self, property);
    }

    fn visit_binding_identifier(&mut self, identifier: &mut BindingIdentifier<'a>) {
        if identifier
            .symbol_id
            .get()
            .is_some_and(|symbol| self.symbols.contains(&symbol))
        {
            identifier.name = self.allocator.alloc_str("expose").into();
        }
    }

    fn visit_identifier_reference(&mut self, identifier: &mut IdentifierReference<'a>) {
        if identifier
            .reference_id
            .get()
            .and_then(|reference| self.scoping.get_reference(reference).symbol_id())
            .is_some_and(|symbol| self.symbols.contains(&symbol))
        {
            identifier.name = self.allocator.alloc_str("expose").into();
        }
    }

    fn visit_binding_property(&mut self, property: &mut BindingProperty<'a>) {
        let old_alias = matches!(&property.value, BindingPattern::BindingIdentifier(id) if id.name == "__expose");
        walk_mut::walk_binding_property(self, property);
        if let BindingPattern::BindingIdentifier(identifier) = &property.value {
            if old_alias
                && identifier.name == "expose"
                && super::component::key_name(&property.key) == Some("expose")
            {
                // 简写只输出一个 token，保留被改名绑定的 span 和原名；不能挪到键的位置伪造来源。
                property.shorthand = true;
            } else if property.shorthand
                && super::component::key_name(&property.key) != Some(identifier.name.as_str())
            {
                property.shorthand = false;
            }
        }
    }

    fn visit_object_property(&mut self, property: &mut ObjectProperty<'a>) {
        walk_mut::walk_object_property(self, property);
        if property.shorthand
            && let Expression::Identifier(identifier) = &property.value
            && super::component::key_name(&property.key) != Some(identifier.name.as_str())
        {
            property.shorthand = false;
        }
    }
}

/// 根据原 AST 的符号关系改名，嵌套的同名参数和外层 expose 绑定不受影响。
pub(super) fn rename_setup_expose<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    scoping: &Scoping,
) -> bool {
    let mut collect = ExposeBindings {
        scoping,
        symbols: HashSet::new(),
    };
    collect.visit_program(program);
    let changed = !collect.symbols.is_empty();
    RenameExpose {
        allocator,
        scoping,
        symbols: collect.symbols,
    }
    .visit_program(program);
    changed
}
