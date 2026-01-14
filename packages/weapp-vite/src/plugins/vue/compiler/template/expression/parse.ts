import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { LRUCache } from 'lru-cache'
import { parse as babelParse, generate } from '../../../../../utils/babel'

// Note: lru-cache@11 requires non-null value type. Use false as sentinel.
const babelExpressionCache = new LRUCache<string, t.Expression | false>({ max: 1024 })
const inlineHandlerCache = new LRUCache<string, { name: string, args: any[] } | false>({ max: 1024 })

const BABEL_GENERATE_MINI_PROGRAM_OPTIONS = {
  compact: true,
  // WXML does not decode \uXXXX; keep UTF-8 characters.
  jsescOption: { quotes: 'single' as const, minimal: true },
}

export function generateExpression(node: t.Expression): string {
  const { code } = generate(node, BABEL_GENERATE_MINI_PROGRAM_OPTIONS)
  return code
}

export function parseBabelExpression(exp: string): t.Expression | null {
  const cached = babelExpressionCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      babelExpressionCache.set(exp, false)
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    babelExpressionCache.set(exp, expression)
    return expression
  }
  catch {
    babelExpressionCache.set(exp, false)
    return null
  }
}

export function parseBabelExpressionFile(exp: string): { ast: BabelFile, expression: t.Expression } | null {
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    }) as BabelFile
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    return { ast, expression }
  }
  catch {
    return null
  }
}

export function parseInlineHandler(exp: string): { name: string, args: any[] } | null {
  const cached = inlineHandlerCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression
    if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee)) {
      return null
    }
    const name = expression.callee.name
    const args: any[] = []
    for (const arg of expression.arguments) {
      if (t.isIdentifier(arg) && arg.name === '$event') {
        args.push('$event')
      }
      else if (t.isStringLiteral(arg) || t.isNumericLiteral(arg) || t.isBooleanLiteral(arg)) {
        args.push(arg.value)
      }
      else if (t.isNullLiteral(arg)) {
        args.push(null)
      }
      else {
        inlineHandlerCache.set(exp, false)
        return null
      }
    }
    const out = { name, args }
    inlineHandlerCache.set(exp, out)
    return out
  }
  catch {
    inlineHandlerCache.set(exp, false)
    return null
  }
}
