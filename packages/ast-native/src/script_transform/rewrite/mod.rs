use std::collections::{HashMap, HashSet};

use oxc_allocator::Allocator;
use oxc_ast::ast::{Expression, ObjectExpression, Program};
use oxc_semantic::Scoping;

mod component;
mod expose;
mod imports;
mod strip_types;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod expose_baseline_tests;

pub use component::options_object_mut;
pub use imports::ensure_runtime_import;

/// 运行时路由由 JS 的既有常量传入；Rust 不维护另一份导出名单。
pub struct RewriteContract {
    pub define_component: String,
    pub public_module: String,
    pub recognized_modules: HashSet<String>,
    pub runtime_import_routes: HashMap<String, String>,
    pub movable_wevu_imports: HashSet<String>,
    pub moved_vue_imports: HashSet<String>,
    pub template_component_names: HashSet<String>,
}

pub struct PreparedComponent<'a> {
    pub expression: Option<Expression<'a>>,
    pub default_export_index: Option<usize>,
    pub transformed: bool,
    pub uses_slots: bool,
}

impl<'a> PreparedComponent<'a> {
    pub fn options_object_mut(&mut self) -> Option<&mut ObjectExpression<'a>> {
        self.expression.as_mut().and_then(options_object_mut)
    }
}

/// 在主 parse 的 AST 上改写；默认组件暂时移出 program，供后续原生元数据阶段注入。
pub fn prepare_program<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    contract: &RewriteContract,
    scoping: &Scoping,
) -> Result<PreparedComponent<'a>, String> {
    if !contract.template_component_names.is_empty() {
        return Err("Template-only component pruning is not implemented in this experiment".to_string());
    }
    // Babel 在进入 setup 方法时重命名 expose，随后才访问方法体中的空调用。
    let exposed = expose::rename_setup_expose(program, allocator, scoping);
    let mut cleanup = strip_types::StripTypes::new(allocator);
    oxc_ast_visit::VisitMut::visit_program(&mut cleanup, program);
    if let Some(reason) = cleanup.unsupported {
        return Err(reason);
    }
    let imports = imports::rewrite_imports(program, allocator, contract)?;
    let component = component::take_component(program, allocator, contract,
        exposed || cleanup.transformed || cleanup.vue_cleanup)?;
    Ok(PreparedComponent {
        expression: component.expression,
        default_export_index: component.default_export_index,
        transformed: exposed || cleanup.transformed || imports.transformed || component.transformed,
        uses_slots: imports.uses_slots,
    })
}
