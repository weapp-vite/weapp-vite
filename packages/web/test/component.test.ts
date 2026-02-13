import { parseDocument } from 'htmlparser2'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent } from '../src/runtime/component'
import {
  canIUse,
  chooseImage,
  chooseMessageFile,
  clearStorage,
  clearStorageSync,
  createCanvasContext,
  createInterstitialAd,
  createRewardedVideoAd,
  createSelectorQuery,
  createVKSession,
  createWorker,
  downloadFile,
  exitMiniProgram,
  getAccountInfoSync,
  getAppAuthorizeSetting,
  getAppBaseInfo,
  getBatteryInfo,
  getBatteryInfoSync,
  getClipboardData,
  getDeviceInfo,
  getEnterOptionsSync,
  getExtConfig,
  getExtConfigSync,
  getFileSystemManager,
  getLaunchOptionsSync,
  getLocation,
  getMenuButtonBoundingClientRect,
  getNetworkType,
  getStorage,
  getStorageInfo,
  getStorageInfoSync,
  getStorageSync,
  getSystemInfo,
  getSystemInfoSync,
  getSystemSetting,
  getWindowInfo,
  hideLoading,
  initializePageRoutes,
  login,
  navigateBack,
  navigateTo,
  navigateToMiniProgram,
  nextTick,
  offNetworkStatusChange,
  offWindowResize,
  onNetworkStatusChange,
  onWindowResize,
  openCustomerServiceChat,
  openDocument,
  pageScrollTo,
  previewImage,
  registerApp,
  registerComponent,
  registerPage,
  reLaunch,
  removeStorage,
  removeStorageSync,
  reportAnalytics,
  request,
  requestPayment,
  saveImageToPhotosAlbum,
  scanCode,
  setClipboardData,
  setStorage,
  setStorageSync,
  showActionSheet,
  showLoading,
  showModal,
  showShareMenu,
  showToast,
  stopPullDownRefresh,
  updateShareMenu,
  vibrateShort,
} from '../src/runtime/polyfill'
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
    listenerRecords: Array<{ type: string, options: boolean | AddEventListenerOptions | undefined }> = []

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
      if (typeof (child as any).connectedCallback === 'function') {
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
        if (typeof (child as any).disconnectedCallback === 'function') {
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

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      this.listenerRecords.push({ type, options })
      super.addEventListener(type, listener, options)
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
        const ctor = customElementsRegistry.get(node.name)
        let el: BaseHTMLElement
        if (ctor) {
          const instance = new ctor()
          if (instance instanceof BaseHTMLElement) {
            instance.tagName = node.name.toUpperCase()
            el = instance
          }
          else {
            el = new BaseHTMLElement(node.name)
          }
        }
        else {
          el = new BaseHTMLElement(node.name)
        }
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
        else if (!(instance as any).tagName) {
          try {
            Object.defineProperty(instance, 'tagName', {
              value: tagName.toUpperCase(),
              writable: true,
              configurable: true,
            })
          }
          catch {}
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

function overrideGlobalProperty(name: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })
  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
      return
    }
    delete (globalThis as Record<string, unknown>)[name]
  }
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
    const onLoadUpdate = vi.fn()
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

    const updatedTemplate = createTemplate('<view bindtap="increment">{{count}}</view>')
    registerPage({
      data: () => ({ count: 999 }),
      increment() {
        this.setData({ count: this.data.count + 10 })
      },
      onLoad: onLoadUpdate,
      onShow,
      onHide,
      onUnload,
      onReady,
    }, {
      id: 'pages/index/index',
      template: updatedTemplate,
    })
    await Promise.resolve()

    expect(onLoadUpdate).toHaveBeenCalledTimes(0)
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(firstPage.data.count).toBe(2)

    const updatedTrigger = (shadowRoot?.querySelectorAll('div') ?? [])
      .find((node: HTMLElement) => node.getAttribute?.('data-wx-on-click') === 'increment') as HTMLElement | undefined
    updatedTrigger?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(firstPage.data.count).toBe(12)

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
    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onLoadUpdate).toHaveBeenCalledTimes(1)
    expect(onSecondUnload).toHaveBeenCalledTimes(1)
  })

  it('keeps active page state during repeated hot updates', async () => {
    const onLoad = vi.fn()
    const onHotLoad = vi.fn()

    registerPage({
      data: () => ({ count: 0 }),
      increment() {
        this.setData({ count: this.data.count + 1 })
      },
      onLoad,
    }, {
      id: 'pages/hmr-stability/index',
      template: createTemplate('<view bindtap="increment">{{count}}</view>'),
    })

    initializePageRoutes(['pages/hmr-stability/index'])
    await reLaunch({ url: 'pages/hmr-stability/index' })
    await Promise.resolve()

    const page = findElementByTag('wv-page-pages-hmr-stability-index') as HTMLElement & { data: any, shadowRoot?: ShadowRoot }
    expect(page).toBeTruthy()
    expect(onLoad).toHaveBeenCalledTimes(1)

    const firstTrigger = (page.shadowRoot?.querySelectorAll('div') ?? [])
      .find((node: HTMLElement) => node.getAttribute?.('data-wx-on-click') === 'increment') as HTMLElement | undefined
    firstTrigger?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(page.data.count).toBe(1)

    registerPage({
      data: () => ({ count: 1000 }),
      increment() {
        this.setData({ count: this.data.count + 5 })
      },
      onLoad: onHotLoad,
    }, {
      id: 'pages/hmr-stability/index',
      template: createTemplate('<view bindtap="increment">{{count}}</view>'),
    })
    await Promise.resolve()

    expect(onHotLoad).toHaveBeenCalledTimes(0)
    expect(page.data.count).toBe(1)

    const secondTrigger = (page.shadowRoot?.querySelectorAll('div') ?? [])
      .find((node: HTMLElement) => node.getAttribute?.('data-wx-on-click') === 'increment') as HTMLElement | undefined
    secondTrigger?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(page.data.count).toBe(6)

    registerPage({
      data: () => ({ count: 9999 }),
      increment() {
        this.setData({ count: this.data.count + 2 })
      },
      onLoad: onHotLoad,
    }, {
      id: 'pages/hmr-stability/index',
      template: createTemplate('<view bindtap="increment">{{count}}</view>'),
    })
    await Promise.resolve()
    expect(page.data.count).toBe(6)

    const thirdTrigger = (page.shadowRoot?.querySelectorAll('div') ?? [])
      .find((node: HTMLElement) => node.getAttribute?.('data-wx-on-click') === 'increment') as HTMLElement | undefined
    thirdTrigger?.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(page.data.count).toBe(8)
  })

  it('dispatches pageLifetimes show/hide to nested components', async () => {
    const onComponentShow = vi.fn()
    const onComponentHide = vi.fn()

    registerComponent({
      pageLifetimes: {
        show: onComponentShow,
        hide: onComponentHide,
      },
    }, {
      id: 'components/page-lifetimes-probe',
      template: createTemplate('<view class="probe">probe</view>'),
    })

    registerPage({}, {
      id: 'pages/page-lifetimes/index',
      template: createTemplate('<wv-component-components-page-lifetimes-probe></wv-component-components-page-lifetimes-probe>'),
    })

    registerPage({}, {
      id: 'pages/page-lifetimes-second/index',
      template: createTemplate('<view>second</view>'),
    })

    initializePageRoutes(['pages/page-lifetimes/index', 'pages/page-lifetimes-second/index'])
    await reLaunch({ url: 'pages/page-lifetimes/index' })
    await Promise.resolve()
    expect(onComponentShow).toHaveBeenCalledTimes(1)

    await navigateTo({ url: 'pages/page-lifetimes-second/index' })
    await Promise.resolve()
    expect(onComponentHide).toHaveBeenCalledTimes(1)

    await navigateBack({ delta: 1 })
    await Promise.resolve()
    expect(onComponentShow).toHaveBeenCalledTimes(2)
  })
})

describe('event prefix mapping integration', () => {
  it('binds catch/capture flags from template attributes', () => {
    const onBind = vi.fn()
    const onCatch = vi.fn()
    const onCapture = vi.fn()
    const onCaptureCatch = vi.fn()

    defineComponent('wv-event-prefix-flags', {
      template: createTemplate(`
        <view class="bind" bindtap="onBind">bind</view>
        <view class="catch" catchtap="onCatch">catch</view>
        <view class="capture" capture-bindtap="onCapture">capture</view>
        <view class="capture-catch" capture-catchtap="onCaptureCatch">captureCatch</view>
      `),
      component: {
        methods: {
          onBind,
          onCatch,
          onCapture,
          onCaptureCatch,
        },
      },
    })

    const element = document.createElement('wv-event-prefix-flags') as HTMLElement
    document.body.append(element)
    const root = element.shadowRoot ?? element

    const bindEl = root.querySelector('.bind') as HTMLElement & { listenerRecords?: Array<{ type: string, options: boolean | AddEventListenerOptions | undefined }> }
    const catchEl = root.querySelector('.catch') as HTMLElement & { listenerRecords?: Array<{ type: string, options: boolean | AddEventListenerOptions | undefined }> }
    const captureEl = root.querySelector('.capture') as HTMLElement & { listenerRecords?: Array<{ type: string, options: boolean | AddEventListenerOptions | undefined }> }
    const captureCatchEl = root.querySelector('.capture-catch') as HTMLElement & { listenerRecords?: Array<{ type: string, options: boolean | AddEventListenerOptions | undefined }> }

    bindEl.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(onBind).toHaveBeenCalledTimes(1)

    const catchEvent = new Event('click', { bubbles: true, composed: true })
    const catchStop = vi.fn()
    ;(catchEvent as Event & { stopPropagation: () => void }).stopPropagation = catchStop
    catchEl.dispatchEvent(catchEvent)
    expect(onCatch).toHaveBeenCalledTimes(1)
    expect(catchStop).toHaveBeenCalledTimes(1)

    captureEl.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(onCapture).toHaveBeenCalledTimes(1)
    expect(captureEl.listenerRecords?.some(record => record.type === 'click' && record.options === true)).toBe(true)

    const captureCatchEvent = new Event('click', { bubbles: true, composed: true })
    const captureCatchStop = vi.fn()
    ;(captureCatchEvent as Event & { stopPropagation: () => void }).stopPropagation = captureCatchStop
    captureCatchEl.dispatchEvent(captureCatchEvent)
    expect(onCaptureCatch).toHaveBeenCalledTimes(1)
    expect(captureCatchStop).toHaveBeenCalledTimes(1)
    expect(captureCatchEl.listenerRecords?.some(record => record.type === 'click' && record.options === true)).toBe(true)
  })
})

describe('component observer init', () => {
  it('fires observers once when enabled', () => {
    const countObserver = vi.fn()
    const titleObserver = vi.fn()
    const template = createTemplate('<view>{{title}} {{count}}</view>')

    defineComponent('wv-observer-init', {
      template,
      observerInit: true,
      component: {
        properties: {
          title: { type: String, value: 'default', observer: titleObserver },
          count: { type: Number, value: 1, observer: countObserver },
        },
      },
    })

    const element = document.createElement('wv-observer-init') as HTMLElement & { title?: string }
    element.title = 'custom'
    document.body.append(element)

    expect(titleObserver).toHaveBeenCalledTimes(1)
    expect(titleObserver).toHaveBeenCalledWith('custom', 'default')
    expect(countObserver).toHaveBeenCalledTimes(1)
    expect(countObserver).toHaveBeenCalledWith(1, undefined)
  })
})

describe('component behaviors', () => {
  it('merges behaviors data, properties, and methods with component overrides', () => {
    const template = createTemplate(`
      <view class="from-component" bindtap="ping">{{value}}</view>
      <view class="from-behavior" bindtap="fromBehavior"></view>
    `)

    const behaviorA = {
      data: { fromA: 'a', shared: 'a', value: 'a' },
      properties: {
        title: { type: String, value: 'fromA' },
        count: { type: Number, value: 1 },
      },
      methods: {
        fromBehavior(this: any) {
          this.setData({ value: 'fromBehavior' })
        },
        ping(this: any) {
          this.setData({ value: 'fromA' })
        },
      },
    }
    const behaviorB = {
      data: { fromB: 'b', shared: 'b' },
      properties: {
        title: { type: String, value: 'fromB' },
      },
      methods: {
        ping(this: any) {
          this.setData({ value: 'fromB' })
        },
      },
    }

    defineComponent('wv-behavior-merge', {
      template,
      component: {
        behaviors: [behaviorA, behaviorB],
        data: { fromC: 'c', shared: 'c', value: 'c' },
        properties: {
          title: { type: String, value: 'fromC' },
        },
        methods: {
          ping(this: any) {
            this.setData({ value: 'fromC' })
          },
        },
      },
    })

    const element = document.createElement('wv-behavior-merge') as HTMLElement & {
      data: Record<string, any>
      properties: Record<string, any>
    }
    document.body.append(element)

    expect(element.data).toMatchObject({
      fromA: 'a',
      fromB: 'b',
      fromC: 'c',
      shared: 'c',
    })
    expect(element.properties.title).toBe('fromC')
    expect(element.properties.count).toBe(1)

    const root = element.shadowRoot ?? element
    const fromBehavior = root.querySelector('.from-behavior') as HTMLElement
    fromBehavior.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(element.data.value).toBe('fromBehavior')

    const fromComponent = root.querySelector('.from-component') as HTMLElement
    fromComponent.dispatchEvent(new Event('click', { bubbles: true, composed: true }))
    expect(element.data.value).toBe('fromC')
  })

  it('runs lifetimes in behavior order including nested behaviors', () => {
    const calls: string[] = []

    const nested = {
      lifetimes: {
        created() {
          calls.push('nested-created')
        },
        attached() {
          calls.push('nested-attached')
        },
        ready() {
          calls.push('nested-ready')
        },
      },
    }
    const parent = {
      behaviors: [nested],
      lifetimes: {
        created() {
          calls.push('parent-created')
        },
        attached() {
          calls.push('parent-attached')
        },
        ready() {
          calls.push('parent-ready')
        },
      },
    }

    defineComponent('wv-behavior-lifetimes', {
      template: createTemplate('<view />'),
      component: {
        behaviors: [parent],
        lifetimes: {
          created() {
            calls.push('component-created')
          },
          attached() {
            calls.push('component-attached')
          },
          ready() {
            calls.push('component-ready')
          },
        },
      },
    })

    const element = document.createElement('wv-behavior-lifetimes')
    document.body.append(element)

    expect(calls).toEqual([
      'nested-created',
      'parent-created',
      'component-created',
      'nested-attached',
      'parent-attached',
      'component-attached',
      'nested-ready',
      'parent-ready',
      'component-ready',
    ])
  })
})

describe('component selector helpers', () => {
  it('provides createSelectorQuery/selectComponent/selectAllComponents on component instance', () => {
    defineComponent('wv-selector-host', {
      template: createTemplate(`
        <view class="inner" data-id="a"></view>
        <view class="inner" data-id="b"></view>
      `),
      component: {},
    })

    const host = document.createElement('wv-selector-host') as HTMLElement & {
      createSelectorQuery: () => ReturnType<typeof createSelectorQuery>
      selectComponent: (selector: string) => HTMLElement | null
      selectAllComponents: (selector: string) => HTMLElement[]
      renderRoot?: ShadowRoot | HTMLElement
    }
    document.body.append(host)

    const first = host.selectComponent('.inner')
    const all = host.selectAllComponents('.inner')
    expect(first).toBeTruthy()
    expect(all).toHaveLength(2)

    ;(first as any).getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 40,
      bottom: 30,
      width: 40,
      height: 30,
    })
    const rectCallback = vi.fn()
    host.createSelectorQuery()
      .select('.inner')
      .boundingClientRect(rectCallback)
      .exec()
    expect(rectCallback).toHaveBeenCalledWith(expect.objectContaining({
      width: 40,
      height: 30,
    }))
  })
})

describe('web runtime wx utility APIs', () => {
  it('supports storage sync apis', () => {
    clearStorageSync()
    setStorageSync('profile', { name: 'ice', score: 7 })
    expect(getStorageSync('profile')).toEqual({ name: 'ice', score: 7 })

    setStorageSync('token', 'abc')
    expect(getStorageSync('token')).toBe('abc')

    removeStorageSync('token')
    expect(getStorageSync('token')).toBe('')

    const storageInfo = getStorageInfoSync()
    expect(storageInfo).toMatchObject({
      errMsg: 'getStorageInfoSync:ok',
      keys: ['profile'],
      limitSize: 10240,
    })
    expect(storageInfo.currentSize).toBeGreaterThan(0)

    clearStorageSync()
    expect(getStorageSync('profile')).toBe('')
  })

  it('supports async storage apis with callbacks', async () => {
    clearStorageSync()
    const success = vi.fn()
    const complete = vi.fn()
    const result = await setStorage({
      key: 'settings',
      data: { dark: false },
      success,
      complete,
    })
    expect(result.errMsg).toBe('setStorage:ok')
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'setStorage:ok' }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'setStorage:ok' }))

    const getSuccess = vi.fn()
    const getResult = await getStorage({
      key: 'settings',
      success: getSuccess,
    })
    expect(getResult).toMatchObject({
      errMsg: 'getStorage:ok',
      data: { dark: false },
    })
    expect(getSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getStorage:ok' }))

    const removeResult = await removeStorage({ key: 'settings' })
    expect(removeResult.errMsg).toBe('removeStorage:ok')
    await expect(getStorage({ key: 'settings' })).rejects.toMatchObject({
      errMsg: expect.stringContaining('getStorage:fail'),
    })

    const clearResult = await clearStorage()
    expect(clearResult.errMsg).toBe('clearStorage:ok')

    const infoResult = await getStorageInfo()
    expect(infoResult).toMatchObject({
      errMsg: 'getStorageInfo:ok',
      keys: [],
      currentSize: 0,
      limitSize: 10240,
    })
  })

  it('supports getFileSystemManager read/write and USER_DATA_PATH', () => {
    const wxBridge = (globalThis as any).wx as {
      env?: {
        USER_DATA_PATH?: string
      }
    }
    expect(typeof wxBridge?.env?.USER_DATA_PATH).toBe('string')

    const fsManager = getFileSystemManager()
    const filePath = `${wxBridge.env?.USER_DATA_PATH ?? ''}/demo.txt`
    const writeSuccess = vi.fn()
    const writeComplete = vi.fn()
    fsManager.writeFile({
      filePath,
      data: 'wevu demo',
      encoding: 'utf8',
      success: writeSuccess,
      complete: writeComplete,
    })
    expect(writeSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'writeFile:ok' }))
    expect(writeComplete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'writeFile:ok' }))

    const readSuccess = vi.fn()
    const readComplete = vi.fn()
    fsManager.readFile({
      filePath,
      encoding: 'utf8',
      success: readSuccess,
      complete: readComplete,
    })
    expect(readSuccess).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: 'readFile:ok',
      data: 'wevu demo',
    }))
    expect(readComplete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'readFile:ok' }))

    fsManager.writeFileSync(filePath, new Uint8Array([65, 66, 67]))
    const binary = fsManager.readFileSync(filePath) as ArrayBuffer
    expect(Array.from(new Uint8Array(binary))).toEqual([65, 66, 67])

    const fail = vi.fn()
    const missingFile = `${wxBridge.env?.USER_DATA_PATH ?? ''}/missing.txt`
    fsManager.readFile({
      filePath: missingFile,
      fail,
    })
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: expect.stringContaining('readFile:fail'),
    }))
  })

  it('supports createWorker with browser worker bridge', () => {
    class WorkerMock {
      static instances: WorkerMock[] = []
      messages: unknown[] = []
      terminated = false
      listeners = new Map<string, Array<(event: any) => void>>()

      constructor(public scriptPath: string) {
        WorkerMock.instances.push(this)
      }

      addEventListener(type: string, listener: (event: any) => void) {
        const list = this.listeners.get(type) ?? []
        list.push(listener)
        this.listeners.set(type, list)
      }

      postMessage(payload: unknown) {
        this.messages.push(payload)
      }

      terminate() {
        this.terminated = true
      }

      emit(type: string, payload: any) {
        const list = this.listeners.get(type) ?? []
        for (const listener of list) {
          listener(payload)
        }
      }
    }

    const restoreWorker = overrideGlobalProperty('Worker', WorkerMock as unknown as typeof Worker)
    const restoreLocation = overrideGlobalProperty('location', { href: 'https://example.com/pages/index.html' })
    try {
      const worker = createWorker('workers/echo.js')
      const onMessage = vi.fn()
      const onError = vi.fn()
      worker.onMessage(onMessage)
      worker.onError(onError)
      worker.postMessage({ hello: 'wevu' })
      const native = WorkerMock.instances[0]
      expect(native).toBeTruthy()
      expect(native.scriptPath).toBe('https://example.com/pages/workers/echo.js')
      expect(native.messages).toEqual([{ hello: 'wevu' }])

      native.emit('message', { data: { ok: true } })
      native.emit('error', { message: 'boom', filename: 'worker.js', lineno: 1, colno: 2 })

      expect(onMessage).toHaveBeenCalledWith({ data: { ok: true } })
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'boom',
        filename: 'worker.js',
      }))

      worker.terminate()
      expect(native.terminated).toBe(true)
    }
    finally {
      restoreWorker()
      restoreLocation()
    }
  })

  it('fails createWorker when Worker is unavailable', () => {
    const restoreWorker = overrideGlobalProperty('Worker', undefined)
    try {
      expect(() => createWorker('workers/echo.js')).toThrow(/createWorker:fail/)
    }
    finally {
      restoreWorker()
    }
  })

  it('supports request api with json response and failure path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: {
        get: (key: string) => key.toLowerCase() === 'content-type' ? 'application/json' : null,
        forEach: (callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type')
        },
      },
      json: async () => ({ ok: true }),
      text: async () => '{"ok":true}',
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    const restoreFetch = overrideGlobalProperty('fetch', fetchMock)
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await request({
        url: 'https://example.com/api',
        method: 'POST',
        data: { name: 'ice' },
        success,
        complete,
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({
        errMsg: 'request:ok',
        statusCode: 200,
        data: { ok: true },
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'request:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'request:ok' }))

      await expect(request({ url: '' })).rejects.toMatchObject({
        errMsg: expect.stringContaining('request:fail'),
      })
    }
    finally {
      restoreFetch()
    }
  })

  it('supports downloadFile api with fetch bridge', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      blob: async () => new Blob(['mock-binary']),
    })
    const runtimeURL = (globalThis as any).URL
    const createObjectURL = vi.fn(() => 'blob:mock-download')
    const restoreFetch = overrideGlobalProperty('fetch', fetchMock)
    const restoreURL = overrideGlobalProperty('URL', {
      ...runtimeURL,
      createObjectURL,
    })

    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await downloadFile({
        url: 'https://example.com/file.txt',
        success,
        complete,
      })
      expect(result).toMatchObject({
        errMsg: 'downloadFile:ok',
        tempFilePath: 'blob:mock-download',
        statusCode: 200,
      })
      expect(fetchMock).toHaveBeenCalledWith('https://example.com/file.txt', expect.objectContaining({
        method: 'GET',
      }))
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'downloadFile:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'downloadFile:ok' }))

      await expect(downloadFile({ url: '' })).rejects.toMatchObject({
        errMsg: expect.stringContaining('downloadFile:fail'),
      })
    }
    finally {
      restoreFetch()
      restoreURL()
    }
  })

  it('supports login and getAccountInfoSync', async () => {
    const success = vi.fn()
    const complete = vi.fn()
    const loginResult = await login({
      success,
      complete,
    })
    expect(loginResult.errMsg).toBe('login:ok')
    expect(loginResult.code).toContain('web_')
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'login:ok' }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'login:ok' }))

    const restoreLocation = overrideGlobalProperty('location', {
      hostname: 'example.com',
    })
    try {
      const accountInfo = getAccountInfoSync()
      expect(accountInfo).toMatchObject({
        miniProgram: {
          appId: 'web:example.com',
          envVersion: 'develop',
          version: '0.0.0-web',
        },
      })
      expect(accountInfo.plugin).toEqual({})
    }
    finally {
      restoreLocation()
    }
  })

  it('supports vibrateShort api with navigator bridge', async () => {
    const vibrate = vi.fn(() => true)
    const runtimeNavigator = (globalThis as any).navigator
    const restoreNavigator = overrideGlobalProperty('navigator', {
      ...runtimeNavigator,
      vibrate,
    })
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await vibrateShort({
        type: 'heavy',
        success,
        complete,
      })
      expect(result.errMsg).toBe('vibrateShort:ok')
      expect(vibrate).toHaveBeenCalledWith(30)
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'vibrateShort:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'vibrateShort:ok' }))
    }
    finally {
      restoreNavigator()
    }
  })

  it('fails vibrateShort when vibrate api is unavailable', async () => {
    const restoreNavigator = overrideGlobalProperty('navigator', undefined)
    try {
      await expect(vibrateShort()).rejects.toMatchObject({
        errMsg: expect.stringContaining('vibrateShort:fail'),
      })
    }
    finally {
      restoreNavigator()
    }
  })

  it('supports getBatteryInfo/getBatteryInfoSync', async () => {
    const runtimeNavigator = (globalThis as any).navigator
    const getBattery = vi.fn().mockResolvedValue({
      charging: true,
      level: 0.67,
    })
    const restoreNavigator = overrideGlobalProperty('navigator', {
      ...runtimeNavigator,
      getBattery,
    })
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await getBatteryInfo({
        success,
        complete,
      })
      expect(result).toMatchObject({
        errMsg: 'getBatteryInfo:ok',
        level: 67,
        isCharging: true,
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getBatteryInfo:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getBatteryInfo:ok' }))

      const syncResult = getBatteryInfoSync()
      expect(syncResult).toMatchObject({
        level: 67,
        isCharging: true,
      })
    }
    finally {
      restoreNavigator()
    }
  })

  it('supports getLocation with geolocation bridge', async () => {
    const getCurrentPosition = vi.fn((success: (position: any) => void) => {
      success({
        coords: {
          latitude: 31.2304,
          longitude: 121.4737,
          speed: 1.25,
          accuracy: 12,
          altitude: 6,
          altitudeAccuracy: 3,
        },
      })
    })
    const runtimeNavigator = (globalThis as any).navigator
    const restoreNavigator = overrideGlobalProperty('navigator', {
      ...runtimeNavigator,
      geolocation: {
        getCurrentPosition,
      },
    })
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await getLocation({
        type: 'gcj02',
        success,
        complete,
      })
      expect(result).toMatchObject({
        errMsg: 'getLocation:ok',
        latitude: 31.2304,
        longitude: 121.4737,
        speed: 1.25,
        accuracy: 12,
        altitude: 6,
        verticalAccuracy: 3,
        horizontalAccuracy: 12,
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getLocation:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getLocation:ok' }))
    }
    finally {
      restoreNavigator()
    }
  })

  it('fails getLocation when geolocation is unavailable', async () => {
    const runtimeNavigator = (globalThis as any).navigator
    const restoreNavigator = overrideGlobalProperty('navigator', {
      ...runtimeNavigator,
      geolocation: undefined,
    })
    try {
      await expect(getLocation()).rejects.toMatchObject({
        errMsg: expect.stringContaining('getLocation:fail'),
      })
    }
    finally {
      restoreNavigator()
    }
  })

  it('supports network type and status change subscriptions', async () => {
    const runtimeNavigator = (globalThis as any).navigator
    const globalListeners = new Map<string, Array<() => void>>()
    const addGlobalListener = vi.fn((type: string, listener: () => void) => {
      const list = globalListeners.get(type) ?? []
      list.push(listener)
      globalListeners.set(type, list)
    })
    const removeGlobalListener = vi.fn((type: string, listener: () => void) => {
      const list = globalListeners.get(type) ?? []
      globalListeners.set(type, list.filter(item => item !== listener))
    })
    const connection = {
      effectiveType: '4g',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    const navigatorMock = {
      ...runtimeNavigator,
      onLine: true,
      connection,
    }
    const restoreNavigator = overrideGlobalProperty('navigator', navigatorMock)
    const restoreAdd = overrideGlobalProperty('addEventListener', addGlobalListener)
    const restoreRemove = overrideGlobalProperty('removeEventListener', removeGlobalListener)
    try {
      const initial = await getNetworkType()
      expect(initial).toMatchObject({
        errMsg: 'getNetworkType:ok',
        isConnected: true,
        networkType: '4g',
      })

      const callback = vi.fn()
      onNetworkStatusChange(callback)
      expect(addGlobalListener).toHaveBeenCalledWith('online', expect.any(Function))
      expect(addGlobalListener).toHaveBeenCalledWith('offline', expect.any(Function))

      navigatorMock.onLine = false
      const offlineHandlers = globalListeners.get('offline') ?? []
      for (const handler of offlineHandlers) {
        handler()
      }
      expect(callback).toHaveBeenCalledWith({
        isConnected: false,
        networkType: 'none',
      })

      offNetworkStatusChange(callback)
      navigatorMock.onLine = true
      connection.effectiveType = '3g'
      const onlineHandlers = globalListeners.get('online') ?? []
      for (const handler of onlineHandlers) {
        handler()
      }
      expect(callback).toHaveBeenCalledTimes(1)
      offNetworkStatusChange()
    }
    finally {
      restoreNavigator()
      restoreAdd()
      restoreRemove()
    }
  })

  it('supports window resize subscriptions', () => {
    const windowListeners = new Map<string, Array<() => void>>()
    const runtimeWindow = (globalThis as any).window
    const windowMock = {
      ...runtimeWindow,
      innerWidth: 320,
      innerHeight: 600,
      addEventListener: vi.fn((type: string, listener: () => void) => {
        const list = windowListeners.get(type) ?? []
        list.push(listener)
        windowListeners.set(type, list)
      }),
    }
    const restoreWindow = overrideGlobalProperty('window', windowMock)

    try {
      const callback = vi.fn()
      onWindowResize(callback)
      expect(windowMock.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))

      windowMock.innerWidth = 375
      windowMock.innerHeight = 812
      for (const listener of windowListeners.get('resize') ?? []) {
        listener()
      }
      expect(callback).toHaveBeenCalledWith({
        size: {
          windowWidth: 375,
          windowHeight: 812,
        },
        windowWidth: 375,
        windowHeight: 812,
      })

      offWindowResize(callback)
      windowMock.innerWidth = 390
      windowMock.innerHeight = 844
      for (const listener of windowListeners.get('resize') ?? []) {
        listener()
      }
      expect(callback).toHaveBeenCalledTimes(1)
      offWindowResize()
    }
    finally {
      restoreWindow()
    }
  })

  it('supports canIUse api probing', () => {
    expect(canIUse('request')).toBe(true)
    expect(canIUse('wx.downloadFile')).toBe(true)
    expect(canIUse('wx.chooseImage')).toBe(true)
    expect(canIUse('wx.chooseMessageFile')).toBe(true)
    expect(canIUse('wx.previewImage')).toBe(true)
    expect(canIUse('wx.saveImageToPhotosAlbum')).toBe(true)
    expect(canIUse('wx.scanCode')).toBe(true)
    expect(canIUse('wx.vibrateShort')).toBe(true)
    expect(canIUse('wx.getBatteryInfo')).toBe(true)
    expect(canIUse('wx.getBatteryInfoSync')).toBe(true)
    expect(canIUse('wx.getLocation')).toBe(true)
    expect(canIUse('wx.login')).toBe(true)
    expect(canIUse('wx.getAccountInfoSync')).toBe(true)
    expect(canIUse('wx.getStorageSync')).toBe(true)
    expect(canIUse('wx.getFileSystemManager')).toBe(true)
    expect(canIUse('wx.getNetworkType')).toBe(true)
    expect(canIUse('wx.getDeviceInfo')).toBe(true)
    expect(canIUse('wx.getSystemSetting')).toBe(true)
    expect(canIUse('wx.getAppAuthorizeSetting')).toBe(true)
    expect(canIUse('wx.getSystemInfo')).toBe(true)
    expect(canIUse('wx.getWindowInfo')).toBe(true)
    expect(canIUse('wx.onWindowResize')).toBe(true)
    expect(canIUse('wx.offWindowResize')).toBe(true)
    expect(canIUse('wx.getLaunchOptionsSync')).toBe(true)
    expect(canIUse('wx.getEnterOptionsSync')).toBe(true)
    expect(canIUse('wx.navigateToMiniProgram')).toBe(true)
    expect(canIUse('wx.exitMiniProgram')).toBe(true)
    expect(canIUse('wx.openCustomerServiceChat')).toBe(true)
    expect(canIUse('wx.requestPayment')).toBe(true)
    expect(canIUse('wx.showShareMenu')).toBe(true)
    expect(canIUse('wx.updateShareMenu')).toBe(true)
    expect(canIUse('wx.showActionSheet')).toBe(true)
    expect(canIUse('wx.getExtConfigSync')).toBe(true)
    expect(canIUse('wx.getExtConfig')).toBe(true)
    expect(canIUse('wx.cloud')).toBe(true)
    expect(canIUse('wx.cloud.callFunction')).toBe(true)
    expect(canIUse('wx.openDocument')).toBe(true)
    expect(canIUse('wx.reportAnalytics')).toBe(true)
    expect(canIUse('wx.getAppBaseInfo')).toBe(true)
    expect(canIUse('wx.getMenuButtonBoundingClientRect')).toBe(true)
    expect(canIUse('wx.createCanvasContext')).toBe(true)
    expect(canIUse('wx.createSelectorQuery')).toBe(true)
    expect(canIUse('wx.createVKSession')).toBe(true)
    expect(canIUse('wx.createWorker')).toBe(true)
    expect(canIUse('wx.createRewardedVideoAd')).toBe(true)
    expect(canIUse('wx.createInterstitialAd')).toBe(true)
    expect(canIUse('wx.not-exists-api')).toBe(false)
  })

  it('supports mini program navigation and exit apis', async () => {
    const navigateSuccess = vi.fn()
    const navigateComplete = vi.fn()
    const navigateResult = await navigateToMiniProgram({
      appId: 'wx1234567890abcdef',
      success: navigateSuccess,
      complete: navigateComplete,
    })
    expect(navigateResult.errMsg).toBe('navigateToMiniProgram:ok')
    expect(navigateSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'navigateToMiniProgram:ok' }))
    expect(navigateComplete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'navigateToMiniProgram:ok' }))

    await expect(navigateToMiniProgram({ appId: '' })).rejects.toMatchObject({
      errMsg: expect.stringContaining('navigateToMiniProgram:fail'),
    })

    const exitSuccess = vi.fn()
    const exitResult = await exitMiniProgram({ success: exitSuccess })
    expect(exitResult.errMsg).toBe('exitMiniProgram:ok')
    expect(exitSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'exitMiniProgram:ok' }))
  })

  it('supports openCustomerServiceChat and requestPayment', async () => {
    const open = vi.fn()
    const runtimeWindow = (globalThis as any).window
    const restoreWindow = overrideGlobalProperty('window', {
      ...runtimeWindow,
      open,
    })
    try {
      const chatSuccess = vi.fn()
      const chatResult = await openCustomerServiceChat({
        corpId: 'corp',
        url: 'https://work.weixin.qq.com/',
        success: chatSuccess,
      })
      expect(chatResult.errMsg).toBe('openCustomerServiceChat:ok')
      expect(open).toHaveBeenCalledWith('https://work.weixin.qq.com/', '_blank', 'noopener,noreferrer')
      expect(chatSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'openCustomerServiceChat:ok' }))

      const paymentSuccess = vi.fn()
      const paymentComplete = vi.fn()
      const paymentResult = await requestPayment({
        timeStamp: '0',
        nonceStr: 'demo',
        package: 'prepay_id=demo',
        signType: 'MD5',
        paySign: 'demo',
        success: paymentSuccess,
        complete: paymentComplete,
      })
      expect(paymentResult.errMsg).toBe('requestPayment:ok')
      expect(paymentSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'requestPayment:ok' }))
      expect(paymentComplete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'requestPayment:ok' }))
    }
    finally {
      restoreWindow()
    }
  })

  it('supports share menu apis with callbacks', async () => {
    const showSuccess = vi.fn()
    const showComplete = vi.fn()
    const showResult = await showShareMenu({
      withShareTicket: true,
      success: showSuccess,
      complete: showComplete,
    })
    expect(showResult.errMsg).toBe('showShareMenu:ok')
    expect(showSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showShareMenu:ok' }))
    expect(showComplete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showShareMenu:ok' }))

    const updateSuccess = vi.fn()
    const updateComplete = vi.fn()
    const updateResult = await updateShareMenu({
      withShareTicket: true,
      success: updateSuccess,
      complete: updateComplete,
    })
    expect(updateResult.errMsg).toBe('updateShareMenu:ok')
    expect(updateSuccess).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'updateShareMenu:ok' }))
    expect(updateComplete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'updateShareMenu:ok' }))
  })

  it('supports showActionSheet with selection and cancel path', async () => {
    const prompt = vi
      .fn()
      .mockReturnValueOnce('1')
      .mockReturnValueOnce(null)
    const restorePrompt = overrideGlobalProperty('prompt', prompt)
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const selected = await showActionSheet({
        itemList: ['复制链接', '打开页面'],
        success,
        complete,
      })
      expect(selected).toMatchObject({
        errMsg: 'showActionSheet:ok',
        tapIndex: 1,
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showActionSheet:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showActionSheet:ok' }))

      await expect(showActionSheet({
        itemList: ['A', 'B'],
      })).rejects.toMatchObject({
        errMsg: expect.stringContaining('showActionSheet:fail'),
      })

      await expect(showActionSheet({
        itemList: [],
      })).rejects.toMatchObject({
        errMsg: expect.stringContaining('showActionSheet:fail'),
      })
    }
    finally {
      restorePrompt()
    }
  })

  it('supports openDocument with url and memory file', async () => {
    const runtimeWindow = (globalThis as any).window
    const open = vi.fn()
    const restoreWindow = overrideGlobalProperty('window', {
      ...runtimeWindow,
      open,
    })
    try {
      const fsManager = getFileSystemManager()
      const userDataPath = ((globalThis as any).wx?.env?.USER_DATA_PATH as string) ?? '/__weapp_vite_web_user_data__'
      const memoryFilePath = `${userDataPath}/doc.txt`
      fsManager.writeFileSync(memoryFilePath, 'hello document')

      const memoryResult = await openDocument({ filePath: memoryFilePath })
      expect(memoryResult.errMsg).toBe('openDocument:ok')
      expect(open).toHaveBeenCalledTimes(1)
      expect(typeof open.mock.calls[0]?.[0]).toBe('string')

      const urlResult = await openDocument({
        filePath: 'https://example.com/doc.pdf',
      })
      expect(urlResult.errMsg).toBe('openDocument:ok')
      expect(open).toHaveBeenCalledWith('https://example.com/doc.pdf', '_blank', 'noopener,noreferrer')

      await expect(openDocument({ filePath: '' })).rejects.toMatchObject({
        errMsg: expect.stringContaining('openDocument:fail'),
      })
    }
    finally {
      restoreWindow()
    }
  })

  it('supports getExtConfigSync/getExtConfig', async () => {
    const restoreExtConfig = overrideGlobalProperty('__weappViteWebExtConfig', {
      mode: 'demo',
      channel: 'web',
    })
    try {
      const syncConfig = getExtConfigSync()
      expect(syncConfig).toEqual({
        mode: 'demo',
        channel: 'web',
      })

      const success = vi.fn()
      const result = await getExtConfig({ success })
      expect(result).toMatchObject({
        errMsg: 'getExtConfig:ok',
        extConfig: {
          mode: 'demo',
          channel: 'web',
        },
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getExtConfig:ok' }))
    }
    finally {
      restoreExtConfig()
    }
  })

  it('supports reportAnalytics in runtime memory', () => {
    const restoreAnalyticsEvents = overrideGlobalProperty('__weappViteWebAnalyticsEvents', [])
    try {
      reportAnalytics('wevu_demo', {
        action: 'tap',
        time: 123,
      })
      const events = (globalThis as any).__weappViteWebAnalyticsEvents as Array<{
        eventName: string
        data: Record<string, unknown>
      }>
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        eventName: 'wevu_demo',
        data: {
          action: 'tap',
          time: 123,
        },
      })
    }
    finally {
      restoreAnalyticsEvents()
    }
  })

  it('supports createVKSession lifecycle bridge', async () => {
    const session = createVKSession({})
    session.on('updateAnchors', () => {})
    session.off('updateAnchors')
    await expect(session.start()).resolves.toMatchObject({
      errMsg: 'vkSession.start:ok',
    })
    await expect(session.stop()).resolves.toMatchObject({
      errMsg: 'vkSession.stop:ok',
    })

    session.destroy()
    await expect(session.start()).rejects.toThrow(/createVKSession:fail/)
  })

  it('supports wx.cloud init and callFunction bridge', async () => {
    const wxBridge = (globalThis as any).wx as {
      cloud?: {
        init?: (options?: { env?: string, traceUser?: boolean }) => void
        callFunction?: (options?: {
          name?: string
          data?: Record<string, unknown>
          success?: (result: any) => void
          fail?: (result: any) => void
          complete?: (result: any) => void
        }) => Promise<any>
      }
    }
    expect(typeof wxBridge.cloud?.init).toBe('function')
    expect(typeof wxBridge.cloud?.callFunction).toBe('function')

    wxBridge.cloud?.init?.({
      env: 'test-env',
      traceUser: true,
    })

    const success = vi.fn()
    const complete = vi.fn()
    const result = await wxBridge.cloud?.callFunction?.({
      name: 'demo',
      data: { from: 'wevu' },
      success,
      complete,
    })

    expect(result).toMatchObject({
      errMsg: 'cloud.callFunction:ok',
      result: {
        name: 'demo',
        data: { from: 'wevu' },
        env: 'test-env',
        traceUser: true,
        mock: true,
      },
    })
    expect(typeof result.requestID).toBe('string')
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'cloud.callFunction:ok' }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'cloud.callFunction:ok' }))

    const fail = vi.fn()
    await expect(wxBridge.cloud?.callFunction?.({
      name: '',
      fail,
    })).rejects.toMatchObject({
      errMsg: expect.stringContaining('cloud.callFunction:fail'),
    })
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: expect.stringContaining('cloud.callFunction:fail'),
    }))
  })

  it('supports createSelectorQuery with scoped select and viewport query', () => {
    const host = document.createElement('div') as HTMLElement & { renderRoot?: ShadowRoot | HTMLElement }
    const shadow = host.attachShadow({ mode: 'open' })
    const probe = document.createElement('div')
    probe.setAttribute('class', 'query-probe')
    probe.setAttribute('id', 'query-probe-id')
    probe.setAttribute('data-role', 'probe')
    ;(probe as any).scrollTop = 24
    ;(probe as any).getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      right: 110,
      bottom: 80,
      width: 100,
      height: 60,
    })
    shadow.appendChild(probe)
    host.renderRoot = shadow
    document.body.appendChild(host)

    const restoreWindow = overrideGlobalProperty('window', {
      innerWidth: 375,
      innerHeight: 667,
      pageXOffset: 6,
      pageYOffset: 18,
    })

    try {
      const fieldCallback = vi.fn()
      const viewportCallback = vi.fn()
      const execCallback = vi.fn()

      createSelectorQuery()
        .in(host)
        .select('.query-probe')
        .fields({
          id: true,
          dataset: true,
          rect: true,
          size: true,
          scrollOffset: true,
        }, fieldCallback)
        .selectViewport()
        .scrollOffset(viewportCallback)
        .exec(execCallback)

      expect(fieldCallback).toHaveBeenCalledWith(expect.objectContaining({
        id: 'query-probe-id',
        dataset: { role: 'probe' },
        left: 10,
        top: 20,
        right: 110,
        bottom: 80,
        width: 100,
        height: 60,
        scrollTop: 24,
      }))
      expect(viewportCallback).toHaveBeenCalledWith({
        scrollLeft: 6,
        scrollTop: 18,
      })
      expect(execCallback).toHaveBeenCalledTimes(1)
      expect(execCallback.mock.calls[0]?.[0]).toHaveLength(2)
    }
    finally {
      restoreWindow()
      if (host.parentNode) {
        host.parentNode.removeChild(host)
      }
    }
  })

  it('supports createCanvasContext drawing commands', () => {
    const canvas = document.createElement('canvas') as HTMLCanvasElement & {
      width: number
      height: number
      getContext: (type: string) => CanvasRenderingContext2D | null
    }
    canvas.setAttribute('canvas-id', 'demoCanvas')
    canvas.width = 300
    canvas.height = 220

    const clearRect = vi.fn()
    const fillRect = vi.fn()
    const strokeRect = vi.fn()
    const fillText = vi.fn()
    const beginPath = vi.fn()
    const moveTo = vi.fn()
    const lineTo = vi.fn()
    const stroke = vi.fn()
    const closePath = vi.fn()
    const runtimeContext = {
      clearRect,
      fillRect,
      strokeRect,
      fillText,
      beginPath,
      moveTo,
      lineTo,
      stroke,
      closePath,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
    } as unknown as CanvasRenderingContext2D
    const getContext = vi.fn(() => runtimeContext)
    canvas.getContext = getContext
    document.body.append(canvas)

    try {
      const context = createCanvasContext('demoCanvas')
      context.setFillStyle('#273277')
      context.fillRect(20, 20, 140, 80)
      context.setStrokeStyle('#f59e0b')
      context.setLineWidth(4)
      context.strokeRect(20, 120, 200, 90)
      context.setFontSize(20)
      context.fillText('WeVU Canvas', 24, 170)
      context.beginPath()
      context.moveTo(20, 200)
      context.lineTo(220, 200)
      context.stroke()
      context.closePath()
      context.draw()

      expect(getContext).toHaveBeenCalledWith('2d')
      expect(clearRect).toHaveBeenCalledWith(0, 0, 300, 220)
      expect(fillRect).toHaveBeenCalledWith(20, 20, 140, 80)
      expect(strokeRect).toHaveBeenCalledWith(20, 120, 200, 90)
      expect(fillText).toHaveBeenCalledWith('WeVU Canvas', 24, 170)
      expect(beginPath).toHaveBeenCalledTimes(1)
      expect(moveTo).toHaveBeenCalledWith(20, 200)
      expect(lineTo).toHaveBeenCalledWith(220, 200)
      expect(stroke).toHaveBeenCalledTimes(1)
      expect(closePath).toHaveBeenCalledTimes(1)

      const done = vi.fn()
      context.draw(true, done)
      expect(done).toHaveBeenCalledTimes(1)
    }
    finally {
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
    }
  })

  it('supports rewarded and interstitial ad bridge apis', async () => {
    const rewarded = createRewardedVideoAd({ adUnitId: 'adunit-rewarded' })
    const rewardedOnLoad = vi.fn()
    const rewardedOnClose = vi.fn()
    rewarded.onLoad(rewardedOnLoad)
    rewarded.onClose(rewardedOnClose)

    await expect(rewarded.load()).resolves.toMatchObject({ errMsg: 'RewardedVideoAd.load:ok' })
    await expect(rewarded.show()).resolves.toMatchObject({ errMsg: 'RewardedVideoAd.show:ok' })
    expect(rewardedOnLoad).toHaveBeenCalledTimes(1)
    expect(rewardedOnClose).toHaveBeenCalledWith({ isEnded: true })

    const interstitial = createInterstitialAd({ adUnitId: '' })
    const interstitialOnError = vi.fn()
    interstitial.onError(interstitialOnError)
    await expect(interstitial.load()).rejects.toMatchObject({
      errMsg: expect.stringContaining('InterstitialAd.load:fail'),
    })
    expect(interstitialOnError).toHaveBeenCalledWith(expect.objectContaining({
      errMsg: expect.stringContaining('InterstitialAd.load:fail'),
      errCode: -1,
    }))
  })

  it('supports nextTick callback scheduling', async () => {
    const calls: string[] = []
    nextTick(() => {
      calls.push('tick')
    })
    calls.push('sync')
    await Promise.resolve()
    expect(calls).toEqual(['sync', 'tick'])
  })

  it('supports stopPullDownRefresh and pageScrollTo', async () => {
    const success = vi.fn()
    const complete = vi.fn()
    const stopResult = await stopPullDownRefresh({
      success,
      complete,
    })
    expect(stopResult.errMsg).toBe('stopPullDownRefresh:ok')
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'stopPullDownRefresh:ok' }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'stopPullDownRefresh:ok' }))

    const scrollTo = vi.fn()
    const runtimeWindow = (globalThis as any).window
    const restoreWindow = overrideGlobalProperty('window', {
      ...runtimeWindow,
      scrollTo,
    })
    try {
      const scrollResult = await pageScrollTo({
        scrollTop: 128,
        duration: 0,
      })
      expect(scrollResult.errMsg).toBe('pageScrollTo:ok')
      expect(scrollTo).toHaveBeenCalledWith(0, 128)
    }
    finally {
      restoreWindow()
    }
  })

  it('shows and hides loading overlay', async () => {
    const success = vi.fn()
    const complete = vi.fn()
    const shown = await showLoading({
      title: '处理中',
      mask: true,
      success,
      complete,
    })

    expect(shown.errMsg).toBe('showLoading:ok')
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showLoading:ok' }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showLoading:ok' }))

    const loading = document.querySelector('#__weapp_vite_web_loading__') as HTMLElement | null
    expect(loading).toBeTruthy()
    expect(loading?.hasAttribute('hidden')).toBe(false)
    expect(loading?.textContent).toContain('处理中')

    const hidden = await hideLoading()
    expect(hidden.errMsg).toBe('hideLoading:ok')
    expect(loading?.hasAttribute('hidden')).toBe(true)
  })

  it('resolves showModal based on confirm return value', async () => {
    const confirmSpy = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
    const restoreConfirm = overrideGlobalProperty('confirm', confirmSpy)

    try {
      const first = await showModal({
        title: '确认操作',
        content: '继续执行？',
      })
      expect(first).toMatchObject({
        errMsg: 'showModal:ok',
        confirm: true,
        cancel: false,
      })

      const second = await showModal({
        title: '确认操作',
        content: '放弃执行？',
      })
      expect(second).toMatchObject({
        errMsg: 'showModal:ok',
        confirm: false,
        cancel: true,
      })
      expect(confirmSpy).toHaveBeenCalledTimes(2)
    }
    finally {
      restoreConfirm()
    }
  })

  it('supports previewImage with browser window fallback', async () => {
    const open = vi.fn()
    const runtimeWindow = (globalThis as any).window
    const restoreWindow = overrideGlobalProperty('window', {
      ...runtimeWindow,
      open,
    })

    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await previewImage({
        urls: ['https://example.com/a.png', 'https://example.com/b.png'],
        current: 'https://example.com/b.png',
        success,
        complete,
      })
      expect(result.errMsg).toBe('previewImage:ok')
      expect(open).toHaveBeenCalledWith('https://example.com/b.png', '_blank', 'noopener,noreferrer')
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'previewImage:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'previewImage:ok' }))

      await expect(previewImage({ urls: [] })).rejects.toMatchObject({
        errMsg: expect.stringContaining('previewImage:fail'),
      })
    }
    finally {
      restoreWindow()
    }
  })

  it('supports chooseImage via showOpenFilePicker bridge', async () => {
    const runtimeURL = (globalThis as any).URL
    const createObjectURL = vi.fn((file: { name?: string }) => `blob:${file.name ?? 'mock'}`)
    const showOpenFilePicker = vi.fn().mockResolvedValue([
      { getFile: vi.fn().mockResolvedValue({ name: 'a.png', size: 12, type: 'image/png' }) },
      { getFile: vi.fn().mockResolvedValue({ name: 'b.jpg', size: 34, type: 'image/jpeg' }) },
    ])
    const restoreURL = overrideGlobalProperty('URL', {
      ...runtimeURL,
      createObjectURL,
    })
    const restorePicker = overrideGlobalProperty('showOpenFilePicker', showOpenFilePicker)

    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await chooseImage({
        count: 2,
        success,
        complete,
      })
      expect(showOpenFilePicker).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({
        errMsg: 'chooseImage:ok',
        tempFilePaths: ['blob:a.png', 'blob:b.jpg'],
      })
      expect(result.tempFiles).toEqual([
        expect.objectContaining({
          path: 'blob:a.png',
          name: 'a.png',
          size: 12,
          type: 'image/png',
        }),
        expect.objectContaining({
          path: 'blob:b.jpg',
          name: 'b.jpg',
          size: 34,
          type: 'image/jpeg',
        }),
      ])
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'chooseImage:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'chooseImage:ok' }))
    }
    finally {
      restoreURL()
      restorePicker()
    }
  })

  it('fails chooseImage when picker is unavailable', async () => {
    const restorePicker = overrideGlobalProperty('showOpenFilePicker', undefined)
    const restoreDocument = overrideGlobalProperty('document', undefined)
    try {
      await expect(chooseImage()).rejects.toMatchObject({
        errMsg: expect.stringContaining('chooseImage:fail'),
      })
    }
    finally {
      restorePicker()
      restoreDocument()
    }
  })

  it('supports chooseMessageFile via showOpenFilePicker bridge', async () => {
    const runtimeURL = (globalThis as any).URL
    const createObjectURL = vi.fn((file: { name?: string }) => `blob:${file.name ?? 'mock'}`)
    const showOpenFilePicker = vi.fn().mockResolvedValue([
      { getFile: vi.fn().mockResolvedValue({ name: 'a.txt', size: 12, type: 'text/plain', lastModified: 1700000000000 }) },
      { getFile: vi.fn().mockResolvedValue({ name: 'b.pdf', size: 34, type: 'application/pdf', lastModified: 1700000001000 }) },
    ])
    const restoreURL = overrideGlobalProperty('URL', {
      ...runtimeURL,
      createObjectURL,
    })
    const restorePicker = overrideGlobalProperty('showOpenFilePicker', showOpenFilePicker)

    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await chooseMessageFile({
        count: 2,
        type: 'file',
        success,
        complete,
      })
      expect(showOpenFilePicker).toHaveBeenCalledTimes(1)
      expect(result.errMsg).toBe('chooseMessageFile:ok')
      expect(result.tempFiles).toEqual([
        expect.objectContaining({
          path: 'blob:a.txt',
          name: 'a.txt',
          size: 12,
          type: 'text/plain',
          time: 1700000000000,
        }),
        expect.objectContaining({
          path: 'blob:b.pdf',
          name: 'b.pdf',
          size: 34,
          type: 'application/pdf',
          time: 1700000001000,
        }),
      ])
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'chooseMessageFile:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'chooseMessageFile:ok' }))
    }
    finally {
      restoreURL()
      restorePicker()
    }
  })

  it('fails chooseMessageFile when picker is unavailable', async () => {
    const restorePicker = overrideGlobalProperty('showOpenFilePicker', undefined)
    const restoreDocument = overrideGlobalProperty('document', undefined)
    try {
      await expect(chooseMessageFile()).rejects.toMatchObject({
        errMsg: expect.stringContaining('chooseMessageFile:fail'),
      })
    }
    finally {
      restorePicker()
      restoreDocument()
    }
  })

  it('supports saveImageToPhotosAlbum success and failure paths', async () => {
    const success = vi.fn()
    const complete = vi.fn()
    const result = await saveImageToPhotosAlbum({
      filePath: 'https://example.com/a.png',
      success,
      complete,
    })
    expect(result.errMsg).toBe('saveImageToPhotosAlbum:ok')
    expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'saveImageToPhotosAlbum:ok' }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'saveImageToPhotosAlbum:ok' }))

    await expect(saveImageToPhotosAlbum({
      filePath: '',
    })).rejects.toMatchObject({
      errMsg: expect.stringContaining('saveImageToPhotosAlbum:fail'),
    })
  })

  it('supports scanCode with prompt fallback', async () => {
    const promptSpy = vi
      .fn()
      .mockReturnValueOnce('https://example.com/qrcode')
      .mockReturnValueOnce(null)
    const restorePrompt = overrideGlobalProperty('prompt', promptSpy)
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const scanned = await scanCode({
        success,
        complete,
      })
      expect(scanned).toMatchObject({
        errMsg: 'scanCode:ok',
        result: 'https://example.com/qrcode',
        scanType: 'QR_CODE',
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'scanCode:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'scanCode:ok' }))

      await expect(scanCode()).rejects.toMatchObject({
        errMsg: expect.stringContaining('scanCode:fail'),
      })
    }
    finally {
      restorePrompt()
    }
  })

  it('uses alert path when showCancel is false', async () => {
    const alertSpy = vi.fn()
    const confirmSpy = vi.fn()
    const restoreAlert = overrideGlobalProperty('alert', alertSpy)
    const restoreConfirm = overrideGlobalProperty('confirm', confirmSpy)
    try {
      const result = await showModal({
        title: '提示',
        content: '仅展示信息',
        showCancel: false,
      })
      expect(result).toMatchObject({
        errMsg: 'showModal:ok',
        confirm: true,
        cancel: false,
      })
      expect(alertSpy).toHaveBeenCalledTimes(1)
      expect(confirmSpy).not.toHaveBeenCalled()
    }
    finally {
      restoreAlert()
      restoreConfirm()
    }
  })

  it('shows toast and auto hides by duration', async () => {
    vi.useFakeTimers()
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await showToast({
        title: '保存成功',
        duration: 80,
        success,
        complete,
      })

      expect(result.errMsg).toBe('showToast:ok')
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showToast:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'showToast:ok' }))

      const toast = document.querySelector('#__weapp_vite_web_toast__') as HTMLElement | null
      expect(toast).toBeTruthy()
      expect(toast?.hasAttribute('hidden')).toBe(false)
      expect(toast?.textContent).toContain('保存成功')

      vi.advanceTimersByTime(100)
      expect(toast?.hasAttribute('hidden')).toBe(true)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('writes clipboard by navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const runtimeNavigator = (globalThis as any).navigator
    const restoreNavigator = overrideGlobalProperty('navigator', {
      ...runtimeNavigator,
      clipboard: { writeText },
    })
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await setClipboardData({
        data: 'from-clipboard-api',
        success,
        complete,
      })
      expect(result.errMsg).toBe('setClipboardData:ok')
      expect(writeText).toHaveBeenCalledWith('from-clipboard-api')
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'setClipboardData:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'setClipboardData:ok' }))
    }
    finally {
      restoreNavigator()
    }
  })

  it('reads clipboard via navigator.clipboard.readText', async () => {
    const readText = vi.fn().mockResolvedValue('from-clipboard-api')
    const runtimeNavigator = (globalThis as any).navigator
    const restoreNavigator = overrideGlobalProperty('navigator', {
      ...runtimeNavigator,
      clipboard: { readText },
    })
    try {
      const success = vi.fn()
      const result = await getClipboardData({
        success,
      })
      expect(result).toMatchObject({
        errMsg: 'getClipboardData:ok',
        data: 'from-clipboard-api',
      })
      expect(readText).toHaveBeenCalledTimes(1)
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getClipboardData:ok' }))
    }
    finally {
      restoreNavigator()
    }
  })

  it('fails getClipboardData when clipboard api is unavailable', async () => {
    const restoreNavigator = overrideGlobalProperty('navigator', undefined)
    try {
      await expect(getClipboardData()).rejects.toMatchObject({
        errMsg: expect.stringContaining('getClipboardData:fail'),
      })
    }
    finally {
      restoreNavigator()
    }
  })

  it('falls back to document.execCommand for clipboard copy', async () => {
    const restoreNavigator = overrideGlobalProperty('navigator', undefined)

    const execCommand = vi.fn(() => true)
    const previousExecCommand = (document as any).execCommand
    ;(document as any).execCommand = execCommand

    try {
      const result = await setClipboardData({ data: 'from-exec-command' })
      expect(result.errMsg).toBe('setClipboardData:ok')
      expect(execCommand).toHaveBeenCalledWith('copy')
    }
    finally {
      restoreNavigator()
      ;(document as any).execCommand = previousExecCommand
    }
  })

  it('returns merged system info from browser globals', () => {
    const restoreNavigator = overrideGlobalProperty('navigator', {
      language: 'zh-CN',
      platform: 'iPhone',
      appVersion: 'MockVersion',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    })
    const restoreWindow = overrideGlobalProperty('window', {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 3,
    })
    const restoreScreen = overrideGlobalProperty('screen', {
      width: 430,
      height: 932,
    })

    try {
      const info = getSystemInfoSync()
      expect(info).toMatchObject({
        brand: 'web',
        platform: 'ios',
        language: 'zh-CN',
        windowWidth: 390,
        windowHeight: 844,
        screenWidth: 430,
        screenHeight: 932,
        pixelRatio: 3,
      })
      expect(info.system).toBe('iOS')
    }
    finally {
      restoreNavigator()
      restoreWindow()
      restoreScreen()
    }
  })

  it('supports getSystemInfo async wrapper', async () => {
    const restoreNavigator = overrideGlobalProperty('navigator', {
      language: 'zh-CN',
      platform: 'Win32',
      appVersion: 'MockVersion',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    })
    const restoreWindow = overrideGlobalProperty('window', {
      innerWidth: 1440,
      innerHeight: 900,
      devicePixelRatio: 2,
    })
    const restoreScreen = overrideGlobalProperty('screen', {
      width: 1920,
      height: 1080,
    })
    try {
      const success = vi.fn()
      const complete = vi.fn()
      const result = await getSystemInfo({
        success,
        complete,
      })
      expect(result).toMatchObject({
        errMsg: 'getSystemInfo:ok',
        platform: 'windows',
        language: 'zh-CN',
        windowWidth: 1440,
        windowHeight: 900,
      })
      expect(success).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getSystemInfo:ok' }))
      expect(complete).toHaveBeenCalledWith(expect.objectContaining({ errMsg: 'getSystemInfo:ok' }))
    }
    finally {
      restoreNavigator()
      restoreWindow()
      restoreScreen()
    }
  })

  it('supports getAppBaseInfo/getWindowInfo/getMenuButtonBoundingClientRect', () => {
    const restoreNavigator = overrideGlobalProperty('navigator', {
      language: 'zh-CN',
      appVersion: 'MockVersion',
      userAgent: 'MockUA',
      platform: 'MacIntel',
    })
    const restoreWindow = overrideGlobalProperty('window', {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 3,
      matchMedia: vi.fn(() => ({ matches: true })),
    })
    const restoreScreen = overrideGlobalProperty('screen', {
      width: 430,
      height: 932,
    })
    try {
      const appBaseInfo = getAppBaseInfo()
      expect(appBaseInfo).toMatchObject({
        SDKVersion: 'web',
        language: 'zh-CN',
        version: 'MockVersion',
        platform: 'mac',
        enableDebug: false,
        theme: 'dark',
      })

      const windowInfo = getWindowInfo()
      expect(windowInfo).toMatchObject({
        pixelRatio: 3,
        screenWidth: 430,
        screenHeight: 932,
        windowWidth: 390,
        windowHeight: 844,
        statusBarHeight: 0,
        screenTop: 0,
        safeArea: {
          left: 0,
          right: 390,
          top: 0,
          bottom: 844,
          width: 390,
          height: 844,
        },
      })

      const menuRect = getMenuButtonBoundingClientRect()
      expect(menuRect).toMatchObject({
        width: 88,
        height: 32,
        top: 6,
        right: 382,
        bottom: 38,
        left: 294,
      })
    }
    finally {
      restoreNavigator()
      restoreWindow()
      restoreScreen()
    }
  })

  it('supports getDeviceInfo/getSystemSetting/getAppAuthorizeSetting', () => {
    const restoreNavigator = overrideGlobalProperty('navigator', {
      language: 'zh-CN',
      appVersion: 'MockVersion',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      deviceMemory: 8,
    })
    const restoreWindow = overrideGlobalProperty('window', {
      innerWidth: 932,
      innerHeight: 430,
      devicePixelRatio: 2,
    })
    const restoreScreen = overrideGlobalProperty('screen', {
      width: 932,
      height: 430,
    })
    try {
      const deviceInfo = getDeviceInfo()
      expect(deviceInfo).toMatchObject({
        brand: 'web',
        platform: 'mac',
        memorySize: 8192,
        benchmarkLevel: -1,
        abi: 'web',
        deviceOrientation: 'landscape',
      })

      const systemSetting = getSystemSetting()
      expect(systemSetting).toEqual({
        bluetoothEnabled: false,
        wifiEnabled: true,
        locationEnabled: false,
        locationReducedAccuracy: false,
        deviceOrientation: 'landscape',
      })

      const appAuthorizeSetting = getAppAuthorizeSetting()
      expect(appAuthorizeSetting).toEqual({
        albumAuthorized: 'not determined',
        bluetoothAuthorized: 'not determined',
        cameraAuthorized: 'not determined',
        locationAuthorized: 'not determined',
        microphoneAuthorized: 'not determined',
        notificationAuthorized: 'not determined',
        phoneCalendarAuthorized: 'not determined',
      })
    }
    finally {
      restoreNavigator()
      restoreWindow()
      restoreScreen()
    }
  })

  it('supports getLaunchOptionsSync/getEnterOptionsSync', () => {
    registerPage(undefined, {
      id: 'pages/launch-options/index',
      template: createTemplate('<view>launch-options</view>'),
    })
    registerApp({}, { id: 'app' })
    initializePageRoutes(['pages/launch-options/index'])

    const launchOptions = getLaunchOptionsSync()
    expect(launchOptions).toMatchObject({
      scene: 0,
      query: {},
      referrerInfo: {},
    })
    expect(typeof launchOptions.path).toBe('string')

    const enterOptions = getEnterOptionsSync()
    expect(enterOptions).toMatchObject({
      scene: 0,
      query: {},
      referrerInfo: {},
    })
    expect(enterOptions.path).toBe(launchOptions.path)
  })
})
