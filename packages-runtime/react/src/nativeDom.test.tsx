import { createElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNativeComponent } from './components'
import { createNativeDomBackend } from './nativeDom'
import { createReactMiniProgramRoot } from './renderer'

type Listener = (event: FakeEvent) => void

interface FakeEvent {
  detail: Record<string, unknown>
  stopPropagation: () => void
  target: FakeNode
  type: string
}

class FakeNode {
  attributes = new Map<string, unknown>()
  children: FakeNode[] = []
  listeners = new Map<string, Set<{ listener: Listener, capture: boolean }>>()
  nodeValue: string | null = null
  parent: FakeNode | undefined

  constructor(readonly name: string) {}

  appendChild(child: FakeNode) {
    this.insertBefore(child, null)
    return child
  }

  insertBefore(child: FakeNode, before: FakeNode | null) {
    if (child.parent) {
      const previousIndex = child.parent.children.indexOf(child)
      if (previousIndex >= 0) {
        child.parent.children.splice(previousIndex, 1)
      }
    }
    const index = before ? this.children.indexOf(before) : -1
    if (before && index < 0) {
      throw new Error('before node is not a child')
    }
    child.parent = this
    this.children.splice(index < 0 ? this.children.length : index, 0, child)
    return child
  }

  removeChild(child: FakeNode) {
    const index = this.children.indexOf(child)
    if (index < 0) {
      throw new Error('node is not a child')
    }
    this.children.splice(index, 1)
    child.parent = undefined
    return child
  }

  setAttribute(name: string, value: unknown) {
    this.attributes.set(name, value)
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  addEventListener(type: string, listener: Listener, capture = false) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add({ listener, capture })
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: Listener, capture = false) {
    const listeners = this.listeners.get(type)
    if (!listeners) {
      return
    }
    for (const binding of listeners) {
      if (binding.listener === listener && binding.capture === capture) {
        listeners.delete(binding)
      }
    }
    if (listeners.size === 0) {
      this.listeners.delete(type)
    }
  }

  dispatch(type: string) {
    const path: FakeNode[] = [this]
    let current = this.parent
    while (current) {
      path.push(current)
      current = current.parent
    }
    let stopped = false
    const event: FakeEvent = {
      detail: { value: 'from-native' },
      stopPropagation: () => {
        stopped = true
      },
      target: this,
      type,
    }
    for (const node of path.slice().reverse()) {
      node.invoke(type, event, true)
      if (stopped) {
        return
      }
    }
    for (const node of path) {
      node.invoke(type, event, false)
      if (stopped) {
        return
      }
    }
  }

  private invoke(type: string, event: FakeEvent, capture: boolean) {
    for (const binding of this.listeners.get(type) ?? []) {
      if (binding.capture === capture) {
        binding.listener(event)
      }
    }
  }
}

function createTtRuntime(options: { renderMode?: number } = {}) {
  const container = new FakeNode('#document')
  const createdElements: string[] = []
  const createdComponents: Array<{ name: string, options: Record<string, unknown> }> = []
  const appDocument = {
    createElement(name: string) {
      createdElements.push(name)
      return new FakeNode(name)
    },
    createNativeComponent(name: string, componentOptions: Record<string, unknown>) {
      createdComponents.push({ name, options: componentOptions })
      return new FakeNode(name)
    },
    createTextNode(value: string) {
      const node = new FakeNode('#text')
      node.nodeValue = value
      return node
    },
    getPageDocumentById(webviewId: number) {
      expect(webviewId).toBe(42)
      return container
    },
  }
  return {
    appDocument,
    container,
    createdComponents,
    createdElements,
    getBuiltInComponents: () => new Set(['button', 'text', 'view']),
    getRenderMode: () => options.renderMode ?? 2,
  }
}

function useRendererConfig(mode: 'legacy' | 'auto' | 'native-dom', platform: string) {
  vi.stubGlobal('__WEAPP_VITE_REACT_RENDERER__', { mode, platform })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('React TT native DOM renderer', () => {
  it('creates, reorders, updates and removes native nodes without setData', () => {
    useRendererConfig('native-dom', 'tt')
    const tt = createTtRuntime()
    vi.stubGlobal('tt', tt)
    const setData = vi.fn()
    const root = createReactMiniProgramRoot({ __webviewId__: 42, setData }, { renderMode: 'static-bindings' })
    const NativeCard = createNativeComponent<{ title: string }>('native-card')

    root.render(createElement('view', {
      className: 'before',
      id: 'root',
      style: { color: 'red', opacity: 0.5 },
    }, createElement('text', { key: 'text', id: 'message' }, 'first'), createElement(NativeCard, { key: 'card', title: 'card' })))

    const host = tt.container.children[0]!
    const textElement = host.children[0]!
    const text = textElement.children[0]!
    const card = host.children[1]!
    expect(host.attributes.get('class')).toBe('before')
    expect(host.attributes.get('style')).toBe('color:red;opacity:0.5')
    expect(text.nodeValue).toBe('first')
    expect(tt.createdElements).toEqual(expect.arrayContaining(['view', 'text']))
    expect(tt.createdComponents).toMatchObject([{
      name: 'native-card',
      options: { __tt__inner__options__: { name: 'native-card' } },
    }])

    root.render(createElement('view', {
      className: 'after',
      id: 'root',
      style: undefined,
    }, createElement(NativeCard, { key: 'card', title: 'updated card' }), createElement('text', { key: 'text', id: 'message' }, 'second')))

    expect(host.children).toEqual([card, textElement])
    expect(host.attributes.get('class')).toBe('after')
    expect(host.attributes.has('style')).toBe(false)
    expect(text.nodeValue).toBe('second')
    expect(card.attributes.get('title')).toBe('updated card')
    expect(setData).not.toHaveBeenCalled()

    root.unmount()
    expect(tt.container.children).toEqual([])
    expect(setData).not.toHaveBeenCalled()
  })

  it('dispatches capture and bubble handlers synchronously, then removes listeners on unmount', () => {
    useRendererConfig('native-dom', 'tt')
    const tt = createTtRuntime()
    vi.stubGlobal('tt', tt)
    const setData = vi.fn()
    const calls: string[] = []

    function Counter() {
      const [count, setCount] = useState(0)
      return createElement('view', {
        onTap: () => calls.push('parent'),
        onTapCapture: () => calls.push('capture'),
      }, createElement('button', {
        id: 'increment',
        onTap: () => {
          calls.push('button')
          setCount(value => value + 1)
        },
      }, `count:${count}`))
    }

    const root = createReactMiniProgramRoot({ __webviewId__: 42, setData })
    root.render(createElement(Counter))
    const button = tt.container.children[0]!.children[0]!
    button.dispatch('bindtap')

    expect(calls).toEqual(['capture', 'button', 'parent'])
    expect(button.children[0]?.nodeValue).toBe('count:1')
    expect(setData).not.toHaveBeenCalled()

    root.unmount()
    expect(tt.container.children).toEqual([])
    expect(button.listeners.size).toBe(0)
  })

  it('maps camel-case native component events to their mini-program event names', () => {
    useRendererConfig('native-dom', 'tt')
    const tt = createTtRuntime()
    vi.stubGlobal('tt', tt)
    const calls: string[] = []
    const NativeCard = createNativeComponent<{
      onValueChange?: (event: { detail: Record<string, unknown> }) => void
      onValueChangeCapture?: () => void
    }>('native-card')
    const root = createReactMiniProgramRoot({ __webviewId__: 42, setData: vi.fn() })

    root.render(createElement(NativeCard, {
      onValueChange: event => calls.push(`bubble:${String(event.detail.value)}`),
      onValueChangeCapture: () => calls.push('capture'),
    }))

    tt.container.children[0]!.dispatch('bindvaluechange')

    expect(calls).toEqual(['capture', 'bubble:from-native'])
    root.unmount()
  })

  it('uses auto only when TT V2 document capabilities are available', () => {
    useRendererConfig('auto', 'tt')
    const tt = createTtRuntime()
    vi.stubGlobal('tt', tt)
    const root = createReactMiniProgramRoot({ __webviewId__: 42, setData: vi.fn() })
    root.render(createElement('view', null, 'native'))
    expect(tt.container.children).toHaveLength(1)
    root.unmount()

    useRendererConfig('auto', 'weapp')
    const setData = vi.fn()
    const legacyRoot = createReactMiniProgramRoot({ setData })
    legacyRoot.render(createElement('view', null, 'legacy'))
    expect(setData).toHaveBeenCalledTimes(1)
    expect(tt.container.children).toEqual([])
    legacyRoot.unmount()

    useRendererConfig('auto', 'tt')
    vi.stubGlobal('tt', { getRenderMode: () => 1 })
    const unavailableSetData = vi.fn()
    const unavailableRoot = createReactMiniProgramRoot({ __webviewId__: 42, setData: unavailableSetData })
    unavailableRoot.render(createElement('view', null, 'fallback'))
    expect(unavailableSetData).toHaveBeenCalledTimes(1)
    unavailableRoot.unmount()
  })

  it('reports explicit native DOM requests that cannot be supported', () => {
    useRendererConfig('native-dom', 'weapp')
    expect(() => createReactMiniProgramRoot({ setData() {} })).toThrow(/仅支持 tt 平台/)

    useRendererConfig('native-dom', 'tt')
    vi.stubGlobal('tt', { getRenderMode: () => 1 })
    expect(() => createReactMiniProgramRoot({ __webviewId__: 42, setData() {} })).toThrow(/Render Mode V2 API 不可用/)
  })

  it('surfaces host operation failures after native DOM selection', () => {
    useRendererConfig('native-dom', 'tt')
    const tt = createTtRuntime()
    tt.appDocument.createElement = () => {
      throw new Error('native create failed')
    }
    vi.stubGlobal('tt', tt)
    const setData = vi.fn()
    const backend = createNativeDomBackend({ __webviewId__: 42, setData }, () => {})

    expect(backend).toBeDefined()
    expect(() => backend!.createElement('view')).toThrow('native create failed')
    expect(setData).not.toHaveBeenCalled()
  })
})
