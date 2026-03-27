import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

interface HeadlessTestingTapEventInit {
  currentTarget?: {
    dataset?: Record<string, string>
    id?: string
  }
  dataset?: Record<string, string>
  id?: string
  target?: {
    dataset?: Record<string, string>
    id?: string
  }
}

interface HeadlessTestingNodeInteractionHandlers {
  callMethod: (methodName: string, event: Record<string, any>) => unknown
}

const DATASET_NAME_RE = /-([a-z])/g
const TAP_BINDING_ATTRS = ['bindtap', 'bind:tap', 'catchtap', 'catch:tap']

function escapeText(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function toDatasetKey(attributeName: string) {
  return attributeName
    .slice('data-'.length)
    .replace(DATASET_NAME_RE, (_match, char: string) => char.toUpperCase())
}

function collectDataset(node: DomNodeLike) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.attribs ?? {})) {
    if (!key.startsWith('data-')) {
      continue
    }
    dataset[toDatasetKey(key)] = value
  }
  return dataset
}

function resolveTapBinding(node: DomNodeLike) {
  for (const attributeName of TAP_BINDING_ATTRS) {
    const methodName = node.attribs?.[attributeName]?.trim()
    if (methodName) {
      return methodName
    }
  }
  return null
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
  constructor(
    private readonly node: DomNodeLike,
    private readonly interactions?: HeadlessTestingNodeInteractionHandlers,
  ) {}

  async $(selector: string) {
    const match = querySelectorAll(this.node, selector)[0]
    return match ? new HeadlessTestingNodeHandle(match, this.interactions) : null
  }

  async $$(selector: string) {
    return querySelectorAll(this.node, selector).map(node => new HeadlessTestingNodeHandle(node, this.interactions))
  }

  async attr(name: string) {
    return this.node.attribs?.[name]
  }

  async dataset() {
    return collectDataset(this.node)
  }

  async text() {
    return collectText(this.node)
  }

  async tap(event: HeadlessTestingTapEventInit = {}) {
    if (!this.interactions) {
      throw new Error('Tap interactions are not available for this headless testing node.')
    }

    const methodName = resolveTapBinding(this.node)
    if (!methodName) {
      throw new Error(`No tap binding was found on <${this.node.name ?? 'unknown'}> in headless testing runtime.`)
    }

    const dataset = collectDataset(this.node)
    const nodeId = this.node.attribs?.id ?? ''
    return await this.interactions.callMethod(methodName, {
      bubbles: false,
      capturePhase: false,
      composed: false,
      currentTarget: {
        dataset: event.currentTarget?.dataset ?? event.dataset ?? dataset,
        id: event.currentTarget?.id ?? event.id ?? nodeId,
      },
      detail: undefined,
      mark: undefined,
      target: {
        dataset: event.target?.dataset ?? event.dataset ?? dataset,
        id: event.target?.id ?? event.id ?? nodeId,
      },
      type: 'tap',
    })
  }

  async wxml() {
    return serializeNode(this.node)
  }
}
