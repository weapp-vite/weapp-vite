use super::{
    NativeScriptAnalysisInput, analyze_script_native, analyze_scripts_native,
    may_contain_platform_api_access_native, may_contain_static_require_literal_native,
};

fn assert_facts(code: &str, static_require: bool, platform_api: bool) {
    assert_eq!(
        may_contain_static_require_literal_native(code.to_string(), None),
        static_require,
        "static require leaf: {code}"
    );
    assert_eq!(
        may_contain_platform_api_access_native(code.to_string(), None),
        platform_api,
        "platform API leaf: {code}"
    );
    let analysis = analyze_script_native(code.to_string(), None, None, None);
    assert_eq!(
        analysis.has_static_require_literal, static_require,
        "{code}"
    );
    assert_eq!(analysis.has_platform_api_access, platform_api, "{code}");
    let results = analyze_scripts_native(vec![
        NativeScriptAnalysisInput {
            code: code.to_string(),
            filename: None,
            module_id: None,
            hook_to_feature_json: None,
        },
        NativeScriptAnalysisInput {
            code: "const value = 1".to_string(),
            filename: None,
            module_id: None,
            hook_to_feature_json: None,
        },
    ]);
    assert_eq!(
        results[0].has_static_require_literal, static_require,
        "{code}"
    );
    assert_eq!(results[0].has_platform_api_access, platform_api, "{code}");
    assert!(!results[1].has_static_require_literal);
    assert!(!results[1].has_platform_api_access);
}

#[test]
fn static_require_facts_do_not_require_utf8_string_values() {
    for code in [
        r"require('\uD800')",
        r"require('\uDC00')",
        r"require(`\uD800`)",
        r"require(`\uDC00`)",
        r"require('\uD83D\uDE00')",
        r"require(`\uD83D\uDE00`)",
        "require('中文-😀')",
        "require(`中文-😀`)",
        "require('')",
        "require(``)",
    ] {
        assert_facts(code, true, false);
    }
}

#[test]
fn computed_platform_facts_do_not_require_utf8_string_values() {
    // 注释只满足既有文本预筛选，不额外引入能掩盖 computed 分支的 AST 访问。
    for code in [
        r"/* wx. */ wx['\uD800']()",
        r"/* wx. */ wx['\uDC00']()",
        r"/* wx. */ wx[`\uD800`]()",
        r"/* wx. */ wx[`\uDC00`]()",
        r"/* wx. */ wx['\uD83D\uDE00']()",
        "/* wx. */ wx[`中文-😀`]()",
        "/* wx. */ wx['']()",
        "/* wx. */ wx[``]()",
    ] {
        assert_facts(code, false, true);
    }
}

#[test]
fn boolean_facts_preserve_dynamic_and_text_prefilter_boundaries() {
    for code in [
        "require(name)",
        "require(`pkg/${name}`)",
        "require(42)",
        "require(tag`pkg`)",
        r"wx['\uD800']()",
        "/* wx. */ wx[name]()",
        "/* wx. */ wx[`prefix${name}`]()",
    ] {
        assert_facts(code, false, false);
    }
}
