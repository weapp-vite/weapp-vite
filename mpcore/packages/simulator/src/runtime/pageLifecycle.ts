import type { RuntimeScheduler } from '../kernel/scheduler'
import type { HeadlessPageInstance } from './pageInstance'

export function runInitialPageLifecycles(
  page: HeadlessPageInstance,
  query: Record<string, string>,
  scheduler: RuntimeScheduler,
  isAlive: () => boolean,
) {
  page.onLoad?.(query)
  if (!isAlive()) {
    return
  }
  page.onShow?.()
  if (!isAlive()) {
    return
  }
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
