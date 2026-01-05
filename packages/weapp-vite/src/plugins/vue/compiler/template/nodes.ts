import type {
  TextNode,
} from '@vue/compiler-core'
import type { TransformContext } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { transformElement } from './elements'
import { normalizeWxmlExpression } from './expression'

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

function transformInterpolation(node: any, _context: TransformContext): string {
  const { content } = node
  if (content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const expValue = normalizeWxmlExpression(content.content)
    return `{{${expValue}}}`
  }
  /* istanbul ignore next */
  return '{{}}'
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
