import type { ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { resolveTemplateTagName } from '../htmlTagMapping'
import { renderMustache } from '../mustache'
import { collectElementAttributes } from './attrs'
import { shouldTransformAsComponentWithSlots, transformComponentWithSlots } from './tag-component'

export function transformNormalElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const tag = resolveTemplateTagName(node.tag, context)

  if (shouldTransformAsComponentWithSlots(node, context, tag)) {
    return transformComponentWithSlots(node, context, transformNode)
  }

  const { attrs, vTextExp } = collectElementAttributes(node, context, {
    resolvedTag: tag,
  })

  let children = ''
  if (node.children.length > 0) {
    children = node.children
      .map(child => transformNode(child, context))
      .join('')
  }
  if (vTextExp !== undefined) {
    children = renderMustache(vTextExp, context)
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  return children
    ? `<${tag}${attrString}>${children}</${tag}>`
    : `<${tag}${attrString} />`
}
