/* eslint-disable ts/no-use-before-define -- 后端工厂与宿主辅助函数按能力探针、操作实现的阅读顺序组织。 */
import type { NativeDomEvent, NativeDomNode, NativeDomSelection } from '@weapp-core/shared/native-dom'
import type { HostElement, HostRendererBackend } from './hostTree'
import type { HostProps, MiniProgramEventLike, MiniProgramPageAdapter } from './types'
import { createNativeDomElement, selectNativeDom } from '@weapp-core/shared/native-dom'
import { serializeStyle } from './hostTree/serialization'

export type ReactRendererMode = 'legacy' | 'auto' | 'native-dom'

interface ReactRendererBuildConfig {
  mode?: ReactRendererMode
  platform?: string
}

interface NativeEventBinding {
  listener: (event: NativeDomEvent) => void
  type: string
  capture: boolean
}

export type NativeDomEventDispatcher = (target: HostElement, event: MiniProgramEventLike) => void

declare const __WEAPP_VITE_REACT_RENDERER__: ReactRendererBuildConfig | undefined

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

export function createNativeDomBackend(
  adapter: MiniProgramPageAdapter,
  dispatchEvent: NativeDomEventDispatcher,
): HostRendererBackend | undefined {
  const selection = selectNativeDom(readBuildConfig(), adapter, 'react')
  return selection ? new TtDomBackend(selection, dispatchEvent) : undefined
}

class TtDomBackend implements HostRendererBackend {
  readonly container: NativeDomNode
  private readonly selection: NativeDomSelection
  private readonly dispatchedEvents = new WeakSet<object>()
  private readonly dispatchEvent: NativeDomEventDispatcher
  private readonly eventBindings = new WeakMap<NativeDomNode, Map<string, NativeEventBinding>>()
  private readonly hostNodes = new WeakMap<object, HostElement>()

  constructor(selection: NativeDomSelection, dispatchEvent: NativeDomEventDispatcher) {
    this.selection = selection
    this.container = selection.container
    this.dispatchEvent = dispatchEvent
  }

  createElement(type: string) {
    return createNativeDomElement(this.selection, type)
  }

  createText(value: string) {
    return this.selection.appDocument.createTextNode(value)
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
