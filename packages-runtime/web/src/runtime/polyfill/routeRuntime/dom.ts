import type { ComponentPublicInstance } from '../../component'
import type { PageRecord, PageStackEntry } from './options'
import { ensureAppContainer, getAppContainer, onDocumentReady } from '../../appShell/container'
import { attachRouteMeta } from './lifecycle'

export function getPageContainer() {
  return getAppContainer()
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
  onDocumentReady(() => {
    const container = ensureAppContainer()
    if (!container) {
      return
    }
    const element = document.createElement(record.tag) as HTMLElement & ComponentPublicInstance
    element.setAttribute('data-weapp-page', entry.id)
    element.setAttribute('style', 'display:block;min-height:100%;box-sizing:border-box;padding-bottom:var(--weapp-tab-bar-inset, 0px);padding-top:var(--weapp-tab-bar-top-inset, 0px);')
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
