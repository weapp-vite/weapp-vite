import type { ComponentOptions, ComponentPublicInstance } from '../../component'
import type { PageRecord, RouteMeta } from './options'

const ROUTE_META_SYMBOL = Symbol('@weapp-vite/web:route-meta')
const PAGE_STATE_SYMBOL = Symbol('@weapp-vite/web:page-state')

interface RouteMetaCarrier {
  [ROUTE_META_SYMBOL]?: RouteMeta
  route?: string
}

interface PageInstanceState {
  loaded: boolean
  visible: boolean
}

interface PageStateCarrier {
  [PAGE_STATE_SYMBOL]?: PageInstanceState
}

type ComponentPageLifetimeType = 'show' | 'hide' | 'resize'

interface PageLifetimeAwareComponent extends HTMLElement {
  __weappInvokePageLifetime?: (type: ComponentPageLifetimeType) => void
  renderRoot?: ShadowRoot | HTMLElement
}

function getRouteMeta(instance: ComponentPublicInstance): RouteMeta | undefined {
  return (instance as RouteMetaCarrier)[ROUTE_META_SYMBOL]
}

function getPageState(instance: ComponentPublicInstance): PageInstanceState {
  const target = instance as PageStateCarrier
  target[PAGE_STATE_SYMBOL] ??= { loaded: false, visible: false }
  return target[PAGE_STATE_SYMBOL]!
}

function walkElementsDeep(root: ParentNode, collector: Set<HTMLElement>) {
  const nodes = Array.from((root as ParentNode & { childNodes?: ArrayLike<unknown> }).childNodes ?? [])
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue
    }
    collector.add(node)
    walkElementsDeep(node, collector)
    if (node.shadowRoot) {
      walkElementsDeep(node.shadowRoot, collector)
    }
  }
}

export function dispatchPageLifetimeToComponents(
  page: ComponentPublicInstance,
  type: ComponentPageLifetimeType,
) {
  const host = page as ComponentPublicInstance & {
    renderRoot?: ShadowRoot | HTMLElement
    shadowRoot?: ShadowRoot | null
  }
  const root = host.renderRoot ?? host.shadowRoot ?? host
  if (!root || typeof root.querySelectorAll !== 'function') {
    return
  }
  const elements = new Set<HTMLElement>()
  walkElementsDeep(root, elements)
  for (const element of elements) {
    const component = element as PageLifetimeAwareComponent
    if (typeof component.__weappInvokePageLifetime === 'function') {
      component.__weappInvokePageLifetime(type)
    }
  }
}

export function attachRouteMeta(
  element: HTMLElement & ComponentPublicInstance,
  meta: RouteMeta,
) {
  const carrier = element as RouteMetaCarrier
  carrier[ROUTE_META_SYMBOL] = meta
  carrier.route = meta.id
}

export function hidePageInstance(instance: ComponentPublicInstance, record: PageRecord) {
  const state = getPageState(instance)
  if (!state.visible) {
    return
  }
  dispatchPageLifetimeToComponents(instance, 'hide')
  record.hooks.onHide?.call(instance)
  state.visible = false
}

export function showPageInstance(instance: ComponentPublicInstance, record: PageRecord) {
  const state = getPageState(instance)
  if (state.visible || !state.loaded) {
    return
  }
  record.hooks.onShow?.call(instance)
  dispatchPageLifetimeToComponents(instance, 'show')
  state.visible = true
}

export function augmentPageComponentOptions(component: ComponentOptions, record: PageRecord) {
  const lifetimes = component.lifetimes ?? {}
  const originalCreated = lifetimes?.created
  const originalAttached = lifetimes?.attached
  const originalReady = lifetimes?.ready
  const originalDetached = lifetimes?.detached

  const enhanced: ComponentOptions = {
    ...component,
    lifetimes: {
      ...lifetimes,
      created(this: ComponentPublicInstance) {
        originalCreated?.call(this)
        getPageState(this)
        record.instances.add(this)
      },
      attached(this: ComponentPublicInstance) {
        originalAttached?.call(this)
        const meta = getRouteMeta(this)
        if (meta?.entry) {
          meta.entry.instance = this
        }
        const state = getPageState(this)
        if (!state.loaded) {
          record.hooks.onLoad?.call(this, meta?.query ?? {})
          state.loaded = true
        }
        if (meta?.entry.active !== false) {
          record.hooks.onShow?.call(this)
          state.visible = true
        }
      },
      ready(this: ComponentPublicInstance) {
        originalReady?.call(this)
        record.hooks.onReady?.call(this)
        if (getPageState(this).visible) {
          dispatchPageLifetimeToComponents(this, 'show')
        }
      },
      detached(this: ComponentPublicInstance) {
        originalDetached?.call(this)
        const meta = getRouteMeta(this)
        if (meta?.entry) {
          meta.entry.instance = undefined
        }
        const state = getPageState(this)
        hidePageInstance(this, record)
        if (state.loaded) {
          record.hooks.onUnload?.call(this)
        }
        state.loaded = false
        state.visible = false
        record.instances.delete(this)
      },
    },
  }

  return enhanced
}
