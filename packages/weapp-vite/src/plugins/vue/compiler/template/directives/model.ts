import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'

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

function transformVModel(
  element: ElementNode | undefined,
  expValue: string,
  context: TransformContext,
): string | null {
  const escapedModel = expValue.replace(/"/g, '&quot;')
  const bindModel = (event: string) => {
    const bindAttr = context.platform.eventBindingAttr(event)
    return `${bindAttr}="__weapp_vite_model" data-wv-model="${escapedModel}"`
  }

  if (!element) {
    return `value="{{${expValue}}}" ${bindModel('input')}`
  }

  const tag = element.tag
  const typeAttr = getElementType(element)

  switch (tag) {
    case 'input': {
      switch (typeAttr) {
        case 'checkbox': {
          return `checked="{{${expValue}}}" ${bindModel('change')}`
        }
        case 'radio': {
          return `value="{{${expValue}}}" ${bindModel('change')}`
        }
        default: {
          return `value="{{${expValue}}}" ${bindModel('input')}`
        }
      }
    }

    case 'textarea': {
      return `value="{{${expValue}}}" ${bindModel('input')}`
    }

    case 'select': {
      return `value="{{${expValue}}}" ${bindModel('change')}`
    }

    case 'switch':
    case 'checkbox': {
      return `checked="{{${expValue}}}" ${bindModel('change')}`
    }

    case 'slider': {
      return `value="{{${expValue}}}" ${bindModel('change')}`
    }

    case 'picker': {
      return `value="{{${expValue}}}" ${bindModel('change')}`
    }

    default: {
      context.warnings.push(
        `在 <${tag}> 上使用 v-model 可能无法按预期工作，已使用默认绑定。`,
      )
      return `value="{{${expValue}}}" ${bindModel('input')}`
    }
  }
}

export function transformModelDirective(
  node: DirectiveNode,
  context: TransformContext,
  elementNode?: ElementNode,
): string | null {
  const { exp } = node
  if (!exp) {
    return null
  }
  const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)

  return transformVModel(elementNode, expValue, context)
}
