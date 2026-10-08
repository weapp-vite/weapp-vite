use serde_json::Value;

mod apply;
mod computed;
mod contract;
mod expression;
mod inline;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod baseline_tests;

pub use apply::{MetadataApplied, apply_to_component};
pub use contract::MetadataSymbols;

#[derive(Clone, Debug)]
pub struct MetadataImport {
    pub imported: String,
    pub local: String,
}

#[derive(Debug)]
pub struct MetadataPlan {
    pub computed_properties: Vec<String>,
    pub inline_entries: Vec<String>,
    pub inline_map_key: String,
    pub imports: Vec<MetadataImport>,
    pub warnings: Vec<String>,
}

pub fn build(options: &Value, symbols: &MetadataSymbols) -> Result<MetadataPlan, String> {
    let options: contract::Options = serde_json::from_value(options.clone())
        .map_err(|error| format!("Unsupported script metadata options: {error}"))?;
    let bindings = options.class_style_bindings.as_deref().unwrap_or_default();
    if !bindings.is_empty()
        && options
            .props_aliases
            .as_ref()
            .is_some_and(|value| value.as_object().is_none_or(|value| !value.is_empty()))
    {
        return Err("Class/style props aliases require the JavaScript fallback".to_string());
    }
    for symbol in [
        &symbols.normalize_class,
        &symbols.normalize_style,
        &symbols.unref,
        &symbols.resolve_prop_value,
        &symbols.expression_error_identifier,
    ] {
        if !expression::valid_identifier(symbol) {
            return Err("Unsupported metadata helper identifier".to_string());
        }
    }
    let computed_properties = bindings
        .iter()
        .map(|binding| computed::property(binding, symbols))
        .collect::<Result<Vec<_>, _>>()?;
    let inline_entries = options
        .inline_expressions
        .as_deref()
        .unwrap_or_default()
        .iter()
        .map(inline::entry)
        .collect::<Result<Vec<_>, _>>()?;
    let imports = if bindings.is_empty() {
        Vec::new()
    } else {
        [
            ("normalizeClass", &symbols.normalize_class),
            ("normalizeStyle", &symbols.normalize_style),
            ("unref", &symbols.unref),
            ("resolvePropValue", &symbols.resolve_prop_value),
        ]
        .into_iter()
        .map(|(imported, local)| MetadataImport {
            imported: imported.to_string(),
            local: local.clone(),
        })
        .collect()
    };
    Ok(MetadataPlan {
        computed_properties,
        inline_entries,
        inline_map_key: symbols.inline_map_key.clone(),
        imports,
        warnings: Vec::new(),
    })
}
