use super::{fragments as f, request::Request};
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde_json::{Value, json};
use std::collections::HashSet;

pub(super) fn safe_object(object: &ObjectExpression<'_>) -> bool {
    let mut keys = HashSet::new();
    object.properties.iter().all(|p| {
        matches!(p, ObjectPropertyKind::ObjectProperty(p)
        if !p.computed && p.kind == PropertyKind::Init
        && p.key.static_name().is_some_and(|k| k != "__proto__" && keys.insert(k.into_owned())))
    })
}

fn merge_defaults<'a>(
    object: &mut ObjectExpression<'a>,
    defaults: &Value,
    allocator: &'a Allocator,
) -> Result<(), String> {
    let Some(defaults) = defaults.as_object() else {
        return Err("Non-object component defaults".to_owned());
    };
    for (key, value) in defaults {
        let Some(existing) = f::find_mut(object, key) else {
            f::prepend_json(object, key, value, allocator)?;
            continue;
        };
        if !["options", "setData"].contains(&key.as_str()) {
            continue;
        }
        let Some(nested) = value.as_object() else {
            continue;
        };
        match &mut existing.value {
            Expression::ObjectExpression(object) => {
                // 生产实现一次 prepend 整组缺省项；逆向逐项插入保持同样的属性顺序。
                for (key, value) in nested.iter().rev() {
                    f::prepend_json(object, key, value, allocator)?;
                }
            }
            Expression::Identifier(_)
            | Expression::StaticMemberExpression(_)
            | Expression::ComputedMemberExpression(_) => {
                let Expression::ObjectExpression(additions) = f::json_expression(value, allocator)?
                else {
                    unreachable!()
                };
                f::wrap_spread(&mut existing.value, additions.unbox(), allocator);
            }
            _ => {}
        }
    }
    Ok(())
}

pub fn defaults_and_page<'a>(
    object: &mut ObjectExpression<'a>,
    request: &Request,
    flags: &[String],
    allocator: &'a Allocator,
) -> Result<Value, String> {
    // 动态 component shape 的能力与样式语义尚未覆盖，整段回退而不猜测。
    if !safe_object(object)
        || ["extends", "mixins", "behaviors", "definitionFilter"]
            .iter()
            .any(|k| f::find(object, k).is_some())
    {
        return Err("Dynamic or duplicate component options/inheritance are deferred".to_owned());
    }
    f::prepend_missing(
        object,
        &request.marker("WEVU_IS_PAGE_KEY")?,
        if request.options["isPage"] == true {
            "true"
        } else {
            "false"
        },
        allocator,
    )?;
    if !flags.is_empty() {
        let mut injected = serde_json::Map::new();
        for flag in flags {
            injected.insert(flag.clone(), json!(true));
        }
        if let Some(existing) = f::find_mut(object, "features") {
            match &mut existing.value {
                Expression::ObjectExpression(features) => {
                    for flag in flags.iter().rev() {
                        f::prepend_missing(features, flag, "true", allocator)?;
                    }
                }
                Expression::Identifier(_)
                | Expression::StaticMemberExpression(_)
                | Expression::ComputedMemberExpression(_) => {
                    let Expression::ObjectExpression(additions) =
                        f::json_expression(&Value::Object(injected), allocator)?
                    else {
                        unreachable!()
                    };
                    f::wrap_spread(&mut existing.value, additions.unbox(), allocator);
                }
                _ => {}
            }
        } else {
            let position = object.properties.iter().position(|p| matches!(p, ObjectPropertyKind::ObjectProperty(p) if !p.computed && p.key.static_name().is_some_and(|k| k == "setup"))).unwrap_or(0);
            object.properties.insert(
                position,
                f::property(
                    "features",
                    f::json_expression(&Value::Object(injected), allocator)?,
                    allocator,
                )?,
            );
        }
    }
    if let Some(defaults) = request.options["wevuDefaults"].get("component") {
        let mut defaults = defaults.clone();
        let page = request.options["isPage"] == true;
        let force_page_virtual_host = page && defaults["options"]["virtualHost"] == true;
        if page {
            if let Some(options) = defaults.get_mut("options").and_then(Value::as_object_mut) {
                options.remove("virtualHost");
                if options.is_empty() {
                    defaults.as_object_mut().unwrap().remove("options");
                }
            }
        }
        merge_defaults(object, &defaults, allocator)?;
        if force_page_virtual_host {
            merge_defaults(object, &json!({"options":{"virtualHost":false}}), allocator)?;
        }
    }
    let read = |key: &str| -> Result<Value, String> {
        let Some(options) = f::find(object, "options") else {
            return Ok(json!({"kind":"absent"}));
        };
        let Expression::ObjectExpression(options) = &options.value else {
            return Err("Dynamic style options are deferred".to_owned());
        };
        if !safe_object(options) {
            return Err("Dynamic style option properties are deferred".to_owned());
        }
        let Some(value) = options.properties.iter().rev().find_map(|p| match p {
            ObjectPropertyKind::ObjectProperty(p)
                if p.key.static_name().is_some_and(|k| k == key) =>
            {
                Some(&p.value)
            }
            _ => None,
        }) else {
            return Ok(json!({"kind":"absent"}));
        };
        let value = match value {
            Expression::BooleanLiteral(v) => json!(v.value),
            Expression::StringLiteral(v) => json!(v.value.as_str()),
            Expression::NumericLiteral(v) => json!(v.value),
            Expression::NullLiteral(_) => Value::Null,
            _ => return Err("Non-literal style option is deferred".to_owned()),
        };
        Ok(json!({"kind":"known", "value":value}))
    };
    Ok(json!({"styleIsolation":read("styleIsolation")?, "addGlobalClass":read("addGlobalClass")?}))
}

#[cfg(test)]
#[path = "component_options_guard_tests.rs"]
mod tests;

pub fn function_paths<'a>(
    object: &mut ObjectExpression<'a>,
    request: &Request,
    allocator: &'a Allocator,
) -> Result<(), String> {
    let Some(paths) = request.options["functionPropPaths"].as_array() else {
        return Ok(());
    };
    let mut unique = Vec::new();
    for path in paths {
        let path = path.as_str().ok_or("Non-string function prop path")?;
        if !path.is_empty() && !unique.contains(&path) {
            unique.push(path);
        }
    }
    let key = request.marker("WEVU_FUNCTION_PROP_PATHS_KEY")?;
    if !unique.is_empty() && !object.properties.iter().any(|p| matches!(p, ObjectPropertyKind::ObjectProperty(p) if !p.computed && p.key.static_name().is_some_and(|k| k == key))) {
        object.properties.push(f::property(&key, f::expression(&json!(unique).to_string(), allocator)?, allocator)?);
    }
    Ok(())
}
