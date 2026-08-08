import type { PageStackEntry } from './options'
import { getAppContainer } from '../../appShell/container'

type ScrollContainer = HTMLElement & Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

let activeEntry: PageStackEntry | undefined
let boundContainer: ScrollContainer | undefined
let scrollHandler: (() => void) | undefined

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

export function setEntryScrollOwner(entry: PageStackEntry, active: boolean) {
  if (active) {
    activeEntry = entry
    return
  }
  if (activeEntry === entry) {
    activeEntry = undefined
  }
}

export function recordActiveEntryScrollPosition() {
  if (activeEntry) {
    captureEntryScrollPosition(activeEntry)
  }
}

export function bindPageScrollOwner(container: ScrollContainer) {
  if (boundContainer === container) {
    return
  }
  if (boundContainer && scrollHandler) {
    boundContainer.removeEventListener('scroll', scrollHandler)
  }
  boundContainer = container
  scrollHandler = recordActiveEntryScrollPosition
  container.addEventListener('scroll', scrollHandler, { passive: true })
}

export function disposePageScrollOwner() {
  if (boundContainer && scrollHandler) {
    boundContainer.removeEventListener('scroll', scrollHandler)
  }
  activeEntry = undefined
  boundContainer = undefined
  scrollHandler = undefined
}
