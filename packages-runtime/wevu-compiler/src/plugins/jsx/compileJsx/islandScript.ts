import type { ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { JsxDynamicIslandMetadata } from './types'
import { WEVU_JSX_ISLAND_DATA_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../utils/babel'
import { toStaticObjectKey } from './ast'

function parseIslandExpression(expression: string) {
  const parsed = babelParse(`const __wevuIsland = (${expression})`, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  const statement = parsed.program.body[0]
  if (!t.isVariableDeclaration(statement)) {
    return undefined
  }
  const init = statement.declarations[0]?.init
  return init && t.isExpression(init) ? init : undefined
}

function injectIslandComputed(optionsObject: ObjectExpression, islands: JsxDynamicIslandMetadata[]) {
  const entries = islands.flatMap((island) => {
    const expression = parseIslandExpression(island.expression)
    if (!expression) {
      return []
    }
    const normalized = t.callExpression(
      t.memberExpression(t.identifier('__wevuNormalizeJsxIsland'), t.identifier('call')),
      [t.thisExpression(), expression, t.stringLiteral(island.id)],
    )
    return [t.objectProperty(t.stringLiteral(island.id), normalized)]
  })
  if (!entries.length) {
    return false
  }

  const islandGetter = t.objectMethod(
    'method',
    t.identifier(WEVU_JSX_ISLAND_DATA_KEY),
    [],
    t.blockStatement([t.returnStatement(t.objectExpression(entries))]),
  )
  const computed = optionsObject.properties.find(property => (
    (t.isObjectProperty(property) || t.isObjectMethod(property))
    && toStaticObjectKey(property.key) === 'computed'
  ))
  if (computed && t.isObjectProperty(computed) && t.isObjectExpression(computed.value)) {
    computed.value.properties.push(islandGetter)
  }
  else {
    optionsObject.properties.unshift(
      t.objectProperty(t.identifier('computed'), t.objectExpression([islandGetter])),
    )
  }
  return true
}

export function injectDynamicIslandRuntime(source: string, islands: JsxDynamicIslandMetadata[] | undefined) {
  if (!islands?.length) {
    return source
  }
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  const defineComponentAliases = new Set(['defineComponent', '_defineComponent'])
  const declarations = new Map<string, ObjectExpression>()
  let injected = false

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value !== 'wevu' && path.node.source.value !== 'vue') {
        return
      }
      for (const specifier of path.node.specifiers) {
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported, { name: 'defineComponent' })) {
          defineComponentAliases.add(specifier.local.name)
        }
      }
    },
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        declarations.set(path.node.id.name, path.node.init)
      }
      if (t.isCallExpression(path.node.init) && t.isIdentifier(path.node.init.callee) && defineComponentAliases.has(path.node.init.callee.name)) {
        const first = path.node.init.arguments[0]
        if (t.isObjectExpression(first)) {
          declarations.set(path.node.id.name, first)
        }
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      let optionsObject: ObjectExpression | undefined
      if (t.isObjectExpression(declaration)) {
        optionsObject = declaration
      }
      else if (t.isCallExpression(declaration) && t.isIdentifier(declaration.callee) && defineComponentAliases.has(declaration.callee.name)) {
        const first = declaration.arguments[0]
        if (t.isObjectExpression(first)) {
          optionsObject = first
        }
      }
      else if (t.isIdentifier(declaration)) {
        optionsObject = declarations.get(declaration.name)
      }
      if (optionsObject) {
        injected = injectIslandComputed(optionsObject, islands) || injected
      }
    },
  })
  if (!injected) {
    return source
  }

  ast.program.body.unshift(t.importDeclaration([
    t.importSpecifier(t.identifier('__wevuNormalizeJsxIsland'), t.identifier('normalizeJsxIsland')),
  ], t.stringLiteral('wevu')))
  return generate(ast).code
}
