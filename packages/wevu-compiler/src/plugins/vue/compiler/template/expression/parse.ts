import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { LRUCache } from 'lru-cache'
import { parse as babelParse, generate } from '../../../../../utils/babel'

// 注意：lru-cache@11 要求值类型不能为 null，这里用 false 作为哨兵值。
const babelExpressionCache = new LRUCache<string, t.Expression | false>({ max: 1024 })
export type InlineHandlerArg
  = | { type: 'event', expression: string }
    | { type: 'literal', value: string | number | boolean | null, expression: string }
    | { type: 'expression', expression: string }

export interface InlineHandler { name: string, args: InlineHandlerArg[] }

const inlineHandlerCache = new LRUCache<string, InlineHandler | false>({ max: 1024 })

const BABEL_GENERATE_MINI_PROGRAM_OPTIONS = {
  compact: true,
  // WXML 不会解码 \uXXXX，保持 UTF-8 字符输出。
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

function unwrapTsExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSNonNullExpression(node) || t.isTSTypeAssertion(node)) {
    return unwrapTsExpression(node.expression)
  }
  return node
}

export function parseInlineHandler(exp: string): InlineHandler | null {
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
    const args: InlineHandlerArg[] = []
    for (const rawArg of expression.arguments) {
      if (t.isSpreadElement(rawArg)) {
        inlineHandlerCache.set(exp, false)
        return null
      }
      const arg = unwrapTsExpression(rawArg as t.Expression)
      if (t.isIdentifier(arg) && arg.name === '$event') {
        args.push({ type: 'event', expression: '\'$event\'' })
        continue
      }
      if (t.isStringLiteral(arg) || t.isNumericLiteral(arg) || t.isBooleanLiteral(arg)) {
        args.push({ type: 'literal', value: arg.value, expression: generateExpression(arg) })
        continue
      }
      if (t.isNullLiteral(arg)) {
        args.push({ type: 'literal', value: null, expression: 'null' })
        continue
      }
      args.push({ type: 'expression', expression: generateExpression(arg) })
    }
    const out: InlineHandler = { name, args }
    inlineHandlerCache.set(exp, out)
    return out
  }
  catch {
    inlineHandlerCache.set(exp, false)
    return null
  }
}
