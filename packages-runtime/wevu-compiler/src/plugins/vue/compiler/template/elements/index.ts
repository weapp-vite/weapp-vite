import type { ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { omitUnsupportedDynamicDirectiveNames } from '../directives'
import { isStructuralDirective } from './helpers'
import { transformKeepAliveElement, transformTemplateElement, transformTransitionElement } from './tag-builtin'
import { transformComponentElement } from './tag-component'
import { transformNormalElement } from './tag-normal'
import { transformSlotElement } from './tag-slot'
import { transformForElement, transformIfElement } from './tag-structural'

export function transformElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const compatibleNode = omitUnsupportedDynamicDirectiveNames(node, context)
  const { tag } = compatibleNode

  if (tag === 'template') {
    return transformTemplateElement(compatibleNode, context, transformNode)
  }

  if (tag === 'slot') {
    const { type } = isStructuralDirective(compatibleNode)
    if (type === 'if') {
      return transformIfElement(compatibleNode, context, transformNode)
    }
    if (type === 'for') {
      return transformForElement(compatibleNode, context, transformNode)
    }
    return transformSlotElement(compatibleNode, context, transformNode)
  }

  if (tag === 'component') {
    return transformComponentElement(compatibleNode, context, transformNode)
  }

  if (tag === 'transition') {
    return transformTransitionElement(compatibleNode, context, transformNode)
  }

  if (tag === 'keep-alive') {
    return transformKeepAliveElement(compatibleNode, context, transformNode)
  }

  const { type } = isStructuralDirective(compatibleNode)

  if (type === 'if') {
    return transformIfElement(compatibleNode, context, transformNode)
  }

  if (type === 'for') {
    return transformForElement(compatibleNode, context, transformNode)
  }

  return transformNormalElement(compatibleNode, context, transformNode)
}
