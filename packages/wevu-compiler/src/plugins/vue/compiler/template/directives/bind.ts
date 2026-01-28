import type { DirectiveNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'

const isSimpleIdentifier = (value: string) => /^[A-Z_$][\w$]*$/i.test(value)
const isSimpleMemberPath = (value: string) => /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i.test(value)

export function transformBindDirective(
  node: DirectiveNode,
  context: TransformContext,
  forInfo?: ForParseResult,
): string | null {
  const { exp, arg } = node
  if (!arg) {
    return null
  }
  const argValue = arg.type === NodeTypes.SIMPLE_EXPRESSION ? arg.content : ''
  if (!exp) {
    return null
  }
  const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)

  if (argValue === 'key') {
    const trimmed = expValue.trim()
    const warnKeyFallback = (reason: string) => {
      if (!forInfo) {
        return
      }
      context.warnings.push(
        `v-for :key "${trimmed}" ${reason}，已降级为 wx:key="${context.platform.keyThisValue}"。`
        + '建议使用稳定的基础类型 key（例如 item.id）。',
      )
    }
    if (forInfo?.item && trimmed === forInfo.item) {
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    if (forInfo?.key && trimmed === forInfo.key) {
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    if (forInfo?.item && trimmed.startsWith(`${forInfo.item}.`)) {
      const remainder = trimmed.slice(forInfo.item.length + 1)
      if (isSimpleMemberPath(remainder)) {
        const firstSegment = remainder.split('.')[0] || remainder
        return context.platform.keyAttr(firstSegment)
      }
      warnKeyFallback('不是简单的成员路径')
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    if (isSimpleIdentifier(trimmed)) {
      return context.platform.keyAttr(trimmed)
    }
    if (forInfo) {
      warnKeyFallback('是复杂表达式')
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    return context.platform.keyAttr(expValue)
  }

  return `${argValue}="{{${expValue}}}"`
}
