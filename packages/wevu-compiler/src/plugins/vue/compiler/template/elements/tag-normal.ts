import type { ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { collectElementAttributes } from './attrs'
import { findSlotDirective } from './helpers'
import { transformComponentWithSlots } from './tag-component'

export function transformNormalElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const { tag } = node

  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  if (slotDirective || templateSlotChildren.length > 0) {
    return transformComponentWithSlots(node, context, transformNode)
  }

  const { attrs, vTextExp } = collectElementAttributes(node, context)

  let children = ''
  if (node.children.length > 0) {
    children = node.children
      .map(child => transformNode(child, context))
      .join('')
  }
  if (vTextExp !== undefined) {
    children = `{{${vTextExp}}}`
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  return children
    ? `<${tag}${attrString}>${children}</${tag}>`
    : `<${tag}${attrString} />`
}
