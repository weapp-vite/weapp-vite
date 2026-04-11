import type { ComponentPropsOptions, ComputedDefinitions, DefineComponentOptions, InternalRuntimeState, MethodDefinitions, MiniProgramComponentRawOptions, RuntimeApp } from '../types'
import type { WatchMap } from './watch'
import { WEVU_EXPOSED_KEY, WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { resolveComponentFeatures } from './component/features'
import { createPageLifecycleHooks } from './component/lifecycle'
import { createComponentMethods } from './component/methods'
import { getRuntimeOwnerLabel, prepareComponentOptions } from './component/options'
import { createPropsSync } from './component/props'
import { registerComponentDefinition } from './component/registerDefinition'

/**
 * 注册组件入口（框架内部使用）。
 * @internal
 */
export function registerComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup'],
  mpOptions: MiniProgramComponentRawOptions,
) {
  const {
    userMethods,
    userLifetimes,
    userPageLifetimes,
    userOptions,
    restOptions,
    topLevelMethods,
    templateRefs,
    layoutHosts,
    userObservers,
    setupLifecycle,
    legacyCreated,
    isPage,
    features,
    userOnLoad,
    userOnUnload,
    userOnShow,
    userOnHide,
    userOnReady,
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
    applyExtraInstanceFields,
  } = prepareComponentOptions(mpOptions)

  const {
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
    const hooks = target[WEVU_HOOKS_KEY]
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
      const exposed = (this as any)[WEVU_EXPOSED_KEY] ?? {}
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

  const { attachWevuPropKeys, syncWevuPropsFromInstance, finalObservers } = createPropsSync({
    restOptions,
    userObservers,
  })

  const { finalMethods } = createComponentMethods({
    userMethods: {
      ...topLevelMethods,
      ...userMethods,
    },
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
  })

  registerComponentDefinition({
    runtimeApp,
    watch,
    setup,
    restOptions,
    pageLifecycleHooks,
    finalObservers,
    userLifetimes,
    userPageLifetimes,
    finalMethods,
    finalOptions,
    applyExtraInstanceFields,
    templateRefs,
    layoutHosts,
    attachWevuPropKeys,
    setupLifecycle,
    syncWevuPropsFromInstance,
    isPage,
    legacyCreated,
    getRuntimeOwnerLabel,
  })
}
