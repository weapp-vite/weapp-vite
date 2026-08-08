import type { ComponentPublicInstance, RelationType } from './types'
import { posix } from 'pathe'
import { slugify } from '../../shared/slugify'

function resolveComposedParent(node: Node): Node | undefined {
  const assignedSlot = (node as Element).assignedSlot
  if (assignedSlot) {
    return assignedSlot
  }
  if (node.parentNode) {
    return node.parentNode
  }
  const root = node.getRootNode?.()
  return root instanceof ShadowRoot ? root.host : undefined
}

function resolveRelationTag(componentId: string, relationPath: string) {
  if (!relationPath.startsWith('.')) {
    return undefined
  }
  const targetId = posix.normalize(posix.join(posix.dirname(componentId), relationPath))
  return slugify(targetId, 'wv-component')
}

export function resolveRelationNodes(
  instance: ComponentPublicInstance,
  componentId: string | undefined,
  relationPath: string,
  type: RelationType,
): ComponentPublicInstance[] {
  if (!componentId) {
    return []
  }
  const tag = resolveRelationTag(componentId, relationPath)
  if (!tag) {
    return []
  }
  if (type === 'child' || type === 'descendant') {
    const matches = Array.from(instance.querySelectorAll(tag)) as ComponentPublicInstance[]
    return type === 'descendant'
      ? matches
      : matches.filter(node => resolveComposedParent(node) === instance)
  }

  let current = resolveComposedParent(instance)
  while (current) {
    if ((current as Element).tagName?.toLowerCase() === tag) {
      return [current as ComponentPublicInstance]
    }
    if (type === 'parent') {
      return []
    }
    current = resolveComposedParent(current)
  }
  return []
}
