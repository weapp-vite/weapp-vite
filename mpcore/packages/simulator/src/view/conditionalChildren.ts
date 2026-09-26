interface ConditionalNode {
  type?: string
  name?: string
  data?: string
  attribs?: Record<string, string>
}

export function selectConditionalChildren<T extends ConditionalNode>(children: T[], evaluate: (node: T, index: number) => boolean) {
  const selected: Array<{ node: T, index: number }> = []
  let inChain = false
  let matched = false
  for (const [index, node] of children.entries()) {
    if (node.type === 'text' && !node.data?.trim() && inChain) {
      continue
    }
    const attributes = node.attribs ?? {}
    const isTag = node.type === 'tag'
    if (isTag && attributes['wx:if'] != null) {
      inChain = true
      matched = evaluate(node, index)
      if (matched) {
        selected.push({ node, index })
      }
      continue
    }
    if (isTag && (attributes['wx:elif'] != null || attributes['wx:else'] != null)) {
      if (inChain && !matched && (attributes['wx:else'] != null || evaluate(node, index))) {
        selected.push({ node, index })
        matched = true
      }
      continue
    }
    inChain = false
    matched = false
    selected.push({ node, index })
  }
  return selected
}
