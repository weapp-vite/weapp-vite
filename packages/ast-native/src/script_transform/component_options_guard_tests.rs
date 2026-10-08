use oxc_allocator::Allocator;
use oxc_ast::ast::Expression;
use oxc_parser::Parser;
use oxc_span::SourceType;
use serde_json::json;

use super::defaults_and_page;
use crate::script_transform::{fragments, request::Request};

fn request() -> Request {
    Request {
        options: json!({"wevuDefaults":{"component":{"options":{"first":true,"second":true},"setData":{"first":true,"second":true}}}}),
        contract: json!({"markers":{"WEVU_IS_PAGE_KEY":"pageMarker"}}),
        omitted_undefined: Vec::new(),
        provenance: None,
    }
}

#[test]
fn prepends_nested_defaults_in_original_entry_order_and_preserves_existing_values() {
    let allocator = Allocator::default();
    let expression = Parser::new(&allocator, "{options:{existing:true,second:false},setData:{existing:true}}", SourceType::mjs()).parse_expression().unwrap();
    let Expression::ObjectExpression(mut object) = expression else { panic!() };
    defaults_and_page(&mut object, &request(), &[], &allocator).unwrap();
    for (key, expected) in [("options", vec!["first", "existing", "second"]), ("setData", vec!["first", "second", "existing"])] {
        let Expression::ObjectExpression(nested) = &fragments::find(&object, key).unwrap().value else { panic!() };
        let keys: Vec<_> = nested.properties.iter().map(|property| match property {
            oxc_ast::ast::ObjectPropertyKind::ObjectProperty(property) => property.key.static_name().unwrap().into_owned(),
            _ => panic!(),
        }).collect();
        assert_eq!(keys, expected);
    }
    let Expression::ObjectExpression(options) = &fragments::find(&object, "options").unwrap().value else { panic!() };
    assert!(matches!(&fragments::find(options, "second").unwrap().value, Expression::BooleanLiteral(value) if !value.value));
}

#[test]
fn rejects_duplicate_component_and_style_options_before_reporting_static_values() {
    let allocator = Allocator::default();
    for source in [
        "{options:{styleIsolation:'isolated'},options:{styleIsolation:'shared'}}",
        "{setData:{strategy:'patch'},setData:{strategy:'full'}}",
        "{options:{styleIsolation:'isolated',styleIsolation:'shared'}}",
    ] {
        let expression = Parser::new(&allocator, source, SourceType::mjs()).parse_expression().unwrap();
        let Expression::ObjectExpression(mut object) = expression else { panic!() };
        assert!(defaults_and_page(&mut object, &request(), &[], &allocator).is_err(), "{source}");
    }
}
