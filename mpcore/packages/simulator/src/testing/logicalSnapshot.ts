export interface HeadlessTestingLogicalNode {
  attrs: Record<string, string>
  children: HeadlessTestingLogicalNode[]
  nodeId?: string
  tag?: string
  text: string
  type: 'element' | 'text'
}

export interface HeadlessTestingPageSnapshot {
  data: Record<string, any>
  path: string
  query: Record<string, string>
  root: HeadlessTestingLogicalNode
  wxml: string
}

function collectNodeText(node: any): string {
  if (node.type === 'text') {
    return node.data ?? ''
  }
  return (node.children ?? []).map(collectNodeText).join('')
}

export function createLogicalNode(node: any): HeadlessTestingLogicalNode {
  if (node.type === 'text') {
    return {
      attrs: {},
      children: [],
      text: node.data ?? '',
      type: 'text',
    }
  }

  const attrs = Object.fromEntries(
    Object.entries(node.attribs ?? {})
      .filter(([key]) => !key.startsWith('data-sim-')),
  ) as Record<string, string>
  return {
    attrs,
    children: (node.children ?? []).map(createLogicalNode),
    nodeId: node.attribs?.['data-sim-node'],
    tag: node.name,
    text: collectNodeText(node),
    type: 'element',
  }
}
