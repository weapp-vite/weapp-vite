use oxc_allocator::Allocator;
use oxc_ast::ast::{Expression, ObjectPropertyKind, PropertyKind, StaticMemberExpression};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::{ParseOptions, Parser};
use oxc_span::{SourceType, Span};

use super::contract::{MetadataSymbols, quote};

pub(super) fn valid_identifier(name: &str) -> bool {
    oxc_syntax::identifier::is_identifier_name(name)
        && !oxc_syntax::keyword::is_reserved_keyword(name)
}

pub(super) fn parse<'a>(
    allocator: &'a Allocator,
    source: &'a str,
) -> Result<Expression<'a>, String> {
    Parser::new(allocator, source, SourceType::mjs())
        .with_options(ParseOptions {
            preserve_parens: false,
            ..ParseOptions::default()
        })
        .parse_expression()
        .map_err(|_| "Unsupported metadata expression syntax".to_string())
}

// 模板解析器会剥离 TS；POC 尚未承担这一步时必须回退，不能把合法 TS 静默改成 undefined。
pub(super) fn inline_source(source: &str) -> Result<String, String> {
    let allocator = Allocator::default();
    if parse(&allocator, source).is_ok() {
        return Ok(source.to_string());
    }
    if Parser::new(&allocator, source, SourceType::ts())
        .parse_expression()
        .is_ok()
    {
        return Err(
            "TypeScript inline metadata expression requires the JavaScript fallback".to_string(),
        );
    }
    Ok("undefined".to_string())
}

pub(super) fn contains_slot_owner(source: &str, symbols: &MetadataSymbols) -> Result<bool, String> {
    struct Owner<'s> {
        symbols: &'s MetadataSymbols,
        found: bool,
    }
    impl<'a> Visit<'a> for Owner<'_> {
        fn visit_static_member_expression(&mut self, member: &StaticMemberExpression<'a>) {
            if !member.optional
                && matches!(member.object, Expression::ThisExpression(_))
                && (member.property.name.as_str() == self.symbols.slot_owner_key
                    || member.property.name.as_str() == self.symbols.slot_owner_proxy_key)
            {
                self.found = true;
            }
            walk::walk_static_member_expression(self, member);
        }
    }
    if !source.contains(&symbols.slot_owner_key) && !source.contains(&symbols.slot_owner_proxy_key)
    {
        return Ok(false);
    }
    let allocator = Allocator::default();
    let expression = parse(&allocator, source)?;
    let mut visitor = Owner {
        symbols,
        found: false,
    };
    visitor.visit_expression(&expression);
    Ok(visitor.found)
}

fn collect_data(expression: &Expression<'_>, edits: &mut Vec<(Span, bool)>, shorthand: bool) {
    match expression {
        Expression::Identifier(identifier) if identifier.name == "data" => {
            edits.push((identifier.span, shorthand))
        }
        Expression::StaticMemberExpression(member) if !member.optional => {
            collect_data(&member.object, edits, false)
        }
        Expression::ComputedMemberExpression(member) if !member.optional => {
            collect_data(&member.object, edits, false)
        }
        Expression::ObjectExpression(object) => {
            for property in &object.properties {
                if let ObjectPropertyKind::ObjectProperty(property) = property {
                    if !property.method && property.kind == PropertyKind::Init {
                        collect_data(&property.value, edits, property.shorthand);
                    }
                }
            }
        }
        Expression::ArrayExpression(array) => {
            for element in &array.elements {
                if let Some(expression) = element.as_expression() {
                    collect_data(expression, edits, false);
                }
            }
        }
        Expression::BinaryExpression(binary) => {
            collect_data(&binary.left, edits, false);
            collect_data(&binary.right, edits, false);
        }
        Expression::LogicalExpression(logical) => {
            collect_data(&logical.left, edits, false);
            collect_data(&logical.right, edits, false);
        }
        Expression::ConditionalExpression(conditional) => {
            collect_data(&conditional.test, edits, false);
            collect_data(&conditional.consequent, edits, false);
            collect_data(&conditional.alternate, edits, false);
        }
        Expression::UnaryExpression(unary) => collect_data(&unary.argument, edits, false),
        Expression::CallExpression(call) if !call.optional => {
            collect_data(&call.callee, edits, false);
            for argument in &call.arguments {
                if let Some(expression) = argument.as_expression() {
                    collect_data(expression, edits, false);
                }
            }
        }
        _ => {}
    }
}

pub(super) fn rewrite_data_access(
    source: &str,
    symbols: &MetadataSymbols,
) -> Result<String, String> {
    let allocator = Allocator::default();
    let expression = parse(&allocator, source)?;
    let mut edits = Vec::new();
    collect_data(&expression, &mut edits, false);
    let props = if valid_identifier(&symbols.props_key) {
        format!("this.{}", symbols.props_key)
    } else {
        format!("this[{}]", quote(&symbols.props_key))
    };
    let replacement = format!(
        "{}({props}!=null&&({props}.data!==undefined||Object.prototype.hasOwnProperty.call({props},\"data\"))?{props}.data:this.data)",
        symbols.unref
    );
    let mut output = source.to_string();
    for (span, shorthand) in edits.into_iter().rev() {
        let replacement = if shorthand {
            format!("data:{replacement}")
        } else {
            replacement.clone()
        };
        output.replace_range(span.start as usize..span.end as usize, &replacement);
    }
    Ok(output)
}
