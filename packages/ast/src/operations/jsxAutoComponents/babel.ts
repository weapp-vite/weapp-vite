import type { Expression, ObjectExpression } from '@babel/types'
import type * as t from '@babel/types'
import type {
  JsxAutoComponentAnalysisOptions,
  JsxAutoComponentContext,
  JsxBabelModuleAnalysisOptions,
} from './types'
import * as babelTypes from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../babel'
import { getObjectPropertyByKey, resolveRenderableExpression } from '../../babelNodes'
import {
  createJsxImportedComponent,
  defaultIsDefineComponentSource,
  getJsxImportLocalName,
  isJsxDefineComponentImportSpecifier,
} from './shared'

export function defaultResolveBabelComponentExpression(
  declaration: t.Declaration | t.Expression | null,
  defineComponentDecls: Map<string, ObjectExpression>,
  defineComponentAliases: Set<string>,
): Expression | null {
  if (!declaration) {
    return null
  }
  if (babelTypes.isObjectExpression(declaration)) {
    return declaration
  }
  if (
    babelTypes.isCallExpression(declaration)
    && babelTypes.isIdentifier(declaration.callee)
    && defineComponentAliases.has(declaration.callee.name)
  ) {
    const arg = declaration.arguments[0]
    if (babelTypes.isObjectExpression(arg)) {
      return arg
    }
    if (babelTypes.isIdentifier(arg)) {
      return defineComponentDecls.get(arg.name) ?? null
    }
  }
  if (babelTypes.isIdentifier(declaration)) {
    return defineComponentDecls.get(declaration.name) ?? null
  }
  return null
}

export function defaultResolveBabelRenderExpression(componentExpr: Expression) {
  if (!babelTypes.isObjectExpression(componentExpr)) {
    return null
  }

  const renderNode = getObjectPropertyByKey(componentExpr, 'render')
  if (!renderNode) {
    return null
  }

  if (!babelTypes.isObjectMethod(renderNode) && !babelTypes.isObjectProperty(renderNode)) {
    return null
  }

  return resolveRenderableExpression(renderNode)
}

export function collectJsxImportedComponentsAndDefaultExportFromBabelAst(
  ast: t.File,
  options: JsxBabelModuleAnalysisOptions = {},
) {
  const resolvedOptions = {
    isDefineComponentSource: options.isDefineComponentSource ?? defaultIsDefineComponentSource,
    resolveBabelComponentExpression: options.resolveBabelComponentExpression ?? defaultResolveBabelComponentExpression,
  }
  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, ObjectExpression>()
  const imports = new Map<string, ReturnType<typeof createJsxImportedComponent>>()
  let exportDefaultExpression: Expression | null = null

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value

      if (resolvedOptions.isDefineComponentSource(source)) {
        for (const specifier of path.node.specifiers) {
          if (isJsxDefineComponentImportSpecifier(specifier)) {
            const localName = getJsxImportLocalName(specifier)
            if (localName) {
              defineComponentAliases.add(localName)
            }
          }
        }
      }

      if (path.node.importKind === 'type') {
        return
      }
      if (!babelTypes.isStringLiteral(path.node.source)) {
        return
      }
      const importSource = path.node.source.value
      for (const specifier of path.node.specifiers) {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          continue
        }
        const localName = getJsxImportLocalName(specifier)
        if (!localName) {
          continue
        }
        if (babelTypes.isImportDefaultSpecifier(specifier)) {
          imports.set(localName, createJsxImportedComponent(localName, importSource, 'default'))
          continue
        }
        if (!babelTypes.isImportSpecifier(specifier)) {
          continue
        }
        imports.set(localName, createJsxImportedComponent(localName, importSource, 'named', specifier.imported))
      }
    },
    VariableDeclarator(path) {
      if (!babelTypes.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (babelTypes.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, babelTypes.cloneNode(path.node.init, true))
        return
      }
      if (!babelTypes.isCallExpression(path.node.init)) {
        return
      }
      const callee = path.node.init.callee
      if (!babelTypes.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
        return
      }
      const first = path.node.init.arguments[0]
      if (babelTypes.isObjectExpression(first)) {
        defineComponentDecls.set(path.node.id.name, babelTypes.cloneNode(first, true))
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      if (babelTypes.isDeclaration(declaration)) {
        return
      }
      exportDefaultExpression = resolvedOptions.resolveBabelComponentExpression(
        declaration,
        defineComponentDecls,
        defineComponentAliases,
      )
    },
  })

  return {
    importedComponents: [...imports.values()],
    exportDefaultExpression,
  }
}

export function collectJsxTemplateTagsFromBabelExpression(
  renderExpression: Expression,
  isCollectableTag: (tag: string) => boolean,
) {
  const tags = new Set<string>()

  function walk(node: t.Node) {
    if (babelTypes.isJSXElement(node)) {
      const { name } = node.openingElement
      if (!babelTypes.isJSXMemberExpression(name)) {
        let tag: string | null = null
        if (babelTypes.isJSXIdentifier(name)) {
          tag = name.name
        }
        else if (babelTypes.isJSXNamespacedName(name)) {
          tag = `${name.namespace.name}:${name.name.name}`
        }
        if (tag && isCollectableTag(tag)) {
          tags.add(tag)
        }
      }
      for (const child of node.children) {
        walk(child)
      }
      return
    }
    if (babelTypes.isJSXFragment(node)) {
      for (const child of node.children) {
        walk(child)
      }
      return
    }
    if (babelTypes.isJSXExpressionContainer(node) && !babelTypes.isJSXEmptyExpression(node.expression)) {
      walk(node.expression)
      return
    }
    if (babelTypes.isConditionalExpression(node)) {
      walk(node.consequent)
      walk(node.alternate)
      return
    }
    if (babelTypes.isLogicalExpression(node)) {
      walk(node.left)
      walk(node.right)
      return
    }
    if (babelTypes.isCallExpression(node)) {
      for (const arg of node.arguments) {
        if (babelTypes.isExpression(arg)) {
          walk(arg)
        }
      }
      return
    }
    if (babelTypes.isArrowFunctionExpression(node) || babelTypes.isFunctionExpression(node)) {
      if (babelTypes.isBlockStatement(node.body)) {
        for (const stmt of node.body.body) {
          if (babelTypes.isReturnStatement(stmt) && stmt.argument) {
            walk(stmt.argument)
          }
        }
      }
      else {
        walk(node.body)
      }
      return
    }
    if (babelTypes.isArrayExpression(node)) {
      for (const element of node.elements) {
        if (element && babelTypes.isExpression(element)) {
          walk(element)
        }
      }
      return
    }
    if (babelTypes.isParenthesizedExpression(node) || babelTypes.isTSAsExpression(node) || babelTypes.isTSSatisfiesExpression(node) || babelTypes.isTSNonNullExpression(node)) {
      walk((node as t.ParenthesizedExpression).expression)
    }
  }

  walk(renderExpression)
  return tags
}

export function collectJsxAutoComponentsWithBabel(source: string, options: Required<JsxAutoComponentAnalysisOptions>): JsxAutoComponentContext {
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  const { importedComponents, exportDefaultExpression } = collectJsxImportedComponentsAndDefaultExportFromBabelAst(ast, options)
  if (!exportDefaultExpression) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  const renderExpression = options.resolveBabelRenderExpression(exportDefaultExpression)
  if (!renderExpression) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  return {
    templateTags: collectJsxTemplateTagsFromBabelExpression(renderExpression, options.isCollectableTag),
    importedComponents,
  }
}
