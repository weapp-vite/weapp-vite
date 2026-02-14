import type {
  TextNode,
} from '@vue/compiler-core'
import type { TransformContext } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { transformElement } from './elements'
import { normalizeWxmlExpressionWithContext } from './expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from './expression/runtimeBinding'
import { renderMustache } from './mustache'

function escapeWxmlText(value: string) {
  if (!value) {
    return ''
  }
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function transformText(node: TextNode, _context: TransformContext): string {
  return escapeWxmlText(node.content)
}

function transformInterpolation(node: any, context: TransformContext): string {
  const { content } = node
  if (content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const rawExpValue = content.content
    const runtimeExp = shouldFallbackToRuntimeBinding(rawExpValue)
      ? registerRuntimeBindingExpression(rawExpValue, context, { hint: '插值表达式' })
      : null
    const expValue = runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
    return renderMustache(expValue, context)
  }
  /* istanbul ignore next */
  return renderMustache('', context)
}

export function transformNode(node: any, context: TransformContext): string {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return transformElement(node, context, transformNode)

    case NodeTypes.TEXT:
      return transformText(node, context)

    case NodeTypes.INTERPOLATION:
      return transformInterpolation(node, context)

    case NodeTypes.COMMENT:
      // 注释默认移除
      return ''

    default:
      // 未知节点类型，返回空字符串
      /* istanbul ignore next */
      return ''
  }
}
