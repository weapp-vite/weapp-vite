use super::*;
use crate::SCRIPT_PARSE_COUNT;

fn input(code: &str, filename: &str) -> NativeCompilerScriptInput {
    NativeCompilerScriptInput {
        code: code.to_string().into(),
        filename: Some(filename.to_string()),
        module_id: None,
        hook_to_feature_json: None,
    }
}

#[test]
fn compiler_registered_components_accepts_only_proven_static_objects() {
    let results = analyze_compiler_scripts_native(vec![input(
        "export default { name: 'Page', components: { Card, Local: Other, 'custom-card': Card } }",
        "page.ts",
    )]);
    let components = results[0]
        .as_ref()
        .unwrap()
        .registered_components
        .as_ref()
        .unwrap();
    let registrations: Vec<_> = components
        .iter()
        .map(|component| (component.name.as_str(), component.local.as_str()))
        .collect();
    assert_eq!(
        registrations,
        [
            ("Card", "Card"),
            ("Local", "Other"),
            ("custom-card", "Card")
        ]
    );

    for code in [
        "const a = 1",
        "export default { name: 'Page' }",
        "export default { components: {} }",
    ] {
        let results = analyze_compiler_scripts_native(vec![input(code, "page.ts")]);
        assert!(
            results[0]
                .as_ref()
                .unwrap()
                .registered_components
                .as_ref()
                .unwrap()
                .is_empty()
        );
    }
    for code in [
        "export default defineComponent({ components: { Card } })",
        "const page = { components: { Card } }; export default page",
        "export default Object.assign({}, { components: { Card } })",
        "export default { ...rest, components: { Card } }",
        "export default { ['components']: { Card } }",
        "export default { get components() { return { Card } } }",
        "export default { components: {}, components: { Card } }",
        "export default { components: { ...rest, Card } }",
        "export default { components: { Card, Card: Other } }",
        "export default { components: { [name]: Card } }",
        "export default { components: { Card() {} } }",
        "export default { components: { Card: () => Other } }",
        "export default { components: { Card: (Other as object) } }",
        "export default { components: table }",
        "export default ({ components: { Card } } as object)",
    ] {
        let results = analyze_compiler_scripts_native(vec![input(code, "page.ts")]);
        assert!(
            results[0].as_ref().unwrap().registered_components.is_none(),
            "{code}"
        );
    }
}

#[test]
fn compiler_batch_preserves_valid_results_and_caches_failed_parses() {
    SCRIPT_PARSE_COUNT.set(0);
    let results = analyze_compiler_scripts_native(vec![
        input("export default {}", "page.ts"),
        input("const =", "page.ts"),
        input("const element = <view />", "page.tsx"),
        input("const element = <view />", "page.ts"),
        input("const =", "page.ts"),
        input("export default {}", "page.ts"),
    ]);

    assert_eq!(SCRIPT_PARSE_COUNT.get(), 4);
    assert_eq!(results.len(), 6);
    assert!(results[0].as_ref().unwrap().has_default_export);
    assert!(results[1].is_none());
    assert!(results[2].is_some());
    assert!(results[3].is_none());
    assert!(results[4].is_none());
    assert!(results[5].as_ref().unwrap().has_default_export);
}

#[test]
fn compiler_batch_rejects_lone_surrogate_without_parsing_or_losing_valid_items() {
    SCRIPT_PARSE_COUNT.set(0);
    let mut invalid = input("", "page.ts");
    invalid.code = Utf16String::from(vec![0xD800]);
    let results =
        analyze_compiler_scripts_native(vec![invalid, input("export default {}", "page.ts")]);
    assert_eq!(SCRIPT_PARSE_COUNT.get(), 1);
    assert!(results[0].is_none());
    assert!(results[1].as_ref().unwrap().has_default_export);
}

#[test]
fn compiler_batch_rejects_escaped_surrogates_in_decoded_summary_values() {
    for code in [
        r#"import Card from './\uD800.vue'"#,
        r#"import { '\uDC00' as Card } from './card'"#,
        r#"export { Card as '\uD800' } from './card'"#,
        r#"export default { components: { '\uD800': Card } }"#,
        r#"defineOptions({ name: '\uDC00' })"#,
        r#"defineOptions({ '\uD800': 'value' })"#,
    ] {
        SCRIPT_PARSE_COUNT.set(0);
        let results = analyze_compiler_scripts_native(vec![
            input(code, "page.ts"),
            input(
                r#"import Card from './中文-\uD83D\uDE00.vue'; defineOptions({ name: '😀' })"#,
                "page.ts",
            ),
            input(code, "page.ts"),
        ]);
        assert_eq!(SCRIPT_PARSE_COUNT.get(), 2);
        assert!(results[0].is_none(), "{code}");
        assert!(results[2].is_none(), "{code}");
        let valid = results[1].as_ref().unwrap();
        assert_eq!(valid.imports[0].source, "./中文-😀.vue");
        assert_eq!(valid.define_options_name.as_deref(), Some("😀"));
    }
}

#[test]
fn compiler_macro_spans_preserve_statements_and_utf16_boundaries() {
    let statements = [
        "(defineOptions({ name: '😀' }));",
        "defineOptions({ name: '后续' })",
    ];
    let code = format!(
        "// 中文 😀\r\nconst emoji = '🌞';\r\n{}\r\n{}\nfunction nested() {{ defineOptions({{ name: 'nested' }}) }}\ndefineOptions?.({{}});\nwrapper(defineOptions({{}}));\n(defineOptions({{}}) as object);\nvoid defineOptions({{}});\n",
        statements[0], statements[1],
    );
    let results = analyze_compiler_scripts_native(vec![input(&code, "page.ts")]);
    let spans = &results[0].as_ref().unwrap().define_options_statements;
    assert_eq!(spans.len(), 2);
    let utf16: Vec<u16> = code.encode_utf16().collect();
    for (span, statement) in spans.iter().zip(statements) {
        assert_eq!(
            String::from_utf16(&utf16[span.start as usize..span.end as usize]).unwrap(),
            statement
        );
    }
}

#[test]
fn compiler_parse_counts_are_isolated_between_simultaneous_threads() {
    let barrier = std::sync::Barrier::new(2);
    std::thread::scope(|scope| {
        for count in [1, 2] {
            let barrier = &barrier;
            scope.spawn(move || {
                SCRIPT_PARSE_COUNT.set(0);
                for _ in 0..count {
                    analyze_compiler_scripts_native(vec![input("export default {}", "page.ts")]);
                }
                barrier.wait();
                assert_eq!(SCRIPT_PARSE_COUNT.get(), count);
            });
        }
    });
}

#[test]
fn compiler_batch_reuses_parse_but_specializes_feature_results() {
    SCRIPT_PARSE_COUNT.set(0);
    let code = "import { onLoad } from 'wevu'; onLoad(() => wx.request())";
    let results = analyze_compiler_scripts_native(vec![
        NativeCompilerScriptInput {
            code: code.to_string().into(),
            filename: Some("page.ts".to_string()),
            module_id: Some("wevu".to_string()),
            hook_to_feature_json: Some(r#"{"onLoad":"load"}"#.to_string()),
        },
        NativeCompilerScriptInput {
            code: code.to_string().into(),
            filename: Some("page.ts".to_string()),
            module_id: Some("wevu".to_string()),
            hook_to_feature_json: Some(r#"{"onLoad":"alternate"}"#.to_string()),
        },
    ]);

    assert_eq!(SCRIPT_PARSE_COUNT.get(), 1);
    let first = results[0].as_ref().expect("first item should parse");
    let second = results[1].as_ref().expect("second item should parse");
    assert_eq!(first.feature_flags, vec!["load"]);
    assert_eq!(second.feature_flags, vec!["alternate"]);
    assert_eq!(first.imports, second.imports);
}
