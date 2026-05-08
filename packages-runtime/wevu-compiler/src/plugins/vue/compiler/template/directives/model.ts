import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_INLINE_HANDLER,
  WEVU_MODEL_HANDLER,
} from '@weapp-core/constants'
import {
  INLINE_DATASET_KEY,
  INLINE_EVENT_DETAIL_KEY,
  normalizeEventDatasetSuffix,
} from '../../../../../inlineDataset'
import { getBindDirectiveExpression } from '../elements/helpers'
import {
  normalizeWxmlExpressionWithContext,
  registerInlineExpression,
  registerRuntimeBindingExpression,
} from '../expression'
import { renderMustache } from '../mustache'
import { transformBindDirective } from './bind'

function getElementType(element: ElementNode | undefined): string {
  if (!element) {
    return ''
  }

  for (const prop of element.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'type') {
      if (prop.value && prop.value.type === NodeTypes.TEXT) {
        return prop.value.content
      }
    }
  }
  return ''
}

const QUOTE_RE = /"/g
const CAMELIZE_RE = /-([a-z0-9])/gi
const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const NATIVE_MODEL_TAGS = new Set(['input', 'textarea', 'select', 'switch', 'checkbox', 'slider', 'picker'])

function camelize(value: string) {
  return value.replace(CAMELIZE_RE, (_, char: string) => char.toUpperCase())
}

function buildModelAssignmentExpression(rawExpValue: string) {
  if (IDENTIFIER_RE.test(rawExpValue)) {
    return `ctx.${rawExpValue} = $event`
  }
  return `${rawExpValue} = $event`
}

function isNativeModelElement(element: ElementNode | undefined) {
  if (!element || element.tag !== element.tag.toLowerCase()) {
    return false
  }
  return NATIVE_MODEL_TAGS.has(element.tag)
}

function transformVModel(
  element: ElementNode | undefined,
  expValue: string,
  context: TransformContext,
): string | null {
  const escapedModel = expValue.replace(QUOTE_RE, '&quot;')
  const bindModel = (event: string) => {
    const bindAttr = context.platform.eventBindingAttr(event)
    return `${bindAttr}="${WEVU_MODEL_HANDLER}" data-wv-model="${escapedModel}"`
  }

  if (!element) {
    return `value="${renderMustache(expValue, context)}" ${bindModel('input')}`
  }

  const tag = element.tag
  const typeAttr = getElementType(element)

  switch (tag) {
    case 'input': {
      switch (typeAttr) {
        case 'checkbox': {
          return `checked="${renderMustache(expValue, context)}" ${bindModel('change')}`
        }
        case 'radio': {
          return `value="${renderMustache(expValue, context)}" ${bindModel('change')}`
        }
        default: {
          return `value="${renderMustache(expValue, context)}" ${bindModel('input')}`
        }
      }
    }

    case 'textarea': {
      return `value="${renderMustache(expValue, context)}" ${bindModel('input')}`
    }

    case 'select': {
      return `value="${renderMustache(expValue, context)}" ${bindModel('change')}`
    }

    case 'switch':
    case 'checkbox': {
      return `checked="${renderMustache(expValue, context)}" ${bindModel('change')}`
    }

    case 'slider': {
      return `value="${renderMustache(expValue, context)}" ${bindModel('change')}`
    }

    case 'picker': {
      return `value="${renderMustache(expValue, context)}" ${bindModel('change')}`
    }

    default: {
      context.warnings.push(
        `在 <${tag}> 上使用 v-model 可能无法按预期工作，已使用默认绑定。`,
      )
      return `value="${renderMustache(expValue, context)}" ${bindModel('input')}`
    }
  }
}

function transformComponentModelDirective(
  node: DirectiveNode,
  context: TransformContext,
): string | null {
  const rawExpValue = getBindDirectiveExpression(node).trim()
  if (!rawExpValue) {
    return null
  }

  const rawModelName = node.arg?.type === NodeTypes.SIMPLE_EXPRESSION
    ? node.arg.content.trim()
    : ''
  if (node.arg?.type === NodeTypes.SIMPLE_EXPRESSION && !node.arg.isStatic) {
    context.warnings.push('暂不支持动态 v-model 参数，已忽略该 v-model。')
    return null
  }
  const modelProp = rawModelName || 'modelValue'
  if (!modelProp) {
    return null
  }

  const updateEvent = `update:${camelize(modelProp)}`
  const eventSuffix = normalizeEventDatasetSuffix(updateEvent)
  const bindAttr = context.platform.eventBindingAttr(updateEvent)
  const updateExpression = buildModelAssignmentExpression(rawExpValue)
  const inlineExpression = registerInlineExpression(updateExpression, context)
  if (!inlineExpression) {
    context.warnings.push(`v-model="${rawExpValue}" 需要是可赋值的成员表达式。`)
    return null
  }

  const modelAttr = modelProp === 'modelValue'
    ? `modelValue="${renderMustache(normalizeWxmlExpressionWithContext(rawExpValue, context), context)}"`
    : transformBindDirective(node, context)
  const updateAttr = [
    `data-${INLINE_EVENT_DETAIL_KEY}-${eventSuffix}="1"`,
    `data-${INLINE_DATASET_KEY}-${eventSuffix}="${inlineExpression.id}"`,
    `${bindAttr}="${WEVU_INLINE_HANDLER}"`,
  ].filter(Boolean).join(' ')

  const modifierNames = node.modifiers
    .map(modifier => modifier.content.trim())
    .filter(Boolean)
  const modifierProperties = modifierNames
    .map(name => `${JSON.stringify(name)}:true`)
    .join(',')
  const modifiersProp = modelProp === 'modelValue' ? 'modelModifiers' : `${modelProp}Modifiers`
  const modifiersRef = modifierNames.length
    ? registerRuntimeBindingExpression(
        `{${modifierProperties}}`,
        context,
        { hint: 'v-model modifiers' },
      )
    : null
  const modifierAttr = modifiersRef
    ? `${modifiersProp}="${renderMustache(modifiersRef, context)}"`
    : null

  return [
    modelAttr,
    updateAttr,
    modifierAttr,
  ].filter(Boolean).join(' ')
}

export function transformModelDirective(
  node: DirectiveNode,
  context: TransformContext,
  elementNode?: ElementNode,
  options?: {
    isComponent?: boolean
  },
): string | null {
  const { exp } = node
  if (!exp) {
    return null
  }

  if (options?.isComponent === true && !isNativeModelElement(elementNode)) {
    return transformComponentModelDirective(node, context)
  }

  if (node.arg) {
    context.warnings.push('原生小程序元素不支持 v-model 参数，已忽略该 v-model。')
    return null
  }

  const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)

  return transformVModel(elementNode, expValue, context)
}
