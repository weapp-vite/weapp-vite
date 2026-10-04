use super::{contract::CalleeOrigin, fragments};
use oxc_ast::ast::*;
use oxc_span::SPAN;
use serde_json::Value;

fn property<'b, 'a>(
    object: &'b mut ObjectExpression<'a>,
    name: &str,
) -> Result<&'b mut ObjectProperty<'a>, String> {
    let indexes: Vec<_> = object
        .properties
        .iter()
        .enumerate()
        .filter_map(|(index, value)| match value {
            ObjectPropertyKind::ObjectProperty(value)
                if value.key.static_name().is_some_and(|key| key == name) =>
            {
                Some(index)
            }
            _ => None,
        })
        .collect();
    if indexes.len() != 1 {
        return Err(format!(
            "Missing/duplicate provenance target property: {name}"
        ));
    }
    let ObjectPropertyKind::ObjectProperty(property) = &mut object.properties[indexes[0]] else {
        unreachable!()
    };
    if property.computed || property.method || property.kind != PropertyKind::Init {
        return Err(format!("Unsupported provenance target property: {name}"));
    }
    Ok(property)
}
fn object<'b, 'a>(value: &'b mut Expression<'a>) -> Result<&'b mut ObjectExpression<'a>, String> {
    match value {
        Expression::ObjectExpression(object) => Ok(object),
        _ => Err("Provenance target is not an object".to_owned()),
    }
}

pub fn apply(
    component: &mut ObjectExpression<'_>,
    map_key: &str,
    options: &Value,
    origins: &[CalleeOrigin],
) -> Result<(), String> {
    let entries = options["inlineExpressions"]
        .as_array()
        .ok_or("Missing provenance inline assets")?;
    let mut ids = std::collections::HashSet::new();
    for entry in entries {
        if !ids.insert(entry["id"].as_str().ok_or("Invalid inline asset id")?) {
            return Err("Duplicate inline asset id".to_owned());
        }
    }
    let methods = object(&mut property(component, "methods")?.value)?;
    let map = object(&mut property(methods, map_key)?.value)?;
    for origin in origins {
        let asset = entries
            .iter()
            .find(|entry| entry["id"] == origin.inline_id)
            .ok_or("Unknown provenance inline asset")?;
        let context = asset["parameterNames"]["context"]
            .as_str()
            .ok_or("Missing inline context parameter")?;
        let entry = object(&mut property(map, &origin.inline_id)?.value)?;
        let Expression::ArrowFunctionExpression(function) = &mut property(entry, "fn")?.value
        else {
            return Err("Inline provenance requires generated arrow handler".to_owned());
        };
        let ArrowFunctionBody::CallExpression(call) = &mut function.body else {
            return Err("Inline provenance requires direct root call".to_owned());
        };
        if call.optional || call.type_arguments.is_some() {
            return Err("Unsupported inline provenance call".to_owned());
        }
        let Expression::StaticMemberExpression(member) = &mut call.callee else {
            return Err("Inline provenance requires context member callee".to_owned());
        };
        if member.optional
            || !matches!(&member.object, Expression::Identifier(id) if id.name == context)
            || member.property.name.as_str() != origin.name
            || member.property.span != SPAN
        {
            return Err("Inline callee differs from provenance occurrence".to_owned());
        }
        member.property.span = origin.handle;
        if !origin.fragments.is_empty() {
            fragments::apply(
                call,
                asset["expression"]
                    .as_str()
                    .ok_or("Missing inline expression")?,
                &origin.fragments,
            )?;
        }
    }
    Ok(())
}
