import type { LayoutHostBinding } from '../../layoutBridge'
import type { TemplateRefBinding } from '../../templateRefs'
import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  RuntimeApp,
} from '../../types'
import type { WatchMap } from '../watch'
import { callHookList } from '../../hooks'
import { registerRuntimeLayoutHosts, unregisterRuntimeLayoutHosts } from '../../layoutBridge'
import { resolveRuntimePageLayoutName, syncRuntimePageLayoutState } from '../../pageLayout'
import { clearTemplateRefs, scheduleTemplateRefUpdate } from '../../templateRefs'
import { enableDeferredSetData, mountRuntimeInstance, setRuntimeSetDataVisibility, teardownRuntimeInstance } from '../runtimeInstance'

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
  isPage: boolean
  legacyCreated: unknown
  getRuntimeOwnerLabel: (instance: InternalRuntimeState) => string
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
    isPage,
    legacyCreated,
    getRuntimeOwnerLabel,
  } = options

  const pageShareMethodBridges: Record<string, (...args: any[]) => any> = {}
  const attachRuntimeLayoutHosts = (instance: InternalRuntimeState) => {
    if (!Array.isArray(layoutHosts) || !layoutHosts.length) {
      return
    }
    if ((instance as any).__wevuLayoutHostBridge) {
      return
    }
    const bridge = registerRuntimeLayoutHosts(layoutHosts, instance)
    if (bridge) {
      instance.__wevuLayoutHostBridge = bridge
    }
  }
  const attachPageLayoutSetter = (instance: InternalRuntimeState) => {
    if (!isPage) {
      return
    }
    instance.__wevuSetPageLayout = (layout: string | false, props?: Record<string, any>) => {
      const runtimeState = instance.__wevu?.state as Record<string, any> | undefined
      if (!runtimeState || typeof runtimeState !== 'object') {
        return
      }
      runtimeState.__wv_page_layout_name = resolveRuntimePageLayoutName(layout)
      const nextProps = layout === false ? {} : (props ?? {})
      runtimeState.__wv_page_layout_props = nextProps
      syncRuntimePageLayoutState(instance as Record<string, any>, layout, nextProps)
    }
  }
  if (isPage) {
    const shareHookNames = ['onShareAppMessage', 'onShareTimeline', 'onAddToFavorites']
    for (const hookName of shareHookNames) {
      const pageHook = (pageLifecycleHooks as any)[hookName]
      if (typeof pageHook !== 'function') {
        continue
      }
      if (typeof (finalMethods as any)[hookName] === 'function') {
        continue
      }
      pageShareMethodBridges[hookName] = function pageShareMethodBridge(this: InternalRuntimeState, ...args: any[]) {
        return pageHook.apply(this, args)
      }
    }
  }

  Component({
    ...restOptions,
    ...pageLifecycleHooks,
    observers: finalObservers,
    lifetimes: {
      ...userLifetimes,
      created: function created(this: InternalRuntimeState, ...args: any[]) {
        applyExtraInstanceFields(this)
        if (Array.isArray(templateRefs) && templateRefs.length) {
          Object.defineProperty(this, '__wevuTemplateRefs', {
            value: templateRefs,
            configurable: true,
            enumerable: false,
            writable: false,
          })
        }
        attachWevuPropKeys(this)
        if (setupLifecycle === 'created') {
          try {
            mountRuntimeInstance(this, runtimeApp, watch, setup, { deferSetData: true })
          }
          catch (error) {
            const label = getRuntimeOwnerLabel(this)
            throw new Error(`[wevu] mount runtime failed in created (${label}): ${error instanceof Error ? error.message : String(error)}`)
          }
          syncWevuPropsFromInstance(this)
          attachPageLayoutSetter(this)
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
        applyExtraInstanceFields(this)
        if (Array.isArray(templateRefs) && templateRefs.length && !(this as any).__wevuTemplateRefs) {
          Object.defineProperty(this, '__wevuTemplateRefs', {
            value: templateRefs,
            configurable: true,
            enumerable: false,
            writable: false,
          })
        }
        attachWevuPropKeys(this)
        if (setupLifecycle !== 'created' || !(this as any).__wevu) {
          try {
            mountRuntimeInstance(this, runtimeApp, watch, setup)
          }
          catch (error) {
            const label = getRuntimeOwnerLabel(this)
            throw new Error(`[wevu] mount runtime failed in attached (${label}): ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        syncWevuPropsFromInstance(this)
        attachPageLayoutSetter(this)
        attachRuntimeLayoutHosts(this)
        if (setupLifecycle === 'created') {
          enableDeferredSetData(this)
        }
        callHookList(this, 'onAttached', args)
        if (typeof (userLifetimes as any).attached === 'function') {
          ;(userLifetimes as any).attached.apply(this, args)
        }
      },
      ready: function ready(this: InternalRuntimeState, ...args: any[]) {
        if (isPage && typeof (pageLifecycleHooks as any).onReady === 'function') {
          ;(pageLifecycleHooks as any).onReady.call(this, ...args)
          if (typeof (userLifetimes as any).ready === 'function') {
            ;(userLifetimes as any).ready.apply(this, args)
          }
          return
        }
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
        callHookList(this, 'onDetached', args)
        if (isPage && typeof (pageLifecycleHooks as any).onUnload === 'function') {
          ;(pageLifecycleHooks as any).onUnload.call(this, ...args)
          if (typeof (userLifetimes as any).detached === 'function') {
            ;(userLifetimes as any).detached.apply(this, args)
          }
          return
        }
        clearTemplateRefs(this)
        if (Array.isArray(layoutHosts) && layoutHosts.length && (this as any).__wevuLayoutHostBridge) {
          unregisterRuntimeLayoutHosts(layoutHosts, (this as any).__wevuLayoutHostBridge)
          delete (this as any).__wevuLayoutHostBridge
        }
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
      ...pageShareMethodBridges,
      ...finalMethods,
    },
    options: finalOptions,
  })
}
