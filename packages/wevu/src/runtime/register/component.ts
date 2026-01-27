import type { TemplateRefBinding } from '../templateRefs'
import type { ComponentPropsOptions, ComputedDefinitions, DefineComponentOptions, InternalRuntimeState, MethodDefinitions, MiniProgramComponentRawOptions, PageFeatures, RuntimeApp } from '../types'
import type { WatchMap } from './watch'
import { callHookList } from '../hooks'
import { clearTemplateRefs, scheduleTemplateRefUpdate } from '../templateRefs'
import { resolveComponentFeatures } from './component/features'
import { createPageLifecycleHooks } from './component/lifecycle'
import { createComponentMethods } from './component/methods'
import { createPropsSync } from './component/props'
import { enableDeferredSetData, mountRuntimeInstance, teardownRuntimeInstance } from './runtimeInstance'

export function registerComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup'],
  mpOptions: MiniProgramComponentRawOptions,
) {
  const {
    methods: userMethods = {},
    lifetimes: userLifetimes = {},
    pageLifetimes: userPageLifetimes = {},
    options: userOptions = {},
    ...rest
  } = mpOptions

  const userOnLoad = (rest as any).onLoad
  const userOnUnload = (rest as any).onUnload
  const userOnShow = (rest as any).onShow
  const userOnHide = (rest as any).onHide
  const userOnReady = (rest as any).onReady
  const userOnSaveExitState = (rest as any).onSaveExitState
  const userOnPullDownRefresh = (rest as any).onPullDownRefresh
  const userOnReachBottom = (rest as any).onReachBottom
  const userOnPageScroll = (rest as any).onPageScroll
  const userOnRouteDone = (rest as any).onRouteDone
  const userOnTabItemTap = (rest as any).onTabItemTap
  const userOnResize = (rest as any).onResize
  const userOnShareAppMessage = (rest as any).onShareAppMessage
  const userOnShareTimeline = (rest as any).onShareTimeline
  const userOnAddToFavorites = (rest as any).onAddToFavorites
  const features = ((rest as any).features ?? {}) as PageFeatures
  const isPage = Boolean((rest as any).__wevu_isPage) || Object.keys(features ?? {}).length > 0

  const restOptions: Record<string, any> = {
    ...(rest as any),
  }
  const templateRefs = (restOptions as any).__wevuTemplateRefs as TemplateRefBinding[] | undefined
  delete (restOptions as any).__wevuTemplateRefs
  const userObservers = (restOptions as any).observers as Record<string, any> | undefined
  const setupLifecycle = (restOptions as any).setupLifecycle === 'created' ? 'created' : 'attached'
  delete (restOptions as any).setupLifecycle
  const legacyCreated = restOptions.created
  delete restOptions.features
  delete restOptions.created
  delete restOptions.onLoad
  delete restOptions.onUnload
  delete restOptions.onShow
  delete restOptions.onHide
  delete restOptions.onReady

  const {
    enableOnPullDownRefresh,
    enableOnReachBottom,
    enableOnPageScroll,
    enableOnRouteDone,
    enableOnTabItemTap,
    enableOnResize,
    enableOnShareAppMessage,
    enableOnShareTimeline,
    enableOnAddToFavorites,
    enableOnSaveExitState,
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
  } = resolveComponentFeatures({
    features,
    userOnSaveExitState,
    userOnPullDownRefresh,
    userOnReachBottom,
    userOnPageScroll,
    userOnRouteDone,
    userOnTabItemTap,
    userOnResize,
    userOnShareAppMessage,
    userOnShareTimeline,
    userOnAddToFavorites,
  })

  const hasHook = (target: InternalRuntimeState, name: string) => {
    const hooks = target.__wevuHooks
    if (!hooks) {
      return false
    }
    const entry = (hooks as any)[name]
    if (!entry) {
      return false
    }
    if (Array.isArray(entry)) {
      return entry.length > 0
    }
    return typeof entry === 'function'
  }

  // 自动对齐 Vue 3 的 expose：
  // - 若用户未提供 component-export 的 export()，默认返回 setup() 中 expose() 写入的 __wevuExposed
  // - 若用户同时提供 export() 与 expose()，则自动浅合并（export() 优先级更高）
  {
    const userExport = (restOptions as any).export
    ;(restOptions as any).export = function __wevu_export(this: InternalRuntimeState) {
      const exposed = (this as any).__wevuExposed ?? {}
      const base = typeof userExport === 'function' ? userExport.call(this) : {}

      if (base && typeof base === 'object' && !Array.isArray(base)) {
        return {
          ...exposed,
          ...base,
        }
      }

      // 若用户 export() 返回非对象（理论上不应发生），则保持原返回值；否则回退 exposed
      return base ?? exposed
    }
  }

  // 默认启用多 slot 以兼容微信小程序具名插槽写法；用户显式配置时保持原值
  const finalOptions = {
    multipleSlots: (userOptions as any).multipleSlots ?? true,
    ...(userOptions as any),
  }

  const { syncWevuPropsFromInstance, finalObservers } = createPropsSync({
    restOptions,
    userObservers,
  })

  const { finalMethods } = createComponentMethods({
    userMethods,
    runtimeMethods: methods,
  })

  const pageLifecycleHooks = createPageLifecycleHooks({
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
  })

  Component({
    ...restOptions,
    ...pageLifecycleHooks,
    observers: finalObservers,
    lifetimes: {
      ...userLifetimes,
      created: function created(this: InternalRuntimeState, ...args: any[]) {
        if (Array.isArray(templateRefs) && templateRefs.length) {
          Object.defineProperty(this, '__wevuTemplateRefs', {
            value: templateRefs,
            configurable: true,
            enumerable: false,
            writable: false,
          })
        }
        if (setupLifecycle === 'created') {
          mountRuntimeInstance(this, runtimeApp, watch, setup, { deferSetData: true })
          syncWevuPropsFromInstance(this)
        }
        // 兼容：若用户使用旧式 created（非 lifetimes.created），在定义 lifetimes.created 后会被覆盖，这里手动补齐调用
        if (typeof legacyCreated === 'function') {
          legacyCreated.apply(this, args)
        }
        if (typeof (userLifetimes as any).created === 'function') {
          ;(userLifetimes as any).created.apply(this, args)
        }
      },
      moved: function moved(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onMoved', args)
        if (typeof (userLifetimes as any).moved === 'function') {
          ;(userLifetimes as any).moved.apply(this, args)
        }
      },
      attached: function attached(this: InternalRuntimeState, ...args: any[]) {
        if (Array.isArray(templateRefs) && templateRefs.length && !(this as any).__wevuTemplateRefs) {
          Object.defineProperty(this, '__wevuTemplateRefs', {
            value: templateRefs,
            configurable: true,
            enumerable: false,
            writable: false,
          })
        }
        if (setupLifecycle !== 'created' || !(this as any).__wevu) {
          mountRuntimeInstance(this, runtimeApp, watch, setup)
        }
        syncWevuPropsFromInstance(this)
        if (setupLifecycle === 'created') {
          enableDeferredSetData(this)
        }
        if (typeof (userLifetimes as any).attached === 'function') {
          ;(userLifetimes as any).attached.apply(this, args)
        }
      },
      ready: function ready(this: InternalRuntimeState, ...args: any[]) {
        if (!(this as any).__wevuReadyCalled) {
          ;(this as any).__wevuReadyCalled = true
          syncWevuPropsFromInstance(this)
          scheduleTemplateRefUpdate(this, () => {
            callHookList(this, 'onReady', args)
            if (typeof (userLifetimes as any).ready === 'function') {
              ;(userLifetimes as any).ready.apply(this, args)
            }
          })
          return
        }
        if (typeof (userLifetimes as any).ready === 'function') {
          ;(userLifetimes as any).ready.apply(this, args)
        }
      },
      detached: function detached(this: InternalRuntimeState, ...args: any[]) {
        clearTemplateRefs(this)
        teardownRuntimeInstance(this)
        if (typeof (userLifetimes as any).detached === 'function') {
          ;(userLifetimes as any).detached.apply(this, args)
        }
      },
      error: function error(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onError', args)
        if (typeof (userLifetimes as any).error === 'function') {
          ;(userLifetimes as any).error.apply(this, args)
        }
      },
    },
    pageLifetimes: {
      ...userPageLifetimes,
      show: function show(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onShow', args)
        if (typeof (userPageLifetimes as any).show === 'function') {
          ;(userPageLifetimes as any).show.apply(this, args)
        }
      },
      hide: function hide(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onHide', args)
        if (typeof (userPageLifetimes as any).hide === 'function') {
          ;(userPageLifetimes as any).hide.apply(this, args)
        }
      },
      resize: function resize(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onResize', args)
        if (typeof (userPageLifetimes as any).resize === 'function') {
          ;(userPageLifetimes as any).resize.apply(this, args)
        }
      },
    },
    methods: finalMethods,
    options: finalOptions,
  })
}
