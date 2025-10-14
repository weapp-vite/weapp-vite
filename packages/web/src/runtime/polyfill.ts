import type { TemplateRenderer } from './template'
import { defineComponent } from './component'

interface RegisterMeta {
  id: string
  template?: TemplateRenderer
  style?: string
}

interface PageRecord {
  tag: string
}

const pageRegistry = new Map<string, PageRecord>()
const componentRegistry = new Map<string, PageRecord>()
let pageOrder: string[] = []
let firstMounted = false

function slugify(id: string, prefix: string) {
  const normalized = id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${prefix}-${normalized || 'index'}`
}

function ensureDocumentReady(callback: () => void) {
  if (typeof document === 'undefined') {
    return
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => callback(), { once: true })
    return
  }
  callback()
}

function mountFirstPage() {
  if (firstMounted || !pageOrder.length) {
    return
  }
  const firstPageId = pageOrder[0]
  const record = pageRegistry.get(firstPageId)
  if (!record) {
    return
  }
  ensureDocumentReady(() => {
    const container = document.querySelector('#app') ?? document.body
    if (container) {
      container.innerHTML = ''
      const element = document.createElement(record.tag)
      container.append(element)
      firstMounted = true
    }
  })
}

export function initializePageRoutes(ids: string[]) {
  pageOrder = Array.from(new Set(ids))
  mountFirstPage()
}

export function registerPage(options: any, meta: RegisterMeta) {
  const tag = slugify(meta.id, 'wv-page')
  const template = meta.template ?? (() => '')
  defineComponent(tag, {
    template,
    style: meta.style,
    component: options,
  })
  pageRegistry.set(meta.id, { tag })
  mountFirstPage()
  return options
}

export function registerComponent(options: any, meta: RegisterMeta) {
  const tag = slugify(meta.id, 'wv-component')
  const template = meta.template ?? (() => '')
  defineComponent(tag, {
    template,
    style: meta.style,
    component: options,
  })
  componentRegistry.set(meta.id, { tag })
  return options
}

export function registerApp(options: any, _meta?: RegisterMeta) {
  return options
}
