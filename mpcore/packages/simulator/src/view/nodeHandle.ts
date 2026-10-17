import type { HeadlessTestingDispatchEventInit, HeadlessTestingNodeEventInit, HeadlessTestingNodeValueEventInit, HeadlessTestingTouchEventInit } from './nodeEvents'
import { createMiniProgramEventPayload, resolveMiniProgramEventBinding } from './eventBinding'
import { collectNodeDataset } from './nodeDataset'
import { collectNodeText, serializeNode } from './nodeSerialization'
import { queryInspectionSelectorAll, querySelectorAll } from './selectors'
import { queryInspectionXPathElements, queryXPathElements } from './xpath'

interface DomNodeLike {
  attribs?: Record<string, string>
  children?: DomNodeLike[]
  data?: string
  dataset?: Record<string, unknown>
  name?: string
  parent?: DomNodeLike | null
  type?: string
}

export type { HeadlessTestingDispatchEventInit, HeadlessTestingNodeEventInit, HeadlessTestingNodeValueEventInit, HeadlessTestingTouch, HeadlessTestingTouchEventInit } from './nodeEvents'

interface HeadlessTestingNodeInteractionHandlers {
  assertActive?: () => void
  callMethod: (scopeId: string | null, methodName: string, event: Record<string, any>) => unknown
  dispatchNativeEvent?: (node: DomNodeLike, eventName: string, event: HeadlessTestingNodeEventInit, onHandlerResult?: (result: unknown) => void) => boolean
  createScopeHandle: (scopeId: string | null) => { scopeId: string, snapshot: () => Promise<unknown> } | null
  createPageHandle: () => { data: (path?: string) => Promise<unknown> }
  ownerScopeId: (scopeId: string | null) => string | null
  projectionOnly?: boolean
}

function createValueEventDetail(value: string, detail?: HeadlessTestingNodeValueEventInit['detail']) {
  return {
    value,
    ...(detail ?? {}),
  }
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

  private assertActive() {
    this.interactions?.assertActive?.()
  }

  private query(selector: string) {
    const query = this.interactions?.projectionOnly ? querySelectorAll : queryInspectionSelectorAll
    const nodes = query(this.node, selector)
    const scope = this.node.attribs?.['data-sim-scope']
    if (!scope || !this.interactions) {
      return nodes
    }
    return nodes.filter((node) => {
      const nodeScope = node.attribs?.['data-sim-scope']
      return nodeScope === scope || (node.attribs?.['data-sim-component']
        && (this.interactions!.ownerScopeId(nodeScope ?? null) ?? resolvePageScopeId(nodeScope)) === scope)
    })
  }

  async $(selector: string) {
    this.assertActive()
    const match = this.query(selector)[0]
    return match ? new HeadlessTestingNodeHandle(match, this.interactions) : null
  }

  async $$(selector: string) {
    this.assertActive()
    return this.query(selector).map(node => new HeadlessTestingNodeHandle(node, this.interactions))
  }

  async getElementsByXpath(expression: string) {
    this.assertActive()
    const query = this.interactions?.projectionOnly ? queryXPathElements : queryInspectionXPathElements
    return query(this.node, expression).map(node => new HeadlessTestingNodeHandle(node, this.interactions))
  }

  async attr(name: string) {
    this.assertActive()
    return this.node.attribs?.[name]
  }

  async dataset() {
    this.assertActive()
    return collectNodeDataset(this.node)
  }

  async scope() {
    this.assertActive()
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createScopeHandle(this.node.attribs?.['data-sim-scope'] ?? null)
  }

  async componentScope() {
    this.assertActive()
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createScopeHandle(resolveComponentScopeId(this.node.attribs?.['data-sim-scope'] ?? null))
  }

  async pageScope() {
    this.assertActive()
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createScopeHandle(resolvePageScopeId(this.node.attribs?.['data-sim-scope'] ?? null))
  }

  async page() {
    this.assertActive()
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    return this.interactions.createPageHandle()
  }

  async ownerComponentScope() {
    this.assertActive()
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }
    const scopeId = resolveComponentScopeId(this.node.attribs?.['data-sim-scope'] ?? null)
    return this.interactions.createScopeHandle(this.interactions.ownerScopeId(scopeId))
  }

  async text() {
    this.assertActive()
    return collectNodeText(this.node)
  }

  async tagName() {
    this.assertActive()
    return this.node.type === 'tag' ? this.node.name : undefined
  }

  async trigger(eventName: string, event: HeadlessTestingNodeEventInit = {}) {
    this.assertActive()
    if (!this.interactions) {
      throw new Error('Node interactions are not available for this headless testing node.')
    }

    const normalizedEventName = eventName.trim()
    if (!normalizedEventName) {
      throw new Error('Event name must be a non-empty string in headless testing runtime.')
    }

    let handlerResults: unknown[] | undefined
    let nativeHandled: boolean | undefined
    try {
      nativeHandled = this.interactions.dispatchNativeEvent?.(
        this.node,
        normalizedEventName,
        event,
        normalizedEventName === 'tap'
          ? (result) => {
              handlerResults ??= []
              handlerResults.push(result)
            }
          : undefined,
      )
    }
    catch (error) {
      // 后续同步失败不能遗弃已启动的异步回调；多个失败保留原始异常作为 cause。
      let failures: unknown[] | undefined
      if (handlerResults) {
        for (const result of await Promise.allSettled(handlerResults)) {
          if (result.status === 'rejected') {
            failures ??= [error]
            failures.push(result.reason)
          }
        }
      }
      if (failures) {
        throw new AggregateError(failures, 'Native interaction handlers failed', { cause: error })
      }
      throw error
    }
    if (normalizedEventName === 'tap' && nativeHandled) {
      return handlerResults ? (await Promise.all(handlerResults))[0] : undefined
    }
    const binding = resolveMiniProgramEventBinding(this.node.attribs, normalizedEventName)
    if (!binding?.method) {
      if (nativeHandled) {
        return
      }
      throw new Error(`No ${normalizedEventName} binding was found on <${this.node.name ?? 'unknown'}> in headless testing runtime.`)
    }

    const result = this.interactions.callMethod(
      this.node.attribs?.['data-sim-scope'] ?? null,
      binding.method,
      createMiniProgramEventPayload(this.node, normalizedEventName, event),
    )
    return await result
  }

  async tap(event: HeadlessTestingNodeEventInit = {}) {
    return await this.trigger('tap', event)
  }

  async touchstart(event: HeadlessTestingTouchEventInit = {}) {
    return await this.trigger('touchstart', event)
  }

  async touchmove(event: HeadlessTestingTouchEventInit = {}) {
    return await this.trigger('touchmove', event)
  }

  async touchend(event: HeadlessTestingTouchEventInit = {}) {
    return await this.trigger('touchend', event)
  }

  async dispatchEvent({ eventName, $: selector, ...event }: HeadlessTestingDispatchEventInit) {
    const target = selector ? await this.$(selector) : this
    if (!target) {
      throw new Error(`No node matching "${selector}" was found for dispatchEvent in headless testing runtime.`)
    }
    return await target.trigger(eventName, event)
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
    this.assertActive()
    return serializeNode(this.node)
  }
}
