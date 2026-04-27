import type { ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { resolveTemplateTagName } from '../htmlTagMapping'
import { renderMustache } from '../mustache'
import { collectElementAttributes, isBuiltinTag } from './attrs'
import { findSlotDirective } from './helpers'
import { transformComponentWithSlots } from './tag-component'

export function transformNormalElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const tag = resolveTemplateTagName(node.tag, context)

  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  const shouldUseAugmentedDefaultSlot = node.children.length > 0 && !context.scopedSlotsRequireProps && !isBuiltinTag(tag)
  const shouldUseSlotPresenceMetadata = node.children.length > 0 && /^[A-Z]/.test(node.tag)
  if (slotDirective || templateSlotChildren.length > 0 || shouldUseAugmentedDefaultSlot || shouldUseSlotPresenceMetadata) {
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
