use super::{metadata::MetadataSymbols, rewrite::RewriteContract};
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};

pub struct Request {
    pub options: Value,
    pub contract: Value,
    pub omitted_undefined: Vec<String>,
}

pub fn string(value: &Value, key: &str) -> Result<String, String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| format!("Missing contract string: {key}"))
}

#[path = "request_decode.rs"]
mod decoder;
use decoder::decode;

impl Request {
    pub fn parse(source: &str) -> Result<Self, String> {
        let raw: Value =
            serde_json::from_str(source).map_err(|e| format!("Invalid script request: {e}"))?;
        if raw["schemaVersion"] != 1 || !raw["contract"].is_object() {
            return Err("Unsupported script request version/contract".to_owned());
        }
        let declared = [
            "isTypeScript",
            "skipComponentTransform",
            "isApp",
            "isPage",
            "templateComponentMeta",
            "wevuDefaults",
            "minify",
            "sourceMap",
            "warn",
            "classStyleRuntime",
            "classStyleBindings",
            "templateRefs",
            "layoutHosts",
            "inlineExpressions",
            "bindingManifest",
            "runtimeBindingManifest",
            "autoSetDataPick",
            "pageLayout",
            "runtimeCapabilities",
            "functionPropPaths",
            "propsAliases",
            "propsDerivedKeys",
            "relaxStructuredTypeOnlyProps",
            "scopedSlotHostProperties",
            "cssModules",
            "stabilizeCssVarsRuntime",
        ];
        if let Some(properties) = raw["options"]["properties"].as_array() {
            for property in properties {
                if let Some(key) = property["key"].as_str()
                    && !declared.contains(&key)
                {
                    return Err(format!("Unknown script option: {key}"));
                }
            }
        }
        let mut omitted_undefined = Vec::new();
        let options = decode(&raw["options"], "$", &mut omitted_undefined)?
            .unwrap_or_else(|| serde_json::json!({}));
        if !options.is_object() {
            return Err("Script options must be an object".to_owned());
        }
        for key in [
            "isTypeScript",
            "skipComponentTransform",
            "isApp",
            "isPage",
            "minify",
            "sourceMap",
            "autoSetDataPick",
            "relaxStructuredTypeOnlyProps",
            "scopedSlotHostProperties",
            "stabilizeCssVarsRuntime",
        ] {
            if options.get(key).is_some_and(|value| !value.is_boolean()) {
                return Err(format!("Invalid boolean option: {key}"));
            }
        }
        let supported = [
            "isTypeScript",
            "skipComponentTransform",
            "isApp",
            "isPage",
            "minify",
            "sourceMap",
            "warn",
            "wevuDefaults",
            "classStyleRuntime",
            "classStyleBindings",
            "inlineExpressions",
            "bindingManifest",
            "runtimeBindingManifest",
            "runtimeCapabilities",
            "functionPropPaths",
            "autoSetDataPick",
        ];
        let deferred = [
            "templateComponentMeta",
            "templateRefs",
            "layoutHosts",
            "pageLayout",
            "propsAliases",
            "propsDerivedKeys",
            "relaxStructuredTypeOnlyProps",
            "scopedSlotHostProperties",
            "cssModules",
            "stabilizeCssVarsRuntime",
        ];
        for (key, value) in options.as_object().unwrap() {
            if supported.contains(&key.as_str()) {
                continue;
            }
            let empty = value.is_null()
                || value == false
                || value.as_array().is_some_and(Vec::is_empty)
                || value.as_object().is_some_and(Map::is_empty);
            if !deferred.contains(&key.as_str()) || !empty {
                return Err(format!("Unsupported script option: {key}"));
            }
        }
        if options["isApp"] == true || options["autoSetDataPick"] == true {
            return Err(
                "App/defaults installation and automatic setData picking are deferred".to_owned(),
            );
        }
        Ok(Self {
            options,
            contract: raw["contract"].clone(),
            omitted_undefined,
        })
    }

    pub fn marker(&self, name: &str) -> Result<String, String> {
        string(&self.contract["markers"], name)
    }
    pub fn runtime(&self) -> &Value {
        &self.contract["runtime"]
    }
    pub fn rewrite_contract(&self) -> Result<RewriteContract, String> {
        let runtime = self.runtime();
        fn strings(value: &Value) -> Result<HashSet<String>, String> {
            value
                .as_array()
                .ok_or("Missing runtime set")?
                .iter()
                .map(|v| {
                    v.as_str()
                        .map(str::to_owned)
                        .ok_or("Non-string runtime set".to_owned())
                })
                .collect()
        }
        let routes: HashMap<String, String> =
            serde_json::from_value(runtime["apiModules"].clone()).map_err(|e| e.to_string())?;
        Ok(RewriteContract {
            public_module: string(runtime, "publicModule")?,
            recognized_modules: strings(&runtime["recognizedModules"])?,
            runtime_import_routes: routes,
            movable_wevu_imports: strings(&runtime["movableWevuImports"])?,
            moved_vue_imports: strings(&runtime["movedVueImports"])?,
            template_component_names: HashSet::new(),
            define_component: string(&runtime["apis"], "defineComponent")?,
        })
    }
    pub fn symbols(&self) -> Result<MetadataSymbols, String> {
        Ok(MetadataSymbols {
            normalize_class: string(&self.runtime()["classStyleHelpers"], "normalizeClass")?,
            normalize_style: string(&self.runtime()["classStyleHelpers"], "normalizeStyle")?,
            unref: string(&self.runtime()["classStyleHelpers"], "unref")?,
            resolve_prop_value: string(&self.runtime()["classStyleHelpers"], "resolvePropValue")?,
            props_key: self.marker("WEVU_PROPS_KEY")?,
            slot_owner_key: self.marker("WEVU_SLOT_OWNER_KEY")?,
            slot_owner_proxy_key: self.marker("WEVU_SLOT_OWNER_PROXY_KEY")?,
            slot_props_data_key: self.marker("WEVU_SLOT_PROPS_DATA_KEY")?,
            inline_map_key: self.marker("WEVU_INLINE_MAP_KEY")?,
            expression_error_identifier: self.marker("WEVU_EXPRESSION_ERROR_IDENTIFIER")?,
        })
    }
}
