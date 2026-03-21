import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../../utils/babel'

export function stripTypeSyntaxFromAst(ast: BabelFile) {
  traverse(ast, {
    CallExpression(path: any) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
      }
    },
    NewExpression(path: any) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
      }
    },
    TSAsExpression(path: any) {
      path.replaceWith(path.node.expression)
    },
    TSSatisfiesExpression(path: any) {
      path.replaceWith(path.node.expression)
    },
    TSTypeAssertion(path: any) {
      path.replaceWith(path.node.expression)
    },
    TSNonNullExpression(path: any) {
      path.replaceWith(path.node.expression)
    },
  })
}

export function parseExpressionAst(expression: string) {
  const file = babelParse(`const __wv_layout_expr__ = ${expression}`, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  stripTypeSyntaxFromAst(file)
  const stmt = file.program.body[0]
  if (!stmt || !t.isVariableDeclaration(stmt)) {
    return null
  }
  const declarator = stmt.declarations[0]
  if (!declarator || !declarator.init || !t.isExpression(declarator.init)) {
    return null
  }
  return declarator.init
}

export function createStaticObjectKey(key: string) {
  return t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key)
}

export function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    if ((t.isIdentifier(prop.key) && prop.key.name === key) || (t.isStringLiteral(prop.key) && prop.key.value === key)) {
      return prop
    }
  }
  return null
}

export function findWevuOptionsObject(ast: BabelFile): t.ObjectExpression | null {
  let matched: t.ObjectExpression | null = null

  traverse(ast, {
    VariableDeclarator(path: any) {
      if (!t.isIdentifier(path.node.id, { name: '__wevuOptions' }) || !t.isObjectExpression(path.node.init)) {
        return
      }
      matched = path.node.init
      path.stop()
    },
    ExportDefaultDeclaration(path: any) {
      if (matched || !t.isObjectExpression(path.node.declaration)) {
        return
      }
      matched = path.node.declaration
      path.stop()
    },
  })

  return matched
}

export function findNativePageOptionsObject(ast: BabelFile) {
  let matched: t.ObjectExpression | null = null

  traverse(ast, {
    CallExpression(path: any) {
      if (!t.isIdentifier(path.node.callee, { name: 'Page' })) {
        return
      }
      const firstArg = path.node.arguments[0]
      if (!firstArg || t.isSpreadElement(firstArg) || !t.isObjectExpression(firstArg)) {
        return
      }
      matched = firstArg
      path.stop()
    },
  })

  return matched
}

export function stripDefinePageMetaCalls(ast: BabelFile) {
  let mutated = false

  traverse(ast, {
    ExpressionStatement(path: any) {
      const expression = path.node.expression
      if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee, { name: 'definePageMeta' })) {
        return
      }
      mutated = true
      path.remove()
    },
  })

  return mutated
}
