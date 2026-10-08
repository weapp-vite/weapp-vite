use super::string;
use serde_json::{Map, Value};
use std::collections::HashSet;

pub(super) fn decode(
    value: &Value,
    path: &str,
    omitted: &mut Vec<String>,
) -> Result<Option<Value>, String> {
    let kind = value["kind"]
        .as_str()
        .ok_or_else(|| format!("Missing tag at {path}"))?;
    Ok(Some(match kind {
        "undefined" => {
            let optional = path == "$"
                || path.strip_prefix("$.").is_some_and(|p| !p.contains('.'))
                || path.ends_with(".conditions")
                || path.ends_with(".rawExpAst");
            if !optional {
                return Err(format!("Unsupported undefined position: {path}"));
            }
            omitted.push(path.to_owned());
            return Ok(None);
        }
        "null" => Value::Null,
        "boolean" => Value::Bool(value["value"].as_bool().ok_or("Invalid boolean tag")?),
        "string" => Value::String(string(value, "value")?),
        "number" => {
            let raw = string(value, "value")?;
            if raw == "-0" {
                return Err(format!("Negative zero is unsupported at {path}"));
            }
            let n: Value =
                serde_json::from_str(&raw).map_err(|_| format!("Non-JSON number at {path}"))?;
            if !n.is_number() {
                return Err(format!("Invalid number at {path}"));
            }
            n
        }
        "expression-source" => {
            let role = string(value, "role")?;
            if ![
                "expAst",
                "rawExpAst",
                "listExpAst",
                "rawListExpAst",
                "projectedListExpAst",
            ]
            .contains(&role.as_str())
                || !path.ends_with(&format!(".{role}"))
            {
                return Err(format!("Expression role mismatch at {path}"));
            }
            serde_json::json!({ "role": role, "source": string(value, "source")? })
        }
        "callback"
            if path == "$.warn"
                && value["role"] == "options.warn"
                && value["ownership"] == "caller; never transferred" =>
        {
            return Ok(None);
        }
        "opaque"
            if path == "$.[owned-transfer]"
                && value["role"] == "script baseline AST transfer"
                && value["ownership"] == "existing baseline loader; never consumed" =>
        {
            return Ok(None);
        }
        "object" => {
            let prototype = string(value, "prototype")?;
            if !["Object", "null", "Array"].contains(&prototype.as_str()) {
                return Err(format!("Unsupported prototype at {path}"));
            }
            let array = prototype == "Array";
            let mut entries = Map::new();
            let mut keys = HashSet::new();
            for property in value["properties"].as_array().ok_or("Missing properties")? {
                let key = if let Some(key) = property["key"].as_str() {
                    key.to_owned()
                } else if path == "$" && property["key"]["symbol"] == "script baseline AST transfer"
                {
                    "[owned-transfer]".to_owned()
                } else {
                    return Err(format!("Unsupported symbol at {path}"));
                };
                if !keys.insert(key.clone()) {
                    return Err(format!("Duplicate key at {path}.{key}"));
                }
                if ["enumerable", "configurable", "writable"]
                    .iter()
                    .any(|key| !property[key].is_boolean())
                {
                    return Err(format!("Invalid descriptor at {path}.{key}"));
                }
                if (path == "$.wevuDefaults" || path.starts_with("$.wevuDefaults."))
                    && !(array && key == "length")
                    && property["enumerable"] != true
                {
                    return Err(format!(
                        "Non-enumerable defaults require fallback at {path}.{key}"
                    ));
                }
                if let Some(decoded) =
                    decode(&property["value"], &format!("{path}.{key}"), omitted)?
                {
                    entries.insert(key, decoded);
                } else if array {
                    return Err(format!("Undefined array member at {path}.{key}"));
                }
            }
            if array {
                let len = entries
                    .remove("length")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing array length")? as usize;
                if len != entries.len() {
                    return Err(format!("Sparse or extended array at {path}"));
                }
                let mut values = Vec::with_capacity(len);
                for i in 0..len {
                    values.push(
                        entries
                            .remove(&i.to_string())
                            .ok_or_else(|| format!("Sparse array at {path}"))?,
                    );
                }
                Value::Array(values)
            } else {
                Value::Object(entries)
            }
        }
        _ => return Err(format!("Unsupported tag {kind} at {path}")),
    }))
}
