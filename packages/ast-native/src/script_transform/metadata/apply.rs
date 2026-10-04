use oxc_allocator::{Allocator, CloneIn, TakeIn};
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_ast_visit::VisitMut;
use oxc_span::{SPAN, Span};

use super::{MetadataImport, MetadataPlan, contract::quote, expression};

#[derive(Debug)]
pub struct MetadataApplied {
    pub computed_injected: bool,
    pub inline_injected: bool,
    pub imports: Vec<MetadataImport>,
    pub warnings: Vec<String>,
}

fn synthetic<'a>(source: String, allocator: &'a Allocator) -> Result<Expression<'a>, String> {
    struct ClearSpans;
    impl<'a> VisitMut<'a> for ClearSpans {
        fn visit_span(&mut self, span: &mut Span) {
            *span = SPAN;
        }
    }
    let mut expression = expression::parse(allocator, allocator.alloc_str(&source))?;
    ClearSpans.visit_expression(&mut expression);
    Ok(expression)
}

fn object<'a>(
    entries: &[String],
    allocator: &'a Allocator,
) -> Result<ObjectExpression<'a>, String> {
    match synthetic(format!("({{{}}})", entries.join(",")), allocator)? {
        Expression::ObjectExpression(object) => Ok(object.unbox()),
        _ => Err("Generated script metadata is not an object".to_string()),
    }
}

fn property<'a>(
    key: &str,
    value: Expression<'a>,
    allocator: &'a Allocator,
) -> Result<ObjectPropertyKind<'a>, String> {
    let key = if expression::valid_identifier(key) {
        key.to_string()
    } else {
        quote(key)
    };
    let mut parsed = object(&[format!("{key}:null")], allocator)?;
    let mut property = parsed
        .properties
        .pop()
        .expect("generated metadata property exists");
    if let ObjectPropertyKind::ObjectProperty(property) = &mut property {
        property.value = value;
    }
    Ok(property)
}

fn ordinary_property<'b, 'a>(
    object: &'b mut ObjectExpression<'a>,
    name: &str,
) -> Option<&'b mut ObjectProperty<'a>> {
    object
        .properties
        .iter_mut()
        .find_map(|property| match property {
            ObjectPropertyKind::ObjectProperty(property)
                if !property.method
                    && !property.computed
                    && property.kind == PropertyKind::Init
                    && property.key.static_name().is_some_and(|key| key == name) =>
            {
                Some(property.as_mut())
            }
            _ => None,
        })
}

fn computed<'a>(
    component: &mut ObjectExpression<'a>,
    entries: &[String],
    allocator: &'a Allocator,
) -> Result<bool, String> {
    let builder = AstBuilder::new(allocator);
    let mut generated = object(entries, allocator)?;
    let Some(existing) = ordinary_property(component, "computed") else {
        component.properties.insert(
            0,
            property(
                "computed",
                Expression::ObjectExpression(oxc_allocator::Box::new_in(generated, &allocator)),
                allocator,
            )?,
        );
        return Ok(true);
    };
    match &mut existing.value {
        Expression::ObjectExpression(object) => object.properties.extend(generated.properties),
        Expression::Identifier(_)
        | Expression::StaticMemberExpression(_)
        | Expression::ComputedMemberExpression(_) => {
            let value = existing.value.take_in(&allocator);
            generated
                .properties
                .push(ObjectPropertyKind::new_spread_property(
                    SPAN, value, &builder,
                ));
            existing.value =
                Expression::ObjectExpression(oxc_allocator::Box::new_in(generated, &allocator));
            existing.shorthand = false;
        }
        _ => return Ok(false),
    }
    Ok(true)
}

fn methods_from_spreads<'a>(
    component: &ObjectExpression<'a>,
    map: ObjectPropertyKind<'a>,
    allocator: &'a Allocator,
) -> Result<Expression<'a>, String> {
    let sources = component
        .properties
        .iter()
        .filter_map(|property| match property {
            ObjectPropertyKind::SpreadProperty(spread) => Some(&spread.argument),
            _ => None,
        })
        .collect::<Vec<_>>();
    let mut final_object = object(&[], allocator)?;
    final_object.properties.push(map);
    let final_expression =
        Expression::ObjectExpression(oxc_allocator::Box::new_in(final_object, &allocator));
    if sources.is_empty() {
        return Ok(final_expression);
    }
    let mut merged = synthetic("Object.assign({})".to_string(), allocator)?;
    let Expression::CallExpression(call) = &mut merged else {
        unreachable!()
    };
    for source in sources {
        let mut access = synthetic("undefined?.methods||{}".to_string(), allocator)?;
        let Expression::LogicalExpression(logical) = &mut access else {
            unreachable!()
        };
        let Expression::ChainExpression(chain) = &mut logical.left else {
            unreachable!()
        };
        let ChainElement::StaticMemberExpression(member) = &mut chain.expression else {
            unreachable!()
        };
        member.object = source.clone_in(allocator);
        call.arguments.push(Argument::from(access));
    }
    call.arguments.push(Argument::from(final_expression));
    Ok(merged)
}

fn inline<'a>(
    component: &mut ObjectExpression<'a>,
    entries: &[String],
    map_key: &str,
    allocator: &'a Allocator,
) -> Result<bool, String> {
    let generated = object(entries, allocator)?;
    let Some(methods) = ordinary_property(component, "methods") else {
        let map = property(
            map_key,
            Expression::ObjectExpression(oxc_allocator::Box::new_in(generated, &allocator)),
            allocator,
        )?;
        let value = methods_from_spreads(component, map, allocator)?;
        component
            .properties
            .push(property("methods", value, allocator)?);
        return Ok(true);
    };
    let Expression::ObjectExpression(methods) = &mut methods.value else {
        return Ok(false);
    };
    let Some(map) = ordinary_property(methods, map_key) else {
        methods.properties.push(property(
            map_key,
            Expression::ObjectExpression(oxc_allocator::Box::new_in(generated, &allocator)),
            allocator,
        )?);
        return Ok(true);
    };
    let Expression::ObjectExpression(map) = &mut map.value else {
        return Ok(false);
    };
    map.properties.extend(generated.properties);
    Ok(true)
}

pub fn apply_to_component<'a>(
    plan: MetadataPlan,
    component: &mut ObjectExpression<'a>,
    allocator: &'a Allocator,
) -> Result<MetadataApplied, String> {
    let mut warnings = plan.warnings;
    let computed_injected = !plan.computed_properties.is_empty()
        && computed(component, &plan.computed_properties, allocator)?;
    if !plan.computed_properties.is_empty() && !computed_injected {
        warnings.push("无法自动注入 class/style 计算属性，请手动合并 computed。".to_string());
    }
    let inline_injected = !plan.inline_entries.is_empty()
        && inline(
            component,
            &plan.inline_entries,
            &plan.inline_map_key,
            allocator,
        )?;
    if !plan.inline_entries.is_empty() && !inline_injected {
        warnings.push("无法自动注入内联表达式元数据：methods 不是对象字面量。".to_string());
    }
    Ok(MetadataApplied {
        computed_injected,
        inline_injected,
        imports: plan.imports,
        warnings,
    })
}
