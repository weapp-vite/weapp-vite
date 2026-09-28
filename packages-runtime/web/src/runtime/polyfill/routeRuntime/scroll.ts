import type { PageStackEntry } from './options'
import { getAppContainer } from '../../appShell/container'

type ScrollContainer = HTMLElement & Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

let activeEntry: PageStackEntry | undefined
let boundContainer: ScrollContainer | undefined
let scrollHandler: (() => void) | undefined

const restorationClaims = new WeakMap<object, number>()

/** 仅认领新页面首次恢复；保留页面的容器位置仍由宿主维护，显式 pageScrollTo 不受影响。 */
export function claimPageScrollRestoration(page: object): () => void {
  restorationClaims.set(page, (restorationClaims.get(page) ?? 0) + 1)
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    const remaining = (restorationClaims.get(page) ?? 1) - 1
    if (remaining > 0) {
      restorationClaims.set(page, remaining)
    }
    else {
      restorationClaims.delete(page)
    }
  }
}

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

export function restoreEntryScrollPosition(entry: PageStackEntry, retained = false) {
  if (!retained && entry.instance && restorationClaims.has(entry.instance)) {
    return
  }
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
  if (activeEntry?.active) {
    captureEntryScrollPosition(activeEntry)
    const page = activeEntry.instance as (PageStackEntry['instance'] & {
      onPageScroll?: (event: { scrollTop: number }) => void
    }) | undefined
    page?.onPageScroll?.({ scrollTop: activeEntry.scrollTop ?? 0 })
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
