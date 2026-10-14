use std::{collections::HashMap, path::Path};

use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast_visit::Visit;
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;

mod types;
mod visitor;
use types::NativeNpmChunkAnalysis;
use visitor::NpmChunkVisitor;

#[napi(object)]
pub struct NativeNpmChunkAnalysisInput {
    pub code: Utf16String,
    pub filename: Option<String>,
}

fn analyze(code: &str, filename: Option<&str>) -> Option<NativeNpmChunkAnalysis> {
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(Path::new(filename.unwrap_or("chunk.js"))).ok()?;
    let parsed = Parser::new(&allocator, code, source_type).parse();
    if parsed.fatal_error || !parsed.diagnostics.is_empty() {
        return None;
    }
    let semantic = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program);
    if !semantic.diagnostics.is_empty() {
        return None;
    }
    let mut visitor = NpmChunkVisitor::new(semantic.semantic.scoping(), code);
    visitor.visit_program(&parsed.program);
    visitor.finish()
}

/// 最终 chunk 一次批量跨界；相同源码共享 parse，失败项交回原 JS 重写。
#[napi(js_name = "analyzeNpmChunksNative")]
pub fn analyze_npm_chunks_native(
    inputs: Vec<NativeNpmChunkAnalysisInput>,
) -> Vec<Option<NativeNpmChunkAnalysis>> {
    let mut analyses = HashMap::new();
    inputs
        .into_iter()
        .map(|input| {
            let code = String::from_utf16(&input.code).ok()?;
            let key = (code, input.filename);
            analyses
                .entry(key)
                .or_insert_with_key(|key| analyze(&key.0, key.1.as_deref()))
                .clone()
        })
        .collect()
}

#[cfg(test)]
mod tests;
