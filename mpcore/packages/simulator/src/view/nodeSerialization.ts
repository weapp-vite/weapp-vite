interface SerializableNode {
  attribs?: Record<string, string>
  children?: SerializableNode[]
  data?: string
  name?: string
  type?: string
}

function escapeText(text: string) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function serializeNode(node: SerializableNode): string {
  if (node.type === 'text') {
    return escapeText(node.data ?? '')
  }
  if (node.type !== 'tag') {
    return (node.children ?? []).map(serializeNode).join('')
  }
  if (node.name === 'page') {
    return (node.children ?? [])
      .filter(child => !(child.type === 'tag' && (child.name === 'import' || child.name === 'wxs')))
      .map(serializeNode)
      .join('')
  }
  const attrs = Object.entries(node.attribs ?? {})
    .filter(([key]) => !key.startsWith('data-sim-'))
    .map(([key, value]) => ` ${key}="${escapeText(value).replaceAll('"', '&quot;')}"`)
    .join('')
  return `<${node.name ?? ''}${attrs}>${(node.children ?? []).map(serializeNode).join('')}</${node.name ?? ''}>`
}

export function collectNodeText(node: SerializableNode): string {
  if (node.type === 'text') {
    return node.data ?? ''
  }
  return (node.children ?? []).map(collectNodeText).join('')
}
