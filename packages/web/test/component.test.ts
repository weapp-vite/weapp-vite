import { parseDocument } from 'htmlparser2'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import { initializePageRoutes, navigateBack, navigateTo, registerApp, registerPage } from '../src/runtime/polyfill'
import { createTemplate } from '../src/runtime/template'

/* eslint-disable ts/no-use-before-define, antfu/consistent-chaining, new-cap, style/lines-between-class-members */

function setupTestDom() {
  if ((globalThis as any).document) {
    return
  }

  class AttributeList implements Iterable<{ name: string, value: string }> {
    #map = new Map<string, string>()

    set(name: string, value: string) {
      this.#map.set(name, value)
    }

    get(name: string) {
      return this.#map.get(name)
    }

    has(name: string) {
      return this.#map.has(name)
    }

    entries() {
      return this.#map.entries()
    }

    delete(name: string) {
      this.#map.delete(name)
    }

    keys() {
      return this.#map.keys()
    }

    [Symbol.iterator]() {
      const iterator = this.#map[Symbol.iterator]()
      return {
        next(): IteratorResult<{ name: string, value: string }> {
          const { value, done } = iterator.next()
          if (done) {
            return { done: true, value: undefined as any }
          }
          const [name, val] = value as [string, string]
          return { done: false, value: { name, value: val } }
        },
      }
    }
  }

  class VirtualTextNode {
    type = 'text'
    parentNode: VirtualElement | null = null
    constructor(public data: string) {}
    toHTML() {
      return this.data
    }
    get textContent() {
      return this.data
    }
    set textContent(value: string) {
      this.data = value
    }
  }

  function getObservedAttributes(instance: VirtualElement) {
    const ctor = instance.constructor as { observedAttributes?: string[] | (() => string[]) }
    const value = typeof ctor.observedAttributes === 'function'
      ? ctor.observedAttributes()
      : ctor.observedAttributes
    return Array.isArray(value) ? value : []
  }

  class VirtualElement extends EventTarget {
    tagName: string
    attributes = new AttributeList()
    childNodes: Array<VirtualElement | VirtualTextNode> = []
    parentNode: VirtualElement | null = null
    dataset: Record<string, string> = {}
    classList = new Set<string>()
    shadowRoot?: VirtualShadowRoot

    constructor(tagName: string) {
      super()
      this.tagName = tagName.toUpperCase()
    }

    appendChild<T extends VirtualElement | VirtualTextNode>(child: T): T {
      if (child.parentNode) {
        child.parentNode.removeChild(child)
      }
      child.parentNode = this
      this.childNodes.push(child)
      if (child instanceof BaseHTMLElement && typeof (child as any).connectedCallback === 'function') {
        (child as any).connectedCallback()
      }
      return child
    }

    append(...nodes: (VirtualElement | VirtualTextNode | string)[]) {
      for (const node of nodes) {
        if (typeof node === 'string') {
          this.appendChild(new VirtualTextNode(node))
        }
        else {
          this.appendChild(node)
        }
      }
    }

    removeChild(child: VirtualElement | VirtualTextNode) {
      const index = this.childNodes.indexOf(child)
      if (index >= 0) {
        this.childNodes.splice(index, 1)
        if (child instanceof BaseHTMLElement && typeof (child as any).disconnectedCallback === 'function') {
          (child as any).disconnectedCallback()
        }
        child.parentNode = null
      }
    }

    setAttribute(name: string, value: string) {
      const normalized = value ?? ''
      const oldValue = this.attributes.has(name) ? this.attributes.get(name) ?? null : null
      this.attributes.set(name, normalized)
      if (name === 'class') {
        this.classList = new Set(normalized.split(/\s+/).filter(Boolean))
      }
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
        this.dataset[key] = normalized
      }
      const observed = getObservedAttributes(this)
      if (observed.includes(name) && typeof (this as any).attributeChangedCallback === 'function') {
        (this as any).attributeChangedCallback(name, oldValue, normalized)
      }
    }

    getAttribute(name: string) {
      return this.attributes.has(name) ? this.attributes.get(name) ?? null : null
    }

    hasAttribute(name: string) {
      return this.attributes.has(name)
    }

    getAttributeNames() {
      return Array.from(this.attributes.keys())
    }

    removeAttribute(name: string) {
      const oldValue = this.attributes.has(name) ? this.attributes.get(name) ?? null : null
      this.attributes.delete(name)
      if (name === 'class') {
        this.classList.clear()
      }
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
        delete this.dataset[key]
      }
      const observed = getObservedAttributes(this)
      if (observed.includes(name) && typeof (this as any).attributeChangedCallback === 'function') {
        (this as any).attributeChangedCallback(name, oldValue, null)
      }
    }

    attachShadow(_init: { mode: 'open' | 'closed' }) {
      this.shadowRoot = new VirtualShadowRoot(this)
      return this.shadowRoot
    }

    get textContent(): string {
      return this.childNodes.map(node => node instanceof VirtualElement ? node.textContent : node.textContent).join('')
    }

    set textContent(value: string) {
      this.childNodes = value ? [new VirtualTextNode(value)] : []
    }

    get innerHTML(): string {
      return this.childNodes.map(node => node instanceof VirtualElement ? node.toHTML() : node.toHTML()).join('')
    }

    set innerHTML(value: string) {
      this.childNodes = []
      const fragment = parseFragment(value)
      for (const child of fragment) {
        this.appendChild(child)
      }
    }

    toHTML(): string {
      const attrs = Array.from(this.attributes.entries())
        .map(([key, val]) => ` ${key}="${val}"`).join('')
      const children = this.innerHTML
      if (SELF_CLOSING.has(this.tagName)) {
        return `<${this.tagName.toLowerCase()}${attrs} />`
      }
      return `<${this.tagName.toLowerCase()}${attrs}>${children}</${this.tagName.toLowerCase()}>`
    }

    querySelector(selector: string): VirtualElement | null {
      return this.querySelectorAll(selector)[0] ?? null
    }

    querySelectorAll(selector: string): VirtualElement[] {
      const matcher = createSelectorMatcher(selector)
      const results: VirtualElement[] = []
      const visit = (node: VirtualElement | VirtualTextNode) => {
        if (node instanceof VirtualElement) {
          if (matcher(node)) {
            results.push(node)
          }
          for (const child of node.childNodes) {
            visit(child)
          }
        }
      }
      for (const child of this.childNodes) {
        visit(child)
      }
      return results
    }
  }

  class VirtualShadowRoot extends VirtualElement {
    constructor(public host: VirtualElement) {
      super('#shadow-root')
    }
  }

  class BaseHTMLElement extends VirtualElement {
    constructor(tagName = 'div') {
      super(tagName)
    }
  }

  const SELF_CLOSING = new Set(['AREA', 'BASE', 'BR', 'COL', 'EMBED', 'HR', 'IMG', 'INPUT', 'LINK', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'])

  function parseFragment(html: string): Array<VirtualElement | VirtualTextNode> {
    const result: Array<VirtualElement | VirtualTextNode> = []
    const document = parseDocument(html, {
      xmlMode: false,
      decodeEntities: true,
      recognizeSelfClosing: true,
    })

    const convert = (node: any): VirtualElement | VirtualTextNode | null => {
      if (node.type === 'text') {
        return new VirtualTextNode(node.data)
      }
      if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
        const el = new BaseHTMLElement(node.name)
        for (const [key, val] of Object.entries(node.attribs ?? {})) {
          el.setAttribute(key, val as string)
        }
        for (const child of node.children ?? []) {
          const converted = convert(child)
          if (converted) {
            el.appendChild(converted)
          }
        }
        return el
      }
      return null
    }

    for (const child of document.children ?? []) {
      const converted = convert(child)
      if (converted) {
        result.push(converted)
      }
    }
    return result
  }

  function createSelectorMatcher(selector: string) {
    if (selector.startsWith('.')) {
      const className = selector.slice(1)
      return (node: VirtualElement) => node.classList.has(className)
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1)
      return (node: VirtualElement) => node.getAttribute('id') === id
    }
    if (selector.includes('.')) {
      const [tag, className] = selector.split('.')
      return (node: VirtualElement) => node.tagName === tag.toUpperCase() && node.classList.has(className)
    }
    return (node: VirtualElement) => node.tagName === selector.toUpperCase()
  }

  class VirtualDocument {
    head = new BaseHTMLElement('head')
    body = new BaseHTMLElement('body')

    createElement(tagName: string) {
      const ctor = customElementsRegistry.get(tagName)
      if (ctor) {
        const instance = new ctor()
        if (instance instanceof BaseHTMLElement) {
          instance.tagName = tagName.toUpperCase()
        }
        return instance
      }
      return new BaseHTMLElement(tagName)
    }

    createTreeWalker(root: VirtualElement) {
      const elements: VirtualElement[] = []
      const visit = (node: VirtualElement | VirtualTextNode) => {
        if (node instanceof VirtualElement) {
          elements.push(node)
          for (const child of node.childNodes) {
            visit(child)
          }
        }
      }
      for (const child of root.childNodes) {
        visit(child)
      }
      let index = -1
      return {
        currentNode: root,
        nextNode() {
          index += 1
          const next = elements[index]
          if (!next) {
            return null
          }
          this.currentNode = next
          return next
        },
      }
    }

    querySelector(selector: string) {
      return this.body.querySelector(selector)
    }
  }

  const customElementsRegistry = new Map<string, CustomElementConstructor>()

  const customElements = {
    define(name: string, ctor: CustomElementConstructor) {
      if (customElementsRegistry.has(name)) {
        throw new Error(`Custom element "${name}" has already been defined`)
      }
      customElementsRegistry.set(name, ctor)
    },
    get(name: string) {
      return customElementsRegistry.get(name)
    },
  }

  if (typeof (globalThis as any).CustomEvent === 'undefined') {
    class CustomEventPolyfill<T = any> extends Event {
      detail: T
      constructor(type: string, params?: CustomEventInit<T>) {
        super(type, params)
        this.detail = params?.detail as T
      }
    }
    ;(globalThis as any).CustomEvent = CustomEventPolyfill as unknown as typeof CustomEvent
  }

  ;(globalThis as any).HTMLElement = BaseHTMLElement as unknown as typeof HTMLElement
  ;(globalThis as any).document = new VirtualDocument()
  ;(globalThis as any).customElements = customElements
  ;(globalThis as any).NodeFilter = { SHOW_ELEMENT: 1 }
}

beforeAll(() => {
  setupTestDom()
})

function findElementByTag(tagName: string) {
  const children = (document.body as any).childNodes as Array<HTMLElement>
  return children.find(node => (node as any).tagName === tagName.toUpperCase()) ?? null
}

const helloWorldWxml = `<view class="hello-card">
  <view class="hello-title">{{title}}</view>
  <view class="hello-body">{{description}}</view>
  <view class="hello-last">{{last}}</view>
  <view class="hello-actions">
    <view
      class="hello-button"
      data-url="{{link}}"
      bindtap="copyLink"
    >
      {{buttonText}}
    </view>
  </view>
</view>`

describe.skip('defineComponent', () => {
  it('registers custom element and updates on setData', async () => {
    const template = createTemplate(helloWorldWxml)

    defineComponent('wv-hello-world', {
      template,
      style: '.hello-card { font-size: 14px; }',
      component: {
        properties: {
          title: { type: String, value: 'Default Title' },
        },
        data: () => ({
          description: '欢迎使用 weapp-vite',
          buttonText: '复制链接',
          link: 'https://vite.icebreaker.top',
          last: '-',
        }),
        methods: {
          copyLink(event) {
            const url = event.currentTarget.dataset.url as string
            this.setData({ last: url })
            this.triggerEvent('copied', { url })
          },
        },
      },
    })

    const element = document.createElement('wv-hello-world') as HTMLElement & {
      setData: (patch: Record<string, any>) => void
      data: Record<string, any>
    }

    const handler = vi.fn()
    element.addEventListener('copied', handler)
    element.setAttribute('title', '自定义标题')

    document.body.append(element)

    const shadowRoot = element.shadowRoot
    expect(shadowRoot).toBeDefined()
    const title = shadowRoot?.querySelector('.hello-title')
    expect(title?.textContent).toBe('自定义标题')

    const button = shadowRoot?.querySelector('.hello-button') as HTMLElement
    expect(button).toBeTruthy()

    button.dispatchEvent(new Event('click', { bubbles: true, composed: true }))

    expect(element.data.last).toBe('https://vite.icebreaker.top')
    const lastView = shadowRoot?.querySelector('.hello-last')
    expect(lastView?.textContent).toBe('https://vite.icebreaker.top')
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      detail: { url: 'https://vite.icebreaker.top' },
    }))
  })
})

describe('registerPage integration', () => {
  it('mounts pages, wires events, and supports navigation', async () => {
    const onLoad = vi.fn()
    const onShow = vi.fn()
    const onHide = vi.fn()
    const onUnload = vi.fn()
    const onReady = vi.fn()
    const onSecondLoad = vi.fn()
    const onSecondUnload = vi.fn()

    registerApp({
      globalData: { message: 'hello' },
    })

    const firstTemplate = createTemplate('<view bindtap="increment">{{count}}</view>')
    registerPage({
      data: () => ({ count: 1 }),
      increment() {
        this.setData({ count: this.data.count + 1 })
      },
      onLoad,
      onShow,
      onHide,
      onUnload,
      onReady,
    }, {
      id: 'pages/index/index',
      template: firstTemplate,
    })

    const secondTemplate = createTemplate('<view>{{title}}</view>')
    registerPage({
      data: { title: 'second' },
      onLoad: onSecondLoad,
      onUnload: onSecondUnload,
    }, {
      id: 'pages/second/index',
      template: secondTemplate,
    })

    initializePageRoutes(['pages/index/index', 'pages/second/index'])
    await Promise.resolve()

    const bodyChildren = (document.body as any).childNodes as Array<HTMLElement>
    expect(bodyChildren.length).toBeGreaterThan(0)
    const tags = bodyChildren.map(node => (node as any).tagName)
    expect(tags).toContain('WV-PAGE-PAGES-INDEX-INDEX')

    const firstPage = findElementByTag('wv-page-pages-index-index') as HTMLElement & { data: any }
    expect(firstPage).toBeTruthy()
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledTimes(1)

    const currentPages = (globalThis as any).getCurrentPages?.() ?? []
    expect(currentPages.length).toBe(1)

    const renderedHTML = firstPage.shadowRoot?.innerHTML ?? ''
    expect(renderedHTML).toContain('data-wx-on-click="increment"')

    const shadowRoot = firstPage.shadowRoot as any
    expect(shadowRoot).toBeTruthy()
    const trigger = (shadowRoot?.querySelectorAll('div') ?? [])
      .find((node: HTMLElement) => node.getAttribute?.('data-wx-on-click') === 'increment') as HTMLElement | undefined
    expect(trigger).toBeTruthy()
    trigger?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(firstPage.data.count).toBe(2)

    await navigateTo({ url: 'pages/second/index?foo=bar' })
    await Promise.resolve()

    expect(firstPage.parentNode).toBeNull()
    expect(onHide).toHaveBeenCalledTimes(1)
    expect(onUnload).toHaveBeenCalledTimes(1)
    const secondPage = findElementByTag('wv-page-pages-second-index') as HTMLElement & { data: any }
    expect(secondPage).toBeTruthy()
    expect(onSecondLoad).toHaveBeenCalledWith(expect.objectContaining({ foo: 'bar' }))
    expect(typeof (globalThis as any).wx.navigateTo).toBe('function')

    await navigateBack({ delta: 1 })
    await Promise.resolve()

    const firstPageAgain = findElementByTag('wv-page-pages-index-index') as HTMLElement & { data: any }
    expect(firstPageAgain).toBeTruthy()
    expect(onLoad).toHaveBeenCalledTimes(2)
    expect(onSecondUnload).toHaveBeenCalledTimes(1)
  })
})
