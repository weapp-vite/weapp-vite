use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSymbols {
    pub normalize_class: String,
    pub normalize_style: String,
    pub unref: String,
    pub resolve_prop_value: String,
    pub props_key: String,
    pub slot_owner_key: String,
    pub slot_owner_proxy_key: String,
    pub slot_props_data_key: String,
    pub inline_map_key: String,
    pub expression_error_identifier: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct ExpressionSource {
    pub role: String,
    pub source: String,
}

impl ExpressionSource {
    pub fn read(&self, role: &str) -> Result<&str, String> {
        if self.role != role {
            return Err(format!(
                "Metadata expression role differs: expected {role}, got {}",
                self.role
            ));
        }
        Ok(&self.source)
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(super) enum BindingKind {
    Class,
    Style,
    Bind,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Binding {
    pub name: String,
    pub r#type: BindingKind,
    pub exp: String,
    pub exp_ast: Option<ExpressionSource>,
    pub for_stack: Option<Vec<ForInfo>>,
    pub conditions: Option<Vec<Condition>>,
    pub error_fallback: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ForInfo {
    pub list_exp: Option<String>,
    pub list_exp_ast: Option<ExpressionSource>,
    pub raw_list_exp_ast: Option<ExpressionSource>,
    pub projected_list_exp_ast: Option<ExpressionSource>,
    pub item: Option<String>,
    pub index: Option<String>,
    pub key: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Condition {
    pub exp_ast: ExpressionSource,
    pub raw_exp_ast: Option<ExpressionSource>,
    pub for_depth: usize,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct InlineExpression {
    pub id: String,
    pub expression: String,
    pub scope_keys: Vec<String>,
    pub parameter_names: ParameterNames,
    pub index_bindings: Option<Vec<IndexBinding>>,
    pub scope_resolvers: Option<Vec<ScopeResolver>>,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct ParameterNames {
    pub context: String,
    pub scope: String,
    pub event: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct IndexBinding {
    pub key: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(super) struct ScopeResolver {
    pub key: String,
    pub expression: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Options {
    pub class_style_bindings: Option<Vec<Binding>>,
    pub inline_expressions: Option<Vec<InlineExpression>>,
    pub props_aliases: Option<serde_json::Value>,
}

pub(super) fn quote(value: &str) -> String {
    serde_json::to_string(value).expect("a Rust string is always JSON serializable")
}
