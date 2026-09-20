import type { WevuJsxVNode } from '../jsxTypes'
import { WEVU_JSX_ISLAND_HANDLER_MAP_KEY } from '@weapp-core/constants'

export const Fragment = Symbol.for('wevu.jsx.fragment')

export interface WevuJsxIslandNode {
  children?: WevuJsxIslandNode[]
  events?: Record<string, string>
  kind: 'element' | 'fragment' | 'text'
  props?: Record<string, any>
  tag?: string
  text?: string
}

export interface WevuJsxIslandAdapters {
  normalizeClass: (value: unknown) => string
  normalizeStyle: (value: unknown) => string
}

export function createVNode(type: unknown, props?: Record<string, any> | null, children?: unknown): WevuJsxVNode {
  return { type, props, children }
}

export function createTextVNode(text: unknown): WevuJsxVNode {
  return { type: 'text', props: null, children: String(text ?? '') }
}

export function isVNode(value: unknown): value is WevuJsxVNode {
  return !!value && typeof value === 'object' && 'type' in value
}

export function mergeProps(...sources: Array<Record<string, any> | null | undefined>) {
  const output: Record<string, any> = {}
  for (const source of sources) {
    if (!source) {
      continue
    }
    for (const [key, value] of Object.entries(source)) {
      if (key === 'class' && output.class) {
        output.class = [output.class, value]
      }
      else if (key === 'style' && output.style) {
        output.style = [output.style, value]
      }
      else {
        output[key] = value
      }
    }
  }
  return output
}

export function transformOn(events: Record<string, unknown>) {
  const output: Record<string, unknown> = {}
  for (const [name, handler] of Object.entries(events)) {
    output[`on${name.charAt(0).toUpperCase()}${name.slice(1)}`] = handler
  }
  return output
}

export function resolveComponent(name: string) {
  return name
}

export const vShow = 'show'
export const vModelText = 'model-text'
export const vModelCheckbox = 'model-checkbox'
export const vModelRadio = 'model-radio'
export const vModelSelect = 'model-select'

export function withDirectives(vnode: WevuJsxVNode, directives: unknown[]) {
  const props = { ...(vnode.props ?? {}) }
  for (const raw of directives) {
    if (!Array.isArray(raw)) {
      continue
    }
    const [directive, value, argument] = raw
    if (directive === vShow) {
      props.hidden = !value
      continue
    }
    if (
      directive === vModelText
      || directive === vModelCheckbox
      || directive === vModelRadio
      || directive === vModelSelect
    ) {
      const modelName = typeof argument === 'string' && argument ? argument : 'modelValue'
      const updater = props[`onUpdate:${modelName}`]
      props[modelName === 'modelValue' ? 'value' : modelName] = value
      if (typeof updater === 'function') {
        const eventName = directive === vModelText ? 'onInput' : 'onChange'
        props[eventName] = (event: any) => updater(event?.detail?.value ?? event?.detail)
      }
    }
  }
  return { ...vnode, props }
}

export function resolveDirective(name: string) {
  return name
}

function eventNameFromProp(name: string) {
  if (!/^on[A-Z]/.test(name)) {
    return undefined
  }
  return name.slice(2).toLowerCase()
}

function getHandlerMap(target: any): Record<string, (...args: any[]) => any> {
  const existing = target?.[WEVU_JSX_ISLAND_HANDLER_MAP_KEY]
  if (existing && typeof existing === 'object') {
    return existing
  }
  const next: Record<string, (...args: any[]) => any> = Object.create(null)
  if (target && (typeof target === 'object' || typeof target === 'function')) {
    Object.defineProperty(target, WEVU_JSX_ISLAND_HANDLER_MAP_KEY, {
      value: next,
      configurable: true,
      writable: true,
    })
  }
  return next
}

function normalizeChildren(
  value: unknown,
  target: any,
  islandId: string,
  seed: { value: number },
  adapters: WevuJsxIslandAdapters,
): WevuJsxIslandNode[] {
  const resolved = typeof value === 'function' ? value() : value
  if (resolved == null || resolved === false || resolved === true) {
    return []
  }
  if (Array.isArray(resolved)) {
    const children: WevuJsxIslandNode[] = []
    for (const item of resolved) {
      children.push(...normalizeChildren(item, target, islandId, seed, adapters))
    }
    return children
  }
  if (typeof resolved === 'object' && !isVNode(resolved)) {
    const slots = resolved as Record<string, unknown>
    return normalizeChildren(slots.default, target, islandId, seed, adapters)
  }
  // eslint-disable-next-line ts/no-use-before-define
  const node = normalizeNode(resolved, target, islandId, seed, adapters)
  return node ? [node] : []
}

function normalizeNode(
  value: unknown,
  target: any,
  islandId: string,
  seed: { value: number },
  adapters: WevuJsxIslandAdapters,
): WevuJsxIslandNode | undefined {
  if (value == null || value === false || value === true) {
    return undefined
  }
  if (Array.isArray(value)) {
    return { kind: 'fragment', children: normalizeChildren(value, target, islandId, seed, adapters) }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return { kind: 'text', text: String(value) }
  }
  if (!isVNode(value)) {
    return { kind: 'text', text: String(value) }
  }
  if (value.type === Fragment) {
    return { kind: 'fragment', children: normalizeChildren(value.children, target, islandId, seed, adapters) }
  }
  if (value.type === 'text') {
    return { kind: 'text', text: String(value.children ?? '') }
  }
  if (typeof value.type === 'function') {
    return normalizeNode(value.type(value.props ?? {}, value.children), target, islandId, seed, adapters)
  }
  if (value.type && typeof value.type === 'object' && typeof (value.type as any).render === 'function') {
    return normalizeNode((value.type as any).render.call(value.props ?? {}), target, islandId, seed, adapters)
  }
  const tag = typeof value.type === 'string' ? value.type : undefined
  if (!tag) {
    return undefined
  }

  const props: Record<string, any> = {}
  const events: Record<string, string> = {}
  const handlers = getHandlerMap(target)
  for (const [name, raw] of Object.entries(value.props ?? {})) {
    const eventName = eventNameFromProp(name)
    if (eventName && typeof raw === 'function') {
      const handlerId = `${islandId}:${seed.value++}`
      handlers[handlerId] = raw as unknown as (...args: unknown[]) => unknown
      events[eventName] = handlerId
      continue
    }
    if (typeof raw === 'function' || raw === undefined) {
      continue
    }
    if (name === 'class' || name === 'className') {
      props.class = adapters.normalizeClass(raw)
    }
    else if (name === 'style') {
      props.style = adapters.normalizeStyle(raw)
    }
    else {
      props[name] = raw
    }
  }
  return {
    kind: 'element',
    tag,
    props,
    events,
    children: normalizeChildren(value.children, target, islandId, seed, adapters),
  }
}

export function normalizeJsxIsland(
  this: any,
  value: unknown,
  islandId: string,
  adapters: WevuJsxIslandAdapters,
): WevuJsxIslandNode | null {
  const handlers = getHandlerMap(this)
  for (const key of Object.keys(handlers)) {
    if (key.startsWith(`${islandId}:`)) {
      delete handlers[key]
    }
  }
  return normalizeNode(value, this, islandId, { value: 0 }, adapters) ?? null
}

export function runJsxIslandHandler(target: any, event: any) {
  const handlerId = event?.currentTarget?.dataset?.wvJsxHandler ?? event?.target?.dataset?.wvJsxHandler
  if (typeof handlerId !== 'string' || !handlerId) {
    return undefined
  }
  const runtime = target?.__wevu
  const handlers = target?.[WEVU_JSX_ISLAND_HANDLER_MAP_KEY]
    ?? runtime?.proxy?.[WEVU_JSX_ISLAND_HANDLER_MAP_KEY]
  const handler = handlers?.[handlerId]
  return typeof handler === 'function' ? handler.call(runtime?.proxy ?? target, event) : undefined
}
