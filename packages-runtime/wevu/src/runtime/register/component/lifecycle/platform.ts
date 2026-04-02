import type { InternalRuntimeState } from '../../../types'
import { callHookList } from '../../../hooks'
import { getMiniProgramGlobalObject } from '../../../platform'

let wxPatched = false
let currentPageInstance: InternalRuntimeState | undefined
const PAGE_SCROLL_HOOK_DEPTH_KEY = '__wevuPageScrollHookDepth'

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
  const currentDepth = Number((target as any)[PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 0)
  ;(target as any)[PAGE_SCROLL_HOOK_DEPTH_KEY] = currentDepth + 1
  try {
    return task()
  }
  finally {
    const nextDepth = Number((target as any)[PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 1) - 1
    if (nextDepth <= 0) {
      delete (target as any)[PAGE_SCROLL_HOOK_DEPTH_KEY]
    }
    else {
      ;(target as any)[PAGE_SCROLL_HOOK_DEPTH_KEY] = nextDepth
    }
  }
}

export function resolvePageOptions(target: InternalRuntimeState) {
  const direct = (target as any).options
  if (direct && typeof direct === 'object') {
    return direct
  }
  if (typeof getCurrentPages === 'function') {
    const pages = getCurrentPages()
    const page = Array.isArray(pages) ? pages.at(-1) : undefined
    const options = page && typeof page === 'object' ? (page as any).options : undefined
    if (options && typeof options === 'object') {
      return options
    }
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

export function ensurePageShareMenus(options: {
  enableOnShareAppMessage: boolean
  enableOnShareTimeline: boolean
}) {
  const { enableOnShareAppMessage, enableOnShareTimeline } = options
  if (!enableOnShareAppMessage && !enableOnShareTimeline) {
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

  // 官方要求：展示 shareTimeline 时必须同时展示 shareAppMessage
  const shouldShowShareAppMessage = enableOnShareAppMessage || enableOnShareTimeline
  if (!shouldShowShareAppMessage) {
    return
  }

  const menus: Array<'shareAppMessage' | 'shareTimeline'> = ['shareAppMessage']
  if (enableOnShareTimeline) {
    menus.push('shareTimeline')
  }

  showMenu({
    withShareTicket: true,
    menus,
  })
}
