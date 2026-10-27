import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { File, Node } from '@weapp-vite/ast/babelTypes'
import type { createAnalysisSourceReader } from '../sourceReader'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike, traverse } from '../../../../../utils/babel'

export interface ModuleFacts {
  id: string
  ast: File
  scope: Scope
}

export interface ModuleValue {
  node: Node
  module: ModuleFacts
}

export function createModuleFacts(id: string, ast: File): ModuleFacts {
  let scope: Scope | undefined
  traverse(ast, {
    Program(path) {
      scope = path.scope
      path.stop()
    },
  })
  return { id, ast, scope: scope! }
}

export function unwrap(node: Node): Node {
  return t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)
    || t.isTSTypeAssertion(node) || t.isTypeCastExpression(node) || t.isParenthesizedExpression(node)
    ? unwrap(node.expression)
    : node
}

export function staticName(node: Node, computed = false): string | undefined {
  node = unwrap(node)
  if (t.isStringLiteral(node) || t.isNumericLiteral(node)) {
    return String(node.value)
  }
  if (!computed && t.isIdentifier(node)) {
    return node.name
  }
  if (t.isTemplateLiteral(node) && !node.expressions.length) {
    return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw
  }
}

/** 只跟随所请求的导出；模块读取和解析在本次分析内复用。 */
export function createPropsModuleResolver(reader: ReturnType<typeof createAnalysisSourceReader>, root: ModuleFacts) {
  const modules = new Map<string, Promise<ModuleFacts | undefined>>([[root.id, Promise.resolve(root)]])
  const load = (id: string) => {
    let task = modules.get(id)
    if (!task) {
      task = (async () => {
        const source = await reader.load(id)
        if (!source || source.descriptor || source.invalid) {
          return undefined
        }
        try {
          source.ast ??= parseJsLike(source.source)
          return createModuleFacts(id, source.ast)
        }
        catch {
          return undefined
        }
      })()
      modules.set(id, task)
    }
    return task
  }

  const resolveExport = async (source: string, importer: string, name: string, visiting = new Set<string>()): Promise<ModuleValue | undefined> => {
    const id = await reader.resolve(source, importer)
    if (!id) {
      return undefined
    }
    const key = `${id}\0${name}`
    if (visiting.has(key)) {
      return undefined
    }
    const next = new Set(visiting).add(key)
    const module = await load(id)
    if (!module) {
      return undefined
    }
    for (const statement of module.ast.program.body) {
      if (name === 'default' && t.isExportDefaultDeclaration(statement)) {
        return { node: statement.declaration, module }
      }
      if (!t.isExportNamedDeclaration(statement) || statement.exportKind === 'type') {
        continue
      }
      if (t.isVariableDeclaration(statement.declaration)) {
        for (const declaration of statement.declaration.declarations) {
          if (t.isIdentifier(declaration.id, { name })) {
            return { node: declaration.id, module }
          }
        }
      }
      for (const specifier of statement.specifiers) {
        if (!t.isExportSpecifier(specifier) || specifier.exportKind === 'type' || staticName(specifier.exported) !== name) {
          continue
        }
        const local = staticName(specifier.local)
        if (statement.source) {
          return local ? resolveExport(statement.source.value, module.id, local, next) : undefined
        }
        return { node: specifier.local, module }
      }
    }
  }

  const resolveImport = async (node: Node, module: ModuleFacts): Promise<ModuleValue | undefined> => {
    node = unwrap(node)
    let local: string | undefined
    let member: string | undefined
    if (t.isIdentifier(node)) {
      local = node.name
    }
    else if (t.isMemberExpression(node) && t.isIdentifier(node.object)) {
      local = node.object.name
      member = staticName(node.property, node.computed)
      if (!member) {
        return undefined
      }
    }
    const binding = local && module.scope.getBinding(local)
    if (!binding || !binding.path.parentPath?.isImportDeclaration() || binding.path.parentPath.node.importKind === 'type') {
      return undefined
    }
    const declaration = binding.path.parentPath.node
    const specifier = binding.path.node
    const name = t.isImportDefaultSpecifier(specifier) && member === undefined
      ? 'default'
      : t.isImportSpecifier(specifier) && specifier.importKind !== 'type' && member === undefined
        ? staticName(specifier.imported)
        : t.isImportNamespaceSpecifier(specifier) ? member : undefined
    return name ? resolveExport(declaration.source.value, module.id, name) : undefined
  }
  return { resolveImport }
}
