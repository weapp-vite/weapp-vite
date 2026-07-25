import type { Program } from '@oxc-project/types'
import type { AstEngineName, AstParserLike } from '../types'
import { walk } from 'oxc-walker'
import { parseJsLikeWithEngine } from '../engine'
import { analyzeScriptWithNative, loadNativeAstBindingSync, shouldUseNativeAst } from '../native'

export interface RequireToken {
  start: number
  end: number
  value: string
  async?: boolean
}

export interface RequireCallbackToken extends RequireToken {
  callEnd: number
  callStart: number
  errorCallbackEnd?: number
  errorCallbackStart?: number
  successCallbackEnd: number
  successCallbackStart: number
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

function createAsyncRequireToken(node: any): RequireToken | null {
  const argv0 = node.arguments?.[0]
  const value = getStaticRequireLiteralValue(argv0)
  if (!argv0 || value === null) {
    return null
  }

  return {
    start: argv0.start,
    end: argv0.end,
    value,
    async: true,
  }
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

  return createAsyncRequireToken(node)
}

/**
 * 收集 `require(path, callback)` 依赖字面量。
 */
export function getRequireCallbackLiteralToken(node: any): RequireCallbackToken | null {
  if (
    node?.type !== 'CallExpression'
    || node.callee?.type !== 'Identifier'
    || node.callee.name !== 'require'
    || !Array.isArray(node.arguments)
    || node.arguments.length < 2
  ) {
    return null
  }

  const token = createAsyncRequireToken(node)
  const successCallback = node.arguments[1]
  const errorCallback = node.arguments[2]
  if (!token || !successCallback) {
    return null
  }

  return {
    ...token,
    callStart: node.start,
    callEnd: node.end,
    successCallbackStart: successCallback.start,
    successCallbackEnd: successCallback.end,
    ...(errorCallback
      ? {
          errorCallbackStart: errorCallback.start,
          errorCallbackEnd: errorCallback.end,
        }
      : {}),
  }
}

export function collectRequireTokens(ast: unknown) {
  const requireTokens: RequireToken[] = []
  const requireCallbackTokens: RequireCallbackToken[] = []

  walk(ast as Program, {
    enter(node) {
      const asyncToken = getRequireAsyncLiteralToken(node)
      if (asyncToken) {
        requireTokens.push(asyncToken)
        return
      }

      const callbackToken = getRequireCallbackLiteralToken(node)
      if (callbackToken) {
        requireTokens.push(callbackToken)
        requireCallbackTokens.push(callbackToken)
      }
    },
  })

  return {
    requireCallbackTokens,
    requireTokens,
  }
}

export function isStaticRequireCall(node: any) {
  if (node?.type !== 'CallExpression') {
    return false
  }

  if (node.callee?.type !== 'Identifier' || node.callee.name !== 'require') {
    return false
  }

  return typeof getStaticRequireLiteralValue(node.arguments?.[0]) === 'string'
}

export function hasStaticRequireCall(ast: Program) {
  let found = false

  walk(ast, {
    enter(node) {
      if (found) {
        return
      }
      if (isStaticRequireCall(node)) {
        found = true
      }
    },
  })

  return found
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

  if (shouldUseNativeAst()) {
    try {
      const batchAnalysis = analyzeScriptWithNative(code)
      if (batchAnalysis) {
        return batchAnalysis.hasStaticRequireLiteral
      }
      const checkNative = loadNativeAstBindingSync()?.mayContainStaticRequireLiteralNative
      if (checkNative) {
        return checkNative(code, 'inline.ts')
      }
    }
    catch {
      // native AST 是可选快速路径，失败时回退原有解析。
    }
  }

  try {
    const ast = parseJsLikeWithEngine(code, {
      engine,
      filename: 'inline.ts',
      parserLike: options?.parserLike,
    }) as Program
    return hasStaticRequireCall(ast)
  }
  catch {
    return true
  }
}
