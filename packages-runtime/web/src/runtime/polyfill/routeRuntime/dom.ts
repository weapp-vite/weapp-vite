import type { ComponentPublicInstance } from '../../component'
import type { PageRecord, PageStackEntry } from './options'
import { ensureAppContainer, onDocumentReady } from '../../appShell/container'
import { attachRouteMeta } from './lifecycle'
import {
  bindPageScrollOwner,
  restoreEntryScrollPosition,
  setEntryScrollOwner,
} from './scroll'

function applyEntryVisibility(entry: PageStackEntry) {
  const element = entry.element
  if (!element) {
    return
  }
  const currentStyle = element.getAttribute('style') ?? ''
  const styleWithoutDisplay = currentStyle
    .replace(/(?:^|;)\s*display\s*:[^;]*/gi, '')
    .replace(/^;|;$/g, '')
  const setDisplay = (display: 'block' | 'none') => {
    element.setAttribute('style', `${styleWithoutDisplay}${styleWithoutDisplay ? ';' : ''}display:${display};`)
  }
  element.setAttribute('data-weapp-page-active', entry.active ? 'true' : 'false')
  setEntryScrollOwner(entry, entry.active)
  if (entry.active) {
    setDisplay('block')
    element.removeAttribute('hidden')
    element.removeAttribute('aria-hidden')
    return
  }
  // 自定义页面元素挂载时带有内联 display，必须同步清零才能真正隐藏。
  setDisplay('none')
  element.setAttribute('hidden', '')
  element.setAttribute('aria-hidden', 'true')
}

export function setEntryActiveInDom(entry: PageStackEntry, active: boolean) {
  entry.active = active
  applyEntryVisibility(entry)
}

export function unmountEntryFromDom(entry: PageStackEntry) {
  setEntryScrollOwner(entry, false)
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
  onBeforeMount: (entry: PageStackEntry) => void,
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
    bindPageScrollOwner(container)
    onBeforeMount(entry)
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
  })
}

export { getPageContainer } from './scroll'
