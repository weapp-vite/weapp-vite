import type { Expression, ObjectExpression } from '@babel/types'
import type { AstEngineName } from '../types'
import * as t from '@babel/types'
import { parseSync } from 'oxc-parser'
import { walk as walkOxc } from 'oxc-walker'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../babel'
import { getObjectPropertyByKey, resolveRenderableExpression } from '../babelNodes'

export interface JsxImportedComponent {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

export interface JsxAutoComponentContext {
  templateTags: Set<string>
  importedComponents: JsxImportedComponent[]
}

export interface JsxAutoComponentAnalysisOptions {
  astEngine?: AstEngineName
  isCollectableTag: (tag: string) => boolean
  isDefineComponentSource?: (source: string) => boolean
  resolveBabelComponentExpression?: (
    declaration: t.Declaration | t.Expression | null,
    defineComponentDecls: Map<string, ObjectExpression>,
    defineComponentAliases: Set<string>,
  ) => Expression | null
  resolveBabelRenderExpression?: (componentExpr: Expression) => Expression | null
}

export interface JsxBabelModuleAnalysisOptions {
  isDefineComponentSource?: (source: string) => boolean
  resolveBabelComponentExpression?: (
    declaration: t.Declaration | t.Expression | null,
    defineComponentDecls: Map<string, ObjectExpression>,
    defineComponentAliases: Set<string>,
  ) => Expression | null
}

function defaultIsDefineComponentSource(source: string) {
  return source === 'vue'
}

function defaultResolveBabelComponentExpression(
  declaration: t.Declaration | t.Expression | null,
  defineComponentDecls: Map<string, ObjectExpression>,
  defineComponentAliases: Set<string>,
): Expression | null {
  if (!declaration) {
    return null
  }
  if (t.isObjectExpression(declaration)) {
    return declaration
  }
  if (
    t.isCallExpression(declaration)
    && t.isIdentifier(declaration.callee)
    && defineComponentAliases.has(declaration.callee.name)
  ) {
    const arg = declaration.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
    if (t.isIdentifier(arg)) {
      return defineComponentDecls.get(arg.name) ?? null
    }
  }
  if (t.isIdentifier(declaration)) {
    return defineComponentDecls.get(declaration.name) ?? null
  }
  return null
}

function defaultResolveBabelRenderExpression(componentExpr: Expression) {
  if (!t.isObjectExpression(componentExpr)) {
    return null
  }

  const renderNode = getObjectPropertyByKey(componentExpr, 'render')
  if (!renderNode) {
    return null
  }

  if (!t.isObjectMethod(renderNode) && !t.isObjectProperty(renderNode)) {
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
  const imports = new Map<string, JsxImportedComponent>()
  let exportDefaultExpression: Expression | null = null

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value

      if (resolvedOptions.isDefineComponentSource(source)) {
        for (const specifier of path.node.specifiers) {
          if (!t.isImportSpecifier(specifier)) {
            continue
          }
          if (!t.isIdentifier(specifier.imported, { name: 'defineComponent' })) {
            continue
          }
          defineComponentAliases.add(specifier.local.name)
        }
      }

      if (path.node.importKind === 'type') {
        return
      }
      if (!t.isStringLiteral(path.node.source)) {
        return
      }
      const importSource = path.node.source.value
      for (const specifier of path.node.specifiers) {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          continue
        }
        if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
          continue
        }
        const localName = specifier.local.name
        if (t.isImportDefaultSpecifier(specifier)) {
          imports.set(localName, {
            localName,
            importSource,
            importedName: 'default',
            kind: 'default',
          })
          continue
        }
        if (!t.isImportSpecifier(specifier)) {
          continue
        }
        const importedName = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : t.isStringLiteral(specifier.imported)
            ? specifier.imported.value
            : undefined
        imports.set(localName, {
          localName,
          importSource,
          importedName,
          kind: 'named',
        })
      }
    },
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(path.node.init, true))
        return
      }
      if (!t.isCallExpression(path.node.init)) {
        return
      }
      const callee = path.node.init.callee
      if (!t.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
        return
      }
      const first = path.node.init.arguments[0]
      if (t.isObjectExpression(first)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(first, true))
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      if (t.isDeclaration(declaration)) {
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
    if (t.isJSXElement(node)) {
      const { name } = node.openingElement
      if (!t.isJSXMemberExpression(name)) {
        let tag: string | null = null
        if (t.isJSXIdentifier(name)) {
          tag = name.name
        }
        else if (t.isJSXNamespacedName(name)) {
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
    if (t.isJSXFragment(node)) {
      for (const child of node.children) {
        walk(child)
      }
      return
    }
    if (t.isJSXExpressionContainer(node) && !t.isJSXEmptyExpression(node.expression)) {
      walk(node.expression)
      return
    }
    if (t.isConditionalExpression(node)) {
      walk(node.consequent)
      walk(node.alternate)
      return
    }
    if (t.isLogicalExpression(node)) {
      walk(node.left)
      walk(node.right)
      return
    }
    if (t.isCallExpression(node)) {
      for (const arg of node.arguments) {
        if (t.isExpression(arg)) {
          walk(arg)
        }
      }
      return
    }
    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      if (t.isBlockStatement(node.body)) {
        for (const stmt of node.body.body) {
          if (t.isReturnStatement(stmt) && stmt.argument) {
            walk(stmt.argument)
          }
        }
      }
      else {
        walk(node.body)
      }
      return
    }
    if (t.isArrayExpression(node)) {
      for (const element of node.elements) {
        if (element && t.isExpression(element)) {
          walk(element)
        }
      }
      return
    }
    if (t.isParenthesizedExpression(node) || t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)) {
      walk((node as t.ParenthesizedExpression).expression)
    }
  }

  walk(renderExpression)
  return tags
}

function unwrapOxcExpression(node: any): any {
  let current = node
  while (
    current
    && (
      current.type === 'TSAsExpression'
      || current.type === 'TSSatisfiesExpression'
      || current.type === 'TSNonNullExpression'
      || current.type === 'ParenthesizedExpression'
    )
  ) {
    current = current.expression
  }
  return current
}

function getOxcStaticPropertyName(node: any) {
  const current = unwrapOxcExpression(node)
  if (!current) {
    return undefined
  }
  if (current.type === 'Identifier') {
    return current.name
  }
  if (current.type === 'StringLiteral') {
    return current.value
  }
  if (current.type === 'Literal' && typeof current.value === 'string') {
    return current.value
  }
  return undefined
}

function resolveOxcComponentExpression(
  declaration: any,
  defineComponentDecls: Map<string, any>,
  defineComponentAliases: Set<string>,
) {
  const normalized = unwrapOxcExpression(declaration)
  if (!normalized) {
    return null
  }
  if (normalized.type === 'ObjectExpression') {
    return normalized
  }
  if (normalized.type === 'Identifier') {
    return defineComponentDecls.get(normalized.name) ?? null
  }
  if (
    normalized.type === 'CallExpression'
    && normalized.callee?.type === 'Identifier'
    && defineComponentAliases.has(normalized.callee.name)
  ) {
    const first = normalized.arguments?.[0]
    const unwrappedFirst = unwrapOxcExpression(first)
    if (unwrappedFirst?.type === 'ObjectExpression') {
      return unwrappedFirst
    }
    if (unwrappedFirst?.type === 'Identifier') {
      return defineComponentDecls.get(unwrappedFirst.name) ?? null
    }
  }
  return null
}

function resolveOxcRenderExpression(componentExpr: any) {
  if (componentExpr?.type !== 'ObjectExpression') {
    return null
  }

  let renderProperty: any = null
  for (const property of componentExpr.properties ?? []) {
    const propertyName = getOxcStaticPropertyName(property?.key)
    if (propertyName === 'render') {
      renderProperty = property
      break
    }
  }

  if (!renderProperty) {
    return null
  }

  const renderValue = renderProperty.value ?? renderProperty
  const normalizedValue = unwrapOxcExpression(renderValue)
  if (!normalizedValue || (normalizedValue.type !== 'FunctionExpression' && normalizedValue.type !== 'ArrowFunctionExpression')) {
    return null
  }

  if (normalizedValue.body?.type === 'BlockStatement') {
    for (const statement of normalizedValue.body.body ?? []) {
      if (statement.type === 'ReturnStatement' && statement.argument) {
        return unwrapOxcExpression(statement.argument)
      }
    }
    return null
  }

  return unwrapOxcExpression(normalizedValue.body)
}

function collectJsxTemplateTagsFromOxc(renderExpression: any, isCollectableTag: (tag: string) => boolean) {
  const tags = new Set<string>()

  walkOxc(renderExpression, {
    enter(node) {
      if (node.type === 'JSXElement') {
        const name = node.openingElement?.name
        if (!name || name.type === 'JSXMemberExpression') {
          return
        }
        let tag: string | null = null
        if (name.type === 'JSXIdentifier') {
          tag = name.name
        }
        else if (name.type === 'JSXNamespacedName') {
          tag = `${name.namespace.name}:${name.name.name}`
        }
        if (tag && isCollectableTag(tag)) {
          tags.add(tag)
        }
      }
    },
  })

  return tags
}

function collectWithBabel(source: string, options: Required<JsxAutoComponentAnalysisOptions>): JsxAutoComponentContext {
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

function collectWithOxc(source: string, options: Required<Pick<JsxAutoComponentAnalysisOptions, 'isCollectableTag' | 'isDefineComponentSource'>>): JsxAutoComponentContext {
  const ast = parseSync('inline.tsx', source).program as any
  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, any>()
  const imports = new Map<string, JsxImportedComponent>()
  let exportDefaultExpression: any = null

  for (const statement of ast.body ?? []) {
    if (statement?.type === 'ImportDeclaration') {
      const importSource = statement.source?.value
      if (typeof importSource === 'string' && options.isDefineComponentSource(importSource)) {
        for (const specifier of statement.specifiers ?? []) {
          if (
            specifier?.type === 'ImportSpecifier'
            && specifier.imported?.type === 'Identifier'
            && specifier.imported.name === 'defineComponent'
            && specifier.local?.type === 'Identifier'
          ) {
            defineComponentAliases.add(specifier.local.name)
          }
        }
      }

      if (statement.importKind === 'type' || typeof importSource !== 'string') {
        continue
      }

      for (const specifier of statement.specifiers ?? []) {
        if (specifier?.importKind === 'type' || specifier?.local?.type !== 'Identifier') {
          continue
        }
        const localName = specifier.local.name
        if (specifier.type === 'ImportDefaultSpecifier') {
          imports.set(localName, {
            localName,
            importSource,
            importedName: 'default',
            kind: 'default',
          })
          continue
        }
        if (specifier.type !== 'ImportSpecifier') {
          continue
        }
        const importedName = specifier.imported?.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported?.type === 'StringLiteral'
            ? specifier.imported.value
            : undefined
        imports.set(localName, {
          localName,
          importSource,
          importedName,
          kind: 'named',
        })
      }
      continue
    }

    if (statement?.type === 'VariableDeclaration') {
      for (const declaration of statement.declarations ?? []) {
        if (declaration?.id?.type !== 'Identifier' || !declaration.init) {
          continue
        }

        const init = unwrapOxcExpression(declaration.init)
        if (init?.type === 'ObjectExpression') {
          defineComponentDecls.set(declaration.id.name, init)
          continue
        }
        if (
          init?.type === 'CallExpression'
          && init.callee?.type === 'Identifier'
          && defineComponentAliases.has(init.callee.name)
        ) {
          const first = unwrapOxcExpression(init.arguments?.[0])
          if (first?.type === 'ObjectExpression') {
            defineComponentDecls.set(declaration.id.name, first)
          }
        }
      }
      continue
    }

    if (statement?.type === 'ExportDefaultDeclaration') {
      exportDefaultExpression = resolveOxcComponentExpression(
        statement.declaration,
        defineComponentDecls,
        defineComponentAliases,
      )
    }
  }

  const importedComponents = [...imports.values()]
  if (!exportDefaultExpression) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  const renderExpression = resolveOxcRenderExpression(exportDefaultExpression)
  if (!renderExpression) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  return {
    templateTags: collectJsxTemplateTagsFromOxc(renderExpression, options.isCollectableTag),
    importedComponents,
  }
}

/**
 * 从 JSX 源码中收集自动 usingComponents 所需的导入组件与模板标签。
 */
export function collectJsxAutoComponentsFromCode(
  source: string,
  options: JsxAutoComponentAnalysisOptions,
): JsxAutoComponentContext {
  const normalizedOptions = {
    astEngine: options.astEngine ?? 'babel',
    isCollectableTag: options.isCollectableTag,
    isDefineComponentSource: options.isDefineComponentSource ?? defaultIsDefineComponentSource,
    resolveBabelComponentExpression: options.resolveBabelComponentExpression ?? defaultResolveBabelComponentExpression,
    resolveBabelRenderExpression: options.resolveBabelRenderExpression ?? defaultResolveBabelRenderExpression,
  }

  try {
    return normalizedOptions.astEngine === 'oxc'
      ? collectWithOxc(source, normalizedOptions)
      : collectWithBabel(source, normalizedOptions)
  }
  catch {
    return {
      templateTags: new Set<string>(),
      importedComponents: [],
    }
  }
}
