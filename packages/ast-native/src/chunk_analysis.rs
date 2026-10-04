use std::path::Path;

use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::ast::{
    CallExpression, ComputedMemberExpression, Expression, IdentifierReference,
    PrivateFieldExpression, StaticMemberExpression,
};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{Semantic, SemanticBuilder};
use oxc_span::{GetSpan, SourceType, Span};

#[napi(object)]
pub struct NativeChunkRewriteInput {
    pub code: String,
    pub filename: Option<String>,
}

#[napi(object)]
pub struct NativeChunkRewriteRange {
    pub start: u32,
    pub end: u32,
}

#[napi(object)]
pub struct NativeChunkRequireLiteral {
    pub start: u32,
    pub end: u32,
    pub value: String,
}

#[napi(object)]
pub struct NativeChunkRewriteAnalysis {
    pub require_literals: Vec<NativeChunkRequireLiteral>,
    pub platform_api_objects: Vec<NativeChunkRewriteRange>,
}

// 仅记录非 ASCII 字符造成的累计偏移，避免为每个节点重新扫描源码前缀。
struct Utf16Offsets {
    deltas: Vec<(u32, u32)>,
}

impl Utf16Offsets {
    fn new(code: &str) -> Self {
        let mut deltas = Vec::new();
        let mut delta = 0;
        for (start, character) in code.char_indices() {
            if !character.is_ascii() {
                delta += (character.len_utf8() - character.len_utf16()) as u32;
                deltas.push(((start + character.len_utf8()) as u32, delta));
            }
        }
        Self { deltas }
    }

    fn offset(&self, byte: u32) -> u32 {
        let index = self.deltas.partition_point(|(end, _)| *end <= byte);
        byte - index.checked_sub(1).map_or(0, |index| self.deltas[index].1)
    }

    fn range(&self, span: Span) -> NativeChunkRewriteRange {
        NativeChunkRewriteRange {
            start: self.offset(span.start),
            end: self.offset(span.end),
        }
    }
}

struct ChunkAnalysisVisitor<'s, 'a> {
    semantic: &'s Semantic<'a>,
    offsets: &'s Utf16Offsets,
    result: NativeChunkRewriteAnalysis,
    unsupported_literal: bool,
}

impl<'s, 'a> ChunkAnalysisVisitor<'s, 'a> {
    fn is_unbound(&self, identifier: &IdentifierReference<'a>) -> bool {
        self.semantic.is_reference_to_global_variable(identifier)
    }

    fn collect_platform_object(&mut self, expression: &Expression<'a>) {
        if let Expression::Identifier(identifier) = expression.without_parentheses()
            && super::is_platform_api_identifier(identifier.name.as_str())
            && self.is_unbound(identifier)
        {
            self.result.platform_api_objects.push(self.offsets.range(identifier.span));
        }
    }
}

impl<'s, 'a> Visit<'a> for ChunkAnalysisVisitor<'s, 'a> {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        // Babel 的现有改写只处理 CallExpression，不处理 OptionalCallExpression。
        if !call.optional
            && let Expression::Identifier(identifier) = call.callee.without_parentheses()
            && identifier.name.as_str() == "require"
            && self.is_unbound(identifier)
            && let Some(argument) = call.arguments.first().and_then(|arg| arg.as_expression())
            && let Some(value) = super::static_string_literal_value(argument.without_parentheses())
        {
            let argument = argument.without_parentheses();
            let lone_surrogates = match argument {
                Expression::StringLiteral(literal) => literal.lone_surrogates,
                Expression::TemplateLiteral(template) => template.quasis.iter().any(|quasi| quasi.lone_surrogates),
                _ => false,
            };
            if lone_surrogates {
                self.unsupported_literal = true;
            } else {
                let range = self.offsets.range(argument.span());
                self.result.require_literals.push(NativeChunkRequireLiteral {
                    start: range.start,
                    end: range.end,
                    value: value.to_string(),
                });
            }
        }
        walk::walk_call_expression(self, call);
    }

    fn visit_static_member_expression(&mut self, member: &StaticMemberExpression<'a>) {
        self.collect_platform_object(&member.object);
        walk::walk_static_member_expression(self, member);
    }

    fn visit_computed_member_expression(&mut self, member: &ComputedMemberExpression<'a>) {
        self.collect_platform_object(&member.object);
        walk::walk_computed_member_expression(self, member);
    }

    fn visit_private_field_expression(&mut self, member: &PrivateFieldExpression<'a>) {
        self.collect_platform_object(&member.object);
        walk::walk_private_field_expression(self, member);
    }
}

fn analyze_chunk(input: NativeChunkRewriteInput) -> napi::Result<NativeChunkRewriteAnalysis> {
    let allocator = Allocator::default();
    let filename = input.filename.as_deref().unwrap_or("chunk.js");
    let source_type = SourceType::from_path(Path::new(filename))
        .unwrap_or_else(|_| SourceType::mjs())
        .with_module(true);
    let parsed = Parser::new(&allocator, &input.code, source_type)
        .with_options(ParseOptions { preserve_parens: false, ..ParseOptions::default() })
        .parse();
    if parsed.fatal_error || !parsed.diagnostics.is_empty() {
        return Err(napi::Error::from_reason("Experimental chunk parsing failed"));
    }
    let built = SemanticBuilder::new().with_check_syntax_error(true).build(&parsed.program);
    if !built.diagnostics.is_empty() {
        return Err(napi::Error::from_reason("Experimental chunk semantic analysis failed"));
    }
    let offsets = Utf16Offsets::new(&input.code);
    let mut visitor = ChunkAnalysisVisitor {
        semantic: &built.semantic,
        offsets: &offsets,
        result: NativeChunkRewriteAnalysis {
            require_literals: Vec::new(),
            platform_api_objects: Vec::new(),
        },
        unsupported_literal: false,
    };
    visitor.visit_program(&parsed.program);
    if visitor.unsupported_literal {
        return Err(napi::Error::from_reason("Experimental chunk literal contains lone surrogates"));
    }
    Ok(visitor.result)
}

/// 实验批处理入口；每份源码只解析一次，仅返回改写所需事实，不导出 AST。
#[napi(js_name = "analyzeChunkRewritesNative")]
pub fn analyze_chunk_rewrites_native(
    inputs: Vec<NativeChunkRewriteInput>,
) -> napi::Result<Vec<NativeChunkRewriteAnalysis>> {
    inputs.into_iter().map(analyze_chunk).collect()
}
