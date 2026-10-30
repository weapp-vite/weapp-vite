import type * as t from '@weapp-vite/ast/babelTypes'
import type { SourceRange } from '../types'
import type { ScriptExportScope, ScriptReference, ScriptSymbol } from './types'
import { traverse } from '@weapp-vite/ast'
import { collectModuleFacts } from './moduleFacts'

type ScriptAst = Parameters<typeof traverse>[0]
interface Bindings { getBinding: (name: string) => { identifier: t.Identifier, path: { node: t.Node } } | undefined }

export function staticScriptString(node: { type: string, value?: unknown, expressions?: unknown[], quasis?: Array<{ value: { cooked?: string | null, raw: string } }> } | null | undefined) {
  if (node?.type === 'StringLiteral') {
    return typeof node.value === 'string' ? node.value : undefined
  }
  if (node?.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    return node.quasis?.map(part => part.value.cooked ?? part.value.raw).join('')
  }
  return undefined
}

function range(node: { type?: string, start?: number | null, end?: number | null }): SourceRange {
  const quoted = node.type === 'StringLiteral'
  return { start: (node.start ?? 0) + (quoted ? 1 : 0), end: (node.end ?? 0) - (quoted ? 1 : 0) }
}

function propertyName(node: t.Node | null | undefined, computed = false) {
  if (node?.type === 'Identifier' && !computed) {
    return node.name
  }
  return staticScriptString(node)
}

function moduleExports(node: t.Node | null | undefined) {
  return node?.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'module' && propertyName(node.property, node.computed) === 'exports'
}

/** 解析后的 AST 同时供应模块导航与本地符号，不重复正则解析脚本。 */
export function collectScriptFacts(ast: ScriptAst) {
  const references: ScriptReference[] = []
  const symbols = new Map<string, ScriptSymbol>()
  function symbol(name: string, kind: ScriptSymbol['kind'], node: t.Node, declaration?: SourceRange, rename: ScriptSymbol['rename'] | null = { kind: 'name' }, exportScope?: ScriptExportScope) {
    const value: ScriptSymbol = { name, kind, ...range(node), ...(declaration ? { declaration } : {}), ...(rename ? { rename } : {}), ...(exportScope ? { exportScope } : {}) }
    symbols.set(`${exportScope ?? ''}:${kind}:${name}:${value.start}:${value.end}`, value)
  }
  function reference(node: t.Node | null | undefined, kind: ScriptReference['kind']) {
    const source = staticScriptString(node)
    if (source !== undefined && node) {
      references.push({ source, kind, start: (node.start ?? 0) + 1, end: Math.max((node.start ?? 0) + 1, (node.end ?? 0) - 1) })
    }
  }
  function objectExports(node: t.Node, bindings: Bindings, exportScope: 'default-member' | 'commonjs', visited = new Set<t.Node>()) {
    if (visited.has(node)) {
      return
    }
    visited.add(node)
    if (node.type === 'Identifier') {
      const binding = bindings.getBinding(node.name)
      if (binding?.path.node.type === 'VariableDeclarator' && binding.path.node.init) {
        objectExports(binding.path.node.init, bindings, exportScope, visited)
      }
      if (exportScope === 'commonjs') {
        symbol('default', 'export', node, binding ? range(binding.identifier) : undefined, null, 'commonjs')
      }
      return
    }
    if (node.type !== 'ObjectExpression') {
      if (exportScope === 'commonjs') {
        symbol('default', 'export', node, undefined, null, 'commonjs')
      }
      return
    }
    for (const property of node.properties) {
      if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod') {
        continue
      }
      const name = propertyName(property.key, property.computed)
      if (name !== undefined) {
        const binding = property.type === 'ObjectProperty' && property.value.type === 'Identifier' ? bindings.getBinding(property.value.name) : undefined
        symbol(name, 'export', property.key, binding ? range(binding.identifier) : range(property.key), property.type === 'ObjectProperty' && property.shorthand ? { kind: 'property-shorthand', localName: name } : { kind: 'name' }, exportScope)
      }
    }
  }
  traverse(ast, {
    Identifier(path) {
      const property = path.parentPath.isObjectProperty() ? path.parentPath : path.parentPath.isAssignmentPattern() && path.parentPath.parentPath.isObjectProperty() ? path.parentPath.parentPath : undefined
      const specifier = path.parentPath.isExportSpecifier() ? path.parentPath.node : undefined
      const imported = path.parentPath.isImportSpecifier() ? path.parentPath.node : undefined
      const rename: NonNullable<ScriptSymbol['rename']> = property?.node.shorthand
        ? { kind: 'property-shorthand', localName: path.node.name }
        : imported && imported.local.start === imported.imported.start
          ? { kind: 'import-shorthand', localName: path.node.name }
          : specifier && specifier.local.start === specifier.exported.start ? { kind: 'export-shorthand', localName: path.node.name } : { kind: 'name' }
      const declaration: boolean = path.isBindingIdentifier()
      if (declaration) {
        symbol(path.node.name, 'declaration', path.node, undefined, rename)
      }
      else if (path.isReferencedIdentifier() && !path.findParent(parent => parent.isTSType() || parent.isTSInterfaceDeclaration() || parent.isTSTypeAliasDeclaration())) {
        const binding = path.scope.getBinding(path.node.name)
        symbol(path.node.name, 'reference', path.node, binding ? range(binding.identifier) : undefined, rename)
      }
    },
    ImportDeclaration(path) {
      reference(path.node.source, 'import')
    },
    CallExpression(path) {
      if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require' && !path.scope.getBinding('require')) {
        reference(path.node.arguments[0], 'require')
      }
    },
    ExportAllDeclaration(path) {
      reference(path.node.source, 'export')
    },
    ExportNamedDeclaration(path) {
      const node = path.node
      reference(node.source, 'export')
      if (node.declaration?.type === 'FunctionDeclaration' || node.declaration?.type === 'ClassDeclaration') {
        const id = node.declaration.id
        if (id) {
          symbol(id.name, 'export', id, range(id), { kind: 'binding', localName: id.name }, 'named')
        }
      }
      else if (node.declaration?.type === 'VariableDeclaration') {
        for (const id of Object.values(path.get('declaration').getBindingIdentifiers())) {
          symbol(id.name, 'export', id, range(id), { kind: 'binding', localName: id.name }, 'named')
        }
      }
      for (const specifier of node.specifiers) {
        const exported = specifier.exported
        const name = exported.type === 'Identifier' ? exported.name : exported.value
        const localName = specifier.type === 'ExportSpecifier' ? propertyName(specifier.local) : undefined
        const local = localName === undefined ? undefined : path.scope.getBinding(localName)
        const shorthand = specifier.type === 'ExportSpecifier' && specifier.local.start === exported.start
        symbol(name, 'export', exported, local ? range(local.identifier) : undefined, name === 'default' ? null : shorthand ? { kind: 'export-shorthand', localName: name } : { kind: 'name' }, name === 'default' ? 'default' : 'named')
        if (name === 'default' && local?.path.node.type === 'VariableDeclarator' && local.path.node.init) {
          objectExports(local.path.node.init, path.scope, 'default-member')
        }
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      const local = declaration.type === 'Identifier' ? path.scope.getBinding(declaration.name) : undefined
      const id = declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration' ? declaration.id : undefined
      symbol('default', 'export', id ?? declaration, local ? range(local.identifier) : id ? range(id) : undefined, null, 'default')
      objectExports(declaration, path.scope, 'default-member')
    },
    AssignmentExpression(path) {
      const left = path.node.left
      if (moduleExports(left) && !path.scope.getBinding('module')) {
        objectExports(path.node.right, path.scope, 'commonjs')
      }
      else if (left.type === 'MemberExpression' && ((moduleExports(left.object) && !path.scope.getBinding('module')) || (left.object.type === 'Identifier' && left.object.name === 'exports' && !path.scope.getBinding('exports')))) {
        const name = propertyName(left.property, left.computed)
        if (name !== undefined) {
          const binding = path.node.right.type === 'Identifier' ? path.scope.getBinding(path.node.right.name) : undefined
          symbol(name, 'export', left.property, binding ? range(binding.identifier) : range(left.property), { kind: 'name' }, 'commonjs')
        }
      }
    },
  })
  return { references, symbols: [...symbols.values()].sort((left, right) => left.start - right.start || left.kind.localeCompare(right.kind)), ...collectModuleFacts(ast) }
}
