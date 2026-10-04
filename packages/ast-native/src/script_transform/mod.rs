use std::path::{Path, PathBuf};

use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_codegen::{Codegen, CodegenOptions};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;

mod capabilities;
mod component_manifest;
mod component_options;
mod component_seed;
mod diagnostics;
mod fragments;
mod metadata;
mod provenance;
mod request;
mod rewrite;
mod transform;

#[cfg(test)]
mod tests;

pub use diagnostics::NativeScriptDiagnostic;

#[derive(Debug)]
#[napi(object)]
pub struct NativeScriptRoundTrip {
    pub status: String,
    pub code: Option<String>,
    pub map: Option<String>,
    pub parse_diagnostics: Vec<NativeScriptDiagnostic>,
    pub semantic_diagnostics: Vec<NativeScriptDiagnostic>,
    pub unsupported_reason: Option<String>,
}

impl NativeScriptRoundTrip {
    fn empty(status: &str) -> Self {
        Self {
            status: status.to_string(),
            code: None,
            map: None,
            parse_diagnostics: Vec::new(),
            semantic_diagnostics: Vec::new(),
            unsupported_reason: None,
        }
    }
}

/// 仅诊断已完成转换的 JS；一次调用完成解析、语义校验和代码生成，不承担 TS、JSX 或 Vue 转换。
#[napi(js_name = "roundTripScriptNative")]
pub fn round_trip_script_native(
    code: Utf16String,
    filename: Option<String>,
    minify: Option<bool>,
) -> napi::Result<NativeScriptRoundTrip> {
    let code = String::from_utf16(&code).map_err(|_| {
        napi::Error::from_reason("Experimental script input contains lone UTF-16 surrogates")
    })?;
    // sourcemap 的源标签也统一分隔符，避免诊断报告随执行平台改变。
    let filename = filename
        .unwrap_or_else(|| "inline.js".to_string())
        .replace('\\', "/");
    let source_type = match SourceType::from_path(Path::new(&filename)) {
        Ok(source_type) if source_type.is_javascript() && !source_type.is_jsx() => source_type,
        _ => {
            let mut result = NativeScriptRoundTrip::empty("unsupported-source-type");
            result.unsupported_reason = Some("Only already-transformed .js, .mjs and .cjs input is supported; TypeScript and JSX are not transformed".to_string());
            return Ok(result);
        }
    };
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, &code, source_type)
        .with_options(ParseOptions {
            parse_regular_expression: true,
            ..ParseOptions::default()
        })
        .parse();
    if parsed.fatal_error || !parsed.diagnostics.is_empty() {
        let mut result = NativeScriptRoundTrip::empty("parse-error");
        result.parse_diagnostics = diagnostics::diagnostics(&code, &parsed.diagnostics)?;
        return Ok(result);
    }
    let semantic = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program);
    if !semantic.diagnostics.is_empty() {
        let mut result = NativeScriptRoundTrip::empty("semantic-error");
        result.semantic_diagnostics = diagnostics::diagnostics(&code, &semantic.diagnostics)?;
        return Ok(result);
    }
    // minify 会改变输出形态；不调用 CodegenOptions::minify()，以免关闭 pure、license 等重要注释。
    let generated = Codegen::new()
        .with_options(CodegenOptions {
            minify: minify.unwrap_or(false),
            source_map_path: Some(PathBuf::from(filename)),
            ..CodegenOptions::default()
        })
        .build(&parsed.program);
    let map = generated.map.ok_or_else(|| {
        napi::Error::from_reason("Experimental script codegen did not produce a sourcemap")
    })?;
    let mut result = NativeScriptRoundTrip::empty("ok");
    result.code = Some(generated.code);
    result.map = Some(map.to_json_string());
    Ok(result)
}
