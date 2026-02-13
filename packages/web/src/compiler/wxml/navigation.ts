import type { NavigationBarConfig, RenderElementNode, RenderNode } from './types'

const NAVIGATION_BAR_ATTRS = new Set([
  'title',
  'background-color',
  'text-style',
  'front-color',
  'loading',
])

function stripPageMetaNodes(nodes: RenderNode[]): RenderNode[] {
  const stripped: RenderNode[] = []
  for (const node of nodes) {
    if (node.type === 'element' && node.name === 'page-meta') {
      continue
    }
    if (node.type === 'element' && node.children?.length) {
      const nextChildren = stripPageMetaNodes(node.children)
      if (nextChildren !== node.children) {
        stripped.push({ ...node, children: nextChildren })
        continue
      }
    }
    stripped.push(node)
  }
  return stripped
}

function pickNavigationBarAttrs(attribs: Record<string, string> | undefined) {
  if (!attribs) {
    return undefined
  }
  const picked: Record<string, string> = {}
  for (const [key, value] of Object.entries(attribs)) {
    if (NAVIGATION_BAR_ATTRS.has(key)) {
      picked[key] = value
    }
  }
  return Object.keys(picked).length > 0 ? picked : undefined
}

function findNavigationBarInPageMeta(node: RenderElementNode) {
  const children = node.children ?? []
  for (const child of children) {
    if (child.type === 'element' && child.name === 'navigation-bar') {
      return child
    }
  }
  return undefined
}

export function extractNavigationBarFromPageMeta(nodes: RenderNode[]): {
  nodes: RenderNode[]
  attrs?: Record<string, string>
  warnings: string[]
} {
  let pageMetaIndex = -1
  let navigationBar: RenderElementNode | undefined
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.type === 'element' && node.name === 'page-meta') {
      if (pageMetaIndex === -1) {
        pageMetaIndex = i
      }
      if (!navigationBar) {
        navigationBar = findNavigationBarInPageMeta(node)
      }
    }
  }
  const warnings: string[] = []
  if (pageMetaIndex > 0) {
    warnings.push('[web] page-meta 需要作为页面第一个节点，已忽略其位置约束。')
  }
  const cleaned = pageMetaIndex === -1 ? nodes : stripPageMetaNodes(nodes)
  const attrs = navigationBar ? pickNavigationBarAttrs(navigationBar.attribs) : undefined
  return { nodes: cleaned, attrs, warnings }
}

function toAttributeValue(value: unknown) {
  if (value == null) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

export function buildNavigationBarAttrs(
  config: NavigationBarConfig | undefined,
  overrides?: Record<string, string>,
) {
  const attrs: Record<string, string> = {}
  if (config?.title !== undefined) {
    const value = toAttributeValue(config.title)
    if (value !== undefined) {
      attrs.title = value
    }
  }
  if (config?.backgroundColor !== undefined) {
    const value = toAttributeValue(config.backgroundColor)
    if (value !== undefined) {
      attrs['background-color'] = value
    }
  }
  if (config?.textStyle !== undefined) {
    const value = toAttributeValue(config.textStyle)
    if (value !== undefined) {
      attrs['text-style'] = value
    }
  }
  if (config?.frontColor !== undefined) {
    const value = toAttributeValue(config.frontColor)
    if (value !== undefined) {
      attrs['front-color'] = value
    }
  }
  if (config?.loading) {
    attrs.loading = 'true'
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      attrs[key] = value
    }
  }
  return attrs
}
