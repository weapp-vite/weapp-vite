import type { PageStackEntry } from './options'
import { getAppContainer } from '../../appShell/container'

type ScrollContainer = HTMLElement & Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** 与 page.json 的 onReachBottomDistance 默认值一致。 */
const DEFAULT_REACH_BOTTOM_DISTANCE = 50

let activeEntry: PageStackEntry | undefined
let boundContainer: ScrollContainer | undefined
let scrollHandler: (() => void) | undefined

const restorationClaims = new WeakMap<object, number>()
const reachBottomStates = new WeakMap<PageStackEntry, boolean>()

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

function isContainerAtBottom(container: ScrollContainer) {
  if (!(container.scrollHeight > container.clientHeight)) {
    return false
  }
  return container.scrollTop + container.clientHeight >= container.scrollHeight - DEFAULT_REACH_BOTTOM_DISTANCE
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
    // 恢复位置不算用户触底，同步状态避免随后的 scroll 事件补发一次 onReachBottom。
    reachBottomStates.set(entry, isContainerAtBottom(container))
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

/**
 * 真机在滚到底部时触发一次 `onReachBottom`：内容加载后离开底部再滚到底会重新触发，
 * 停在底部继续滚动不会重复调用。
 */
function notifyEntryReachBottom(entry: PageStackEntry) {
  const container = getPageContainer()
  if (!container) {
    return
  }
  const atBottom = isContainerAtBottom(container)
  const previous = reachBottomStates.get(entry) ?? false
  if (atBottom === previous) {
    return
  }
  reachBottomStates.set(entry, atBottom)
  if (!atBottom) {
    return
  }
  const page = entry.instance as (PageStackEntry['instance'] & {
    onReachBottom?: () => void
  }) | undefined
  page?.onReachBottom?.()
}

export function recordActiveEntryScrollPosition() {
  if (activeEntry?.active) {
    captureEntryScrollPosition(activeEntry)
    const page = activeEntry.instance as (PageStackEntry['instance'] & {
      onPageScroll?: (event: { scrollTop: number }) => void
    }) | undefined
    page?.onPageScroll?.({ scrollTop: activeEntry.scrollTop ?? 0 })
    notifyEntryReachBottom(activeEntry)
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
