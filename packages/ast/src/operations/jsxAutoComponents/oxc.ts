import type { JsxAutoComponentAnalysisOptions, JsxAutoComponentContext, JsxImportedComponent } from './types'
import { parseSync } from 'oxc-parser'
import { walk as walkOxc } from 'oxc-walker'
import {
  createJsxImportedComponent,
  getJsxImportLocalName,
  isJsxDefineComponentImportSpecifier,
} from './shared'

export function unwrapOxcExpression(node: any): any {
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

export function getJsxOxcStaticPropertyName(node: any) {
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

export function resolveOxcComponentExpression(
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

export function resolveOxcRenderExpression(componentExpr: any) {
  if (componentExpr?.type !== 'ObjectExpression') {
    return null
  }

  let renderProperty: any = null
  for (const property of componentExpr.properties ?? []) {
    const propertyName = getJsxOxcStaticPropertyName(property?.key)
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

export function collectJsxTemplateTagsFromOxc(renderExpression: any, isCollectableTag: (tag: string) => boolean) {
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

export function collectJsxAutoComponentsWithOxc(
  source: string,
  options: Required<Pick<JsxAutoComponentAnalysisOptions, 'isCollectableTag' | 'isDefineComponentSource'>>,
): JsxAutoComponentContext {
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
          if (isJsxDefineComponentImportSpecifier(specifier)) {
            const localName = getJsxImportLocalName(specifier)
            if (localName) {
              defineComponentAliases.add(localName)
            }
          }
        }
      }

      if (statement.importKind === 'type' || typeof importSource !== 'string') {
        continue
      }

      for (const specifier of statement.specifiers ?? []) {
        if (specifier?.importKind === 'type') {
          continue
        }
        const localName = getJsxImportLocalName(specifier)
        if (!localName) {
          continue
        }
        if (specifier.type === 'ImportDefaultSpecifier') {
          imports.set(localName, createJsxImportedComponent(localName, importSource, 'default'))
          continue
        }
        if (specifier.type !== 'ImportSpecifier') {
          continue
        }
        imports.set(localName, createJsxImportedComponent(localName, importSource, 'named', specifier.imported))
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
