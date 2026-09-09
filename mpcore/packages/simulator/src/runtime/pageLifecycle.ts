import type { RuntimeScheduler } from '../kernel/scheduler'
import type { HeadlessPageInstance } from './pageInstance'

const loadingPages = new WeakSet<HeadlessPageInstance>()

export function isPageBeforeReady(page: HeadlessPageInstance) {
  return loadingPages.has(page)
}

export function runInitialPageLifecycles(
  page: HeadlessPageInstance,
  query: Record<string, string>,
  scheduler: RuntimeScheduler,
  isAlive: () => boolean,
  renderComponents?: () => void,
) {
  loadingPages.add(page)
  try {
    // 原生宿主先挂载静态组件并建立关系，随后执行 Page.onLoad，最后派发组件 ready。
    renderComponents?.()
    page.onLoad?.(query)
    if (!isAlive()) {
      return
    }
    page.onShow?.()
    if (!isAlive()) {
      return
    }
  }
  finally {
    loadingPages.delete(page)
  }
  renderComponents?.()
  // ready 属于后续宿主任务，让 onLoad/onShow 发起的微任务先完成。
  scheduler.setTimeout(() => {
    if (!isAlive()) {
      return
    }
    page.onReady?.()
    if (isAlive()) {
      page.onRouteDone?.({})
    }
  }, 0)
}
