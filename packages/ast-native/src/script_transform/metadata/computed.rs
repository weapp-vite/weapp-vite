use super::contract::{Binding, BindingKind, ForInfo, MetadataSymbols, quote};
use super::expression::{contains_slot_owner, rewrite_data_access, valid_identifier};

fn error_log(method: &str, message: &str, error: &str) -> String {
    format!(
        "if(typeof console!==\"undefined\"&&typeof console.{method}===\"function\"){{console.{method}({}, {error});}}",
        quote(message)
    )
}

fn normalized(binding: &Binding, symbols: &MetadataSymbols) -> Result<String, String> {
    let source = binding
        .exp_ast
        .as_ref()
        .map(|source| source.read("expAst"))
        .transpose()?;
    let error = &symbols.expression_error_identifier;
    let (value, fallback, log) = if binding.r#type == BindingKind::Bind {
        let source = source.unwrap_or("undefined");
        let log = if contains_slot_owner(source, symbols)? {
            String::new()
        } else {
            error_log(
                "error",
                &format!(
                    "[wevu] 模板运行时表达式执行失败: {} = {}",
                    binding.name, binding.exp
                ),
                error,
            )
        };
        (source.to_string(), "undefined".to_string(), log)
    } else {
        let helper = if binding.r#type == BindingKind::Class {
            &symbols.normalize_class
        } else {
            &symbols.normalize_style
        };
        let source = rewrite_data_access(source.unwrap_or("\"\""), symbols)?;
        (
            format!("{helper}(({source}))"),
            quote(binding.error_fallback.as_deref().unwrap_or("")),
            String::new(),
        )
    };
    Ok(format!(
        "(()=>{{try{{return ({value});}}catch({error}){{{log}return {fallback};}}}})()"
    ))
}

fn list_source<'a>(binding: &Binding, info: &'a ForInfo) -> Result<&'a str, String> {
    let source = if binding.exp.starts_with("v-for :key ") {
        info.raw_list_exp_ast
            .as_ref()
            .map(|source| (source, "rawListExpAst"))
    } else {
        info.projected_list_exp_ast
            .as_ref()
            .map(|source| (source, "projectedListExpAst"))
    }
    .or_else(|| {
        info.list_exp_ast
            .as_ref()
            .map(|source| (source, "listExpAst"))
    });
    source
        .map(|(source, role)| source.read(role))
        .transpose()
        .map(|value| value.unwrap_or("[]"))
}

fn loop_expression(
    binding: &Binding,
    stack: &[ForInfo],
    depth: usize,
    symbols: &MetadataSymbols,
) -> Result<String, String> {
    if depth == stack.len() {
        return normalized(binding, symbols);
    }
    let info = &stack[depth];
    let inner = expression(binding, stack, depth + 1, symbols)?;
    let list = format!("__wv_list_{depth}");
    let item = info
        .item
        .as_deref()
        .filter(|name| valid_identifier(name))
        .map(str::to_string)
        .unwrap_or_else(|| format!("__wv_item_{depth}"));
    let index = info
        .index
        .as_deref()
        .filter(|name| valid_identifier(name))
        .map(str::to_string)
        .unwrap_or_else(|| format!("__wv_index_{depth}"));
    let key = info.key.as_deref().filter(|name| valid_identifier(name));
    let array_key = key
        .filter(|name| *name != index)
        .map(|key| format!("const {key}={index};"))
        .unwrap_or_default();
    let array = format!("{list}.map(({item},{index})=>{{{array_key}return ({inner});}})");
    let result = format!("__wv_res_{depth}");
    let keys = format!("__wv_keys_{depth}");
    let loop_index = format!("__wv_i_{depth}");
    let object_key = format!("__wv_key_{depth}");
    let object_item = format!("__wv_item_{depth}");
    let mut aliases = String::new();
    if let Some(item) = info
        .item
        .as_deref()
        .filter(|name| valid_identifier(name) && *name != object_item)
    {
        aliases.push_str(&format!("const {item}={object_item};"));
    }
    if let Some(key) = key.filter(|name| *name != object_key) {
        aliases.push_str(&format!("const {key}={object_key};"));
    }
    if let Some(index) = info.index.as_deref().filter(|name| valid_identifier(name)) {
        let value = if key.is_some() {
            &loop_index
        } else {
            &object_key
        };
        if index != value {
            aliases.push_str(&format!("const {index}={value};"));
        }
    }
    let object = format!(
        "const {result}={{}};const {keys}=Object.keys({list});for(let {loop_index}=0;{loop_index}<{keys}.length;{loop_index}++){{const {object_key}={keys}[{loop_index}];const {object_item}={list}[{object_key}];{aliases}{result}[{object_key}]=({inner});}}return {result};"
    );
    let source = list_source(binding, info)?;
    let error = format!("__wv_err_{depth}");
    let diagnostic = info.list_exp.as_deref().unwrap_or("undefined");
    let suppress = diagnostic
        .trim()
        .starts_with(&format!("{}.", symbols.slot_props_data_key))
        || diagnostic
            .trim()
            .starts_with(&format!("{}.", symbols.slot_owner_key))
        || info
            .list_exp_ast
            .as_ref()
            .map(|source| {
                source
                    .read("listExpAst")
                    .and_then(|source| contains_slot_owner(source, symbols))
            })
            .transpose()?
            .unwrap_or(false);
    let log = if suppress {
        String::new()
    } else {
        error_log(
            "error",
            &format!("[wevu] 模板 v-for 数据源表达式执行失败: {diagnostic}"),
            &error,
        )
    };
    Ok(format!(
        "(()=>{{let {list}=[];try{{{list}={}(({source}));}}catch({error}){{{log}{list}=[];}}if(typeof {list}===\"number\"&&Number.isFinite({list})){{{list}=Array.from({{length:Math.max(0,Math.floor({list}))}},(_,__wv_numeric_index_{depth})=>__wv_numeric_index_{depth});}}if(Array.isArray({list})){{return {array};}}else if({list}!=null&&typeof {list}===\"object\"){{{object}}}else{{return [];}}}})()",
        symbols.unref
    ))
}

fn expression(
    binding: &Binding,
    stack: &[ForInfo],
    depth: usize,
    symbols: &MetadataSymbols,
) -> Result<String, String> {
    let body = loop_expression(binding, stack, depth, symbols)?;
    let mut conditions = Vec::new();
    for condition in binding
        .conditions
        .as_deref()
        .unwrap_or_default()
        .iter()
        .filter(|condition| condition.for_depth == depth)
    {
        let source = if binding.exp.starts_with("v-for :key ") {
            condition
                .raw_exp_ast
                .as_ref()
                .map(|source| source.read("rawExpAst"))
                .transpose()?
                .unwrap_or(condition.exp_ast.read("expAst")?)
        } else {
            condition.exp_ast.read("expAst")?
        };
        conditions.push(format!("({source})"));
    }
    if conditions.is_empty() {
        return Ok(body);
    }
    let fallback = if depth < stack.len() {
        "[]"
    } else if binding.r#type == BindingKind::Bind {
        "undefined"
    } else {
        "\"\""
    };
    Ok(format!("({})?({body}):{fallback}", conditions.join("&&")))
}

pub(super) fn property(binding: &Binding, symbols: &MetadataSymbols) -> Result<String, String> {
    let body = expression(
        binding,
        binding.for_stack.as_deref().unwrap_or_default(),
        0,
        symbols,
    )?;
    let key = if valid_identifier(&binding.name) {
        binding.name.clone()
    } else {
        quote(&binding.name)
    };
    Ok(format!("{key}:function(){{return ({body});}}"))
}
