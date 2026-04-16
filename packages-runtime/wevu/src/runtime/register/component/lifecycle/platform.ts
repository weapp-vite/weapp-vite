import type { InternalRuntimeState } from '../../../types'
import { WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY } from '@weapp-core/constants'
import { callHookList } from '../../../hooks'
import {
  getCurrentMiniProgramPages,
  getCurrentMiniProgramRuntimeCapabilities,
  getMiniProgramGlobalObject,
  supportsCurrentMiniProgramRuntimeCapability,
} from '../../../platform'

let wxPatched = false
let currentPageInstance: InternalRuntimeState | undefined
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

export function ensureWxPatched() {
  if (wxPatched) {
    return
  }
  wxPatched = true
  const wxGlobal = getMiniProgramGlobalObject()
  if (!wxGlobal || typeof wxGlobal !== 'object') {
    return
  }
  if (supportsCurrentMiniProgramRuntimeCapability('pullDownRefreshApi')) {
    const rawStartPullDownRefresh = wxGlobal.startPullDownRefresh as ((...args: any[]) => any) | undefined
    if (typeof rawStartPullDownRefresh === 'function') {
      wxGlobal.startPullDownRefresh = function startPullDownRefreshPatched(...args: any[]) {
        const result = rawStartPullDownRefresh.apply(this, args)
        if (currentPageInstance) {
          callHookList(currentPageInstance, 'onPullDownRefresh', [])
        }
        return result
      }
    }
  }
  if (supportsCurrentMiniProgramRuntimeCapability('pageScrollApi')) {
    const rawPageScrollTo = wxGlobal.pageScrollTo as ((...args: any[]) => any) | undefined
    if (typeof rawPageScrollTo === 'function') {
      wxGlobal.pageScrollTo = function pageScrollToPatched(options: any, ...rest: any[]) {
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

  const wxGlobal = getMiniProgramGlobalObject()
  if (!wxGlobal || typeof wxGlobal.showShareMenu !== 'function') {
    return
  }

  const showMenu = (payload: {
    menus: Array<'shareAppMessage' | 'shareTimeline'>
    withShareTicket?: boolean
  }) => {
    try {
      wxGlobal.showShareMenu(payload as any)
    }
    catch {
      // 忽略平台差异导致的菜单能力异常，避免影响页面主流程
    }
  }

  const runtimeCapabilities = getCurrentMiniProgramRuntimeCapabilities()
  const shouldShowShareAppMessage = runtimeCapabilities.shareTimelineRequiresShareAppMessage
    ? (enableOnShareAppMessage || enableOnShareTimeline)
    : enableOnShareAppMessage

  if (!shouldShowShareAppMessage && !enableOnShareTimeline) {
    return
  }

  const menus: Array<'shareAppMessage' | 'shareTimeline'> = []
  if (shouldShowShareAppMessage) {
    menus.push('shareAppMessage')
  }
  if (enableOnShareTimeline) {
    menus.push('shareTimeline')
  }

  showMenu({
    withShareTicket: true,
    menus,
  })
}
