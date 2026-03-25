import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

function escapeText(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', '&quot;')
}

function serializeNode(node: DomNodeLike): string {
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
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join('')
  const children = (node.children ?? []).map(serializeNode).join('')
  return `<${node.name ?? ''}${attrs}>${children}</${node.name ?? ''}>`
}

function collectText(node: DomNodeLike): string {
  if (node.type === 'text') {
    return node.data ?? ''
  }
  return (node.children ?? []).map(collectText).join('')
}

export class HeadlessTestingNodeHandle {
  constructor(private readonly node: DomNodeLike) {}

  async $(selector: string) {
    const match = querySelectorAll(this.node, selector)[0]
    return match ? new HeadlessTestingNodeHandle(match) : null
  }

  async $$(selector: string) {
    return querySelectorAll(this.node, selector).map(node => new HeadlessTestingNodeHandle(node))
  }

  async attr(name: string) {
    return this.node.attribs?.[name]
  }

  async dataset() {
    const dataset: Record<string, any> = {}
    for (const [key, value] of Object.entries(this.node.attribs ?? {})) {
      if (key.startsWith('data-')) {
        dataset[key.slice(5)] = value
      }
    }
    return dataset
  }

  async text() {
    return collectText(this.node)
  }

  async wxml() {
    return serializeNode(this.node)
  }
}
