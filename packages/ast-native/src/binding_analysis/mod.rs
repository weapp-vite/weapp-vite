use std::collections::{HashMap, HashSet, hash_map::Entry};

use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_allocator::Allocator;

mod normalize;
mod references;
mod summary;

#[cfg(test)]
mod tests;

#[napi(object)]
pub struct NativeBindingExpressionInput {
    pub expression: Utf16String,
    pub locals: Vec<Utf16String>,
    pub safe_call_names: Vec<Utf16String>,
}

#[derive(Clone)]
#[napi(object)]
pub struct NativeBindingDependency {
    pub root: String,
    pub path: Option<String>,
    pub mode: String,
}

#[napi(object)]
pub struct NativeBindingExpressionAnalysis {
    pub dependencies: Vec<NativeBindingDependency>,
    pub snapshot_fallback: bool,
}

fn lossless_string(value: &Utf16String) -> napi::Result<String> {
    String::from_utf16(value).map_err(|_| napi::Error::from_reason("Experimental binding input contains lone UTF-16 surrogates"))
}

fn string_set(values: &[Utf16String]) -> napi::Result<HashSet<String>> {
    values.iter().map(lossless_string).collect()
}

fn specialize_summary(
    summary: &summary::BindingExpressionSummary,
    locals: &HashSet<String>,
    safe_call_names: &HashSet<String>,
    ignored_globals: &HashSet<String>,
) -> NativeBindingExpressionAnalysis {
    NativeBindingExpressionAnalysis {
        dependencies: summary.dependencies.iter()
            .filter(|dependency| !locals.contains(&dependency.root) && !ignored_globals.contains(&dependency.root))
            .cloned()
            .collect(),
        snapshot_fallback: summary.unconditional_snapshot_fallback
            || summary.direct_call_names.iter().any(|name| !safe_call_names.contains(name)),
    }
}

/// 实验批处理入口；同批唯一表达式只解析一次，逐项特化并保留整批无损回退边界。
#[napi(js_name = "analyzeBindingExpressionsNative")]
pub fn analyze_binding_expressions_native(
    inputs: Vec<NativeBindingExpressionInput>,
    ignored_globals: Vec<Utf16String>,
) -> napi::Result<Vec<Option<NativeBindingExpressionAnalysis>>> {
    let ignored_globals = string_set(&ignored_globals)?;
    let mut allocator = Allocator::default();
    let mut summaries = HashMap::new();
    let mut results = Vec::with_capacity(inputs.len());
    for input in inputs {
        let expression = lossless_string(&input.expression)?;
        // 即使命中成功或解析失败的摘要，也必须逐项校验所有 UTF-16 配置字符串。
        let locals = string_set(&input.locals)?;
        let safe_call_names = string_set(&input.safe_call_names)?;
        let summary = match summaries.entry(expression) {
            Entry::Occupied(entry) => entry.into_mut(),
            Entry::Vacant(entry) => {
                let result = summary::parse_expression_summary(entry.key(), &allocator);
                // 返回值只持有自有数据；成功、解析失败和错误均在传播前释放本次 AST。
                allocator.reset();
                #[cfg(test)]
                tests::record_reset(allocator.used_bytes());
                entry.insert(result?)
            }
        };
        results.push(summary.as_ref().map(|summary| {
            specialize_summary(summary, &locals, &safe_call_names, &ignored_globals)
        }));
    }
    Ok(results)
}
