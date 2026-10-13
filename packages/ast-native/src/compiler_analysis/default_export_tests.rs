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
        ("export default {}", true),
        ("const page = {}; export default page", true),
        ("export default defineComponent({})", true),
        ("export default function page() {}", true),
        ("export default class Page {}", true),
        (
            "const page: object = {}; export default (page satisfies object)",
            true,
        ),
        ("// export default {}\nconst page = {}", false),
        ("const label = 'export default {}'", false),
        ("const page = {}; export { page as default }", false),
        (
            "declare module 'virtual:card' { const page: any; export default page; }",
            true,
        ),
        ("export/*comment*/default {}", true),
    ];
    for (code, expected) in cases {
        SCRIPT_PARSE_COUNT.set(0);
        let results = analyze_compiler_scripts_native(vec![input(code), input(code)]);
        assert_eq!(SCRIPT_PARSE_COUNT.get(), 1, "{code}");
        assert_eq!(
            results[0].as_ref().unwrap().has_default_export,
            expected,
            "{code}"
        );
        assert_eq!(
            results[1].as_ref().unwrap().has_default_export,
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
