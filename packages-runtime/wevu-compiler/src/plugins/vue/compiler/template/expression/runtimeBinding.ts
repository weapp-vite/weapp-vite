import type { TransformContext } from '../types'
import { traverse } from '../../../../../utils/babel'
import { normalizeJsExpressionWithContext } from './js'
import { parseBabelExpressionFile } from './parse'
import { normalizeWxmlExpression } from './wxml'

function buildForIndexAccess(context: TransformContext): string {
  if (!context.forStack.length) {
    return ''
  }
  return context.forStack
    .map(info => `[${info.index ?? 'index'}]`)
    .join('')
}

/**
 * 检测表达式是否包含小程序模板不稳定的调用语义。
 */
export function shouldFallbackToRuntimeBinding(exp: string): boolean {
  const trimmed = exp.trim()
  if (!trimmed) {
    return false
  }
  const normalized = normalizeWxmlExpression(trimmed)
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return false
  }

  let shouldFallback = false
  traverse(parsed.ast, {
    CallExpression(path) {
      shouldFallback = true
      path.stop()
    },
    OptionalCallExpression(path) {
      shouldFallback = true
      path.stop()
    },
  })
  return shouldFallback
}

/**
 * 将复杂表达式注册为 JS 运行时计算绑定，返回可用于模板 mustache 的绑定引用。
 */
export function registerRuntimeBindingExpression(
  exp: string,
  context: TransformContext,
  options?: { hint?: string },
): string | null {
  const expAst = normalizeJsExpressionWithContext(exp, context, options)
  if (!expAst) {
    return null
  }

  const binding = {
    name: `__wv_bind_${context.classStyleBindings.filter(item => item.type === 'bind').length}`,
    type: 'bind' as const,
    exp,
    expAst,
    forStack: context.forStack.map(info => ({ ...info })),
  }
  context.classStyleBindings.push(binding)

  return `${binding.name}${buildForIndexAccess(context)}`
}
