import type { NodePath } from '@weapp-vite/ast/babelCore'
import * as t from '@weapp-vite/ast/babelTypes'

function typeOnlyDeclaration(node: t.Node) {
  return t.isTSInterfaceDeclaration(node) || t.isTSTypeAliasDeclaration(node) || t.isTSDeclareFunction(node) || ('declare' in node && node.declare === true)
}

export function isDefaultExportSpecifier(specifier: t.ExportSpecifier | t.ExportNamespaceSpecifier | t.ExportDefaultSpecifier) {
  return t.isIdentifier(specifier.exported, { name: 'default' }) || t.isStringLiteral(specifier.exported, { value: 'default' })
}

/** 纯类型导出不改变默认模块 API；混合值导出保留完整的 ESM namespace。 */
export function runtimeExportShape(program: NodePath<t.Program>) {
  const typeNames = new Set<string>()
  for (const statement of program.node.body) {
    const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement
    if (declaration && typeOnlyDeclaration(declaration) && 'id' in declaration && t.isIdentifier(declaration.id)) {
      typeNames.add(declaration.id.name)
    }
    if (t.isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers) {
        if (statement.importKind === 'type' || (t.isImportSpecifier(specifier) && specifier.importKind === 'type')) {
          typeNames.add(specifier.local.name)
        }
      }
    }
  }
  let named = false
  let defaultExport = false
  for (const statement of program.node.body) {
    if (t.isExportDefaultDeclaration(statement) && !typeOnlyDeclaration(statement.declaration)) {
      defaultExport = true
    }
    if (t.isExportAllDeclaration(statement)) {
      named ||= statement.exportKind !== 'type'
      continue
    }
    if (!t.isExportNamedDeclaration(statement) || statement.exportKind === 'type') {
      continue
    }
    if (statement.declaration) {
      named ||= !typeOnlyDeclaration(statement.declaration)
      continue
    }
    for (const specifier of statement.specifiers) {
      if (t.isExportSpecifier(specifier) && (specifier.exportKind === 'type' || (t.isIdentifier(specifier.local) && typeNames.has(specifier.local.name)))) {
        continue
      }
      if (isDefaultExportSpecifier(specifier)) {
        defaultExport = true
      }
      else {
        named = true
      }
    }
  }
  return { named, defaultExport }
}
