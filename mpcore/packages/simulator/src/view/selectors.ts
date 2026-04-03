interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

const WHITESPACE_RE = /\s+/
const DATA_ATTR_SELECTOR_RE = /^\[data-([^=\]]+)="([^"]*)"\]$/
const COMPOUND_SELECTOR_PART_RE = /#[\w-]+|\.[\w-]+|\[data-[^=\]]+="[^"]*"\]|[A-Za-z][\w-]*/g

function getClassList(node: DomNodeLike) {
  return String(node.attribs?.class ?? '')
    .split(WHITESPACE_RE)
    .map(item => item.trim())
    .filter(Boolean)
}

function matchesSimpleSelector(node: DomNodeLike, selector: string) {
  if (node.type !== 'tag') {
    return false
  }

  if (selector === 'page') {
    return node.name === 'page'
  }
  if (selector.startsWith('#')) {
    return node.attribs?.id === selector.slice(1)
  }
  if (selector.startsWith('.')) {
    return getClassList(node).includes(selector.slice(1))
  }
  const dataAttrMatch = selector.match(DATA_ATTR_SELECTOR_RE)
  if (dataAttrMatch) {
    const [, key, value] = dataAttrMatch
    return node.attribs?.[`data-${key}`] === value
  }
  return node.name === selector
}

function parseCompoundSelector(selector: string) {
  const parts = selector.match(COMPOUND_SELECTOR_PART_RE) ?? []
  return parts.join('') === selector ? parts : []
}

function matchesSelectorToken(node: DomNodeLike, selector: string) {
  const simpleSelectors = parseCompoundSelector(selector)
  if (simpleSelectors.length === 0) {
    return false
  }
  return simpleSelectors.every(simpleSelector => matchesSimpleSelector(node, simpleSelector))
}

function collectDescendants(node: DomNodeLike, into: DomNodeLike[]) {
  for (const child of node.children ?? []) {
    into.push(child)
    collectDescendants(child, into)
  }
}

export function querySelectorAll(root: DomNodeLike, selector: string): DomNodeLike[] {
  const parts = selector.trim().split(WHITESPACE_RE).filter(Boolean)
  if (parts.length === 0) {
    return []
  }

  let current: DomNodeLike[] = [root]
  for (const part of parts) {
    const next: DomNodeLike[] = []
    for (const node of current) {
      const candidates: DomNodeLike[] = []
      if (part === 'page' && node.type === 'tag' && node.name === 'page') {
        candidates.push(node)
      }
      collectDescendants(node, candidates)
      for (const candidate of candidates) {
        if (matchesSelectorToken(candidate, part)) {
          next.push(candidate)
        }
      }
    }
    current = next
  }

  return current
}
