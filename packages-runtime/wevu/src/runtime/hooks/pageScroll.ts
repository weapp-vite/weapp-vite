import type { InternalRuntimeState } from '../types'
import { WEVU_PAGE_HOOK_BRIDGES_KEY, WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY, WEVU_PAGE_SCROLL_OBSERVERS_KEY } from '@weapp-core/constants'
import { callHookList } from './base'

type PageScrollHandler = (this: InternalRuntimeState, ...args: unknown[]) => unknown
type PageScrollHookState = InternalRuntimeState & {
  [WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY]?: number
  [WEVU_PAGE_HOOK_BRIDGES_KEY]?: Partial<Record<'onPageScroll', PageScrollHandler>>
  onPageScroll?: PageScrollHandler
}

export function runInPageScrollHook<T>(target: InternalRuntimeState, task: () => T): T {
  const state = target as PageScrollHookState
  const depth = Number(state[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 0)
  state[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] = depth + 1
  try {
    return task()
  }
  finally {
    if (depth === 0) {
      delete state[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY]
    }
    else {
      state[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] = depth
    }
  }
}

/** 原生方法和动态桥共用一次分发，框架观察器不参与用户 hook 的覆盖优先级。 */
export function callPageScrollHooks(target: InternalRuntimeState, args: unknown[], original?: PageScrollHandler) {
  const state = target as PageScrollHookState
  const nested = Number(state[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 0) > 0
  return runInPageScrollHook(target, () => {
    if (!nested) {
      // 先缓存真实位置，避免业务 hook 同步导航时读取上一次滚动。
      callHookList(target, WEVU_PAGE_SCROLL_OBSERVERS_KEY, args)
      callHookList(target, 'onPageScroll', args)
    }
    return original?.apply(target, args)
  })
}

export function ensurePageHookOnInstance(target: InternalRuntimeState, name: 'onPageScroll') {
  const page = target as PageScrollHookState
  const bridges = page[WEVU_PAGE_HOOK_BRIDGES_KEY] ??= {}
  if (typeof bridges[name] === 'function') {
    return
  }
  const original = page[name]
  const bridge: PageScrollHandler = function onWevuPageHookBridge(...args) {
    return callPageScrollHooks(this, args, original)
  }
  bridges[name] = bridge
  page[name] = bridge
}
