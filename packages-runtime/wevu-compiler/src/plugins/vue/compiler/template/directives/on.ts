import type { DirectiveNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  INLINE_DATASET_KEY,
  INLINE_EVENT_DETAIL_KEY,
  INLINE_HANDLER_KEY,
  normalizeEventDatasetSuffix,
} from '../../../../../inlineDataset'
import { normalizeWxmlExpressionWithContext, registerInlineExpression } from '../expression'
import { renderMustache } from '../mustache'

const SIMPLE_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

const isSimpleHandler = (value: string) => SIMPLE_IDENTIFIER_RE.test(value)

function shouldUseDetailPayload(options?: { isComponent?: boolean }) {
  return options?.isComponent === true
}

const QUOTE_RE = /"/g

function buildInlineScopeAttrs(scopeBindings: string[], context: TransformContext): string[] {
  return scopeBindings.map((binding, index) => {
    const escaped = binding.replace(QUOTE_RE, '&quot;')
    return `data-wv-s${index}="${renderMustache(escaped, context)}"`
  })
}

function buildInlineIndexAttrs(indexBindings: string[], context: TransformContext): string[] {
  return indexBindings.map((binding, index) => {
    const escaped = binding.replace(QUOTE_RE, '&quot;')
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
  const eventSuffix = normalizeEventDatasetSuffix(mappedEvent)
  const eventPrefix = resolveEventPrefix(node.modifiers)
  const bindAttr = context.platform.eventBindingAttr(`${eventPrefix}:${mappedEvent}`)
  const detailAttr = useDetailPayload ? `data-${INLINE_EVENT_DETAIL_KEY}-${eventSuffix}="1"` : ''
  if (context.rewriteScopedSlot) {
    if (inlineExpression) {
      const scopeAttrs = buildInlineScopeAttrs(inlineExpression.scopeBindings, context)
      const indexAttrs = buildInlineIndexAttrs(inlineExpression.indexBindings, context)
      return [
        detailAttr,
        `data-${INLINE_DATASET_KEY}-${eventSuffix}="${inlineExpression.id}"`,
        ...scopeAttrs,
        ...indexAttrs,
        `${bindAttr}="__weapp_vite_owner"`,
      ].filter(Boolean).join(' ')
    }
    if (!isInlineExpression && rawExpValue) {
      return [detailAttr, `data-${INLINE_HANDLER_KEY}-${eventSuffix}="${rawExpValue}"`, `${bindAttr}="__weapp_vite_owner"`].filter(Boolean).join(' ')
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
      `data-${INLINE_DATASET_KEY}-${eventSuffix}="${inlineExpression.id}"`,
      ...scopeAttrs,
      ...indexAttrs,
      `${bindAttr}="__weapp_vite_inline"`,
    ].filter(Boolean).join(' ')
  }
  if (isInlineExpression) {
    const escaped = inlineSource.replace(QUOTE_RE, '&quot;')
    return [detailAttr, `data-wv-inline-${eventSuffix}="${escaped}"`, `${bindAttr}="__weapp_vite_inline"`].filter(Boolean).join(' ')
  }
  return [detailAttr, `${bindAttr}="${expValue}"`].filter(Boolean).join(' ')
}
