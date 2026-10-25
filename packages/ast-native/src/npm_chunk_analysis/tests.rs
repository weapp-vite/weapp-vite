use super::analyze;

#[test]
fn excludes_shadowed_require_and_platform_apis() {
    let code = "require('global'); wx.request(); function nested(require, wx) { require('local'); wx.request(); }";
    let analysis = analyze(code, None).unwrap();
    assert_eq!(analysis.requires.len(), 1);
    assert_eq!(analysis.requires[0].importee, "global");
    assert_eq!(analysis.platform_api_ranges.len(), 1);
}

#[test]
fn reports_utf16_ranges_for_optional_computed_and_assignment_members() {
    let code = "const emoji = '中é😀'; wx['request'](); my?.getStorage(); tt.value = 1;";
    let analysis = analyze(code, None).unwrap();
    assert_eq!(analysis.platform_api_ranges.len(), 3);
    let units: Vec<_> = code.encode_utf16().collect();
    for (range, expected) in analysis.platform_api_ranges.iter().zip(["wx", "my", "tt"]) {
        assert_eq!(
            String::from_utf16(&units[range.start as usize..range.end as usize]).unwrap(),
            expected
        );
    }
}

#[test]
fn preserves_local_root_enter_order_and_member_interop_facts() {
    let code =
        "var first = require('pkg'); var alias = first; alias = first; helper.__toESM(alias, 1);";
    let analysis = analyze(code, None).unwrap();
    let kinds: Vec<_> = analysis
        .local_root_facts
        .iter()
        .map(|fact| fact.kind.as_str())
        .collect();
    assert_eq!(kinds, ["alias", "require", "alias", "alias", "interop"]);
    assert_eq!(
        analysis.local_root_facts[1].binding_name.as_deref(),
        Some("first")
    );
    assert_eq!(
        analysis.local_root_facts[4].reference_name.as_deref(),
        Some("alias")
    );
}

#[test]
fn rejects_parser_errors_and_lone_surrogate_values_per_item() {
    for code in [
        "const =",
        "require('\\uD800')",
        "require('\\uDC00')",
        "require(`\\uD800`)",
        "wx['\\uD800']()",
        "const props = { '\\uDC00': true }; require('pkg')",
    ] {
        assert!(analyze(code, None).is_none());
    }
}

#[test]
fn preserves_existing_interop_fact_around_a_shadowed_relative_require() {
    let code = "function local(require) { return __toESM(require('./miniprogram_npm/pkg'), 1); }";
    let analysis = analyze(code, None).unwrap();
    assert!(analysis.requires.is_empty());
    assert_eq!(analysis.local_root_facts.len(), 1);
    assert_eq!(analysis.local_root_facts[0].kind, "interop");
    assert_eq!(
        analysis.local_root_facts[0].importee.as_deref(),
        Some("./miniprogram_npm/pkg")
    );
}
