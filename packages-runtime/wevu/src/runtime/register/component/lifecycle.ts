import type { ComponentPropsOptions, ComputedDefinitions, DefineComponentOptions, InternalRuntimeState, MethodDefinitions, RuntimeApp } from '../../types'
import type { WatchMap } from '../watch'
import {
  WEVU_ON_LOAD_CALLED_KEY,
  WEVU_READY_CALLED_KEY,
  WEVU_ROUTE_DONE_CALLED_KEY,
} from '@weapp-core/constants'
import { callHookList } from '../../hooks'
import { scheduleTemplateRefUpdate } from '../../templateRefs'
import { enableDeferredSetData, mountRuntimeInstance, setRuntimeSetDataVisibility, teardownRuntimeInstance } from '../runtimeInstance'
import { attachOptionalPageLifecycleHooks } from './lifecycle/optionalHooks'
import { bindCurrentPageInstance, ensurePageShareMenus, ensureWxPatched, releaseCurrentPageInstance, resolvePageOptions } from './lifecycle/platform'

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
  enableOnRouteDoneFallback: boolean
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
    enableOnRouteDoneFallback,
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
      if ((this as any)[WEVU_ON_LOAD_CALLED_KEY]) {
        return
      }
      ;(this as any)[WEVU_ON_LOAD_CALLED_KEY] = true
      mountRuntimeInstance(this, runtimeApp, watch, setup)
      enableDeferredSetData(this)
      if (isPage) {
        ensurePageShareMenus({
          enableOnShareAppMessage,
          enableOnShareTimeline,
        })
      }
      callHookList(this, 'onLoad', args)
      if (typeof userOnLoad === 'function') {
        return userOnLoad.apply(this, args)
      }
    },
    onUnload(this: InternalRuntimeState, ...args: any[]) {
      if (isPage) {
        releaseCurrentPageInstance(this)
      }
      teardownRuntimeInstance(this)
      if (typeof userOnUnload === 'function') {
        return userOnUnload.apply(this, args)
      }
    },
    onShow(this: InternalRuntimeState, ...args: any[]) {
      if (isPage) {
        ensureWxPatched()
        bindCurrentPageInstance(this)
        if (!(this as any)[WEVU_ON_LOAD_CALLED_KEY]) {
          pageLifecycleHooks.onLoad.call(this, resolvePageOptions(this))
        }
        ensurePageShareMenus({
          enableOnShareAppMessage,
          enableOnShareTimeline,
        })
        ;(this as any)[WEVU_ROUTE_DONE_CALLED_KEY] = false
      }
      setRuntimeSetDataVisibility(this, true)
      callHookList(this, 'onShow', args)
      if (typeof userOnShow === 'function') {
        return userOnShow.apply(this, args)
      }
    },
    onHide(this: InternalRuntimeState, ...args: any[]) {
      if (isPage) {
        releaseCurrentPageInstance(this)
      }
      setRuntimeSetDataVisibility(this, false)
      callHookList(this, 'onHide', args)
      if (typeof userOnHide === 'function') {
        return userOnHide.apply(this, args)
      }
    },
    onReady(this: InternalRuntimeState, ...args: any[]) {
      if (isPage) {
        if (!(this as any)[WEVU_ON_LOAD_CALLED_KEY]) {
          pageLifecycleHooks.onLoad.call(this, resolvePageOptions(this))
        }
        ensurePageShareMenus({
          enableOnShareAppMessage,
          enableOnShareTimeline,
        })
      }
      // 兼容：部分平台/模式可能触发 Page.onReady，而非 Component lifetimes.ready
      if (!(this as any)[WEVU_READY_CALLED_KEY]) {
        ;(this as any)[WEVU_READY_CALLED_KEY] = true
        // 部分 IDE/基础库在首屏场景可能不派发 routeDone，这里做一次延迟兜底。
        // 若平台随后派发了真实 routeDone，会因为 __wevuRouteDoneCalled 判定而跳过补发。
        if (isPage && enableOnRouteDone && enableOnRouteDoneFallback) {
          // eslint-disable-next-line ts/no-this-alias
          const current = this
          setTimeout(() => {
            if (!(current as any)[WEVU_ROUTE_DONE_CALLED_KEY]) {
              pageLifecycleHooks.onRouteDone?.call(current)
            }
          }, 0)
        }
        scheduleTemplateRefUpdate(this, () => {
          callHookList(this, 'onReady', args)
          if (typeof userOnReady === 'function') {
            userOnReady.apply(this, args)
          }
        })
        return
      }
      if (typeof userOnReady === 'function') {
        return userOnReady.apply(this, args)
      }
    },
  }

  attachOptionalPageLifecycleHooks(pageLifecycleHooks, {
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
  })

  return pageLifecycleHooks
}
