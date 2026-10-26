use napi_derive::napi;
use oxc_ast::ast::{CallExpression, Expression, PropertyKind};

use crate::static_property_name;

#[napi(object)]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeReservedPropsDiagnostic {
    pub warning_offset: Option<u32>,
}

fn is_reserved(name: &str) -> bool {
    matches!(name, "id" | "class" | "slot")
}

fn runtime_props_contain_reserved(argument: &Expression<'_>) -> bool {
    match argument.without_parentheses() {
        Expression::ObjectExpression(object) => object.properties.iter().any(|property| {
            let oxc_ast::ast::ObjectPropertyKind::ObjectProperty(property) = property else {
                return false;
            };
            !property.computed
                && !property.method
                && property.kind == PropertyKind::Init
                && static_property_name(&property.key).is_some_and(is_reserved)
        }),
        Expression::ArrayExpression(array) => array.elements.iter().any(|element| {
            element.as_expression().is_some_and(|expression| {
                matches!(expression.without_parentheses(), Expression::StringLiteral(value) if value.value.as_str().is_some_and(is_reserved))
            })
        }),
        _ => false,
    }
}

#[derive(Default)]
pub(super) struct ReservedPropsAnalysis {
    unsupported: bool,
    warning_start: Option<u32>,
}

impl ReservedPropsAnalysis {
    pub(super) fn inspect_call(&mut self, call: &CallExpression<'_>) {
        if !call.optional
            && matches!(call.callee.without_parentheses(), Expression::Identifier(callee) if callee.name == "defineProps")
        {
            // 类型参数的作用域、交叉类型和递归引用继续交给现有 Babel 诊断。
            self.unsupported |= call.type_arguments.is_some();
            if self.warning_start.is_none()
                && call
                    .arguments
                    .first()
                    .and_then(|arg| arg.as_expression())
                    .is_some_and(runtime_props_contain_reserved)
            {
                self.warning_start = Some(call.span.start);
            }
        }
    }

    // 返回空诊断表示完整扫描后没有警告；缺失诊断表示调用方应执行原有检测。
    pub(super) fn finish(self, code: &str) -> Option<NativeReservedPropsDiagnostic> {
        (!self.unsupported).then(|| NativeReservedPropsDiagnostic {
            warning_offset: self
                .warning_start
                .map(|start| code[..start as usize].encode_utf16().count() as u32),
        })
    }
}
