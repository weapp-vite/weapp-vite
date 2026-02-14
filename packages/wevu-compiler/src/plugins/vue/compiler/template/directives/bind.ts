import type { Expression } from '@babel/types'
import type { DirectiveNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { parseBabelExpression } from '../expression/parse'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { renderMustache } from '../mustache'

function unwrapTsExpression(node: Expression): Expression {
  if (node.type === 'TSAsExpression' || node.type === 'TSNonNullExpression' || node.type === 'TSTypeAssertion') {
    return unwrapTsExpression(node.expression as Expression)
  }
  return node
}

function isTopLevelObjectLiteral(exp: string) {
  const parsed = parseBabelExpression(exp)
  if (!parsed) {
    return false
  }
  const normalized = unwrapTsExpression(parsed)
  return normalized.type === 'ObjectExpression'
}

function createBindRuntimeAttr(argValue: string, rawExpValue: string, context: TransformContext): string | null {
  const bindingRef = registerRuntimeBindingExpression(rawExpValue, context, { hint: `:${argValue} 绑定` })
  if (!bindingRef) {
    return null
  }
  return `${argValue}="${renderMustache(bindingRef, context)}"`
}

function createInlineObjectLiteralAttr(argValue: string, rawExpValue: string, context: TransformContext): string {
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context).trim()
  if (context.mustacheInterpolation === 'spaced') {
    return `${argValue}="${renderMustache(expValue, context)}"`
  }
  return `${argValue}="{{ ${expValue} }}"`
}

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
  if (!rawExpValue) {
    return null
  }

  if (argValue === 'key') {
    const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
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

  if (isTopLevelObjectLiteral(rawExpValue)) {
    if (context.objectLiteralBindMode === 'inline') {
      return createInlineObjectLiteralAttr(argValue, rawExpValue, context)
    }
    return createBindRuntimeAttr(argValue, rawExpValue, context)
  }

  if (shouldFallbackToRuntimeBinding(rawExpValue)) {
    const runtimeAttr = createBindRuntimeAttr(argValue, rawExpValue, context)
    if (runtimeAttr) {
      return runtimeAttr
    }
  }

  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)

  return `${argValue}="${renderMustache(expValue, context)}"`
}
