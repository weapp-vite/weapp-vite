import { querySelectorAll } from './selectors'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

interface HeadlessTestingNodeEventInit {
  currentTarget?: {
    dataset?: Record<string, string>
    id?: string
  }
  dataset?: Record<string, string>
  detail?: unknown
  id?: string
  mark?: Record<string, unknown>
  target?: {
    dataset?: Record<string, string>
    id?: string
  }
}

interface HeadlessTestingNodeValueEventInit extends HeadlessTestingNodeEventInit {
  detail?: {
    value?: string
    [key: string]: unknown
  }
}

interface HeadlessTestingNodeInteractionHandlers {
  callMethod: (scopeId: string | null, methodName: string, event: Record<string, any>) => unknown
  createScopeHandle: (scopeId: string | null) => { scopeId: string, snapshot: () => Promise<unknown> } | null
}

const DATASET_NAME_RE = /-([a-z])/g

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
    if (!key.startsWith('data-') || key.startsWith('data-sim-')) {
      continue
    }
    dataset[toDatasetKey(key)] = value
  }
  return dataset
}

function resolveEventBinding(node: DomNodeLike, eventName: string) {
  const normalizedEventName = eventName.trim()
  if (!normalizedEventName) {
    return null
  }

  const bindingAttrs = [
    `bind${normalizedEventName}`,
    `bind:${normalizedEventName}`,
    `catch${normalizedEventName}`,
    `catch:${normalizedEventName}`,
  ]
  for (const attributeName of bindingAttrs) {
    const methodName = node.attribs?.[attributeName]?.trim()
    if (methodName) {
      return methodName
    }
  }
  return null
}

function createEventPayload(node: DomNodeLike, eventName: string, event: HeadlessTestingNodeEventInit) {
  const dataset = collectDataset(node)
  const nodeId = node.attribs?.id ?? ''
  return {
    bubbles: false,
    capturePhase: false,
    composed: false,
    currentTarget: {
      dataset: event.currentTarget?.dataset ?? event.dataset ?? dataset,
      id: event.currentTarget?.id ?? event.id ?? nodeId,
    },
    detail: event.detail,
    mark: event.mark,
    target: {
      dataset: event.target?.dataset ?? event.dataset ?? dataset,
      id: event.target?.id ?? event.id ?? nodeId,
    },
    type: eventName,
  }
}

function createValueEventDetail(value: string, detail?: HeadlessTestingNodeValueEventInit['detail']) {
  return {
    value,
    ...(detail ?? {}),
  }
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
    .filter(([key]) => !key.startsWith('data-sim-'))
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

function resolvePageScopeId(scopeId?: string | null) {
  if (!scopeId) {
    return null
  }
  const pagePathIndex = scopeId.indexOf('/page/')
  return pagePathIndex >= 0 ? scopeId.slice(0, pagePathIndex) : scopeId
}

function resolveComponentScopeId(scopeId?: string | null) {
  if (!scopeId || !scopeId.includes('/')) {
    return null
  }
  return scopeId
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

  async scope() {
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createScopeHandle(this.node.attribs?.['data-sim-scope'] ?? null)
  }

  async componentScope() {
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createScopeHandle(resolveComponentScopeId(this.node.attribs?.['data-sim-scope'] ?? null))
  }

  async pageScope() {
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createScopeHandle(resolvePageScopeId(this.node.attribs?.['data-sim-scope'] ?? null))
  }

  async text() {
    return collectText(this.node)
  }

  async trigger(eventName: string, event: HeadlessTestingNodeEventInit = {}) {
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }

    const normalizedEventName = eventName.trim()
    if (!normalizedEventName) {
      throw new Error('Event name must be a non-empty string in headless testing runtime.')
    }

    const methodName = resolveEventBinding(this.node, normalizedEventName)
    if (!methodName) {
      throw new Error(`No ${normalizedEventName} binding was found on <${this.node.name ?? 'unknown'}> in headless testing runtime.`)
    }

    return await this.interactions.callMethod(
      this.node.attribs?.['data-sim-scope'] ?? null,
      methodName,
      createEventPayload(this.node, normalizedEventName, event),
    )
  }

  async tap(event: HeadlessTestingNodeEventInit = {}) {
    return await this.trigger('tap', event)
  }

  async input(value: string, event: HeadlessTestingNodeValueEventInit = {}) {
    return await this.trigger('input', {
      ...event,
      detail: createValueEventDetail(value, event.detail),
    })
  }

  async change(value: string, event: HeadlessTestingNodeValueEventInit = {}) {
    return await this.trigger('change', {
      ...event,
      detail: createValueEventDetail(value, event.detail),
    })
  }

  async blur(value?: string, event: HeadlessTestingNodeValueEventInit = {}) {
    return await this.trigger('blur', {
      ...event,
      detail: value == null ? event.detail : createValueEventDetail(value, event.detail),
    })
  }

  async wxml() {
    return serializeNode(this.node)
  }
}
