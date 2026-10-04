use std::collections::HashSet;

use oxc_allocator::{Allocator, Vec};
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_ast_visit::{Visit, walk};
use oxc_span::{GetSpan, SPAN, Span};

use super::RewriteContract;

pub(super) struct ImportResult {
    pub transformed: bool,
    pub uses_slots: bool,
}

#[derive(Default)]
struct ImportOrigin {
    specifier: Span,
    imported: Span,
    local: Span,
}

struct RoutedImport {
    imported: String,
    local: String,
    origin: ImportOrigin,
}

impl RoutedImport {
    fn named(specifier: &ImportSpecifier<'_>, name: &str) -> Self {
        Self {
            imported: name.to_owned(),
            local: specifier.local.name.to_string(),
            origin: ImportOrigin {
                specifier: specifier.span,
                imported: specifier.imported.span(),
                local: specifier.local.span,
            },
        }
    }
}

struct SlotsCalls {
    aliases: HashSet<String>,
    used: bool,
}

impl<'a> Visit<'a> for SlotsCalls {
    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if matches!(&call.callee, Expression::Identifier(id) if self.aliases.contains(id.name.as_str()))
        {
            self.used = true;
        }
        walk::walk_call_expression(self, call);
    }
}

fn imported_name<'n>(name: &'n ModuleExportName<'_>) -> &'n str {
    match name {
        ModuleExportName::IdentifierName(id) => id.name.as_str(),
        ModuleExportName::IdentifierReference(id) => id.name.as_str(),
        ModuleExportName::StringLiteral(value) => value.value.as_str(),
    }
}

/// 源模块和导出路径来自 JS 请求；没有路由时拒绝实验，避免产生无效产物。
pub fn ensure_runtime_import<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    contract: &RewriteContract,
    imported: &str,
    local: &str,
) -> Result<(), String> {
    ensure_runtime_import_with_origin(
        program,
        allocator,
        contract,
        imported,
        local,
        &ImportOrigin::default(),
    )
}

fn ensure_runtime_import_with_origin<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    contract: &RewriteContract,
    imported: &str,
    local: &str,
    origin: &ImportOrigin,
) -> Result<(), String> {
    let route = contract
        .runtime_import_routes
        .get(imported)
        .ok_or_else(|| format!("Missing runtime import route for {imported}"))?;
    let builder = AstBuilder::new(allocator);
    let new_specifier = || {
        ImportDeclarationSpecifier::new_import_specifier(
            origin.specifier,
            ModuleExportName::new_identifier_name(
                origin.imported,
                allocator.alloc_str(imported),
                &builder,
            ),
            BindingIdentifier::new(origin.local, allocator.alloc_str(local), &builder),
            ImportOrExportKind::Value,
            &builder,
        )
    };
    for statement in &mut program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };
        if import.source.value.as_str() != route || import.import_kind == ImportOrExportKind::Type {
            continue;
        }
        let specifiers = import
            .specifiers
            .get_or_insert_with(|| Vec::new_in(&allocator));
        let existing = specifiers.iter().any(|specifier| {
            matches!(specifier, ImportDeclarationSpecifier::ImportSpecifier(specifier)
                if specifier.import_kind != ImportOrExportKind::Type
                && matches!(&specifier.imported, ModuleExportName::IdentifierName(id) if id.name == imported)
                && specifier.local.name == local)
        });
        if !existing {
            specifiers.push(new_specifier());
        }
        return Ok(());
    }
    let mut specifiers = Vec::new_in(&allocator);
    specifiers.push(new_specifier());
    program.body.insert(
        0,
        Statement::new_import_declaration(
            SPAN,
            Some(specifiers),
            StringLiteral::new(SPAN, allocator.alloc_str(route), None, &builder),
            None,
            None,
            ImportOrExportKind::Value,
            &builder,
        ),
    );
    Ok(())
}

pub(super) fn rewrite_imports<'a>(
    program: &mut Program<'a>,
    allocator: &'a Allocator,
    contract: &RewriteContract,
) -> Result<ImportResult, String> {
    let mut slots = SlotsCalls {
        aliases: HashSet::new(),
        used: false,
    };
    let mut routes = std::vec::Vec::<RoutedImport>::new();
    let mut transformed = false;
    program.body.retain_mut(|statement| {
        let Statement::ImportDeclaration(import) = statement else { return true };
        let source = import.source.value.as_str();
        let vue = source == "vue";
        let public = source == contract.public_module;
        if (vue || contract.recognized_modules.contains(source)) && let Some(specifiers) = &import.specifiers {
            for specifier in specifiers {
                if let ImportDeclarationSpecifier::ImportSpecifier(specifier) = specifier
                    && imported_name(&specifier.imported) == "useSlots"
                {
                    slots.aliases.insert(specifier.local.name.to_string());
                }
            }
        }
        if source == "@vue/babel-helper-vue-transform-on" && let Some(specifiers) = &import.specifiers
            && let Some(local) = specifiers.iter().find_map(|specifier| match specifier {
                ImportDeclarationSpecifier::ImportDefaultSpecifier(specifier) => Some((specifier.local.name.to_string(), specifier.local.span)),
                _ => None,
            })
        {
            // default 改成具名导出没有对应的原 imported token；只有本地绑定保留来源。
            routes.push(RoutedImport {
                imported: "transformOn".to_string(),
                local: local.0,
                origin: ImportOrigin { local: local.1, ..ImportOrigin::default() },
            });
            transformed = true;
            return false;
        }
        // Vue 的入口 visitor 先删 defineComponent，再运行 import visitor；保留该顺序。
        if vue && let Some(specifiers) = &mut import.specifiers {
            specifiers.retain(|specifier| !matches!(specifier,
                ImportDeclarationSpecifier::ImportSpecifier(specifier)
                if matches!(&specifier.imported, ModuleExportName::IdentifierName(id) if id.name.as_str() == contract.define_component)));
            if specifiers.is_empty() { return false; }
            specifiers.retain(|specifier| {
                let ImportDeclarationSpecifier::ImportSpecifier(specifier) = specifier else { return true };
                let ModuleExportName::IdentifierName(id) = &specifier.imported else { return true };
                if contract.moved_vue_imports.contains(id.name.as_str()) {
                    routes.push(RoutedImport::named(specifier, id.name.as_str()));
                    transformed = true;
                    false
                } else { true }
            });
            if specifiers.is_empty() { return false; }
        }
        if import.import_kind == ImportOrExportKind::Type {
            transformed = true;
            return false;
        }
        if let Some(specifiers) = &mut import.specifiers {
            let previous = specifiers.len();
            specifiers.retain(|specifier| !matches!(specifier,
                ImportDeclarationSpecifier::ImportSpecifier(specifier) if specifier.import_kind == ImportOrExportKind::Type));
            transformed |= previous != specifiers.len();
            if previous != specifiers.len() && specifiers.is_empty() { return false; }
            if public {
                specifiers.retain(|specifier| {
                    let ImportDeclarationSpecifier::ImportSpecifier(specifier) = specifier else { return true };
                    let ModuleExportName::IdentifierName(id) = &specifier.imported else { return true };
                    if contract.movable_wevu_imports.contains(id.name.as_str()) {
                        routes.push(RoutedImport::named(specifier, id.name.as_str()));
                        transformed = true;
                        false
                    } else { true }
                });
            }
        }
        !(vue || public) || import.specifiers.as_ref().is_some_and(|specifiers| !specifiers.is_empty())
    });
    for route in routes {
        ensure_runtime_import_with_origin(
            program,
            allocator,
            contract,
            &route.imported,
            &route.local,
            &route.origin,
        )?;
    }
    slots.visit_program(program);
    Ok(ImportResult {
        transformed,
        uses_slots: slots.used,
    })
}
