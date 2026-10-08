use std::collections::HashMap;

use oxc_allocator::{Allocator, CloneIn, Vec as ArenaVec};
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_span::SPAN;

fn unwrap<'b, 'a>(expression: &'b Expression<'a>) -> &'b Expression<'a> {
    match expression {
        Expression::ParenthesizedExpression(node) => unwrap(&node.expression),
        Expression::TSAsExpression(node) => unwrap(&node.expression),
        Expression::TSSatisfiesExpression(node) => unwrap(&node.expression),
        Expression::TSNonNullExpression(node) => unwrap(&node.expression),
        _ => expression,
    }
}

fn property_name<'b>(key: &'b PropertyKey<'_>) -> Option<&'b str> {
    match key {
        PropertyKey::StaticIdentifier(node) => Some(node.name.as_str()),
        PropertyKey::Identifier(node) => Some(node.name.as_str()),
        PropertyKey::StringLiteral(node) => Some(node.value.as_str()),
        _ => None,
    }
}

fn ordinary(property: &ObjectProperty<'_>) -> bool {
    !property.method && property.kind == PropertyKind::Init
}

fn setup_body<'b, 'a>(component: &'b ObjectExpression<'a>) -> Option<&'b FunctionBody<'a>> {
    for property in &component.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else { continue; };
        if property.computed || property_name(&property.key) != Some("setup") { continue; }
        match unwrap(&property.value) {
            Expression::FunctionExpression(function) => return function.body.as_deref(),
            Expression::ArrowFunctionExpression(arrow) => match &arrow.body {
                ArrowFunctionBody::FunctionBody(body) => return Some(body),
                _ => return None,
            },
            _ => {}
        }
    }
    None
}

fn serializable(expression: &Expression<'_>) -> bool {
    match unwrap(expression) {
        Expression::StringLiteral(_) | Expression::NumericLiteral(_) | Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => true,
        Expression::TemplateLiteral(template) => template.expressions.is_empty(),
        Expression::ArrayExpression(array) => array.elements.iter().all(|element| element.as_expression().is_some_and(serializable)),
        Expression::ObjectExpression(object) => {
            if object.properties.iter().any(|property| matches!(property,
                ObjectPropertyKind::ObjectProperty(property) if ordinary(property) && !property.computed
                    && property_name(&property.key) == Some("__weappViteUsingComponent")
                    && matches!(&property.value, Expression::BooleanLiteral(value) if value.value))) {
                return false;
            }
            object.properties.iter().all(|property| matches!(property,
                ObjectPropertyKind::ObjectProperty(property) if ordinary(property) && !property.computed && serializable(&property.value)))
        }
        _ => false,
    }
}

fn seed<'b, 'a>(expression: &'b Expression<'a>) -> Option<&'b Expression<'a>> {
    let expression = unwrap(expression);
    if let Expression::CallExpression(call) = expression {
        if !call.optional && matches!(&call.callee, Expression::Identifier(name) if matches!(name.name.as_str(), "ref" | "shallowRef" | "reactive")) {
            let argument = call.arguments.first()?.as_expression()?;
            return serializable(argument).then(|| unwrap(argument));
        }
        return None;
    }
    serializable(expression).then_some(expression)
}

fn returned_object<'b, 'a>(body: &'b FunctionBody<'a>, initializers: &HashMap<&str, &'b Expression<'a>>) -> Option<&'b ObjectExpression<'a>> {
    for statement in body.statements.iter().rev() {
        let Statement::ReturnStatement(statement) = statement else { continue; };
        let Some(argument) = &statement.argument else { continue; };
        let expression = match unwrap(argument) {
            Expression::Identifier(identifier) => initializers.get(identifier.name.as_str()).map(|value| unwrap(value)),
            expression => Some(expression),
        };
        if let Some(Expression::ObjectExpression(object)) = expression { return Some(object); }
    }
    None
}

fn static_key<'a>(name: &str, lone_surrogates: bool, allocator: &'a Allocator, builder: &AstBuilder<'a>) -> PropertyKey<'a> {
    let name = allocator.alloc_str(name);
    if !lone_surrogates && oxc_syntax::identifier::is_identifier_name(name) && !oxc_syntax::keyword::is_reserved_keyword(name) {
        PropertyKey::new_static_identifier(SPAN, name, builder)
    } else {
        PropertyKey::new_string_literal_with_lone_surrogates(SPAN, name, None, lone_surrogates, builder)
    }
}

/// 仅复制 setup 直接变量的静态首屏种子；不执行 initializer，不扩大到模块或嵌套块作用域。
pub fn inject<'a>(component: &mut ObjectExpression<'a>, allocator: &'a Allocator) -> Result<bool, String> {
    // 保留现有 Babel helper 的边界：普通 data 属性（含 computed）阻止注入，data 方法不阻止。
    if component.properties.iter().any(|property| matches!(property,
        ObjectPropertyKind::ObjectProperty(property) if ordinary(property) && property_name(&property.key) == Some("data"))) {
        return Ok(false);
    }
    let Some(body) = setup_body(component) else { return Ok(false); };
    let mut initializers = HashMap::new();
    for statement in &body.statements {
        let Statement::VariableDeclaration(declaration) = statement else { continue; };
        for declarator in &declaration.declarations {
            if let (BindingPattern::BindingIdentifier(identifier), Some(initializer)) = (&declarator.id, &declarator.init) {
                initializers.insert(identifier.name.as_str(), initializer);
            }
        }
    }
    let Some(returned) = returned_object(body, &initializers) else { return Ok(false); };
    let builder = AstBuilder::new(allocator);
    let mut properties = ArenaVec::new_in(&allocator);
    for property in &returned.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else { continue; };
        if !ordinary(property) || property.computed { continue; }
        let Some(name) = property_name(&property.key).filter(|name| !name.is_empty()) else { continue; };
        let expression = if let Expression::Identifier(identifier) = &property.value {
            match initializers.get(identifier.name.as_str()) {
                Some(initializer) => *initializer,
                None if property.shorthand => continue,
                None => &property.value,
            }
        } else { &property.value };
        let Some(seed) = seed(expression) else { continue; };
        let lone_surrogates = matches!(&property.key, PropertyKey::StringLiteral(key) if key.lone_surrogates);
        properties.push(ObjectPropertyKind::new_object_property(SPAN, PropertyKind::Init,
            static_key(name, lone_surrogates, allocator, &builder), seed.clone_in(allocator), false, false, false, &builder));
    }
    if properties.is_empty() { return Ok(false); }
    let returned = Statement::new_return_statement(SPAN, Some(Expression::new_object_expression(SPAN, properties, &builder)), &builder);
    let mut statements = ArenaVec::new_in(&allocator);
    statements.push(returned);
    let body = FunctionBody::boxed(SPAN, ArenaVec::new_in(&allocator), statements, &builder);
    let params = FormalParameters::boxed(SPAN, FormalParameterKind::FormalParameter, ArenaVec::new_in(&allocator), None, &builder);
    let function = Expression::new_function_expression(SPAN, FunctionType::FunctionExpression, None, false, false, false,
        None, None, params, None, Some(body), &builder);
    component.properties.insert(0, ObjectPropertyKind::new_object_property(SPAN, PropertyKind::Init,
        static_key("data", false, allocator, &builder), function, true, false, false, &builder));
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use oxc_parser::{ParseOptions, Parser};
    use oxc_span::{GetSpan, SourceType, Span};

    fn object<'a>(allocator: &'a Allocator, source: &'a str) -> ObjectExpression<'a> {
        let expression = Parser::new(allocator, source, SourceType::ts())
            .with_options(ParseOptions { preserve_parens: true, ..ParseOptions::default() }).parse_expression().unwrap();
        match expression {
            Expression::ObjectExpression(object) => object.unbox(),
            _ => panic!("fixture must be an object"),
        }
    }

    fn seeds<'b, 'a>(component: &'b ObjectExpression<'a>) -> &'b ObjectExpression<'a> {
        let ObjectPropertyKind::ObjectProperty(data) = &component.properties[0] else { panic!() };
        assert!(data.method);
        let Expression::FunctionExpression(function) = &data.value else { panic!() };
        let Statement::ReturnStatement(statement) = &function.body.as_ref().unwrap().statements[0] else { panic!() };
        let Expression::ObjectExpression(object) = statement.argument.as_ref().unwrap() else { panic!() };
        object
    }

    fn names(object: &ObjectExpression<'_>) -> Vec<String> {
        object.properties.iter().filter_map(|property| match property {
            ObjectPropertyKind::ObjectProperty(property) => property_name(&property.key).map(str::to_string),
            _ => None,
        }).collect()
    }

    #[test]
    fn clones_literal_and_ref_seeds_with_original_spans() {
        let allocator = Allocator::default();
        let source = "{ setup() { const count = ref(12); const state = reactive({ok:true}); const text = `ready`; return {count,state,text,direct:[1,null]}; } }";
        let mut component = object(&allocator, source);
        let original_setup = component.properties[0].span();
        assert!(inject(&mut component, &allocator).unwrap());
        assert_eq!(names(seeds(&component)), ["count", "state", "text", "direct"]);
        let ObjectPropertyKind::ObjectProperty(count) = &seeds(&component).properties[0] else { panic!() };
        let start = source.find("12").unwrap() as u32;
        assert_eq!(count.value.span(), Span::new(start, start + 2));
        assert_eq!(count.span, SPAN);
        assert_eq!(component.properties[1].span(), original_setup);
    }

    #[test]
    fn rejects_dynamic_holes_spreads_methods_and_component_metadata() {
        let allocator = Allocator::default();
        let source = "{ setup() { const a = run(); const b = ref(...x); const c = ref(-1); const d = [1,,2]; const e = {...x}; const f = {get x(){return 1}}; const g = {__weappViteUsingComponent:true}; const h = ref(`x${a}`); return {a,b,c,d,e,f,g,h,okay:shallowRef('yes')}; } }";
        let mut component = object(&allocator, source);
        assert!(inject(&mut component, &allocator).unwrap());
        assert_eq!(names(seeds(&component)), ["okay"]);
    }

    #[test]
    fn uses_only_direct_variables_and_last_resolvable_return() {
        let allocator = Allocator::default();
        let source = "{ setup() { const first = 1; { const nested = 2; } function inner(){const hidden=3;return {hidden};} const bag = {renamed:first,missing:moduleValue,nested,hidden}; return {old:0}; return bag; return unknown; } }";
        let mut component = object(&allocator, source);
        assert!(inject(&mut component, &allocator).unwrap());
        assert_eq!(names(seeds(&component)), ["renamed"]);
    }

    #[test]
    fn unwraps_only_the_same_ts_wrappers_as_babel() {
        let allocator = Allocator::default();
        let source = "{ setup: (() => { const a = (ref((1 as number))!); const b = (2 satisfies number); const c = <number>3; return ({a,b,c}) as const; }) as any }";
        let mut component = object(&allocator, source);
        assert!(inject(&mut component, &allocator).unwrap());
        assert_eq!(names(seeds(&component)), ["a", "b"]);
    }

    #[test]
    fn preserves_data_property_and_setup_body_boundaries() {
        for source in ["{data:{},setup(){return {x:1}}}", "{['data']:null,setup(){return {x:1}}}", "{[data]:null,setup(){return {x:1}}}", "{setup:()=>({x:1})}", "{setup(){if(true)return {x:1}}}", "{setup(){const {x}={x:1};return {x}}}"] {
            let allocator = Allocator::default();
            assert!(!inject(&mut object(&allocator, source), &allocator).unwrap(), "{source}");
        }
        let allocator = Allocator::default();
        let mut component = object(&allocator, "{data(){return {}},get setup(){return {x:1}}}");
        assert!(inject(&mut component, &allocator).unwrap());
        assert_eq!(names(&component), ["data", "data", "setup"]);
    }

    #[test]
    fn keeps_static_return_key_order_duplicates_and_nonidentifier_strings() {
        let allocator = Allocator::default();
        let mut component = object(&allocator, "{setup(){let x=1;let x=2;return {x,x,'a-b':3,'':4,1:5,[key]:6,...rest,method(){}}}}");
        assert!(inject(&mut component, &allocator).unwrap());
        assert_eq!(names(seeds(&component)), ["x", "x", "a-b"]);
        let ObjectPropertyKind::ObjectProperty(first) = &seeds(&component).properties[0] else { panic!() };
        assert!(matches!(&first.value, Expression::NumericLiteral(value) if value.value == 2.0));
    }
}
