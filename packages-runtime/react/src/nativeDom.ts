/* eslint-disable ts/no-use-before-define -- 后端工厂与宿主辅助函数按能力探针、操作实现的阅读顺序组织。 */
import type { HostElement, HostRendererBackend } from './hostTree'
import type { HostProps, MiniProgramEventLike, MiniProgramPageAdapter } from './types'
import { serializeStyle } from './hostTree/serialization'

export type ReactRendererMode = 'legacy' | 'auto' | 'native-dom'

interface ReactRendererBuildConfig {
  mode?: ReactRendererMode
  platform?: string
}

interface NativeDomEvent {
  detail?: unknown
  stopPropagation?: () => void
  target?: unknown
  type?: string
}

interface NativeDomNode {
  addEventListener: (type: string, listener: (event: NativeDomEvent) => void, capture?: boolean) => void
  appendChild: (node: NativeDomNode) => unknown
  insertBefore: (node: NativeDomNode, before: NativeDomNode | null) => unknown
  nodeValue?: string | null
  removeAttribute: (name: string) => void
  removeChild: (node: NativeDomNode) => unknown
  removeEventListener: (type: string, listener: (event: NativeDomEvent) => void, capture?: boolean) => void
  setAttribute: (name: string, value: unknown) => void
}

interface NativeDomDocument {
  createElement: (type: string) => NativeDomNode
  createNativeComponent: (type: string, options: Record<string, unknown>) => NativeDomNode
  createTextNode: (value: string) => NativeDomNode
  getPageDocumentById: (webviewId: number) => NativeDomNode | undefined
}

interface TtRuntime {
  appDocument?: NativeDomDocument
  getBuiltInComponents?: () => Set<string> | string[]
  getRenderMode?: () => number
}

interface NativeEventBinding {
  listener: (event: NativeDomEvent) => void
  type: string
  capture: boolean
}

export type NativeDomEventDispatcher = (target: HostElement, event: MiniProgramEventLike) => void

declare const __WEAPP_VITE_REACT_RENDERER__: ReactRendererBuildConfig | undefined

const DEFAULT_BUILT_IN_COMPONENTS = new Set([
  'ad',
  'audio',
  'block',
  'button',
  'camera',
  'canvas',
  'checkbox',
  'checkbox-group',
  'cover-image',
  'cover-view',
  'editor',
  'form',
  'functional-page-navigator',
  'icon',
  'image',
  'input',
  'label',
  'live-player',
  'live-pusher',
  'map',
  'movable-area',
  'movable-view',
  'navigator',
  'official-account',
  'open-data',
  'picker',
  'picker-view',
  'picker-view-column',
  'progress',
  'radio',
  'radio-group',
  'rich-text',
  'scroll-view',
  'slot',
  'slider',
  'swiper',
  'swiper-item',
  'switch',
  'textarea',
  'text',
  'video',
  'view',
  'web-view',
])

const BOOLEAN_ATTRIBUTES = new Set(['checked', 'disabled', 'hidden'])

function readBuildConfig(): Required<ReactRendererBuildConfig> {
  const injected = typeof __WEAPP_VITE_REACT_RENDERER__ === 'undefined'
    ? undefined
    : __WEAPP_VITE_REACT_RENDERER__
  return {
    mode: injected?.mode === 'auto' || injected?.mode === 'native-dom' ? injected.mode : 'legacy',
    platform: typeof injected?.platform === 'string' ? injected.platform : '',
  }
}

function capabilityError(reason: string, cause?: unknown) {
  const error = new Error(`[react] renderer: 'native-dom' 需要抖音 Render Mode V2、tt.appDocument 与当前页面 __webviewId__ (${reason})`)
  if (cause !== undefined) {
    ;(error as Error & { cause?: unknown }).cause = cause
  }
  return error
}

export function createNativeDomBackend(
  adapter: MiniProgramPageAdapter,
  dispatchEvent: NativeDomEventDispatcher,
): HostRendererBackend | undefined {
  const config = readBuildConfig()
  if (config.mode === 'legacy' || (config.mode === 'auto' && config.platform !== 'tt')) {
    return undefined
  }
  if (config.mode === 'native-dom' && config.platform !== 'tt') {
    throw new Error(`[react] renderer: 'native-dom' 仅支持 tt 平台，当前目标为 ${config.platform || 'unknown'}`)
  }

  const fallback = (reason: string, cause?: unknown): undefined => {
    if (config.mode === 'auto') {
      return undefined
    }
    throw capabilityError(reason, cause)
  }

  let ttRuntime: TtRuntime | undefined
  let appDocument: NativeDomDocument | undefined
  let container: NativeDomNode | undefined
  let renderMode: number | undefined
  try {
    ttRuntime = (globalThis as typeof globalThis & { tt?: TtRuntime }).tt
    appDocument = ttRuntime?.appDocument
    renderMode = ttRuntime?.getRenderMode?.()
  }
  catch (error) {
    return fallback('读取 Render Mode V2 能力失败', error)
  }

  const webviewId = adapter.__webviewId__
  if (
    !ttRuntime
    || renderMode !== 2
    || !appDocument
    || typeof appDocument.createElement !== 'function'
    || typeof appDocument.createNativeComponent !== 'function'
    || typeof appDocument.createTextNode !== 'function'
    || typeof appDocument.getPageDocumentById !== 'function'
    || typeof webviewId !== 'number'
  ) {
    return fallback('Render Mode V2 API 不可用')
  }

  try {
    container = appDocument.getPageDocumentById(webviewId)
  }
  catch (error) {
    return fallback('读取 Render Mode V2 页面文档失败', error)
  }

  if (!container || !ttRuntime || !appDocument) {
    return fallback('页面文档尚不可用')
  }

  return new TtDomBackend(ttRuntime, appDocument, container, dispatchEvent)
}

class TtDomBackend implements HostRendererBackend {
  readonly container: NativeDomNode
  private readonly appDocument: NativeDomDocument
  private readonly builtInComponents: Set<string>
  private readonly dispatchedEvents = new WeakSet<object>()
  private readonly dispatchEvent: NativeDomEventDispatcher
  private readonly eventBindings = new WeakMap<NativeDomNode, Map<string, NativeEventBinding>>()
  private readonly hostNodes = new WeakMap<object, HostElement>()

  constructor(
    ttRuntime: TtRuntime,
    appDocument: NativeDomDocument,
    container: NativeDomNode,
    dispatchEvent: NativeDomEventDispatcher,
  ) {
    this.appDocument = appDocument
    this.container = container
    this.dispatchEvent = dispatchEvent
    const builtIn = ttRuntime.getBuiltInComponents?.()
    this.builtInComponents = builtIn instanceof Set
      ? builtIn
      : Array.isArray(builtIn) ? new Set(builtIn) : DEFAULT_BUILT_IN_COMPONENTS
  }

  createElement(type: string) {
    if (this.builtInComponents.has(type)) {
      return this.appDocument.createElement(type)
    }
    return this.appDocument.createNativeComponent(type, { __tt__inner__options__: { name: type } })
  }

  createText(value: string) {
    return this.appDocument.createTextNode(value)
  }

  setElementProps(element: HostElement, previous: HostProps, next: HostProps) {
    const node = element.nativeNode as NativeDomNode
    this.hostNodes.set(node, element)

    const previousClass = previous.className ?? previous.class
    const nextClass = next.className ?? next.class
    if (previousClass !== nextClass) {
      this.setAttribute(node, 'class', nextClass)
    }

    if (serializeStyle(previous.style) !== serializeStyle(next.style)) {
      this.setAttribute(node, 'style', next.style)
    }

    const names = new Set([...Object.keys(previous), ...Object.keys(next)])
    for (const name of names) {
      if (name === 'class' || name === 'className' || name === 'style') {
        continue
      }
      if (isEventProp(name)) {
        if (previous[name] !== next[name]) {
          this.setEventListener(node, element, name, next[name])
        }
      }
      else if (shouldSetAttribute(name) && previous[name] !== next[name]) {
        this.setAttribute(node, name, next[name])
      }
    }
  }

  setText(node: object, value: string) {
    ;(node as NativeDomNode).nodeValue = value
  }

  appendChild(parent: object, child: object) {
    ;(parent as NativeDomNode).appendChild(child as NativeDomNode)
  }

  insertBefore(parent: object, child: object, before: object) {
    ;(parent as NativeDomNode).insertBefore(child as NativeDomNode, before as NativeDomNode)
  }

  removeChild(parent: object, child: object) {
    ;(parent as NativeDomNode).removeChild(child as NativeDomNode)
  }

  disposeNode(node: object) {
    const nativeNode = node as NativeDomNode
    const bindings = this.eventBindings.get(nativeNode)
    if (bindings) {
      for (const binding of bindings.values()) {
        nativeNode.removeEventListener(binding.type, binding.listener, binding.capture)
      }
      bindings.clear()
      this.eventBindings.delete(nativeNode)
    }
    this.hostNodes.delete(nativeNode)
  }

  flush() {}

  private setAttribute(node: NativeDomNode, name: string, value: unknown) {
    if (name === 'children' || name === 'key' || name === 'ref' || name.startsWith('__')) {
      return
    }
    if (name === 'style') {
      const style = serializeStyle(value)
      if (style) {
        node.setAttribute('style', style)
      }
      else {
        node.removeAttribute('style')
      }
      return
    }
    if (value == null || (BOOLEAN_ATTRIBUTES.has(name) && value === false)) {
      node.removeAttribute(normalizeAttributeName(name))
      return
    }
    node.setAttribute(normalizeAttributeName(name), value)
  }

  private setEventListener(node: NativeDomNode, element: HostElement, propName: string, value: unknown) {
    const event = parseEventProp(propName)
    if (!event) {
      return
    }
    const bindings = this.eventBindings.get(node) ?? new Map<string, NativeEventBinding>()
    const previous = bindings.get(propName)
    if (previous) {
      node.removeEventListener(previous.type, previous.listener, previous.capture)
      bindings.delete(propName)
    }
    if (typeof value !== 'function') {
      if (bindings.size === 0) {
        this.eventBindings.delete(node)
      }
      return
    }

    const nativeType = `bind${event.nativeType}`
    const listener = (eventValue: NativeDomEvent) => {
      if (this.dispatchedEvents.has(eventValue)) {
        return
      }
      this.dispatchedEvents.add(eventValue)

      const target = isObject(eventValue.target) ? this.hostNodes.get(eventValue.target) ?? element : element
      const nativeEvent: MiniProgramEventLike = {
        currentTarget: { dataset: { sid: target.sid } },
        detail: isRecord(eventValue.detail) ? eventValue.detail : {},
        stopPropagation: () => eventValue.stopPropagation?.(),
        target,
        type: event.type ?? nativeType,
      }
      this.dispatchEvent(target, nativeEvent)
    }
    const binding = { listener, type: nativeType, capture: event.capture }
    node.addEventListener(nativeType, listener, event.capture)
    bindings.set(propName, binding)
    this.eventBindings.set(node, bindings)
  }
}

function isEventProp(name: string) {
  return /^on[A-Z]/.test(name)
}

function shouldSetAttribute(name: string) {
  return name !== 'children' && name !== 'key' && name !== 'ref' && !name.startsWith('__')
}

function parseEventProp(name: string) {
  if (!isEventProp(name)) {
    return undefined
  }
  const capture = name.endsWith('Capture')
  const reactType = name.slice(2, capture ? -7 : undefined).toLowerCase()
  return {
    capture,
    nativeType: reactType === 'click' ? 'tap' : reactType,
    type: reactType,
  }
}

function normalizeAttributeName(name: string) {
  if (/^(?:data|aria)-/.test(name)) {
    return name
  }
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value)
}
