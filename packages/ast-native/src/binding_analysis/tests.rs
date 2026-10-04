use std::cell::Cell;

use napi::bindgen_prelude::Utf16String;

use super::{NativeBindingExpressionInput, analyze_binding_expressions_native};

thread_local! {
    static PARSE_COUNT: Cell<usize> = const { Cell::new(0) };
}

pub(super) fn record_parse() {
    PARSE_COUNT.with(|count| count.set(count.get() + 1));
}

fn parse_count() -> usize {
    PARSE_COUNT.with(Cell::get)
}

fn strings(values: &[&str]) -> Vec<Utf16String> {
    values.iter().map(|value| value.to_string().into()).collect()
}

fn input(expression: &str, locals: &[&str], safe_call_names: &[&str]) -> NativeBindingExpressionInput {
    NativeBindingExpressionInput {
        expression: expression.to_string().into(),
        locals: strings(locals),
        safe_call_names: strings(safe_call_names),
    }
}

#[test]
fn parses_each_unique_expression_once_across_contexts_and_failed_entries() {
    let before = parse_count();
    let results = analyze_binding_expressions_native(vec![
        input("row.name + format(value)", &["row"], &["format"]),
        input("value +", &[], &[]),
        input("row.name + format(value)", &[], &[]),
        input("other.name", &[], &[]),
        input("value +", &["value"], &["format"]),
        input("row.name + format(value)", &["value", "format"], &["format"]),
    ], vec![]).unwrap();

    assert_eq!(parse_count() - before, 3);
    assert_eq!(results.len(), 6);
    assert!(results[1].is_none());
    assert!(results[4].is_none());
    let first = results[0].as_ref().unwrap();
    assert_eq!(first.dependencies.iter().map(|dependency| dependency.root.as_str()).collect::<Vec<_>>(), ["format", "value"]);
    assert!(!first.snapshot_fallback);
    let next = results[2].as_ref().unwrap();
    assert_eq!(next.dependencies.iter().map(|dependency| dependency.root.as_str()).collect::<Vec<_>>(), ["row", "format", "value"]);
    assert!(next.snapshot_fallback);
    let last = results[5].as_ref().unwrap();
    assert_eq!(last.dependencies.len(), 1);
    assert_eq!(last.dependencies[0].path.as_deref(), Some("row.name"));
    assert!(!last.snapshot_fallback);
}

#[test]
fn releases_summaries_between_batches_and_applies_current_globals() {
    let before = parse_count();
    let first = analyze_binding_expressions_native(vec![input("globalValue.name + localValue", &[], &[])], strings(&["globalValue"])).unwrap();
    let second = analyze_binding_expressions_native(vec![input("globalValue.name + localValue", &[], &[])], strings(&["localValue"])).unwrap();

    assert_eq!(parse_count() - before, 2);
    assert_eq!(first[0].as_ref().unwrap().dependencies[0].root, "localValue");
    assert_eq!(second[0].as_ref().unwrap().dependencies[0].path.as_deref(), Some("globalValue.name"));
}

#[test]
fn validates_context_strings_before_successful_or_failed_cache_hits() {
    for expression in ["value", "value +"] {
        for malformed_locals in [true, false] {
            let before = parse_count();
            let mut malformed = input(expression, &[], &[]);
            let invalid = Utf16String::from(vec![0xD800]);
            if malformed_locals {
                malformed.locals.push(invalid);
            } else {
                malformed.safe_call_names.push(invalid);
            }
            let result = analyze_binding_expressions_native(vec![input(expression, &[], &[]), malformed], vec![]);

            assert!(result.is_err());
            assert_eq!(parse_count() - before, 1);
        }
    }
}
