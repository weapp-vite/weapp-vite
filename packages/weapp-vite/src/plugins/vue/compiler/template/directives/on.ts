import type { DirectiveNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext, parseInlineHandler } from '../expression'

const isSimpleHandler = (value: string) => /^[A-Z_$][\w$]*$/i.test(value)

export function transformOnDirective(node: DirectiveNode, context: TransformContext): string | null {
  const { exp, arg } = node
  if (!arg) {
    return null
  }
  const argValue = arg.type === NodeTypes.SIMPLE_EXPRESSION ? arg.content : ''
  if (!exp) {
    return null
  }
  const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
  const isInlineExpression = rawExpValue && !isSimpleHandler(rawExpValue)
  const inlineHandler = isInlineExpression ? parseInlineHandler(rawExpValue) : null

  const mappedEvent = context.platform.mapEventName(argValue)
  const bindAttr = context.platform.eventBindingAttr(mappedEvent)
  if (context.rewriteScopedSlot) {
    if (inlineHandler) {
      const argsJson = JSON.stringify(inlineHandler.args)
      const escapedArgs = argsJson.replace(/"/g, '&quot;')
      return [
        `data-wv-handler="${inlineHandler.name}"`,
        `data-wv-args="${escapedArgs}"`,
        `${bindAttr}="__weapp_vite_owner"`,
      ].join(' ')
    }
    if (!isInlineExpression && rawExpValue) {
      return `data-wv-handler="${rawExpValue}" ${bindAttr}="__weapp_vite_owner"`
    }
    if (isInlineExpression) {
      context.warnings.push('作用域插槽的事件处理不支持内联表达式，请使用简单的方法引用。')
      return `${bindAttr}="__weapp_vite_owner"`
    }
  }
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
  if (inlineHandler) {
    const argsJson = JSON.stringify(inlineHandler.args)
    const escapedArgs = argsJson.replace(/"/g, '&quot;')
    return [
      `data-wv-handler="${inlineHandler.name}"`,
      `data-wv-args="${escapedArgs}"`,
      `${bindAttr}="__weapp_vite_inline"`,
    ].join(' ')
  }
  if (isInlineExpression) {
    const escaped = rawExpValue.replace(/"/g, '&quot;')
    return `data-wv-inline="${escaped}" ${bindAttr}="__weapp_vite_inline"`
  }
  return `${bindAttr}="${expValue}"`
}
