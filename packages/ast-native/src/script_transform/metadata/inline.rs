use std::collections::HashMap;

use super::contract::{InlineExpression, quote};
use super::expression::{inline_source, valid_identifier};

pub(super) fn entry(entry: &InlineExpression) -> Result<String, String> {
    let names = &entry.parameter_names;
    if [&names.context, &names.scope, &names.event]
        .iter()
        .any(|name| !valid_identifier(name))
    {
        return Err("Unsupported inline metadata parameter name".to_string());
    }
    let keys = entry
        .scope_keys
        .iter()
        .map(|key| quote(key))
        .collect::<Vec<_>>()
        .join(",");
    let expression = inline_source(&entry.expression)?;
    let mut fields = vec![
        format!("keys:[{keys}]"),
        format!(
            "fn:({},{},{})=>({expression})",
            names.context, names.scope, names.event
        ),
    ];
    if let Some(bindings) = entry
        .index_bindings
        .as_ref()
        .filter(|bindings| !bindings.is_empty())
    {
        fields.push(format!(
            "indexKeys:[{}]",
            bindings
                .iter()
                .map(|binding| quote(&binding.key))
                .collect::<Vec<_>>()
                .join(",")
        ));
    }
    if let Some(resolvers) = entry
        .scope_resolvers
        .as_ref()
        .filter(|resolvers| !resolvers.is_empty())
    {
        let resolver_map: HashMap<_, _> = resolvers
            .iter()
            .map(|resolver| (resolver.key.as_str(), resolver.expression.as_str()))
            .collect();
        let ordered = entry
            .scope_keys
            .iter()
            .map(|key| {
                resolver_map
                    .get(key.as_str())
                    .filter(|value| !value.is_empty())
                    .map(|source| inline_source(source))
                    .unwrap_or_else(|| Ok("undefined".to_string()))
            })
            .collect::<Result<Vec<_>, _>>()?;
        fields.push(format!(
            "scopeResolvers:[{}]",
            ordered
                .into_iter()
                .map(|value| format!("({value})"))
                .collect::<Vec<_>>()
                .join(",")
        ));
    }
    Ok(format!("{}:{{{}}}", quote(&entry.id), fields.join(",")))
}
