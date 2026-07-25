import { afterEach, describe, expect, it } from 'vitest'
import {
  configureWebSeo,
  resetWebDocumentHead,
  setupWebResourceHints,
  syncWebDocumentHead,
  updateWebDocumentTitle,
} from '../src/runtime/seo'

class FakeElement {
  tagName: string
  children: FakeElement[] = []
  attributes = new Map<string, string>()
  content = ''
  rel = ''
  href = ''
  as = ''
  type = ''
  crossOrigin = ''
  removed = false

  constructor(tagName: string) {
    this.tagName = tagName
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  append(...nodes: FakeElement[]) {
    this.children.push(...nodes)
  }

  remove() {
    this.removed = true
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string) {
    return this.children.filter((child) => {
      const marker = selector.includes(`[data-weapp-web-head="weapp-web-runtime"]`)
      if (marker && child.getAttribute('data-weapp-web-head') !== 'weapp-web-runtime') {
        return false
      }
      const rel = selector.match(/\[rel="([^"]+)"\]/)?.[1]
      const href = selector.match(/\[href="([^"]+)"\]/)?.[1]
      const name = selector.match(/\[name="([^"]+)"\]/)?.[1]
      return (!rel || child.rel === rel)
        && (!href || child.href === href)
        && (!name || child.getAttribute('name') === name)
    })
  }
}

class FakeDocument {
  title = ''
  readyState = 'complete'
  head = new FakeElement('head')
  body = new FakeElement('body')

  createElement(tagName: string) {
    return new FakeElement(tagName)
  }
}

const originalDocument = (globalThis as Record<string, unknown>).document
const originalWindow = (globalThis as Record<string, unknown>).window

afterEach(() => {
  resetWebDocumentHead()
  if (originalDocument === undefined) {
    delete (globalThis as Record<string, unknown>).document
  }
  else {
    Object.assign(globalThis, { document: originalDocument })
  }
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window
  }
  else {
    Object.assign(globalThis, { window: originalWindow })
  }
})

describe('web runtime document head', () => {
  it('syncs route title, description, canonical and resource hints without duplicates', () => {
    const documentRef = new FakeDocument()
    Object.assign(globalThis, {
      document: documentRef,
      window: { location: { href: 'https://example.test/mini/pages/detail?sku=42#top' } },
    })

    configureWebSeo({
      defaultTitle: '商城',
      titleTemplate: '%s | Web Demo',
      description: '商品详情',
    })
    setupWebResourceHints({
      links: [
        { rel: 'preconnect', href: 'https://cdn.example.test' },
        { rel: 'preconnect', href: 'https://cdn.example.test' },
      ],
    })
    syncWebDocumentHead({ route: 'pages/detail/index', title: '详情' })

    expect(documentRef.title).toBe('详情 | Web Demo')
    expect(documentRef.head.querySelectorAll('[data-weapp-web-head="weapp-web-runtime"]').length).toBe(3)
    const description = documentRef.head.querySelector('[name="description"]')
    expect(description?.content).toBe('商品详情')
    const canonical = documentRef.head.querySelector('[rel="canonical"]')
    expect(canonical?.href).toBe('https://example.test/mini/pages/detail')
  })

  it('updates the active page title through the navigation bridge API', () => {
    const documentRef = new FakeDocument()
    Object.assign(globalThis, { document: documentRef })
    configureWebSeo({ enabled: true })

    updateWebDocumentTitle('新标题')

    expect(documentRef.title).toBe('新标题')
  })
})
