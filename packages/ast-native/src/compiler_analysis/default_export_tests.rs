use super::*;
use crate::SCRIPT_PARSE_COUNT;

fn input(code: &str) -> NativeCompilerScriptInput {
    NativeCompilerScriptInput {
        code: code.to_string().into(),
        filename: Some("page.ts".to_string()),
    }
}

#[test]
fn compiler_default_export_facts_share_the_existing_parse() {
    let cases = [
        ("export default {}", Some(true)),
        ("const page = {}; export default page", Some(true)),
        ("export default defineComponent({})", Some(true)),
        ("export default function page() {}", Some(true)),
        ("export default class Page {}", Some(true)),
        (
            "const page: object = {}; export default (page satisfies object)",
            Some(true),
        ),
        ("// export default {}\nconst page = {}", Some(false)),
        ("const label = 'export default {}'", Some(false)),
        ("const page = {}; export { page as default }", Some(false)),
        (
            "declare module 'virtual:card' { const page: any; export default page; }",
            None,
        ),
        ("export/*comment*/default {}", Some(true)),
    ];
    for (code, expected) in cases {
        SCRIPT_PARSE_COUNT.set(0);
        let results = analyze_compiler_scripts_native(vec![input(code), input(code)]);
        assert_eq!(SCRIPT_PARSE_COUNT.get(), 1, "{code}");
        assert_eq!(
            results[0]
                .as_ref()
                .map(|summary| summary.has_default_export),
            expected,
            "{code}"
        );
        assert_eq!(
            results[1]
                .as_ref()
                .map(|summary| summary.has_default_export),
            expected,
            "{code}"
        );
    }
}

#[test]
fn compiler_default_export_rejects_recovered_parses_per_item() {
    let results = analyze_compiler_scripts_native(vec![
        input("const value; export default {}"),
        input("export default {}"),
        input("export default ="),
    ]);
    assert!(results[0].is_none());
    assert!(results[1].as_ref().unwrap().has_default_export);
    assert!(results[2].is_none());
}
