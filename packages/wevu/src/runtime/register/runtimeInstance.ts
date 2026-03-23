import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  RuntimeApp,
  RuntimeInstance,
} from '../types'
import type { AdapterWithSetData } from './runtimeInstance/utils'
import type { WatchMap } from './watch'
import { callHookList } from '../hooks'
import { resolveRuntimePageLayoutName, syncRuntimePageLayoutState } from '../pageLayout'
import { allocateOwnerId, attachOwnerSnapshot, removeOwner, updateOwnerSnapshot } from '../scopedSlots'
import { clearTemplateRefs, scheduleTemplateRefUpdate } from '../templateRefs'
import { bridgeRuntimeMethodsToTarget } from './runtimeInstance/methodBridge'
import {
  createNoopWatchStopHandle,
  safeMarkNoSetData,
} from './runtimeInstance/setupContext'
import { runRuntimeSetupPhase } from './runtimeInstance/setupPhase'
import {

  attachNativeInstanceRef,
  attachRuntimeInstance,
  attachRuntimeProxyProps,
  attachRuntimeRef,
  callNativeSetData,
  resolveNativeSetData,
  syncRuntimeProps,
} from './runtimeInstance/utils'
import { createSetDataHighFrequencyWarningMonitor } from './setDataFrequencyWarning'
import { registerWatches } from './watch'

type RuntimeSetupFunction<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
  | DefineAppOptions<D, C, M>['setup']

type RuntimeInstanceWithSyncFlush<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> = RuntimeInstance<D, C, M> & {
  __wevu_flushSetupSnapshotSync?: () => void
}

function attachPageLayoutSetter(target: InternalRuntimeState) {
  if (typeof (target as any).route !== 'string' || !(target as any).route) {
    return
  }

  target.__wevuSetPageLayout = (layout: string | false, props?: Record<string, any>) => {
    const runtimeState = target.__wevu?.state as Record<string, any> | undefined
    if (!runtimeState || typeof runtimeState !== 'object') {
      return
    }

    runtimeState.__wv_page_layout_name = resolveRuntimePageLayoutName(layout)
    const nextProps = layout === false ? {} : (props ?? {})
    runtimeState.__wv_page_layout_props = nextProps
    syncRuntimePageLayoutState(target as Record<string, any>, layout, nextProps)
  }
}

/**
 * 挂载运行时实例（框架内部注册流程使用）。
 * @internal
 */
export function mountRuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<D, C, M>,
  watchMap: WatchMap | undefined,
  setup?: RuntimeSetupFunction<D, C, M>,
  options?: { deferSetData?: boolean },
) {
  if (target.__wevu) {
    return target.__wevu as RuntimeInstance<D, C, M>
  }
  safeMarkNoSetData(target)
  const ownerId = allocateOwnerId()
  const suspendWhenHidden = Boolean((runtimeApp as any)?.__wevuSetDataOptions?.suspendWhenHidden)
  const targetLabel = typeof (target as any).route === 'string' && (target as any).route
    ? `page:${(target as any).route}`
    : typeof (target as any).is === 'string' && (target as any).is
      ? `component:${(target as any).is}`
      : 'unknown-target'
  const highFrequencyWarning = createSetDataHighFrequencyWarningMonitor({
    option: (runtimeApp as any)?.__wevuSetDataOptions?.highFrequencyWarning,
    targetLabel,
    isInPageScrollHook: () => Number((target as any).__wevuPageScrollHookDepth ?? 0) > 0,
  })
  const createDeferredAdapter = (instance: InternalRuntimeState): AdapterWithSetData => {
    let pending: Record<string, any> | undefined
    let enabled = false
    const adapter: AdapterWithSetData = {
      setData(payload: Record<string, any>) {
        if (!enabled) {
          pending = {
            ...(pending ?? {}),
            ...payload,
          }
          return undefined
        }
        const setData = resolveNativeSetData(instance)
        if (setData) {
          return callNativeSetData(instance, setData, payload)
        }
        return undefined
      },
    }
    adapter.__wevu_enableSetData = () => {
      enabled = true
      const setData = resolveNativeSetData(instance)
      if (pending && Object.keys(pending).length && setData) {
        const payload = pending
        pending = undefined
        callNativeSetData(instance, setData, payload)
      }
    }
    return adapter
  }

  const baseAdapter: AdapterWithSetData = options?.deferSetData
    ? createDeferredAdapter(target)
    : {
        setData(payload: Record<string, any>) {
          const setData = resolveNativeSetData(target)
          if (setData) {
            return callNativeSetData(target, setData, payload)
          }
          return undefined
        },
      }
  let runtimeRef: RuntimeInstance<any, any, any> | undefined
  let visible = true
  let hiddenPendingPayload: Record<string, any> | undefined

  const mergePendingPayload = (pending: Record<string, any> | undefined, payload: Record<string, any>) => ({
    ...(pending ?? {}),
    ...payload,
  })
  const refreshOwnerSnapshot = () => {
    if (!runtimeRef) {
      return
    }
    if (typeof runtimeRef.snapshot !== 'function') {
      return
    }
    const snapshot = runtimeRef.snapshot()
    const propsSource = (target as any).__wevuProps ?? (target as any).properties
    if (propsSource && typeof propsSource === 'object') {
      for (const [key, value] of Object.entries(propsSource)) {
        snapshot[key] = value
      }
    }
    updateOwnerSnapshot(ownerId, snapshot, runtimeRef.proxy)
  }
  const adapter: AdapterWithSetData = {
    ...(baseAdapter as any),
    setData(payload: Record<string, any>) {
      highFrequencyWarning?.()
      if (suspendWhenHidden && !visible) {
        hiddenPendingPayload = mergePendingPayload(hiddenPendingPayload, payload)
        refreshOwnerSnapshot()
        scheduleTemplateRefUpdate(target)
        return undefined
      }
      const result = baseAdapter.setData(payload)
      refreshOwnerSnapshot()
      scheduleTemplateRefUpdate(target)
      return result
    },
    __wevu_setVisibility(nextVisible: boolean) {
      visible = nextVisible
      if (!visible || !hiddenPendingPayload) {
        return undefined
      }
      const payload = hiddenPendingPayload
      hiddenPendingPayload = undefined
      const result = baseAdapter.setData(payload)
      refreshOwnerSnapshot()
      scheduleTemplateRefUpdate(target)
      return result
    },
  }

  const runtime = runtimeApp.mount({
    ...(adapter as any),
  })
  runtimeRef = runtime
  attachRuntimeInstance(runtime as RuntimeInstance<any, any, any>, target)
  const runtimeProxy = runtime?.proxy ?? {}
  const runtimeState = runtime?.state ?? {}
  if (runtimeState && typeof runtimeState === 'object') {
    attachRuntimeRef(runtimeState as Record<string, any>, runtime)
    attachNativeInstanceRef(runtimeState as Record<string, any>, target)
  }
  const runtimeComputed = (runtime as any)?.computed ?? Object.create(null)
  // 防护：适配器可能返回不完整的 runtime（或被插件篡改），此处兜底补齐
  if (!runtime?.methods) {
    try {
      ;(runtime as any).methods = Object.create(null)
    }
    catch {
      // 若对象只读则忽略，后续将使用兜底 runtimeMethods
    }
  }
  const runtimeMethods = runtime?.methods ?? Object.create(null)
  const runtimeWatch = (runtime as any)?.watch ?? (() => createNoopWatchStopHandle())
  const runtimeBindModel = (runtime as any)?.bindModel ?? (() => {})
  const runtimeWithDefaults: RuntimeInstance<any, any, any> = {
    ...(runtime ?? {}),
    state: runtimeState,
    proxy: runtimeProxy,
    methods: runtimeMethods,
    computed: runtimeComputed,
    watch: runtimeWatch,
    bindModel: runtimeBindModel,
    snapshot: (runtime as any)?.snapshot ?? (() => Object.create(null)),
    unmount: (runtime as any)?.unmount ?? (() => {}),
  }

  Object.defineProperty(target, '$wevu', {
    value: runtimeWithDefaults,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  target.__wevu = runtimeWithDefaults
  attachPageLayoutSetter(target)

  attachOwnerSnapshot(target, runtimeWithDefaults as any, ownerId)

  if (watchMap) {
    const stops = registerWatches(runtimeWithDefaults, watchMap, target)
    if (stops.length) {
      target.__wevuWatchStops = stops
    }
  }

  if (setup) {
    runRuntimeSetupPhase({
      target,
      runtime,
      runtimeWithDefaults,
      runtimeState: runtimeState as Record<string, any>,
      runtimeProxy: runtimeProxy as Record<string, any>,
      setup,
      syncRuntimeProps,
      attachRuntimeProxyProps,
    })
    ;(runtime as RuntimeInstanceWithSyncFlush<D, C, M>).__wevu_flushSetupSnapshotSync?.()
  }

  // 将 runtime.methods 透传到原生实例，供小程序事件处理直接调用
  bridgeRuntimeMethodsToTarget(target, runtime)

  return runtime
}

export function enableDeferredSetData(target: InternalRuntimeState) {
  const adapter = (target as any).__wevu?.adapter
  if (adapter && typeof (adapter as any).__wevu_enableSetData === 'function') {
    ;(adapter as any).__wevu_enableSetData()
  }
}

export function setRuntimeSetDataVisibility(target: InternalRuntimeState, visible: boolean) {
  const adapter = (target as any).__wevu?.adapter
  if (adapter && typeof (adapter as any).__wevu_setVisibility === 'function') {
    ;(adapter as any).__wevu_setVisibility(visible)
  }
}

/**
 * 卸载运行时实例（框架内部注册流程使用）。
 * @internal
 */
export function teardownRuntimeInstance(target: InternalRuntimeState) {
  const runtime = target.__wevu
  const ownerId = (target as any).__wvOwnerId
  if (ownerId) {
    removeOwner(ownerId)
  }
  clearTemplateRefs(target)
  // 触发卸载钩子（仅在 teardown 首次执行时触发）
  if (runtime && target.__wevuHooks) {
    callHookList(target, 'onUnload', [])
  }
  // 清理注册的生命周期钩子
  if (target.__wevuHooks) {
    target.__wevuHooks = undefined
  }
  const stops = target.__wevuWatchStops
  if (Array.isArray(stops)) {
    for (const stop of stops) {
      try {
        stop()
      }
      catch {
        // 避免 teardown 中断：单个 stop 失败不阻塞其他清理
      }
    }
  }
  target.__wevuWatchStops = undefined
  target.__wevuEffectScope?.stop()
  target.__wevuEffectScope = undefined
  if (runtime) {
    runtime.unmount()
  }
  delete target.__wevu
  if ('$wevu' in target) {
    delete (target as any).$wevu
  }
}
