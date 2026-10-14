use std::collections::HashSet;

use napi_derive::napi;
use oxc_ast::ast::{
    Expression, ObjectExpression, ObjectProperty, ObjectPropertyKind, Program, PropertyKind,
    Statement,
};

use crate::static_property_name;

#[napi(object)]
#[derive(Clone)]
pub struct NativeCompilerRegisteredComponent {
    pub name: String,
    pub local: String,
}

fn static_properties<'a>(
    object: &'a ObjectExpression<'a>,
) -> Option<Vec<(&'a str, &'a ObjectProperty<'a>)>> {
    let mut seen = HashSet::new();
    let mut properties = Vec::with_capacity(object.properties.len());
    for property in &object.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            return None;
        };
        if property.computed || property.method || property.kind != PropertyKind::Init {
            return None;
        }
        let name = static_property_name(&property.key)?;
        if !seen.insert(name) {
            return None;
        }
        properties.push((name, property.as_ref()));
    }
    Some(properties)
}

/// 只返回能够与现有 Babel 静态注册语义严格对齐的直接对象；复杂对象保留回退。
pub(super) fn collect_registered_components(
    program: &Program<'_>,
) -> Option<Vec<NativeCompilerRegisteredComponent>> {
    let mut result = Vec::new();
    for statement in &program.body {
        let Statement::ExportDefaultDeclaration(export) = statement else {
            continue;
        };
        let expression = export.declaration.as_expression()?;
        let Expression::ObjectExpression(object) = expression.without_parentheses() else {
            return None;
        };
        let properties = static_properties(object)?;
        let Some((_, components)) = properties
            .into_iter()
            .find(|(name, _)| *name == "components")
        else {
            continue;
        };
        let Expression::ObjectExpression(object) = components.value.without_parentheses() else {
            return None;
        };
        for (name, property) in static_properties(object)? {
            let Expression::Identifier(local) = property.value.without_parentheses() else {
                return None;
            };
            result.push(NativeCompilerRegisteredComponent {
                name: name.to_string(),
                local: local.name.to_string(),
            });
        }
    }
    Some(result)
}
