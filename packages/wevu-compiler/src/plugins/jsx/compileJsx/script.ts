import type { ObjectExpression } from '@babel/types'
import * as t from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../utils/babel'
import { JSON_MACROS } from '../../vue/transform/jsonMacros/parse'
import { toStaticObjectKey } from './ast'

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

export function stripRenderOptionFromScript(source: string, filename: string, warn?: (message: string) => void) {
  let ast: t.File
  try {
    ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  }
  catch {
    return source
  }

  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, ObjectExpression>()
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
      const declaration = path.node.declaration
      if (t.isDeclaration(declaration)) {
        return
      }

      if (t.isObjectExpression(declaration)) {
        removedRender = removeRenderOptionFromObjectExpression(declaration) || removedRender
        return
      }

      if (t.isCallExpression(declaration)) {
        const callee = declaration.callee
        if (!t.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
          return
        }
        const first = declaration.arguments[0]
        if (t.isObjectExpression(first)) {
          removedRender = removeRenderOptionFromObjectExpression(first) || removedRender
        }
        return
      }

      if (t.isIdentifier(declaration)) {
        const target = defineComponentDecls.get(declaration.name)
        if (target) {
          removedRender = removeRenderOptionFromObjectExpression(target) || removedRender
        }
      }
    },
  })

  if (!removedRender) {
    warn?.(`[JSX 编译] 未在 ${filename} 中移除 render 选项，输出脚本可能包含 JSX。`)
  }

  if (!removedRender && !removedJsonMacroImport) {
    return source
  }

  return generate(ast).code
}
