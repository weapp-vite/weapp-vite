import type { ComponentPropsOptions, ComputedDefinitions, DefineComponentOptions, InternalRuntimeState, MethodDefinitions, RuntimeApp } from '../../types'
import type { WatchMap } from '../watch'
import { callHookList, callHookReturn } from '../../hooks'
import { scheduleTemplateRefUpdate } from '../../templateRefs'
import { enableDeferredSetData, mountRuntimeInstance, teardownRuntimeInstance } from '../runtimeInstance'

let wxPatched = false
let currentPageInstance: InternalRuntimeState | undefined

function resolvePageOptions(target: InternalRuntimeState) {
  const direct = (target as any).options
  if (direct && typeof direct === 'object') {
    return direct
  }
  if (typeof getCurrentPages === 'function') {
    const pages = getCurrentPages()
    const page = Array.isArray(pages) ? pages[pages.length - 1] : undefined
    const options = page && typeof page === 'object' ? (page as any).options : undefined
    if (options && typeof options === 'object') {
      return options
    }
  }
  return {}
}

function ensureWxPatched() {
  if (wxPatched) {
    return
  }
  wxPatched = true
  const wxGlobal = typeof wx !== 'undefined' ? wx : undefined
  if (!wxGlobal || typeof wxGlobal !== 'object') {
    return
  }
  const rawStartPullDownRefresh = wxGlobal.startPullDownRefresh
  if (typeof rawStartPullDownRefresh === 'function') {
    wxGlobal.startPullDownRefresh = function startPullDownRefreshPatched(...args: any[]) {
      const result = rawStartPullDownRefresh.apply(this, args)
      if (currentPageInstance) {
        callHookList(currentPageInstance, 'onPullDownRefresh', [])
      }
      return result
    }
  }
  const rawPageScrollTo = wxGlobal.pageScrollTo
  if (typeof rawPageScrollTo === 'function') {
    wxGlobal.pageScrollTo = function pageScrollToPatched(options: any, ...rest: any[]) {
      const result = rawPageScrollTo.apply(this, [options, ...rest])
      if (currentPageInstance) {
        callHookList(currentPageInstance, 'onPageScroll', [options ?? {}])
      }
      return result
    }
  }
}

function ensurePageShareMenus(options: {
  enableOnShareAppMessage: boolean
  enableOnShareTimeline: boolean
}) {
  const { enableOnShareAppMessage, enableOnShareTimeline } = options
  if (!enableOnShareAppMessage && !enableOnShareTimeline) {
    return
  }

  const wxGlobal = typeof wx !== 'undefined' ? wx : undefined
  if (!wxGlobal || typeof wxGlobal.showShareMenu !== 'function') {
    return
  }

  const menus: Array<'shareAppMessage' | 'shareTimeline'> = []
  if (enableOnShareAppMessage) {
    menus.push('shareAppMessage')
  }
  if (enableOnShareTimeline) {
    menus.push('shareTimeline')
  }

  try {
    wxGlobal.showShareMenu({
      withShareTicket: true,
      menus,
    } as any)
  }
  catch {
    // 忽略平台差异导致的菜单能力异常，避免影响页面主流程
  }
}

export function createPageLifecycleHooks<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  runtimeApp: RuntimeApp<D, C, M>
  watch: WatchMap | undefined
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  userOnLoad?: any
  userOnUnload?: any
  userOnShow?: any
  userOnHide?: any
  userOnReady?: any
  isPage: boolean
  enableOnSaveExitState: boolean
  enableOnPullDownRefresh: boolean
  enableOnReachBottom: boolean
  enableOnPageScroll: boolean
  enableOnRouteDone: boolean
  enableOnTabItemTap: boolean
  enableOnResize: boolean
  enableOnShareAppMessage: boolean
  enableOnShareTimeline: boolean
  enableOnAddToFavorites: boolean
  effectiveOnSaveExitState: (...args: any[]) => any
  effectiveOnPullDownRefresh: (...args: any[]) => any
  effectiveOnReachBottom: (...args: any[]) => any
  effectiveOnPageScroll: (...args: any[]) => any
  effectiveOnRouteDone: (...args: any[]) => any
  effectiveOnTabItemTap: (...args: any[]) => any
  effectiveOnResize: (...args: any[]) => any
  effectiveOnShareAppMessage: (...args: any[]) => any
  effectiveOnShareTimeline: (...args: any[]) => any
  effectiveOnAddToFavorites: (...args: any[]) => any
  hasHook: (target: InternalRuntimeState, name: string) => boolean
}) {
  const {
    runtimeApp,
    watch,
    setup,
    userOnLoad,
    userOnUnload,
    userOnShow,
    userOnHide,
    userOnReady,
    isPage,
    enableOnSaveExitState,
    enableOnPullDownRefresh,
    enableOnReachBottom,
    enableOnPageScroll,
    enableOnRouteDone,
    enableOnTabItemTap,
    enableOnResize,
    enableOnShareAppMessage,
    enableOnShareTimeline,
    enableOnAddToFavorites,
    effectiveOnSaveExitState,
    effectiveOnPullDownRefresh,
    effectiveOnReachBottom,
    effectiveOnPageScroll,
    effectiveOnRouteDone,
    effectiveOnTabItemTap,
    effectiveOnResize,
    effectiveOnShareAppMessage,
    effectiveOnShareTimeline,
    effectiveOnAddToFavorites,
    hasHook,
  } = options

  const pageLifecycleHooks: Record<string, any> = {
    onLoad(this: InternalRuntimeState, ...args: any[]) {
      if ((this as any).__wevuOnLoadCalled) {
        return
      }
      ;(this as any).__wevuOnLoadCalled = true
      if (isPage) {
        ensurePageShareMenus({
          enableOnShareAppMessage,
          enableOnShareTimeline,
        })
      }
      mountRuntimeInstance(this, runtimeApp, watch, setup)
      enableDeferredSetData(this)
      callHookList(this, 'onLoad', args)
      if (typeof userOnLoad === 'function') {
        return userOnLoad.apply(this, args)
      }
    },
    onUnload(this: InternalRuntimeState, ...args: any[]) {
      if (isPage && currentPageInstance === this) {
        currentPageInstance = undefined
      }
      teardownRuntimeInstance(this)
      if (typeof userOnUnload === 'function') {
        return userOnUnload.apply(this, args)
      }
    },
    onShow(this: InternalRuntimeState, ...args: any[]) {
      if (isPage) {
        ensureWxPatched()
        ensurePageShareMenus({
          enableOnShareAppMessage,
          enableOnShareTimeline,
        })
        // eslint-disable-next-line ts/no-this-alias
        currentPageInstance = this
        if (!(this as any).__wevuOnLoadCalled) {
          pageLifecycleHooks.onLoad.call(this, resolvePageOptions(this))
        }
        ;(this as any).__wevuRouteDoneCalled = false
      }
      callHookList(this, 'onShow', args)
      if (typeof userOnShow === 'function') {
        return userOnShow.apply(this, args)
      }
      if (isPage && enableOnRouteDone && (this as any).__wevuReadyCalled && !(this as any).__wevuRouteDoneCalled) {
        return pageLifecycleHooks.onRouteDone?.call(this)
      }
    },
    onHide(this: InternalRuntimeState, ...args: any[]) {
      if (isPage && currentPageInstance === this) {
        currentPageInstance = undefined
      }
      callHookList(this, 'onHide', args)
      if (typeof userOnHide === 'function') {
        return userOnHide.apply(this, args)
      }
    },
    onReady(this: InternalRuntimeState, ...args: any[]) {
      // 兼容：部分平台/模式可能触发 Page.onReady，而非 Component lifetimes.ready
      if (!(this as any).__wevuReadyCalled) {
        ;(this as any).__wevuReadyCalled = true
        scheduleTemplateRefUpdate(this, () => {
          callHookList(this, 'onReady', args)
          if (typeof userOnReady === 'function') {
            userOnReady.apply(this, args)
          }
          if (isPage && enableOnRouteDone && !(this as any).__wevuRouteDoneCalled) {
            pageLifecycleHooks.onRouteDone?.call(this)
          }
        })
        return
      }
      if (typeof userOnReady === 'function') {
        return userOnReady.apply(this, args)
      }
    },
  }

  if (enableOnSaveExitState) {
    pageLifecycleHooks.onSaveExitState = function onSaveExitState(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onSaveExitState', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnSaveExitState.apply(this, args)
    }
  }
  if (enableOnPullDownRefresh) {
    pageLifecycleHooks.onPullDownRefresh = function onPullDownRefresh(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onPullDownRefresh', args)
      if (!hasHook(this, 'onPullDownRefresh')) {
        return effectiveOnPullDownRefresh.apply(this, args)
      }
    }
  }
  if (enableOnReachBottom) {
    pageLifecycleHooks.onReachBottom = function onReachBottom(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onReachBottom', args)
      if (!hasHook(this, 'onReachBottom')) {
        return effectiveOnReachBottom.apply(this, args)
      }
    }
  }
  if (enableOnPageScroll) {
    pageLifecycleHooks.onPageScroll = function onPageScroll(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onPageScroll', args)
      if (!hasHook(this, 'onPageScroll')) {
        return effectiveOnPageScroll.apply(this, args)
      }
    }
  }
  if (enableOnRouteDone) {
    pageLifecycleHooks.onRouteDone = function onRouteDone(this: InternalRuntimeState, ...args: any[]) {
      ;(this as any).__wevuRouteDoneCalled = true
      callHookList(this, 'onRouteDone', args)
      if (!hasHook(this, 'onRouteDone')) {
        return effectiveOnRouteDone.apply(this, args)
      }
    }
  }
  if (enableOnTabItemTap) {
    pageLifecycleHooks.onTabItemTap = function onTabItemTap(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onTabItemTap', args)
      if (!hasHook(this, 'onTabItemTap')) {
        return effectiveOnTabItemTap.apply(this, args)
      }
    }
  }
  if (enableOnResize) {
    pageLifecycleHooks.onResize = function onResize(this: InternalRuntimeState, ...args: any[]) {
      callHookList(this, 'onResize', args)
      if (!hasHook(this, 'onResize')) {
        return effectiveOnResize.apply(this, args)
      }
    }
  }
  if (enableOnShareAppMessage) {
    pageLifecycleHooks.onShareAppMessage = function onShareAppMessage(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareAppMessage', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnShareAppMessage.apply(this, args)
    }
  }
  if (enableOnShareTimeline) {
    pageLifecycleHooks.onShareTimeline = function onShareTimeline(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onShareTimeline', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnShareTimeline.apply(this, args)
    }
  }
  if (enableOnAddToFavorites) {
    pageLifecycleHooks.onAddToFavorites = function onAddToFavorites(this: InternalRuntimeState, ...args: any[]) {
      const ret = callHookReturn(this, 'onAddToFavorites', args)
      if (ret !== undefined) {
        return ret
      }
      return effectiveOnAddToFavorites.apply(this, args)
    }
  }

  return pageLifecycleHooks
}
