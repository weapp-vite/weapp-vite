import type { ObjectExpression } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../utils/babel'
import { JSON_MACROS } from '../../vue/transform/jsonMacros/parse'
import { toStaticObjectKey } from './ast'

export { injectDynamicIslandRuntime } from './islandScript'

function removeRenderOptionFromObjectExpression(node: ObjectExpression) {
  const nextProps = node.properties.filter((prop) => {
    if (t.isObjectMethod(prop)) {
      return toStaticObjectKey(prop.key) !== 'render'
    }
    if (t.isObjectProperty(prop) && !prop.computed) {
      return toStaticObjectKey(prop.key) !== 'render'
    }
    return true
  })
  const removed = nextProps.length !== node.properties.length
  if (removed) {
    node.properties = nextProps
  }
  return removed
}

function resolveReturnedJsxClosureExpression(expression: t.Expression) {
  if (!t.isArrowFunctionExpression(expression) && !t.isFunctionExpression(expression)) {
    return undefined
  }
  if (t.isJSXElement(expression.body) || t.isJSXFragment(expression.body)) {
    return expression.body
  }
  if (!t.isBlockStatement(expression.body)) {
    return undefined
  }
  const returned = expression.body.body.find(statement => t.isReturnStatement(statement) && statement.argument)
  if (!returned || !t.isReturnStatement(returned)) {
    return undefined
  }
  return returned.argument && (t.isJSXElement(returned.argument) || t.isJSXFragment(returned.argument))
    ? returned.argument
    : undefined
}

function rewriteSetupRenderClosure(node: ObjectExpression) {
  const setup = node.properties.find((property) => {
    if (!t.isObjectMethod(property) && !t.isObjectProperty(property)) {
      return false
    }
    return toStaticObjectKey(property.key) === 'setup'
  })
  if (!setup || !t.isObjectMethod(setup)) {
    return false
  }

  const localNames = new Set<string>()
  for (const param of setup.params) {
    if (t.isIdentifier(param)) {
      localNames.add(param.name)
    }
  }
  for (const statement of setup.body.body) {
    if (t.isVariableDeclaration(statement)) {
      for (const declaration of statement.declarations) {
        if (t.isIdentifier(declaration.id)) {
          localNames.add(declaration.id.name)
        }
      }
    }
    else if (t.isFunctionDeclaration(statement) && statement.id) {
      localNames.add(statement.id.name)
    }
  }

  for (const statement of setup.body.body) {
    if (!t.isReturnStatement(statement) || !statement.argument || !t.isExpression(statement.argument)) {
      continue
    }
    const jsx = resolveReturnedJsxClosureExpression(statement.argument)
    if (!jsx) {
      continue
    }

    const captures = new Set<string>()
    const file = t.file(t.program([t.expressionStatement(t.cloneNode(jsx, true) as t.Expression)]))
    traverse(file, {
      ReferencedIdentifier(path) {
        if (localNames.has(path.node.name)) {
          captures.add(path.node.name)
        }
      },
    })
    statement.argument = t.objectExpression([...captures].map(name => (
      t.objectProperty(t.identifier(name), t.identifier(name), false, true)
    )))
    return true
  }
  return false
}

export function stripRenderOptionFromScript(
  source: string,
  filename: string,
  warnings?: string[],
) {
  let ast: t.File
  try {
    ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  }
  catch {
    return source
  }

  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, ObjectExpression>()
  let hasDefaultExport = false
  let removedRender = false
  let removedJsonMacroImport = false

  traverse(ast, {
    ImportDeclaration(path) {
      const importSource = path.node.source.value

      if (importSource === 'wevu' || importSource === 'vue') {
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

      if (importSource !== 'weapp-vite') {
        return
      }

      const retained = path.node.specifiers.filter((specifier) => {
        if (!t.isImportSpecifier(specifier)) {
          return true
        }
        const importedName = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : t.isStringLiteral(specifier.imported)
            ? specifier.imported.value
            : ''
        return !JSON_MACROS.has(importedName)
      })

      if (retained.length === path.node.specifiers.length) {
        return
      }

      removedJsonMacroImport = true
      if (retained.length === 0) {
        path.remove()
      }
      else {
        path.node.specifiers = retained
      }
    },
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, path.node.init)
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
        defineComponentDecls.set(path.node.id.name, first)
      }
    },
    ExportDefaultDeclaration(path) {
      hasDefaultExport = true
      const declaration = path.node.declaration
      if (t.isDeclaration(declaration)) {
        return
      }

      if (t.isObjectExpression(declaration)) {
        removedRender = removeRenderOptionFromObjectExpression(declaration)
          || rewriteSetupRenderClosure(declaration)
          || removedRender
        return
      }

      if (t.isCallExpression(declaration)) {
        const callee = declaration.callee
        if (!t.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
          return
        }
        const first = declaration.arguments[0]
        if (t.isObjectExpression(first)) {
          removedRender = removeRenderOptionFromObjectExpression(first)
            || rewriteSetupRenderClosure(first)
            || removedRender
        }
        return
      }

      if (t.isIdentifier(declaration)) {
        const target = defineComponentDecls.get(declaration.name)
        if (target) {
          removedRender = removeRenderOptionFromObjectExpression(target)
            || rewriteSetupRenderClosure(target)
            || removedRender
        }
      }
    },
  })

  if (hasDefaultExport && !removedRender) {
    warnings?.push(`[JSX 编译] 未在 ${filename} 中移除 render 选项，输出脚本可能包含 JSX。`)
  }

  if (!removedRender && !removedJsonMacroImport) {
    return source
  }

  return generate(ast).code
}
