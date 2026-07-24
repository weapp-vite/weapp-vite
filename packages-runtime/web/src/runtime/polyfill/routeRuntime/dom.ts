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

export function mountEntryToDom(
  entry: PageStackEntry,
  pageRegistry: Map<string, PageRecord>,
  onMounted: (entry: PageStackEntry) => void,
) {
  const record = pageRegistry.get(entry.id)
  if (!record) {
    return
  }
  ensureDocumentReady(() => {
    const container = ensureContainer()
    if (!container) {
      return
    }
    while (container.childNodes.length) {
      container.removeChild(container.childNodes[0]!)
    }
    const element = document.createElement(record.tag) as HTMLElement & ComponentPublicInstance
    element.setAttribute('data-weapp-page', entry.id)
    element.setAttribute('style', 'display:block;min-height:100%;')
    attachRouteMeta(element, {
      id: entry.id,
      query: entry.query,
      entry,
    })
    container.append(element)
    onMounted(entry)
  })
}
