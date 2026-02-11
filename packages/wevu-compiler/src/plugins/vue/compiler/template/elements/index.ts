import type { ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { isBuiltinTag } from './attrs'
import { isStructuralDirective } from './helpers'
import { transformKeepAliveElement, transformTemplateElement, transformTransitionElement } from './tag-builtin'
import { transformComponentElement, transformComponentWithSlots } from './tag-component'
import { transformNormalElement } from './tag-normal'
import { transformSlotElement } from './tag-slot'
import { transformForElement, transformIfElement } from './tag-structural'

export function transformElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const { tag } = node

  if (tag === 'template') {
    return transformTemplateElement(node, context, transformNode)
  }

  if (tag === 'slot') {
    return transformSlotElement(node, context, transformNode)
  }

  if (tag === 'component') {
    return transformComponentElement(node, context, transformNode)
  }

  if (tag === 'transition') {
    return transformTransitionElement(node, context, transformNode)
  }

  if (tag === 'keep-alive') {
    return transformKeepAliveElement(node, context, transformNode)
  }

  const { type } = isStructuralDirective(node)

  if (type === 'if') {
    return transformIfElement(node, context, transformNode)
  }

  if (type === 'for') {
    return transformForElement(node, context, transformNode)
  }

  if (!isBuiltinTag(tag)) {
    return transformComponentWithSlots(node, context, transformNode)
  }

  return transformNormalElement(node, context, transformNode)
}
