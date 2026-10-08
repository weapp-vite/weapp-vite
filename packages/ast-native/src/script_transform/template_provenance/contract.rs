use oxc_allocator::Allocator;
use oxc_ast::ast::Expression;
use oxc_parser::{ParseOptions, Parser};
use oxc_span::{SourceType, Span};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};

use super::fragments;
pub(super) use super::fragments::{Fragment, FragmentOrigin};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SourceContract {
    pub schema_version: u8,
    pub coordinate_encoding: String,
    pub sources: Vec<Source>,
    pub occurrences: Vec<Occurrence>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Source {
    pub id: String,
    pub filename: String,
    pub content: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Occurrence {
    pub id: String,
    pub kind: String,
    pub source_id: String,
    pub inline_id: String,
    pub expression: ExpressionRange,
    pub callee: CalleeRange,
    pub fragments: Option<Vec<Fragment>>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExpressionRange {
    pub start: u32,
    pub end: u32,
    pub text: String,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CalleeRange {
    pub start: u32,
    pub end: u32,
    pub name: String,
}

pub struct CalleeOrigin {
    pub inline_id: String,
    pub name: String,
    pub source_index: usize,
    pub original: Span,
    pub handle: Span,
    pub fragments: Vec<FragmentOrigin>,
}

pub(super) fn byte_offsets(source: &str) -> HashMap<u32, u32> {
    let mut offsets = HashMap::new();
    let mut utf16 = 0;
    for (byte, character) in source.char_indices() {
        offsets.insert(utf16, byte as u32);
        utf16 += character.len_utf16() as u32;
    }
    offsets.insert(utf16, source.len() as u32);
    offsets
}
pub(super) fn range(offsets: &HashMap<u32, u32>, start: u32, end: u32) -> Result<Span, String> {
    if start >= end {
        return Err("Empty/reversed provenance range".to_owned());
    }
    Ok(Span::new(
        *offsets
            .get(&start)
            .ok_or("Invalid UTF-16 provenance start")?,
        *offsets.get(&end).ok_or("Invalid UTF-16 provenance end")?,
    ))
}

fn unparen<'b, 'a>(mut expression: &'b Expression<'a>) -> &'b Expression<'a> {
    while let Expression::ParenthesizedExpression(parenthesized) = expression {
        expression = &parenthesized.expression;
    }
    expression
}

fn validate_callee(
    occurrence: &Occurrence,
    expression_span: Span,
    callee_span: Span,
    expression: &Expression<'_>,
) -> Result<(), String> {
    let callee = match unparen(expression) {
        Expression::Identifier(identifier) => identifier,
        Expression::CallExpression(call) if !call.optional && call.type_arguments.is_none() => {
            let Expression::Identifier(identifier) = unparen(&call.callee) else {
                return Err("Original handler callee is not a direct identifier".to_owned());
            };
            identifier
        }
        _ => return Err("Original handler is not an identifier or direct call".to_owned()),
    };
    if callee.name.as_str() != occurrence.callee.name
        || callee.span.start + expression_span.start != callee_span.start
        || callee.span.end + expression_span.start != callee_span.end
    {
        return Err("Original handler AST callee differs from occurrence".to_owned());
    }
    Ok(())
}

pub fn validate(main: &str, contract: &SourceContract) -> Result<Vec<CalleeOrigin>, String> {
    if contract.schema_version != 1
        || contract.coordinate_encoding != "utf16"
        || contract.sources.is_empty()
        || contract.occurrences.is_empty()
    {
        return Err("Unsupported/empty template provenance contract".to_owned());
    }
    let mut source_ids = HashMap::new();
    let mut filenames = HashSet::new();
    let mut indexes = Vec::new();
    let mut total = main
        .len()
        .checked_add(2)
        .ok_or("Provenance source size overflow")?;
    for (index, source) in contract.sources.iter().enumerate() {
        let filename = source.filename.replace('\\', "/");
        if source.id.is_empty()
            || source.filename.is_empty()
            || filename == "inline.ts"
            || filename.contains('\0')
            || !filenames.insert(filename)
            || source_ids.insert(source.id.as_str(), index).is_some()
        {
            return Err("Duplicate/invalid provenance source identity".to_owned());
        }
        total = total
            .checked_add(source.content.len())
            .and_then(|n| n.checked_add(3))
            .ok_or("Provenance source size overflow")?;
        if total > u32::MAX as usize {
            return Err("Provenance sources exceed u32 spans".to_owned());
        }
        indexes.push(byte_offsets(&source.content));
    }
    let mut occurrence_ids = HashSet::new();
    let mut inline_ids = HashSet::new();
    let mut handle = u32::try_from(main.len())
        .map_err(|_| "Script exceeds u32 spans")?
        .checked_add(1)
        .ok_or("Provenance handle overflow")?;
    let mut origins = Vec::new();
    for occurrence in &contract.occurrences {
        if occurrence.id.is_empty()
            || occurrence.inline_id.is_empty()
            || occurrence.kind != "inline-handler-callee"
            || !occurrence_ids.insert(&occurrence.id)
            || !inline_ids.insert(&occurrence.inline_id)
        {
            return Err("Duplicate/unsupported provenance occurrence".to_owned());
        }
        let source_index = *source_ids
            .get(occurrence.source_id.as_str())
            .ok_or("Unknown provenance source")?;
        let content = &contract.sources[source_index].content;
        let offsets = &indexes[source_index];
        let expression = range(
            offsets,
            occurrence.expression.start,
            occurrence.expression.end,
        )?;
        let callee = range(offsets, occurrence.callee.start, occurrence.callee.end)?;
        if callee.start < expression.start
            || callee.end > expression.end
            || &content[expression.start as usize..expression.end as usize]
                != occurrence.expression.text
            || &content[callee.start as usize..callee.end as usize] != occurrence.callee.name
        {
            return Err("Provenance occurrence source slice differs".to_owned());
        }
        let allocator = Allocator::default();
        let parsed = Parser::new(&allocator, &occurrence.expression.text, SourceType::mjs())
            .with_options(ParseOptions {
                preserve_parens: true,
                ..ParseOptions::default()
            })
            .parse_expression()
            .map_err(|_| "Invalid original handler expression")?;
        validate_callee(occurrence, expression, callee, &parsed)?;
        let mut fragments = fragments::validate(occurrence, expression, &parsed, content, offsets)?;
        let end = handle
            .checked_add(callee.size())
            .ok_or("Provenance handle overflow")?;
        let callee_handle = Span::new(handle, end);
        handle = end.checked_add(1).ok_or("Provenance handle overflow")?;
        for fragment in &mut fragments {
            let end = handle
                .checked_add(fragment.generated_text.len() as u32)
                .ok_or("Provenance handle overflow")?;
            fragment.handle = Span::new(handle, end);
            handle = end.checked_add(1).ok_or("Provenance handle overflow")?;
        }
        origins.push(CalleeOrigin {
            inline_id: occurrence.inline_id.clone(),
            name: occurrence.callee.name.clone(),
            source_index,
            original: callee,
            handle: callee_handle,
            fragments,
        });
    }
    if source_ids.len()
        != origins
            .iter()
            .map(|origin| origin.source_index)
            .collect::<HashSet<_>>()
            .len()
    {
        return Err("Unused provenance source".to_owned());
    }
    Ok(origins)
}
