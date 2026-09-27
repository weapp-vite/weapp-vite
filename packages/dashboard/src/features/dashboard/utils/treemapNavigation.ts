import type { TreemapNode } from '../types'

export function findTreemapNodePath(nodes: TreemapNode[], nodeId: string): TreemapNode[] {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return [node]
    }
    if (node.children) {
      const path = findTreemapNodePath(node.children, nodeId)
      if (path.length > 0) {
        return [node, ...path]
      }
    }
  }
  return []
}
