interface RenderedNode {
  children?: RenderedNode[]
  parent?: RenderedNode | null
}

/** 在循环展开和组件替换完成后，让父节点关系指向本次渲染树。 */
export function linkRenderedParents(root: RenderedNode, parent: RenderedNode | null = null): void {
  root.parent = parent
  for (const child of root.children ?? []) {
    linkRenderedParents(child, root)
  }
}
