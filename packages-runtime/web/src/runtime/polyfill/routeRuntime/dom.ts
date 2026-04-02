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
  return (document.querySelector('#app') as HTMLElement | null) ?? document.body
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
    attachRouteMeta(element, {
      id: entry.id,
      query: entry.query,
      entry,
    })
    container.append(element)
    onMounted(entry)
  })
}
