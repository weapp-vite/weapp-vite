use oxc_ast::{AstKind, ast::{Expression, FormalParameterKind}};
use oxc_semantic::{AstNodes, Semantic};
use oxc_span::GetSpan;
use oxc_syntax::{node::NodeId, number::ToJsString};

use super::NativeBindingDependency;

// Oxc 为写入目标也创建引用；Babel 的 referenced identifier 对直接赋值目标返回 false。
pub(super) fn is_referenced(nodes: &AstNodes<'_>, id: NodeId) -> bool {
    match nodes.parent_kind(id) {
        AstKind::AssignmentExpression(node) => node.right.node_id() == id,
        AstKind::ArrayAssignmentTarget(_) | AstKind::AssignmentTargetRest(_) => false,
        AstKind::AssignmentTargetPropertyIdentifier(node) => node.binding.node_id() != id,
        AstKind::AssignmentTargetPropertyProperty(node) => node.binding.node_id() != id,
        AstKind::AssignmentTargetWithDefault(node) => node.binding.node_id() != id,
        _ => true,
    }
}

fn member_object(kind: AstKind<'_>) -> Option<&Expression<'_>> {
    match kind {
        AstKind::StaticMemberExpression(node) => Some(&node.object),
        AstKind::ComputedMemberExpression(node) => Some(&node.object),
        AstKind::PrivateFieldExpression(node) => Some(&node.object),
        _ => None,
    }
}

// 由根引用向外追踪对象链，计算键自身仍会在后续节点遍历中按原顺序成为依赖。
pub(super) fn dependency(nodes: &AstNodes<'_>, id: NodeId, name: &str) -> napi::Result<NativeBindingDependency> {
    let mut current = id;
    let mut properties = vec![name.to_string()];
    let mut dynamic = false;
    for parent_id in nodes.ancestor_ids(id) {
        let parent = nodes.kind(parent_id);
        if matches!(parent, AstKind::ChainExpression(_)) {
            current = parent_id;
            continue;
        }
        let Some(object) = member_object(parent) else { break };
        if object.node_id() != current {
            break;
        }
        let property = match parent {
            AstKind::StaticMemberExpression(node) => Some(node.property.name.to_string()),
            AstKind::ComputedMemberExpression(node) => match &node.expression {
                Expression::StringLiteral(literal) => {
                    if literal.lone_surrogates {
                        return Err(napi::Error::from_reason("Experimental binding property contains lone surrogates"));
                    }
                    Some(literal.value.to_string())
                }
                Expression::NumericLiteral(literal) => Some(literal.value.to_js_string()),
                _ => None,
            },
            _ => None,
        };
        if let Some(property) = property {
            properties.push(property);
        } else {
            dynamic = true;
        }
        current = parent_id;
    }
    Ok(NativeBindingDependency {
        root: name.to_string(),
        path: (!dynamic).then(|| properties.join(".")),
        mode: if dynamic { "top-level" } else { "exact-path" }.to_string(),
    })
}

// 这些类型语法在 Babel 保留可引用 Identifier；Oxc 使用不同节点角色。
pub(super) fn referenced_type_name(nodes: &AstNodes<'_>, id: NodeId) -> Option<String> {
    match nodes.kind(id) {
        AstKind::IdentifierName(identifier) => match nodes.parent_kind(id) {
            AstKind::TSQualifiedName(node) if node.right.span == identifier.span() => Some(identifier.name.to_string()),
            AstKind::TSNamedTupleMember(_) | AstKind::TSMethodSignature(_) | AstKind::TSTypePredicate(_) => Some(identifier.name.to_string()),
            _ => None,
        },
        AstKind::BindingIdentifier(identifier) => {
            let parent_id = nodes.parent_id(id);
            if matches!(nodes.kind(parent_id), AstKind::TSTypeParameter(_) | AstKind::TSMappedType(_)
                | AstKind::TSTypeAliasDeclaration(_) | AstKind::TSInterfaceDeclaration(_))
                || (matches!(nodes.kind(parent_id), AstKind::FormalParameter(_))
                    && matches!(nodes.parent_kind(parent_id), AstKind::FormalParameters(parameters) if parameters.kind == FormalParameterKind::Signature))
            {
                Some(identifier.name.to_string())
            } else {
                None
            }
        }
        AstKind::TSIndexSignatureName(identifier) => Some(identifier.name.to_string()),
        AstKind::TSThisParameter(_) => Some("this".to_string()),
        _ => None,
    }
}

// Babel 不为保留的类型签名创建局部绑定；继续寻找外层真正的值绑定。
pub(super) fn has_babel_binding(semantic: &Semantic<'_>, id: NodeId, name: &str) -> bool {
    let nodes = semantic.nodes();
    let scoping = semantic.scoping();
    let mut current = Some(nodes.get_node(id).scope_id());
    while let Some(scope_id) = current {
        if let Some(symbol) = scoping.get_binding(scope_id, name.into()) {
            let declaration = scoping.symbol_declaration(symbol);
            let flags = scoping.symbol_flags(symbol);
            let mut type_binding = flags.is_type() && !flags.is_value();
            for ancestor in nodes.ancestor_kinds(declaration) {
                match ancestor {
                    AstKind::TSTypeParameter(_) | AstKind::TSFunctionType(_) | AstKind::TSConstructorType(_)
                    | AstKind::TSCallSignatureDeclaration(_) | AstKind::TSConstructSignatureDeclaration(_)
                    | AstKind::TSMethodSignature(_) | AstKind::TSMappedType(_) => {
                        type_binding = true;
                        break;
                    }
                    AstKind::Function(_) | AstKind::ArrowFunctionExpression(_) | AstKind::Class(_) => break,
                    _ => {}
                }
            }
            if !type_binding {
                return true;
            }
        }
        current = scoping.scope_parent_id(scope_id);
    }
    false
}
