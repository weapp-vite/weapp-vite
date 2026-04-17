import type { InternalRuntimeState } from '../../../types'
import { WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY } from '@weapp-core/constants'
import { callHookList } from '../../../hooks'
import {
  getCurrentMiniProgramPages,
  getCurrentMiniProgramRuntimeCapabilities,
  getMiniProgramGlobalObject,
  supportsCurrentMiniProgramRuntimeCapability,
} from '../../../platform'

let miniProgramGlobalPatched = false
let currentPageInstance: InternalRuntimeState | undefined
type ShareMenuName = 'shareAppMessage' | 'shareTimeline'
export function getCurrentPageInstance() {
  return currentPageInstance
}

export function bindCurrentPageInstance(target: InternalRuntimeState) {
  currentPageInstance = target
}

export function releaseCurrentPageInstance(target: InternalRuntimeState) {
  if (currentPageInstance === target) {
    currentPageInstance = undefined
  }
}

export function runInPageScrollHook<T>(
  target: InternalRuntimeState,
  task: () => T,
): T {
  const currentDepth = Number((target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 0)
  ;(target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] = currentDepth + 1
  try {
    return task()
  }
  finally {
    const nextDepth = Number((target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 1) - 1
    if (nextDepth <= 0) {
      delete (target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY]
    }
    else {
      ;(target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] = nextDepth
    }
  }
}

export function resolvePageOptions(target: InternalRuntimeState) {
  const direct = (target as any).options
  if (direct && typeof direct === 'object') {
    return direct
  }
  const page = getCurrentMiniProgramPages().at(-1)
  const options = page && typeof page === 'object' ? (page as any).options : undefined
  if (options && typeof options === 'object') {
    return options
  }
  return {}
}

export function ensureMiniProgramGlobalPatched() {
  if (miniProgramGlobalPatched) {
    return
  }
  miniProgramGlobalPatched = true
  const miniProgramGlobal = getMiniProgramGlobalObject()
  if (!miniProgramGlobal || typeof miniProgramGlobal !== 'object') {
    return
  }
  if (supportsCurrentMiniProgramRuntimeCapability('pullDownRefreshApi')) {
    const rawStartPullDownRefresh = miniProgramGlobal.startPullDownRefresh as ((...args: any[]) => any) | undefined
    if (typeof rawStartPullDownRefresh === 'function') {
      miniProgramGlobal.startPullDownRefresh = function startPullDownRefreshPatched(...args: any[]) {
        const result = rawStartPullDownRefresh.apply(this, args)
        if (currentPageInstance) {
          callHookList(currentPageInstance, 'onPullDownRefresh', [])
        }
        return result
      }
    }
  }
  if (supportsCurrentMiniProgramRuntimeCapability('pageScrollApi')) {
    const rawPageScrollTo = miniProgramGlobal.pageScrollTo as ((...args: any[]) => any) | undefined
    if (typeof rawPageScrollTo === 'function') {
      miniProgramGlobal.pageScrollTo = function pageScrollToPatched(options: any, ...rest: any[]) {
        const result = rawPageScrollTo.apply(this, [options, ...rest])
        if (currentPageInstance) {
          const pageInstance = currentPageInstance
          runInPageScrollHook(pageInstance, () => {
            callHookList(pageInstance, 'onPageScroll', [options ?? {}])
          })
        }
        return result
      }
    }
  }
}

export function ensurePageShareMenus(options: {
  enableOnShareAppMessage: boolean
  enableOnShareTimeline: boolean
}) {
  const { enableOnShareAppMessage, enableOnShareTimeline } = options
  if (!enableOnShareAppMessage && !enableOnShareTimeline) {
    return
  }

  if (!supportsCurrentMiniProgramRuntimeCapability('pageShareMenu')) {
    return
  }

  const miniProgramGlobal = getMiniProgramGlobalObject()
  if (!miniProgramGlobal || typeof miniProgramGlobal.showShareMenu !== 'function') {
    return
  }

  const runtimeCapabilities = getCurrentMiniProgramRuntimeCapabilities()
  const shouldShowShareAppMessage = runtimeCapabilities.shareTimelineRequiresShareAppMessage
    ? (enableOnShareAppMessage || enableOnShareTimeline)
    : enableOnShareAppMessage

  if (!shouldShowShareAppMessage && !enableOnShareTimeline) {
    return
  }

  const menus: ShareMenuName[] = []
  if (shouldShowShareAppMessage) {
    menus.push('shareAppMessage')
  }
  if (enableOnShareTimeline) {
    menus.push('shareTimeline')
  }

  const payloads = [
    { withShareTicket: true, menus },
    { menus },
    enableOnShareTimeline ? { withShareTicket: true } : undefined,
    enableOnShareTimeline ? {} : undefined,
    undefined,
  ]

  for (const payload of payloads) {
    try {
      if (payload === undefined) {
        miniProgramGlobal.showShareMenu()
      }
      else {
        miniProgramGlobal.showShareMenu(payload as any)
      }
      break
    }
    catch {
      // 继续尝试更保守的 payload，兼容不同宿主的 showShareMenu 参数形态。
    }
  }
}
