use std::{path::Path, process::Command};

use oxc_sourcemap::Token;
use oxc_span::SPAN;
use serde_json::json;

use super::*;

#[test]
fn same_generated_position_uses_the_last_printed_owner_in_encoded_js_consumer() {
    let source = "function run(){const previous=1;original;}";
    for minify in [false, true] {
        for synthetic_statement in [false, true] {
            let allocator = Allocator::default();
            let mut program = parse(&allocator, source);
            struct Ownership {
                synthetic_statement: bool,
            }
            impl<'a> VisitMut<'a> for Ownership {
                fn visit_expression_statement(&mut self, statement: &mut ExpressionStatement<'a>) {
                    if let Expression::Identifier(identifier) = &mut statement.expression
                        && identifier.name == "original"
                    {
                        if self.synthetic_statement {
                            statement.span = SPAN;
                        } else {
                            identifier.span = SPAN;
                        }
                    }
                    walk_mut::walk_expression_statement(self, statement);
                }
            }
            Ownership {
                synthetic_statement,
            }
            .visit_program(&mut program);
            let (code, map) = checked(&mut program, &allocator, options(minify));
            let generated = point(&code, "original", 0);
            let expected = if synthetic_statement {
                json!({"source":"input.js", "line":1, "column":source.find("original").unwrap(), "name":null})
            } else {
                json!({"source":null, "line":null, "column":null, "name":null})
            };
            let script = format!(
                r#"
import assert from 'node:assert/strict';
import {{ TraceMap, originalPositionFor }} from '@jridgewell/trace-mapping';
const map = new TraceMap({});
assert.deepEqual(originalPositionFor(map, {{ line:{}, column:{} }}), {});
"#,
                map.to_json_string(),
                generated.0 + 1,
                generated.1,
                expected
            );
            let result = Command::new("node")
                .args(["--input-type=module", "-e", &script])
                .current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join("../.."))
                .output()
                .expect("Node and workspace trace-mapping dependency are required");
            assert!(
                result.status.success(),
                "minify={minify} synthetic_statement={synthetic_statement}: {}",
                String::from_utf8_lossy(&result.stderr)
            );
            let mut previous = None;
            for token in map.get_tokens() {
                let position = (token.get_dst_line(), token.get_dst_col());
                assert_ne!(
                    previous,
                    Some(position),
                    "duplicate generated columns must not escape finalization"
                );
                previous = Some(position);
            }
        }
    }
}

#[test]
fn finalizer_rejects_unsorted_positions_and_discards_names_of_replaced_owners() {
    fn map(tokens: Vec<Token>) -> SourceMap<'static> {
        SourceMap::new(
            None,
            vec!["actual".into(), "\0".into()],
            None,
            vec!["input.js".into()],
            vec![Some("\0\nx".into())],
            tokens.into_boxed_slice(),
            None,
        )
    }
    let real = Token::new(0, 0, 1, 0, Some(0), Some(0));
    let synthetic = Token::new(0, 0, 0, 0, Some(0), Some(1));
    let finalized = super::super::map::finalize(map(vec![real, synthetic]), "x", "\0\nx").unwrap();
    assert_eq!(finalized.get_tokens().len(), 1);
    assert_eq!(finalized.get_token(0).unwrap().get_source_id(), None);
    assert_eq!(finalized.get_names().len(), 0);
    let finalized = super::super::map::finalize(map(vec![synthetic, real]), "x", "\0\nx").unwrap();
    assert_eq!(finalized.get_names().collect::<Vec<_>>(), vec!["actual"]);
    assert_eq!(finalized.get_token(0).unwrap().get_name_id(), Some(0));
    let earlier = Token::new(0, 4, 1, 0, Some(0), None);
    assert!(super::super::map::finalize(map(vec![earlier, real]), "x", "\0\nx").is_err());
}
