import type { Program } from '@oxc-project/types'
import type { AstEngineName, AstParserLike } from '../types'
import { walk } from 'oxc-walker'
import { parseJsLikeWithEngine } from '../engine'

export interface RequireToken {
  start: number
  end: number
  value: string
  async?: boolean
}

export function mayContainRequireCallByText(code: string) {
  return code.includes('require(') || code.includes('require (') || code.includes('require`')
}

export function getStaticRequireLiteralValue(node: any) {
  if (!node) {
    return null
  }

  if (node.type === 'Literal' || node.type === 'StringLiteral') {
    return typeof node.value === 'string' ? node.value : null
  }

  if (
    node.type === 'TemplateLiteral'
    && Array.isArray(node.expressions)
    && node.expressions.length === 0
    && Array.isArray(node.quasis)
    && node.quasis.length === 1
  ) {
    return node.quasis[0]?.value?.cooked ?? node.quasis[0]?.value?.raw ?? null
  }

  return null
}

/**
 * 收集 `require.async()` 依赖字面量。
 */
export function getRequireAsyncLiteralToken(node: any): RequireToken | null {
  if (
    node?.type !== 'CallExpression'
    || node.callee?.type !== 'MemberExpression'
    || node.callee.object?.type !== 'Identifier'
    || node.callee.object.name !== 'require'
    || node.callee.property?.type !== 'Identifier'
    || node.callee.property.name !== 'async'
  ) {
    return null
  }

  const argv0 = node.arguments?.[0]
  if (!argv0 || argv0.type !== 'Literal' || typeof argv0.value !== 'string') {
    return null
  }

  return {
    start: argv0.start,
    end: argv0.end,
    value: argv0.value,
    async: true,
  }
}

export function collectRequireTokens(ast: unknown) {
  const requireTokens: RequireToken[] = []

  walk(ast as Program, {
    enter(node) {
      const token = getRequireAsyncLiteralToken(node)
      if (token) {
        requireTokens.push(token)
      }
    },
  })

  return {
    requireTokens,
  }
}

/**
 * 使用统一 AST 入口预判是否存在可静态分析的 `require("...")` / ``require(`...`)``。
 */
export function mayContainStaticRequireLiteral(
  code: string,
  options?: {
    engine?: AstEngineName
    parserLike?: AstParserLike
  },
): boolean {
  const engine = options?.engine ?? 'babel'

  if (engine !== 'oxc') {
    return true
  }

  if (!mayContainRequireCallByText(code)) {
    return false
  }

  try {
    const ast = parseJsLikeWithEngine(code, {
      engine,
      filename: 'inline.ts',
      parserLike: options?.parserLike,
    }) as Program
    let found = false

    walk(ast, {
      enter(node) {
        if (found || node.type !== 'CallExpression') {
          return
        }

        if (node.callee.type !== 'Identifier' || node.callee.name !== 'require') {
          return
        }

        const value = getStaticRequireLiteralValue(node.arguments?.[0])
        if (typeof value === 'string') {
          found = true
        }
      },
    })

    return found
  }
  catch {
    return true
  }
}
