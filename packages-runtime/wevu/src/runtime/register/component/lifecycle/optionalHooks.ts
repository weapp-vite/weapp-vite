import type { InternalRuntimeState } from '../../../types'
import {
  WEVU_ROUTE_DONE_CALLED_KEY,
  WEVU_ROUTE_DONE_IN_TICK_KEY,
} from '@weapp-core/constants'
import { callHookList, callHookReturn } from '../../../hooks'
import { runInPageScrollHook } from './platform'

export interface OptionalPageLifecycleHookOptions {
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
}

export function attachOptionalPageLifecycleHooks(
  pageLifecycleHooks: Record<string, any>,
  options: OptionalPageLifecycleHookOptions,
) {
  const {
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
      return runInPageScrollHook(this, () => {
        callHookList(this, 'onPageScroll', args)
        if (!hasHook(this, 'onPageScroll')) {
          return effectiveOnPageScroll.apply(this, args)
        }
      })
    }
  }
  if (enableOnRouteDone) {
    pageLifecycleHooks.onRouteDone = function onRouteDone(this: InternalRuntimeState, ...args: any[]) {
      if ((this as any)[WEVU_ROUTE_DONE_IN_TICK_KEY]) {
        return
      }
      ;(this as any)[WEVU_ROUTE_DONE_IN_TICK_KEY] = true
      Promise.resolve().then(() => {
        ;(this as any)[WEVU_ROUTE_DONE_IN_TICK_KEY] = false
      })
      ;(this as any)[WEVU_ROUTE_DONE_CALLED_KEY] = true
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
}
