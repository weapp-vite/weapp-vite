import type { ComponentPublicInstance } from '../../component'
import type { PageRecord, PageStackEntry } from './options'
import { attachRouteMeta } from './lifecycle'

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

function ensureContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector('#app') as HTMLElement | null
  if (existing) {
    return existing
  }
  if (!document.body) {
    return undefined
  }
  const container = document.createElement('div')
  container.setAttribute('id', 'app')
  document.body.append(container)
  return container
}

export function getPageContainer() {
  if (typeof document === 'undefined') {
    return undefined
  }
  return document.querySelector('#app') as HTMLElement | null ?? undefined
}

export function captureEntryScrollPosition(entry: PageStackEntry) {
  if (!entry.active) {
    return
  }
  const container = getPageContainer()
  if (container) {
    entry.scrollTop = container.scrollTop
  }
}

export function restoreEntryScrollPosition(entry: PageStackEntry) {
  const container = getPageContainer()
  if (container) {
    container.scrollTop = entry.scrollTop ?? 0
  }
}

function applyEntryVisibility(entry: PageStackEntry) {
  const element = entry.element
  if (!element) {
    return
  }
  element.setAttribute('data-weapp-page-active', entry.active ? 'true' : 'false')
  if (entry.active) {
    element.removeAttribute('hidden')
    element.removeAttribute('aria-hidden')
    return
  }
  element.setAttribute('hidden', '')
  element.setAttribute('aria-hidden', 'true')
}

export function setEntryActiveInDom(entry: PageStackEntry, active: boolean) {
  entry.active = active
  applyEntryVisibility(entry)
}

export function unmountEntryFromDom(entry: PageStackEntry) {
  const element = entry.element
  if (!element) {
    entry.instance = undefined
    return
  }
  if (element.parentNode) {
    element.parentNode.removeChild(element)
  }
  entry.element = undefined
  entry.instance = undefined
}

export function mountEntryToDom(
  entry: PageStackEntry,
  pageRegistry: Map<string, PageRecord>,
  onMounted: (entry: PageStackEntry) => void,
) {
  const record = pageRegistry.get(entry.id)
  if (!record || entry.element) {
    return
  }
  ensureDocumentReady(() => {
    const container = ensureContainer()
    if (!container) {
      return
    }
    const element = document.createElement(record.tag) as HTMLElement & ComponentPublicInstance
    element.setAttribute('data-weapp-page', entry.id)
    element.setAttribute('style', 'display:block;min-height:100%;')
    entry.element = element
    applyEntryVisibility(entry)
    attachRouteMeta(element, {
      id: entry.id,
      query: entry.query,
      entry,
    })
    container.append(element)
    if (entry.active) {
      restoreEntryScrollPosition(entry)
    }
    onMounted(entry)
  })
}
