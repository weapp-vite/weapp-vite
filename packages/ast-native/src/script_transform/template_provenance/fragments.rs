use super::contract::{Occurrence, byte_offsets, range};
use oxc_allocator::Allocator;
use oxc_ast::ast::{CallExpression, Expression};
use oxc_parser::{ParseOptions, Parser};
use oxc_span::{ContentEq, GetSpan, GetSpanMut, SPAN, SourceType, Span};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Fragment {
    pub kind: String,
    pub role: String,
    pub generated: FragmentRange,
    pub source: FragmentRange,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FragmentRange {
    pub start: u32,
    pub end: u32,
    pub text: String,
}

pub struct FragmentOrigin {
    pub original: Span,
    pub generated_start: u32,
    pub generated_end: u32,
    pub generated_text: String,
    pub handle: Span,
}

fn literal(expression: &Expression<'_>) -> bool {
    matches!(
        expression,
        Expression::StringLiteral(_)
            | Expression::NumericLiteral(_)
            | Expression::BooleanLiteral(_)
            | Expression::NullLiteral(_)
    )
}

pub(super) fn validate(
    occurrence: &Occurrence,
    expression_span: Span,
    expression: &Expression<'_>,
    content: &str,
    offsets: &HashMap<u32, u32>,
) -> Result<Vec<FragmentOrigin>, String> {
    let Some(fragments) = &occurrence.fragments else {
        return Ok(Vec::new());
    };
    let Expression::CallExpression(call) = expression else {
        return Err("Argument provenance requires an unwrapped direct call".to_owned());
    };
    if fragments.is_empty() || fragments.len() != call.arguments.len() {
        return Err("Argument provenance must cover every argument in order".to_owned());
    }
    let mut origins = Vec::with_capacity(fragments.len());
    let mut generated_end = 0;
    for (fragment, argument) in fragments.iter().zip(&call.arguments) {
        let Some(argument) = argument.as_expression().filter(|value| literal(value)) else {
            return Err("Argument provenance supports only direct primitive literals".to_owned());
        };
        if fragment.kind != "inline-handler-argument-literal" || fragment.role != "copied" {
            return Err("Unsupported inline argument provenance fragment".to_owned());
        }
        let original = range(offsets, fragment.source.start, fragment.source.end)?;
        let expected = argument.span();
        if original.start != expression_span.start + expected.start
            || original.end != expression_span.start + expected.end
            || &content[original.start as usize..original.end as usize] != fragment.source.text
            || fragment.source.text != fragment.generated.text
        {
            return Err(
                "Argument provenance is not the corresponding original AST token".to_owned(),
            );
        }
        if fragment.generated.start < generated_end
            || fragment.generated.start >= fragment.generated.end
            || fragment.generated.end - fragment.generated.start
                != fragment.generated.text.encode_utf16().count() as u32
        {
            return Err("Invalid/overlapping generated argument provenance range".to_owned());
        }
        generated_end = fragment.generated.end;
        origins.push(FragmentOrigin {
            original,
            generated_start: fragment.generated.start,
            generated_end: fragment.generated.end,
            generated_text: fragment.generated.text.clone(),
            handle: SPAN,
        });
    }
    Ok(origins)
}

/// 只核对真实 asset 的同序参数并标记现有 AST；合成 metadata 的其余节点仍保留 synthetic span。
pub(super) fn apply(
    call: &mut CallExpression<'_>,
    source: &str,
    fragments: &[FragmentOrigin],
) -> Result<(), String> {
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, SourceType::mjs())
        .with_options(ParseOptions {
            preserve_parens: true,
            ..ParseOptions::default()
        })
        .parse_expression()
        .map_err(|_| "Invalid generated inline expression")?;
    let Expression::CallExpression(parsed) = parsed else {
        return Err("Generated inline provenance is not a direct call".to_owned());
    };
    if !call.content_eq(&parsed) || fragments.len() != parsed.arguments.len() {
        return Err("Generated inline AST differs from the actual asset".to_owned());
    }
    let offsets = byte_offsets(source);
    for ((fragment, expected), target) in fragments
        .iter()
        .zip(&parsed.arguments)
        .zip(&mut call.arguments)
    {
        let expected = expected
            .as_expression()
            .filter(|value| literal(value))
            .ok_or("Generated argument is not a direct primitive literal")?;
        let span = range(&offsets, fragment.generated_start, fragment.generated_end)?;
        if expected.span() != span
            || &source[span.start as usize..span.end as usize] != fragment.generated_text
        {
            return Err("Generated argument provenance token differs".to_owned());
        }
        let target = target
            .as_expression_mut()
            .ok_or("Generated argument is a spread")?;
        if target.span() != SPAN {
            return Err("Generated argument already has provenance".to_owned());
        }
        *target.span_mut() = fragment.handle;
    }
    Ok(())
}
