import type { TransformContext } from '../types'
import { WEVU_GENERIC_SLOT_PROPS_DATA_KEY } from '@weapp-core/constants'
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
  options?: { hint?: string, prefix?: string },
): string | null {
  const forIndexAccess = buildForIndexAccess(context)
  const bindingContext = context.rewriteScopedSlot && context.scopedSlotOwnerRuntimeBindingTarget
    ? context.scopedSlotOwnerRuntimeBindingTarget
    : context
  const cacheKey = context.rewriteScopedSlot && !forIndexAccess
    ? `${options?.prefix ?? ''}:${exp.trim()}`
    : undefined
  if (cacheKey) {
    const cached = context.runtimeBindingCache?.get(cacheKey)
    if (cached) {
      return cached
    }
  }

  const expAst = normalizeJsExpressionWithContext(exp, bindingContext, options)
  if (!expAst) {
    return null
  }

  const binding = {
    name: `${options?.prefix ?? context.runtimeBindingPrefix ?? '__wv_bind_'}${bindingContext.classStyleBindings.filter(item => item.type === 'bind').length}`,
    type: 'bind' as const,
    exp,
    expAst,
    forStack: bindingContext.forStack.map(info => ({ ...info })),
  }
  bindingContext.classStyleBindings.push(binding)

  const bindingRef = context.rewriteScopedSlot
    ? `${WEVU_GENERIC_SLOT_PROPS_DATA_KEY}.${binding.name}${forIndexAccess}`
    : `${binding.name}${forIndexAccess}`
  if (cacheKey) {
    context.runtimeBindingCache?.set(cacheKey, bindingRef)
  }
  return bindingRef
}
