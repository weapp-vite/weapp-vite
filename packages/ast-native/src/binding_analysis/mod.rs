use std::collections::HashSet;

use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::{Expression, Statement}};
use oxc_ast_visit::VisitMut;
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;

mod normalize;
mod references;

#[napi(object)]
pub struct NativeBindingExpressionInput {
    pub expression: Utf16String,
    pub locals: Vec<Utf16String>,
    pub safe_call_names: Vec<Utf16String>,
}

#[napi(object)]
pub struct NativeBindingDependency {
    pub root: String,
    pub path: Option<String>,
    pub mode: String,
}

#[napi(object)]
pub struct NativeBindingExpressionAnalysis {
    pub dependencies: Vec<NativeBindingDependency>,
    pub snapshot_fallback: bool,
}

fn lossless_string(value: &Utf16String) -> napi::Result<String> {
    String::from_utf16(value).map_err(|_| napi::Error::from_reason("Experimental binding input contains lone UTF-16 surrogates"))
}

fn string_set(values: &[Utf16String]) -> napi::Result<HashSet<String>> {
    values.iter().map(lossless_string).collect()
}

fn analyze_expression(
    input: NativeBindingExpressionInput,
    ignored_globals: &HashSet<String>,
) -> napi::Result<Option<NativeBindingExpressionAnalysis>> {
    let expression = lossless_string(&input.expression)?;
    let locals = string_set(&input.locals)?;
    let safe_call_names = string_set(&input.safe_call_names)?;
    let source = format!("({expression})");
    let allocator = Allocator::default();
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
    let mut result = NativeBindingExpressionAnalysis { dependencies: Vec::new(), snapshot_fallback: false };
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
                if call.optional || !matches!(&call.callee, Expression::Identifier(identifier) if safe_call_names.contains(identifier.name.as_str())) {
                    result.snapshot_fallback = true;
                }
                None
            }
            AstKind::NewExpression(_) | AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::SpreadElement(_) => {
                result.snapshot_fallback = true;
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
        if locals.contains(&name) || ignored_globals.contains(&name)
            || references::has_babel_binding(semantic, id, &name)
        {
            continue;
        }
        let dependency = references::dependency(nodes, id, &name)?;
        let key = format!("{}:{}:{}", dependency.root, dependency.path.as_deref().unwrap_or(""), dependency.mode);
        if seen.insert(key) {
            result.dependencies.push(dependency);
        }
    }
    Ok(Some(result))
}

/// 实验批处理入口；每个表达式只解析一次，保留单项解析失败与整批无损回退边界。
#[napi(js_name = "analyzeBindingExpressionsNative")]
pub fn analyze_binding_expressions_native(
    inputs: Vec<NativeBindingExpressionInput>,
    ignored_globals: Vec<Utf16String>,
) -> napi::Result<Vec<Option<NativeBindingExpressionAnalysis>>> {
    let ignored_globals = string_set(&ignored_globals)?;
    inputs.into_iter().map(|input| analyze_expression(input, &ignored_globals)).collect()
}
