import type { InternalRuntimeState } from '../../../types'
import { WEVU_PAGE_SCROLL_EVENT_CONTRACT_KEY } from '@weapp-core/constants'
import { callHookList } from '../../../hooks'
import { runInPageScrollHook } from '../../../hooks/pageScroll'
import {
  getCurrentMiniProgramGlobalObject,
  getCurrentMiniProgramPages,
  getCurrentMiniProgramRuntimeCapabilities,
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

export function resolvePageOptions(target: InternalRuntimeState) {
  const direct = (target as any).options
  if (direct && typeof direct === 'object') {
    return direct
  }
  const pages = getCurrentMiniProgramPages()
  const page = pages[pages.length - 1]
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
  const miniProgramGlobal = getCurrentMiniProgramGlobalObject()
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
  if (supportsCurrentMiniProgramRuntimeCapability('pageScrollApi') && miniProgramGlobal[WEVU_PAGE_SCROLL_EVENT_CONTRACT_KEY] !== 1) {
    const rawPageScrollTo = miniProgramGlobal.pageScrollTo as ((...args: any[]) => any) | undefined
    if (typeof rawPageScrollTo === 'function') {
      miniProgramGlobal.pageScrollTo = function pageScrollToPatched(options: any, ...rest: any[]) {
        const pageInstance = currentPageInstance
        const result = rawPageScrollTo.apply(this, [options, ...rest])
        if (pageInstance) {
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

  const miniProgramGlobal = getCurrentMiniProgramGlobalObject()
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
