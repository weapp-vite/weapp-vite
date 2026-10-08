use super::{fragments as f, request::Request};
use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use serde_json::{Map, Value, json};

pub fn inject<'a>(
    object: &mut ObjectExpression<'a>,
    request: &Request,
    allocator: &'a Allocator,
) -> Result<(), String> {
    let Some(manifest) = request.options.get("bindingManifest") else {
        return Ok(());
    };
    if manifest.is_null() {
        return Ok(());
    }
    let diagnostic = request.options["runtimeBindingManifest"] == "diagnostic";
    if request
        .options
        .get("runtimeBindingManifest")
        .is_some_and(|v| v != "compact" && v != "diagnostic")
    {
        return Err("Unsupported manifest mode".to_owned());
    }
    let mut bindings = Vec::new();
    let owner_keys = [
        request.marker("WEVU_SLOT_OWNER_ID_KEY")?,
        request.marker("WEVU_SLOT_OWNER_ID_PROP")?,
    ];
    for binding in manifest["bindings"]
        .as_array()
        .ok_or("Missing manifest bindings")?
    {
        if binding["outputPath"]
            .as_str()
            .is_some_and(|p| owner_keys.iter().any(|k| k == p))
        {
            return Err("Scoped-slot manifest pick injection is deferred".to_owned());
        }
        let mut projected = Map::new();
        for key in ["id", "outputPath"] {
            projected.insert(
                key.to_owned(),
                binding.get(key).ok_or("Missing binding field")?.clone(),
            );
        }
        if diagnostic
            && binding["sourceFile"]
                .as_str()
                .is_some_and(|s| !s.is_empty())
        {
            projected.insert("sourceFile".to_owned(), binding["sourceFile"].clone());
        }
        if binding["updateMode"] != "exact-path" {
            projected.insert("updateMode".to_owned(), binding["updateMode"].clone());
        }
        if binding["updateMode"] == "snapshot-fallback"
            && binding["sourceRoots"]
                .as_array()
                .is_some_and(|a| !a.is_empty())
        {
            projected.insert("sourceRoots".to_owned(), binding["sourceRoots"].clone());
        }
        if diagnostic && binding.get("sourceLocation").is_some_and(|v| !v.is_null()) {
            projected.insert(
                "sourceLocation".to_owned(),
                binding["sourceLocation"].clone(),
            );
        }
        bindings.push(Value::Object(projected));
    }
    let mut result = json!({"version":1,"sourceFile":manifest["sourceFile"],"bindings":bindings});
    if manifest["features"]["scopedSlots"] == true {
        result["features"] = json!({"scopedSlots":true});
    }
    let key = request.marker("WEVU_BINDING_MANIFEST_KEY")?;
    let mut value = f::expression("Object.freeze(null)", allocator)?;
    let Expression::CallExpression(call) = &mut value else {
        return Err("Synthetic freeze call shape differs".to_owned());
    };
    call.arguments[0] = Argument::from(f::json_expression(&result, allocator)?);
    if let Some(existing) = f::find_mut(object, &key) {
        existing.value = value;
        existing.shorthand = false;
    } else {
        object
            .properties
            .push(f::string_property(&key, value, allocator)?);
    }
    Ok(())
}
