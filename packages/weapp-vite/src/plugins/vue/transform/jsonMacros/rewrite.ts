import type { Statement } from '@babel/types'
import * as t from '@babel/types'
import MagicString from 'magic-string'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, parseJsLike, traverse } from '../../../../utils/babel'
import { JSON_MACROS } from './parse'

export function stripScriptSetupMacroStatements(
  content: string,
  ast: { program?: { body?: Statement[] } },
  filename: string,
) {
  const ms = new MagicString(content)
  const macroStatementSources: string[] = []

  const body: Statement[] = ast.program?.body ?? []
  for (const statement of body) {
    if (!t.isExpressionStatement(statement)) {
      continue
    }
    const expr = statement.expression
    if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) {
      continue
    }
    const name = expr.callee.name
    if (!JSON_MACROS.has(name)) {
      continue
    }
    if (expr.arguments.length !== 1) {
      throw new Error(`${name}() in ${filename} expects exactly 1 argument`)
    }

    if (typeof statement.start === 'number' && typeof statement.end === 'number') {
      macroStatementSources.push(content.slice(statement.start, statement.end))
    }

    if (typeof statement.start === 'number' && typeof statement.end === 'number') {
      ms.remove(statement.start, statement.end)
    }
  }

  return { stripped: ms.toString(), macroStatementSources }
}

export function stripJsonMacroCallsFromCode(code: string, filename: string) {
  let ast: any
  try {
    ast = babelParse(code, BABEL_TS_MODULE_PARSER_OPTIONS)
  }
  catch (error) {
    try {
      ast = parseJsLike(code)
    }
    catch (fallbackError) {
      const message = error instanceof Error ? error.message : String(error)
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      throw new Error(
        `Failed to parse compiled script in ${filename}: ${message}; fallback parse error: ${fallbackMessage}`,
      )
    }
  }

  const ms = new MagicString(code)

  traverse(ast, {
    ExpressionStatement(path) {
      const expr = path.node.expression
      if (!t.isCallExpression(expr) || !t.isIdentifier(expr.callee)) {
        return
      }
      if (!JSON_MACROS.has(expr.callee.name)) {
        return
      }

      const start = path.node.start
      const end = path.node.end
      if (typeof start === 'number' && typeof end === 'number') {
        ms.remove(start, end)
      }
    },
  })

  return ms.toString()
}
