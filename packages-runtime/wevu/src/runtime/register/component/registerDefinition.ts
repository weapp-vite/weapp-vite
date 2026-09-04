import type { LayoutHostBinding, TemplateRefBinding } from '../../capabilities'
import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  RuntimeApp,
} from '../../types'
import type { WatchMap } from '../watch'
import {
  WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_READY_CALLED_KEY,
  WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD,
  WEVU_RUNTIME_KEY,
} from '@weapp-core/constants'
import {
  ensureInitialNavigation,
} from '../../../router/initialNavigation'
import { requireRuntimeCapability, runtimeCapabilityRegistry } from '../../capabilities'
import { callHookList } from '../../hooks'
import { getMiniProgramRuntimeGlobalObject } from '../../platform'
import { enableDeferredSetData, mountRuntimeInstance, refreshRuntimeInstance, setRuntimeSetDataVisibility, teardownRuntimeInstance } from '../runtimeInstance'
import { registerNativeComponentDefinition } from './registerNativeDefinition'

export function registerComponentDefinition<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(options: {
  runtimeApp: RuntimeApp<D, C, M>
  watch: WatchMap | undefined
  setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  restOptions: Record<string, any>
  pageLifecycleHooks: Record<string, any>
  finalObservers: Record<string, any>
  userLifetimes: Record<string, any>
  userPageLifetimes: Record<string, any>
  finalMethods: Record<string, (...args: any[]) => any>
  finalOptions: Record<string, any>
  applyExtraInstanceFields: (instance: InternalRuntimeState) => void
  templateRefs: TemplateRefBinding[] | undefined
  layoutHosts: LayoutHostBinding[] | undefined
  attachWevuPropKeys: (instance: InternalRuntimeState) => void
  setupLifecycle: 'created' | 'attached'
  syncWevuPropsFromInstance: (instance: InternalRuntimeState) => void
  syncWevuPropsFromValues: (instance: InternalRuntimeState, values: Record<string, unknown> | undefined) => void
  directPropsDerivedKeys: string[]
  isPage: boolean
  vueLifecycles: Record<string, unknown>
  getRuntimeOwnerLabel: (instance: InternalRuntimeState) => string
  registerNative?: boolean
}) {
  const {
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
    directPropsDerivedKeys,
    isPage,
    vueLifecycles,
    getRuntimeOwnerLabel,
    registerNative = true,
  } = options
  const activeTemplateRefs = Array.isArray(templateRefs) && templateRefs.length > 0
    ? templateRefs
    : undefined
  if (activeTemplateRefs) {
    requireRuntimeCapability('templateRefs', 'registerComponentDefinition(template refs)')
  }
  const activeLayoutHosts = Array.isArray(layoutHosts) && layoutHosts.length > 0
    ? layoutHosts
    : undefined
  const layoutHooks = activeLayoutHosts
    ? requireRuntimeCapability('layout', 'registerComponentDefinition(layout hosts)')
    : undefined

  const scheduleTemplateRefs = (instance: InternalRuntimeState, onResolved?: () => void) => {
    if (activeTemplateRefs) {
      runtimeCapabilityRegistry.templateRefs?.schedule(instance, onResolved)
      return
    }
    onResolved?.()
  }

  const resolveRuntime = (instance: InternalRuntimeState) => {
    const directRuntime = (instance as any).__wevu ?? (instance as any)[WEVU_PUBLIC_RUNTIME_KEY]
    if (directRuntime) {
      return directRuntime
    }
    const runtimeState = (instance as any).$state
    if (runtimeState && typeof runtimeState === 'object') {
      return (runtimeState as any)[WEVU_RUNTIME_KEY]
    }
    return undefined
  }

  const resolveLifecycleContext = (instance: InternalRuntimeState) => {
    const runtimeProxy = resolveRuntime(instance)?.proxy
    if (runtimeProxy) {
      return runtimeProxy
    }
    return runtimeCapabilityRegistry.scopedSlots?.resolveLifecycleProxy(instance) ?? instance
  }

  const mountMissingRuntime = (instance: InternalRuntimeState) => {
    const existing = resolveRuntime(instance)
    if (existing) {
      return { runtime: existing, mounted: false }
    }
    applyExtraInstanceFields(instance)
    attachWevuPropKeys(instance)
    mountRuntimeInstance(instance, runtimeApp, watch, setup, {
      deferSetData: true,
      snapshotOmitKeys: directPropsDerivedKeys,
    })
    syncWevuPropsFromInstance(instance)
    enableDeferredSetData(instance)
    return { runtime: resolveRuntime(instance), mounted: true }
  }

  const callVueLifecycle = (instance: InternalRuntimeState, name: string, args: any[]) => {
    const hook = vueLifecycles[name]
    if (typeof hook === 'function') {
      return hook.apply(resolveLifecycleContext(instance), args)
    }
    return undefined
  }

  const deferPageUntilNavigation = (instance: InternalRuntimeState, task: () => void) => {
    if (!isPage) {
      task()
      return
    }
    const initialNavigationPromise = ensureInitialNavigation(instance as any, undefined, {
      start: false,
      onComplete: (shouldMount) => {
        if (shouldMount) {
          task()
        }
      },
    })
    if (!initialNavigationPromise) {
      task()
    }
  }

  const ensureReadyRuntime = (instance: InternalRuntimeState) => {
    if (resolveRuntime(instance) || typeof vueLifecycles.mounted !== 'function') {
      return
    }
    const result = mountMissingRuntime(instance)
    if (result.mounted) {
      callVueLifecycle(instance, 'created', [])
      callVueLifecycle(instance, 'beforeMount', [])
    }
  }

  const pageMethodBridges: Record<string, (...args: any[]) => any> = {}
  const attachRuntimeLayoutHosts = (instance: InternalRuntimeState) => {
    if (activeLayoutHosts) {
      layoutHooks?.attachHosts(activeLayoutHosts, instance)
    }
  }
  const attachPageLayoutSetter = (instance: InternalRuntimeState) => {
    if (isPage && layoutHooks) {
      layoutHooks?.attachPageSetter(instance)
    }
  }
  if (isPage) {
    const methodBridgeHookNames = ['onPullDownRefresh', 'onReachBottom', 'onShareAppMessage', 'onShareTimeline', 'onAddToFavorites']
    for (const hookName of methodBridgeHookNames) {
      const pageHook = (pageLifecycleHooks as any)[hookName]
      if (typeof pageHook !== 'function') {
        continue
      }
      if (typeof (finalMethods as any)[hookName] === 'function') {
        continue
      }
      pageMethodBridges[hookName] = function pageMethodBridge(this: InternalRuntimeState, ...args: any[]) {
        return pageHook.apply(this, args)
      }
    }
  }

  const componentDefinition = {
    ...restOptions,
    ...(isPage ? pageLifecycleHooks : {}),
    observers: finalObservers,
    lifetimes: {
      ...userLifetimes,
      created: function created(this: InternalRuntimeState, ...args: any[]) {
        applyExtraInstanceFields(this)
        attachWevuPropKeys(this)
        if (activeTemplateRefs) {
          runtimeCapabilityRegistry.templateRefs?.attachBindings(this, activeTemplateRefs)
        }
        const runCreated = () => {
          callVueLifecycle(this, 'beforeCreate', args)
          if (setupLifecycle === 'created') {
            try {
              mountRuntimeInstance(this, runtimeApp, watch, setup, {
                deferSetData: true,
                snapshotOmitKeys: directPropsDerivedKeys,
              })
            }
            catch (error) {
              const label = getRuntimeOwnerLabel(this)
              throw new Error(`[wevu] mount runtime failed in created (${label}): ${error instanceof Error ? error.message : String(error)}`)
            }
            syncWevuPropsFromInstance(this)
            attachPageLayoutSetter(this)
          }
          if (typeof (userLifetimes as any).created === 'function') {
            ;(userLifetimes as any).created.apply(this, args)
          }
        }
        deferPageUntilNavigation(this, runCreated)
      },
      moved: function moved(this: InternalRuntimeState, ...args: any[]) {
        callHookList(this, 'onMoved', args)
        if (typeof (userLifetimes as any).moved === 'function') {
          ;(userLifetimes as any).moved.apply(this, args)
        }
      },
      attached: function attached(this: InternalRuntimeState, ...args: any[]) {
        applyExtraInstanceFields(this)
        attachWevuPropKeys(this)
        if (activeTemplateRefs && !runtimeCapabilityRegistry.templateRefs?.hasBindings(this)) {
          runtimeCapabilityRegistry.templateRefs?.attachBindings(this, activeTemplateRefs)
        }
        deferPageUntilNavigation(this, () => {
          if (setupLifecycle !== 'created' || !(this as any).__wevu) {
            try {
              mountRuntimeInstance(this, runtimeApp, watch, setup, {
                deferSetData: true,
                snapshotOmitKeys: directPropsDerivedKeys,
              })
            }
            catch (error) {
              const label = getRuntimeOwnerLabel(this)
              throw new Error(`[wevu] mount runtime failed in attached (${label}): ${error instanceof Error ? error.message : String(error)}`)
            }
          }
          syncWevuPropsFromInstance(this)
          callVueLifecycle(this, 'created', args)
          callVueLifecycle(this, 'beforeMount', args)
          attachPageLayoutSetter(this)
          attachRuntimeLayoutHosts(this)
          enableDeferredSetData(this)
          callHookList(this, 'onAttached', args)
          if (typeof (userLifetimes as any).attached === 'function') {
            ;(userLifetimes as any).attached.apply(this, args)
          }
        })
      },
      ready: function ready(this: InternalRuntimeState, ...args: any[]) {
        if (isPage && !(this as any)[WEVU_READY_CALLED_KEY]) {
          const initialNavigationPromise = ensureInitialNavigation(this as any, undefined, {
            start: true,
            onComplete: (shouldMount) => {
              if (shouldMount && !(this as any).__wevuInitialNavigationReady) {
                ;(this as any).__wevuInitialNavigationReady = true
                componentDefinition.lifetimes.ready.call(this, ...args)
              }
            },
          })
          if (initialNavigationPromise && !(this as any).__wevuInitialNavigationReady) {
            return
          }
        }
        ensureReadyRuntime(this)
        if (isPage && typeof (pageLifecycleHooks as any).onReady === 'function') {
          const wasReadyCalled = Boolean((this as any)[WEVU_READY_CALLED_KEY])
          ;(pageLifecycleHooks as any).onReady.call(this, ...args)
          if (!wasReadyCalled) {
            const callMounted = () => callVueLifecycle(this, 'mounted', args)
            const initialNavigationPromise = ensureInitialNavigation(this as any, undefined, {
              start: false,
              onComplete: (shouldMount) => {
                if (shouldMount) {
                  callMounted()
                }
              },
            })
            if (!initialNavigationPromise) {
              callMounted()
            }
          }
          if (typeof (userLifetimes as any).ready === 'function') {
            ;(userLifetimes as any).ready.apply(this, args)
          }
          return
        }
        if (!(this as any)[WEVU_READY_CALLED_KEY]) {
          ;(this as any)[WEVU_READY_CALLED_KEY] = true
          syncWevuPropsFromInstance(this)
          runtimeCapabilityRegistry.templateRefs?.scheduleOwner(this)
          scheduleTemplateRefs(this, () => {
            callHookList(this, 'onReady', args)
            callVueLifecycle(this, 'mounted', args)
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
        callVueLifecycle(this, 'beforeUnmount', args)
        callVueLifecycle(this, 'beforeDestroy', args)
        runtimeCapabilityRegistry.templateRefs?.scheduleOwner(this)
        callHookList(this, 'onDetached', args)
        if (isPage && typeof (pageLifecycleHooks as any).onUnload === 'function') {
          ;(pageLifecycleHooks as any).onUnload.call(this, ...args)
          if (typeof (userLifetimes as any).detached === 'function') {
            ;(userLifetimes as any).detached.apply(this, args)
          }
          callVueLifecycle(this, 'unmounted', args)
          callVueLifecycle(this, 'destroyed', args)
          return
        }
        runtimeCapabilityRegistry.templateRefs?.clear(this)
        if (activeLayoutHosts) {
          layoutHooks?.detachHosts(activeLayoutHosts, this)
        }
        teardownRuntimeInstance(this)
        callVueLifecycle(this, 'unmounted', args)
        callVueLifecycle(this, 'destroyed', args)
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
        if (isPage && typeof (pageLifecycleHooks as any).onShow === 'function') {
          ;(pageLifecycleHooks as any).onShow.call(this, ...args)
          if (typeof (userPageLifetimes as any).show === 'function') {
            ;(userPageLifetimes as any).show.apply(this, args)
          }
          return
        }
        setRuntimeSetDataVisibility(this, true)
        callHookList(this, 'onShow', args)
        if (typeof (userPageLifetimes as any).show === 'function') {
          ;(userPageLifetimes as any).show.apply(this, args)
        }
      },
      hide: function hide(this: InternalRuntimeState, ...args: any[]) {
        if (isPage && typeof (pageLifecycleHooks as any).onHide === 'function') {
          ;(pageLifecycleHooks as any).onHide.call(this, ...args)
          if (typeof (userPageLifetimes as any).hide === 'function') {
            ;(userPageLifetimes as any).hide.apply(this, args)
          }
          return
        }
        setRuntimeSetDataVisibility(this, false)
        callHookList(this, 'onHide', args)
        if (typeof (userPageLifetimes as any).hide === 'function') {
          ;(userPageLifetimes as any).hide.apply(this, args)
        }
      },
      resize: function resize(this: InternalRuntimeState, ...args: any[]) {
        if (isPage && typeof (pageLifecycleHooks as any).onResize === 'function') {
          ;(pageLifecycleHooks as any).onResize.call(this, ...args)
          if (typeof (userPageLifetimes as any).resize === 'function') {
            ;(userPageLifetimes as any).resize.apply(this, args)
          }
          return
        }
        callHookList(this, 'onResize', args)
        if (typeof (userPageLifetimes as any).resize === 'function') {
          ;(userPageLifetimes as any).resize.apply(this, args)
        }
      },
      routeDone: function routeDone(this: InternalRuntimeState, ...args: any[]) {
        if (isPage && typeof (pageLifecycleHooks as any).onRouteDone === 'function') {
          ;(pageLifecycleHooks as any).onRouteDone.call(this, ...args)
          if (typeof (userPageLifetimes as any).routeDone === 'function') {
            ;(userPageLifetimes as any).routeDone.apply(this, args)
          }
          return
        }
        callHookList(this, 'onRouteDone', args)
        if (typeof (userPageLifetimes as any).routeDone === 'function') {
          ;(userPageLifetimes as any).routeDone.apply(this, args)
        }
      },
    },
    methods: {
      ...pageMethodBridges,
      ...finalMethods,
      [WEVU_RESOLVE_PUBLIC_INSTANCE_METHOD]: function resolvePublicInstance(this: InternalRuntimeState) {
        const result = mountMissingRuntime(this)
        if (result.mounted) {
          callVueLifecycle(this, 'created', [])
          callVueLifecycle(this, 'beforeMount', [])
        }
        return result.runtime?.proxy
      },
    },
    options: finalOptions,
  }
  if (!registerNative) {
    return componentDefinition
  }

  const statefulHmrBridge = getMiniProgramRuntimeGlobalObject()?.[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  if (typeof statefulHmrBridge?.trackWevuComponent === 'function') {
    const definition = statefulHmrBridge.trackWevuComponent(componentDefinition, (
      instance: InternalRuntimeState,
      stateSnapshot?: Record<string, any>,
    ) => {
      refreshRuntimeInstance(instance, runtimeApp, watch, setup, {
        snapshotOmitKeys: directPropsDerivedKeys,
        stateSnapshot,
      })
      syncWevuPropsFromInstance(instance)
      attachPageLayoutSetter(instance)
      attachRuntimeLayoutHosts(instance)
      enableDeferredSetData(instance, { rehydrateSetupState: true })
    })
    if (!statefulHmrBridge.isApplying()) {
      registerNativeComponentDefinition(definition, isPage)
    }
    return definition
  }
  registerNativeComponentDefinition(componentDefinition, isPage)
  return componentDefinition
}
