import type { RendererCatalog, RendererSpec, RenderNode } from './types'
import { evaluateVisibility } from './core'
import { resolveProps } from './validation'

export function projectRendererSpec(spec: RendererSpec, catalog: RendererCatalog, state: object): RenderNode | null {
  function project(id: string): RenderNode | null {
    const node = spec.elements[id]!
    if (!evaluateVisibility(node.visible, { stateModel: state as Record<string, unknown> })) {
      return null
    }
    return {
      id,
      type: node.type,
      props: resolveProps(node, catalog, state),
      children: (node.children ?? []).map(project).filter((child): child is RenderNode => child !== null),
    }
  }
  return project(spec.root)
}

export function findRenderNode(tree: RenderNode | null, id: string): RenderNode | undefined {
  if (!tree) {
    return undefined
  }
  if (tree.id === id) {
    return tree
  }
  for (const child of tree.children) {
    const found = findRenderNode(child, id)
    if (found) {
      return found
    }
  }
}
