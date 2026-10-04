use std::collections::HashSet;

use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::{Expression, Statement}};
use oxc_ast_visit::VisitMut;
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;

use super::{NativeBindingDependency, normalize, references};

// 摘要只持有自有数据；表达式内部作用域已解析，外部配置在每项请求中特化。
pub(super) struct BindingExpressionSummary {
    pub dependencies: Vec<NativeBindingDependency>,
    pub direct_call_names: HashSet<String>,
    pub unconditional_snapshot_fallback: bool,
}

pub(super) fn parse_expression_summary(expression: &str) -> napi::Result<Option<BindingExpressionSummary>> {
    let source = format!("({expression})");
    let allocator = Allocator::default();
    #[cfg(test)]
    super::tests::record_parse();
    let mut parsed = Parser::new(&allocator, &source, SourceType::ts())
        .with_options(ParseOptions { preserve_parens: false, ..ParseOptions::default() })
        .parse();
    if parsed.fatal_error || !parsed.diagnostics.is_empty()
        || !matches!(parsed.program.body.first(), Some(Statement::ExpressionStatement(_)))
    {
        return Ok(None);
    }
    let mut normalization = normalize::NormalizeTypes { allocator: &allocator, unsupported: false };
    normalization.visit_program(&mut parsed.program);
    if normalization.unsupported {
        return Err(napi::Error::from_reason("Experimental binding assignment target is unsupported"));
    }
    let built = SemanticBuilder::new().with_build_nodes(true).with_check_syntax_error(true).build(&parsed.program);
    if !built.diagnostics.is_empty() {
        return Ok(None);
    }
    let semantic = &built.semantic;
    let nodes = semantic.nodes();
    let mut seen = HashSet::new();
    let mut summary = BindingExpressionSummary {
        dependencies: Vec::new(),
        direct_call_names: HashSet::new(),
        unconditional_snapshot_fallback: false,
    };
    for (id, node) in nodes.iter_enumerated() {
        let name = match node.kind() {
            AstKind::IdentifierReference(identifier)
                if references::is_referenced(nodes, id) =>
            {
                Some(identifier.name.to_string())
            }
            AstKind::IdentifierName(_) | AstKind::BindingIdentifier(_) | AstKind::TSIndexSignatureName(_)
                | AstKind::TSThisParameter(_) => references::referenced_type_name(nodes, id),
            AstKind::CallExpression(call) => {
                if let Expression::Identifier(identifier) = &call.callee
                    && !call.optional
                {
                    summary.direct_call_names.insert(identifier.name.to_string());
                } else {
                    summary.unconditional_snapshot_fallback = true;
                }
                None
            }
            AstKind::NewExpression(_) | AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::SpreadElement(_) => {
                summary.unconditional_snapshot_fallback = true;
                None
            }
            AstKind::StringLiteral(literal) if literal.lone_surrogates => {
                return Err(napi::Error::from_reason("Experimental binding literal contains lone surrogates"));
            }
            AstKind::TemplateElement(element) if element.lone_surrogates => {
                return Err(napi::Error::from_reason("Experimental binding literal contains lone surrogates"));
            }
            _ => None,
        };
        let Some(name) = name else { continue };
        if references::has_babel_binding(semantic, id, &name) {
            continue;
        }
        let dependency = references::dependency(nodes, id, &name)?;
        let key = format!("{}:{}:{}", dependency.root, dependency.path.as_deref().unwrap_or(""), dependency.mode);
        if seen.insert(key) {
            summary.dependencies.push(dependency);
        }
    }
    Ok(Some(summary))
}
