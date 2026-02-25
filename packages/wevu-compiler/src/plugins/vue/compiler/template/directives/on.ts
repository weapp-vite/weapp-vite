import type { DirectiveNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext, registerInlineExpression } from '../expression'
import { renderMustache } from '../mustache'

const isSimpleHandler = (value: string) => /^[A-Z_$][\w$]*$/i.test(value)

function shouldUseDetailPayload(options?: { isComponent?: boolean }) {
  return options?.isComponent === true
}

function buildInlineScopeAttrs(scopeBindings: string[], context: TransformContext): string[] {
  return scopeBindings.map((binding, index) => {
    const escaped = binding.replace(/"/g, '&quot;')
    return `data-wv-s${index}="${renderMustache(escaped, context)}"`
  })
}

function buildInlineIndexAttrs(indexBindings: string[], context: TransformContext): string[] {
  return indexBindings.map((binding, index) => {
    const escaped = binding.replace(/"/g, '&quot;')
    return `data-wv-i${index}="${renderMustache(escaped, context)}"`
  })
}

function resolveEventPrefix(modifiers: DirectiveNode['modifiers']) {
  const hasCatch = modifiers.some(modifier => modifier.content === 'catch')
  const hasStop = modifiers.some(modifier => modifier.content === 'stop')
  const hasCapture = modifiers.some(modifier => modifier.content === 'capture')
  const hasMut = modifiers.some(modifier => modifier.content === 'mut')

  if ((hasCatch || hasStop) && hasCapture) {
    return 'capture-catch'
  }
  if (hasCatch || hasStop) {
    return 'catch'
  }
  if (hasMut) {
    return 'mut-bind'
  }
  if (hasCapture) {
    return 'capture-bind'
  }

  return 'bind'
}

export function transformOnDirective(
  node: DirectiveNode,
  context: TransformContext,
  options?: {
    isComponent?: boolean
  },
): string | null {
  const { exp, arg } = node
  if (!arg) {
    return null
  }
  const argValue = arg.type === NodeTypes.SIMPLE_EXPRESSION ? arg.content : ''
  if (!exp) {
    return null
  }
  const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content.trim() : ''
  const useDetailPayload = shouldUseDetailPayload(options)
  const inlineSource = useDetailPayload && isSimpleHandler(rawExpValue)
    ? `${rawExpValue}($event)`
    : rawExpValue
  const isInlineExpression = inlineSource && !isSimpleHandler(inlineSource)
  const inlineExpression = isInlineExpression ? registerInlineExpression(inlineSource, context) : null

  const mappedEvent = context.platform.mapEventName(argValue)
  const eventPrefix = resolveEventPrefix(node.modifiers)
  const bindAttr = context.platform.eventBindingAttr(`${eventPrefix}:${mappedEvent}`)
  const detailAttr = useDetailPayload ? 'data-wv-event-detail="1"' : ''
  if (context.rewriteScopedSlot) {
    if (inlineExpression) {
      const scopeAttrs = buildInlineScopeAttrs(inlineExpression.scopeBindings, context)
      const indexAttrs = buildInlineIndexAttrs(inlineExpression.indexBindings, context)
      return [
        detailAttr,
        `data-wv-inline-id="${inlineExpression.id}"`,
        ...scopeAttrs,
        ...indexAttrs,
        `${bindAttr}="__weapp_vite_owner"`,
      ].filter(Boolean).join(' ')
    }
    if (!isInlineExpression && rawExpValue) {
      return [detailAttr, `data-wv-handler="${rawExpValue}"`, `${bindAttr}="__weapp_vite_owner"`].filter(Boolean).join(' ')
    }
    if (isInlineExpression) {
      context.warnings.push('作用域插槽的事件处理解析失败，请使用简单的方法引用。')
      return [detailAttr, `${bindAttr}="__weapp_vite_owner"`].filter(Boolean).join(' ')
    }
  }
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
  if (inlineExpression) {
    const scopeAttrs = buildInlineScopeAttrs(inlineExpression.scopeBindings, context)
    const indexAttrs = buildInlineIndexAttrs(inlineExpression.indexBindings, context)
    return [
      detailAttr,
      `data-wv-inline-id="${inlineExpression.id}"`,
      ...scopeAttrs,
      ...indexAttrs,
      `${bindAttr}="__weapp_vite_inline"`,
    ].filter(Boolean).join(' ')
  }
  if (isInlineExpression) {
    const escaped = inlineSource.replace(/"/g, '&quot;')
    return [detailAttr, `data-wv-inline="${escaped}"`, `${bindAttr}="__weapp_vite_inline"`].filter(Boolean).join(' ')
  }
  return [detailAttr, `${bindAttr}="${expValue}"`].filter(Boolean).join(' ')
}
