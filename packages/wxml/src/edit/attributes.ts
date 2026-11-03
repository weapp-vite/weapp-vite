import type { CanonicalAttribute } from '../encoding'
import type { ElementNode } from '../types'
import type { NodeEdits } from './state'

/** 已受编码器保护的字面量和标量直接组合语义属性，不重新扫描未改动的开始标签。 */
export function editedAttributes(node: ElementNode, state: NodeEdits): readonly CanonicalAttribute[] {
  const changes = state.attributes
  if (!changes?.size) {
    return node.attributes
  }
  const attributes: CanonicalAttribute[] = []
  const handled = new Set<string>()
  for (const attribute of node.attributes) {
    if (!changes.has(attribute.name)) {
      attributes.push(attribute)
      continue
    }
    if (!handled.has(attribute.name)) {
      const value = changes.get(attribute.name)
      if (value !== undefined) {
        attributes.push(value === null ? { name: attribute.name } : { name: attribute.name, value, quote: '"' })
      }
      handled.add(attribute.name)
    }
  }
  for (const [name, value] of changes) {
    if (!handled.has(name) && value !== undefined) {
      attributes.push(value === null ? { name } : { name, value, quote: '"' })
    }
  }
  return attributes
}
