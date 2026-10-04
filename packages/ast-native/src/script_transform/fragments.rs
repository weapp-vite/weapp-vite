use oxc_allocator::{Allocator, Box, TakeIn};
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_ast_visit::{VisitMut, walk_mut};
use oxc_parser::{ParseOptions, Parser};
use oxc_span::{SPAN, SourceType, Span};

struct ClearSpans;
impl<'a> VisitMut<'a> for ClearSpans {
    fn visit_span(&mut self, span: &mut Span) {
        *span = SPAN;
    }
}

pub fn expression<'a>(source: &str, allocator: &'a Allocator) -> Result<Expression<'a>, String> {
    let mut value = Parser::new(allocator, allocator.alloc_str(source), SourceType::mjs())
        .with_options(ParseOptions {
            preserve_parens: false,
            ..ParseOptions::default()
        })
        .parse_expression()
        .map_err(|e| format!("Invalid synthetic expression: {e:?}"))?;
    ClearSpans.visit_expression(&mut value);
    Ok(value)
}
pub fn statements<'a>(
    source: &str,
    allocator: &'a Allocator,
) -> Result<oxc_allocator::Vec<'a, Statement<'a>>, String> {
    let mut result = Parser::new(allocator, allocator.alloc_str(source), SourceType::mjs()).parse();
    if !result.diagnostics.is_empty() {
        return Err(format!(
            "Invalid synthetic statements: {:?}",
            result.diagnostics
        ));
    }
    ClearSpans.visit_program(&mut result.program);
    Ok(result.program.body)
}
pub fn property<'a>(
    name: &str,
    value: Expression<'a>,
    allocator: &'a Allocator,
) -> Result<ObjectPropertyKind<'a>, String> {
    let key = if oxc_syntax::identifier::is_identifier_name(name)
        && !oxc_syntax::keyword::is_reserved_keyword(name)
    {
        name.to_owned()
    } else {
        serde_json::to_string(name).unwrap()
    };
    let Expression::ObjectExpression(mut object) =
        expression(&format!("({{{key}:null}})"), allocator)?
    else {
        unreachable!()
    };
    let mut property = object.properties.pop().unwrap();
    if let ObjectPropertyKind::ObjectProperty(p) = &mut property {
        p.value = value;
    }
    Ok(property)
}
pub fn find<'o, 'a>(object: &'o ObjectExpression<'a>, key: &str) -> Option<&'o ObjectProperty<'a>> {
    object.properties.iter().find_map(|p| match p {
        ObjectPropertyKind::ObjectProperty(p)
            if !p.computed
                && !p.method
                && p.kind == PropertyKind::Init
                && p.key.static_name().is_some_and(|n| n == key) =>
        {
            Some(p.as_ref())
        }
        _ => None,
    })
}
pub fn find_mut<'o, 'a>(
    object: &'o mut ObjectExpression<'a>,
    key: &str,
) -> Option<&'o mut ObjectProperty<'a>> {
    object.properties.iter_mut().find_map(|p| match p {
        ObjectPropertyKind::ObjectProperty(p)
            if !p.computed
                && !p.method
                && p.kind == PropertyKind::Init
                && p.key.static_name().is_some_and(|n| n == key) =>
        {
            Some(p.as_mut())
        }
        _ => None,
    })
}
pub fn prepend_missing<'a>(
    object: &mut ObjectExpression<'a>,
    name: &str,
    source: &str,
    allocator: &'a Allocator,
) -> Result<(), String> {
    if find(object, name).is_none() {
        object.properties.insert(
            0,
            property(name, expression(source, allocator)?, allocator)?,
        );
    }
    Ok(())
}
pub fn wrap_spread<'a>(
    value: &mut Expression<'a>,
    additions: ObjectExpression<'a>,
    allocator: &'a Allocator,
) {
    let mut object = additions;
    let mut placeholder = expression("({...null})", allocator).unwrap();
    let Expression::ObjectExpression(spread) = &mut placeholder else {
        unreachable!()
    };
    let mut property = spread.properties.pop().unwrap();
    if let ObjectPropertyKind::SpreadProperty(p) = &mut property {
        p.argument = value.take_in(&allocator);
    }
    object.properties.push(property);
    *value = Expression::ObjectExpression(Box::new_in(object, &allocator));
}

/// 按 Babel valueToNode 的静态数据键形态生成，不改变用户 AST 中的键或表达式。
pub fn json_expression<'a>(
    value: &serde_json::Value,
    allocator: &'a Allocator,
) -> Result<Expression<'a>, String> {
    struct Keys<'a> {
        allocator: &'a Allocator,
    }
    impl<'a> VisitMut<'a> for Keys<'a> {
        fn visit_object_property(&mut self, node: &mut ObjectProperty<'a>) {
            if let PropertyKey::StringLiteral(key) = &node.key {
                let name = key.value.as_str();
                if name == "__proto__" {
                    node.computed = true;
                } else if oxc_syntax::identifier::is_identifier_name(name)
                    && !oxc_syntax::keyword::is_reserved_keyword(name)
                {
                    node.key = PropertyKey::new_static_identifier(
                        SPAN,
                        self.allocator.alloc_str(name),
                        &AstBuilder::new(self.allocator),
                    );
                }
            }
            walk_mut::walk_object_property(self, node);
        }
    }
    let mut result = expression(&value.to_string(), allocator)?;
    Keys { allocator }.visit_expression(&mut result);
    Ok(result)
}

pub fn string_property<'a>(
    name: &str,
    value: Expression<'a>,
    allocator: &'a Allocator,
) -> Result<ObjectPropertyKind<'a>, String> {
    let Expression::ObjectExpression(mut object) = expression(
        &format!("({{{}:null}})", serde_json::to_string(name).unwrap()),
        allocator,
    )?
    else {
        return Err("Synthetic string property shape differs".to_owned());
    };
    let mut property = object
        .properties
        .pop()
        .ok_or("Missing synthetic string property")?;
    if let ObjectPropertyKind::ObjectProperty(property) = &mut property {
        property.value = value;
    }
    Ok(property)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn synthetic_objects_accept_unicode_keywords_and_quoted_keys_without_panicking() {
        let allocator = Allocator::default();
        for key in ["answer", "default", "你好", "a'b", "a\\b", "💡", ""] {
            let property =
                property(key, expression("42", &allocator).unwrap(), &allocator).unwrap();
            let ObjectPropertyKind::ObjectProperty(property) = property else {
                panic!("not a property")
            };
            assert_eq!(property.key.static_name().as_deref(), Some(key));
            let string =
                string_property(key, expression("42", &allocator).unwrap(), &allocator).unwrap();
            assert!(
                matches!(string, ObjectPropertyKind::ObjectProperty(p) if matches!(p.key, PropertyKey::StringLiteral(_)))
            );
        }
        let Expression::ObjectExpression(object) = expression("({answer:42})", &allocator).unwrap()
        else {
            panic!("parentheses preserved")
        };
        let mut value = expression("options", &allocator).unwrap();
        wrap_spread(&mut value, object.unbox(), &allocator);
        assert!(matches!(value, Expression::ObjectExpression(o) if o.properties.len() == 2));
    }
}

pub fn prepend_json<'a>(
    object: &mut ObjectExpression<'a>,
    name: &str,
    value: &serde_json::Value,
    allocator: &'a Allocator,
) -> Result<(), String> {
    if find(object, name).is_none() {
        object.properties.insert(
            0,
            property(name, json_expression(value, allocator)?, allocator)?,
        );
    }
    Ok(())
}
