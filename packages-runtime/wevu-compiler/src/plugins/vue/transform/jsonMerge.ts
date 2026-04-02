import type { JsonMergeContext, JsonMergeStrategy } from '../../../types/json'
import { recursive as mergeRecursive } from 'merge'

function toPlainRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, any>
}

/**
 * 按策略合并 JSON 配置对象。
 */
export function mergeJsonWithStrategy(
  target: Record<string, any>,
  source: Record<string, any>,
  strategy: JsonMergeStrategy | undefined,
  context: JsonMergeContext,
) {
  const base = { ...toPlainRecord(target) }
  const incoming = toPlainRecord(source)

  if (typeof strategy === 'function') {
    const maybeNext = strategy(base, incoming, context)
    if (maybeNext && typeof maybeNext === 'object' && !Array.isArray(maybeNext)) {
      return maybeNext as Record<string, any>
    }
    return base
  }

  if (strategy === 'replace') {
    return { ...incoming }
  }

  if (strategy === 'assign') {
    return { ...base, ...incoming }
  }

  const merged = { ...base }
  mergeRecursive(merged, incoming)
  return merged
}

/**
 * 创建带上下文的 JSON 合并函数。
 */
export function createJsonMerger(
  strategy: JsonMergeStrategy | undefined,
  baseContext: Omit<JsonMergeContext, 'stage'>,
) {
  return (target: Record<string, any>, source: Record<string, any>, stage: JsonMergeContext['stage']) => {
    return mergeJsonWithStrategy(target, source, strategy, { ...baseContext, stage })
  }
}
