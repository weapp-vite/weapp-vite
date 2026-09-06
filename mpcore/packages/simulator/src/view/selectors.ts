interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

const WHITESPACE_RE = /\s+/
const ATTR_SELECTOR_RE = /^\[([\w-]+)="([^"]*)"\]$/
const COMPOUND_SELECTOR_PART_RE = /#[\w-]+|\.[\w-]+|\[[\w-]+="[^"]*"\]|[A-Z][\w-]*/gi

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
  if (selector === '*') {
    return true
  }
  if (selector === 'component') {
    return Boolean(node.attribs?.['data-sim-component'])
  }
  if (selector.startsWith('#')) {
    return node.attribs?.id === selector.slice(1)
  }
  if (selector.startsWith('.')) {
    return getClassList(node).includes(selector.slice(1))
  }
  const attrMatch = selector.match(ATTR_SELECTOR_RE)
  if (attrMatch) {
    const [, key, value] = attrMatch
    return node.attribs?.[key!] === value
  }
  return node.name === selector || node.attribs?.['data-sim-component'] === selector
}

function parseCompoundSelector(selector: string) {
  const parts = selector.match(COMPOUND_SELECTOR_PART_RE) ?? []
  return parts.join('') === selector ? parts : []
}

function matchesSelectorToken(node: DomNodeLike, selector: string) {
  if (selector === '*') {
    return node.type === 'tag'
  }
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
