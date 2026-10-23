export interface SyntaxNode {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

export interface SourceEdit {
  start: number
  end: number
  content: string
}

export function isSyntaxNode(value: unknown): value is SyntaxNode {
  return value !== null && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

export function childNodes(node: SyntaxNode) {
  const children: Array<{ key: string, node: SyntaxNode }> = []
  for (const [key, value] of Object.entries(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (isSyntaxNode(child)) {
        children.push({ key, node: child })
      }
    }
  }
  return children
}

export function patternIdentifiers(node: SyntaxNode): SyntaxNode[] {
  if (node.type === 'Identifier') {
    return [node]
  }
  const keys = node.type === 'ObjectPattern'
    ? ['properties']
    : node.type === 'ObjectProperty'
      ? ['value']
      : node.type === 'AssignmentPattern'
        ? ['left']
        : node.type === 'RestElement'
          ? ['argument']
          : ['elements']
  return childNodes(node).filter(child => keys.includes(child.key)).flatMap(child => patternIdentifiers(child.node))
}

export function createUniqueName(root: SyntaxNode) {
  const used = new Set<string>()
  const visit = (node: SyntaxNode) => {
    if (node.type === 'Identifier' && typeof node.name === 'string') {
      used.add(node.name)
    }
    childNodes(node).forEach(child => visit(child.node))
  }
  visit(root)
  let index = 0
  return () => {
    let name: string
    do {
      name = `__mpcoreEsm${index++}`
    } while (used.has(name))
    used.add(name)
    return name
  }
}

export function applySourceEdits(source: string, edits: SourceEdit[]) {
  for (const edit of edits.toSorted((left, right) => right.start - left.start || right.end - left.end)) {
    source = source.slice(0, edit.start) + edit.content + source.slice(edit.end)
  }
  return source
}
