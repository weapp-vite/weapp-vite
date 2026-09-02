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

  it('handles disabled, missing-document, missing-head, and title fallback states', () => {
    delete (globalThis as Record<string, unknown>).document
    delete (globalThis as Record<string, unknown>).window
    configureWebSeo({ description: 'missing' })
    syncWebDocumentHead({ title: 'missing' })
    setupWebResourceHints({ links: [{ href: '/missing.js', rel: 'preload' }] })
    resetWebDocumentHead()

    const documentRef = new FakeDocument()
    Object.assign(globalThis, { document: documentRef })
    configureWebSeo()
    syncWebDocumentHead({ title: 'disabled' })
    expect(documentRef.title).toBe('')

    configureWebSeo({ defaultTitle: 'Default', titleTemplate: ' - Web' })
    syncWebDocumentHead({})
    expect(documentRef.title).toBe('Default - Web')
    configureWebSeo({ enabled: true })
    syncWebDocumentHead({ route: 'pages/home' })
    expect(documentRef.title).toBe('pages/home')
    syncWebDocumentHead({})

    const headless = new FakeDocument()
    Object.defineProperty(headless, 'head', { configurable: true, value: undefined })
    Object.assign(globalThis, {
      document: headless,
      window: { location: { href: 'https://example.test/headless?query=1' } },
    })
    configureWebSeo({ description: 'headless' })
    syncWebDocumentHead({ title: 'Headless' })
    setupWebResourceHints({ links: [{ href: '/headless.js', rel: 'preload' }] })
    resetWebDocumentHead()
  })

  it('handles canonical URL capability and resource hint attribute matrices', () => {
    const documentRef = new FakeDocument()
    Object.assign(globalThis, { document: documentRef })
    configureWebSeo({ canonical: true })

    delete (globalThis as Record<string, unknown>).window
    syncWebDocumentHead({ title: 'No window' })
    Object.assign(globalThis, { window: { location: { href: 'not a valid URL' } } })
    syncWebDocumentHead({ title: 'Invalid URL' })
    configureWebSeo({ canonical: false })
    syncWebDocumentHead({ title: 'No canonical' })

    setupWebResourceHints()
    setupWebResourceHints({ links: [] })
    setupWebResourceHints({
      links: [
        null as any,
        {} as any,
        { href: '', rel: 'preload' },
        { href: '/missing-rel.js', rel: 1 as any },
        {
          as: 'script',
          crossOrigin: 'anonymous',
          href: '/runtime.js',
          rel: 'preload',
          type: 'text/javascript',
        },
        {
          as: 'script',
          crossOrigin: 'anonymous',
          href: '/runtime.js',
          rel: 'preload',
          type: 'text/javascript',
        },
      ],
    })
    const link = documentRef.head.querySelector('[href="/runtime.js"]')
    expect(link).toMatchObject({
      as: 'script',
      crossOrigin: 'anonymous',
      type: 'text/javascript',
    })
    resetWebDocumentHead()
    expect(documentRef.head.children.filter(child => child.removed)).not.toHaveLength(0)
  })
})
