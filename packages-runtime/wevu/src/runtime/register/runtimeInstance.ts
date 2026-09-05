import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineAppOptions,
  DefineComponentOptions,
  InternalRuntimeState,
  MethodDefinitions,
  RuntimeApp,
  RuntimeInstance,
  SetDataSnapshotOptions,
} from '../types'
import type { AdapterWithSetData } from './runtimeInstance/utils'
import type { WatchMap } from './watch'
import {
  WEVU_EFFECT_SCOPE_KEY,
  WEVU_HOOKS_KEY,
  WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY,
  WEVU_PROPS_DERIVED_KEYS_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_WATCH_STOPS_KEY,
} from '@weapp-core/constants'
import { isRef } from '../../reactivity'
import { isDeepEqualValue } from '../app/setData/snapshot'
import {
  isSetDataHighFrequencyWarningRequested,
  requireRuntimeCapability,
  runtimeCapabilityRegistry,
} from '../capabilities'
import { callHookList } from '../hooks'
import { bridgeRuntimeMethodsToTarget } from './runtimeInstance/methodBridge'
import { attachRuntimeProvideParentContext } from './runtimeInstance/provideContext'
import {
  attachRuntimeSlots,
  createNoopWatchStopHandle,
  safeMarkNoSetData,
} from './runtimeInstance/setupContext'
import { runRuntimeSetupPhase } from './runtimeInstance/setupPhase'
import {
  attachNativeInstanceRef,
  attachRuntimeInstance,
  attachRuntimeRef,
  callNativeSetData,
  ensureRuntimeProps,
  resolveNativeSetData,
} from './runtimeInstance/utils'
import { registerWatches } from './watch'

function cloneInitialSnapshotValue(value: unknown, cache = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }
  if (cache.has(value as object)) {
    return cache.get(value as object)
  }
  if (Array.isArray(value)) {
    const next: unknown[] = []
    cache.set(value, next)
    for (const item of value) {
      next.push(cloneInitialSnapshotValue(item, cache))
    }
    return next
  }
  const next: Record<string, unknown> = {}
  cache.set(value as object, next)
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    next[key] = cloneInitialSnapshotValue(child, cache)
  }
  return next
}

function resolveInitialSnapshotFromNativeData(
  target: InternalRuntimeState,
  omitKeys?: string[],
  extraEntries?: Record<string, unknown>,
) {
  const data = (target as any).data
  if ((!data || typeof data !== 'object') && (!extraEntries || !Object.keys(extraEntries).length)) {
    return undefined
  }
  const omitSet = Array.isArray(omitKeys) && omitKeys.length
    ? new Set(omitKeys)
    : undefined
  const snapshot: Record<string, any> = {}
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (omitSet?.has(key)) {
        continue
      }
      snapshot[key] = cloneInitialSnapshotValue(value)
    }
  }
  if (extraEntries) {
    for (const [key, value] of Object.entries(extraEntries)) {
      if (omitSet?.has(key)) {
        continue
      }
      snapshot[key] = cloneInitialSnapshotValue(value)
    }
  }
  return snapshot
}

function hasTemplateRuntimeBindings(runtimeApp: RuntimeApp<any, any, any>) {
  return Boolean((runtimeApp as any)?.__wevuHasTemplateRuntimeBindings)
}

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
  __wevu_touchSetupMethodsVersion?: () => void
  __wevu_trackSetupReactiveKey?: (key: string) => void
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
  options?: { deferSetData?: boolean, snapshotOmitKeys?: string[] },
) {
  if (target.__wevu) {
    return target.__wevu as RuntimeInstance<D, C, M>
  }
  const runtimeSetDataOptions = (
    runtimeApp as typeof runtimeApp & { __wevuSetDataOptions?: SetDataSnapshotOptions }
  ).__wevuSetDataOptions
  const hasScopedSlotBindings = hasTemplateRuntimeBindings(runtimeApp)
  const scopedSlotHooks = hasScopedSlotBindings
    ? requireRuntimeCapability('scopedSlots', 'mountRuntimeInstance(scoped-slot bindings)')
    : undefined
  const scopedSlotState = scopedSlotHooks?.prepareMount(target)
  const templateRefBindings = target.__wevuTemplateRefs
  if (Array.isArray(templateRefBindings) && templateRefBindings.length) {
    requireRuntimeCapability('templateRefs', 'mountRuntimeInstance(template refs)')
  }
  const highFrequencyWarningRequested = isSetDataHighFrequencyWarningRequested(
    runtimeSetDataOptions?.highFrequencyWarning,
  )
  const highFrequencyWarningHooks = highFrequencyWarningRequested
    ? requireRuntimeCapability('setDataHighFrequencyWarning', 'mountRuntimeInstance(setData.highFrequencyWarning)')
    : undefined
  attachRuntimeProvideParentContext(target, runtimeApp as RuntimeApp<any, any, any>)
  safeMarkNoSetData(target)
  const suspendWhenHidden = Boolean(runtimeSetDataOptions?.suspendWhenHidden)
  const targetLabel = typeof (target as any).route === 'string' && (target as any).route
    ? `page:${(target as any).route}`
    : typeof (target as any).is === 'string' && (target as any).is
      ? `component:${(target as any).is}`
      : 'unknown-target'
  const highFrequencyWarning = highFrequencyWarningHooks?.createMonitor({
    option: runtimeSetDataOptions?.highFrequencyWarning,
    targetLabel,
    isInPageScrollHook: () => Number((target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 0) > 0,
  })
  const createDeferredAdapter = (instance: InternalRuntimeState): AdapterWithSetData => {
    let pending: Record<string, any> | undefined
    let pendingCallbacks: Array<() => void> = []
    let enabled = false
    const adapter: AdapterWithSetData = {
      setData(payload: Record<string, any>, callback?: () => void) {
        if (!enabled) {
          pending = {
            ...(pending ?? {}),
            ...payload,
          }
          if (callback) {
            pendingCallbacks.push(callback)
          }
          return undefined
        }
        const setData = resolveNativeSetData(instance)
        if (setData) {
          return callNativeSetData(instance, setData, payload, callback)
        }
        return undefined
      },
    }
    adapter.__wevu_enableSetData = (discardPending = false) => {
      enabled = true
      if (discardPending) {
        pending = undefined
        pendingCallbacks = []
      }
      const setData = resolveNativeSetData(instance)
      if (pending && Object.keys(pending).length && setData) {
        const payload = pending
        const callbacks = pendingCallbacks
        pending = undefined
        pendingCallbacks = []
        const callback = callbacks.length
          ? () => callbacks.forEach(callback => callback())
          : undefined
        callNativeSetData(instance, setData, payload, callback)
      }
    }
    return adapter
  }

  const baseAdapter: AdapterWithSetData = options?.deferSetData
    ? createDeferredAdapter(target)
    : {
        setData(payload: Record<string, any>, callback?: () => void) {
          const setData = resolveNativeSetData(target)
          if (setData) {
            return callNativeSetData(target, setData, payload, callback)
          }
          return undefined
        },
      }
  let visible = true
  let hiddenPendingPayload: Record<string, any> | undefined

  const mergePendingPayload = (pending: Record<string, any> | undefined, payload: Record<string, any>) => ({
    ...(pending ?? {}),
    ...payload,
  })
  const refreshOwnerSnapshot = () => {
    if (scopedSlotState) {
      runtimeCapabilityRegistry.scopedSlots?.refresh(target, scopedSlotState)
    }
  }
  const syncNativeOwnerId = () => {
    if (scopedSlotState) {
      scopedSlotHooks?.syncNativeOwnerId(target, scopedSlotState)
    }
  }
  const adapter: AdapterWithSetData = {
    ...(baseAdapter as any),
    setData(payload: Record<string, any>) {
      highFrequencyWarning?.()
      if (suspendWhenHidden && !visible) {
        hiddenPendingPayload = mergePendingPayload(hiddenPendingPayload, payload)
        refreshOwnerSnapshot()
        if (Array.isArray(target.__wevuTemplateRefs) && target.__wevuTemplateRefs.length > 0) {
          runtimeCapabilityRegistry.templateRefs?.schedule(target)
        }
        return undefined
      }
      const hasTemplateRefs = Array.isArray(target.__wevuTemplateRefs) && target.__wevuTemplateRefs.length > 0
      refreshOwnerSnapshot()
      if (hasTemplateRefs && resolveNativeSetData(target)) {
        return new Promise<void>((resolve) => {
          baseAdapter.setData(payload, () => {
            refreshOwnerSnapshot()
            runtimeCapabilityRegistry.templateRefs?.schedule(target)
            resolve()
          })
        })
      }
      const result = baseAdapter.setData(payload)
      if (hasTemplateRefs) {
        runtimeCapabilityRegistry.templateRefs?.schedule(target)
      }
      return result
    },
    __wevu_setVisibility(nextVisible: boolean) {
      visible = nextVisible
      if (!visible || !hiddenPendingPayload) {
        return undefined
      }
      const payload = hiddenPendingPayload
      hiddenPendingPayload = undefined
      const hasTemplateRefs = Array.isArray(target.__wevuTemplateRefs) && target.__wevuTemplateRefs.length > 0
      refreshOwnerSnapshot()
      if (hasTemplateRefs && resolveNativeSetData(target)) {
        return new Promise<void>((resolve) => {
          baseAdapter.setData(payload, () => {
            refreshOwnerSnapshot()
            runtimeCapabilityRegistry.templateRefs?.schedule(target)
            resolve()
          })
        })
      }
      const result = baseAdapter.setData(payload)
      if (hasTemplateRefs) {
        runtimeCapabilityRegistry.templateRefs?.schedule(target)
      }
      return result
    },
  }

  const baseMountAdapter = {
    ...(adapter as any),
  }
  Object.defineProperty(baseMountAdapter, '__wevu_targetLabel', {
    configurable: true,
    enumerable: false,
    value: targetLabel,
    writable: false,
  })
  const targetProperties = (target as any).properties
  if (targetProperties && typeof targetProperties === 'object') {
    Object.defineProperty(baseMountAdapter, '__wevu_initialProps', {
      configurable: true,
      enumerable: false,
      value: targetProperties,
      writable: false,
    })
  }
  if (Array.isArray(options?.snapshotOmitKeys) && options.snapshotOmitKeys.length) {
    Object.defineProperty(baseMountAdapter, '__wevu_snapshotOmitKeys', {
      configurable: true,
      enumerable: false,
      value: options.snapshotOmitKeys,
      writable: false,
    })
  }
  const initialSnapshot = resolveInitialSnapshotFromNativeData(
    target,
    options?.snapshotOmitKeys,
  )
  if (initialSnapshot && Object.keys(initialSnapshot).length) {
    Object.defineProperty(baseMountAdapter, '__wevu_initialSnapshot', {
      configurable: true,
      enumerable: false,
      value: initialSnapshot,
      writable: false,
    })
  }
  if (scopedSlotState) {
    Object.defineProperty(baseMountAdapter, '__wevu_initialState', {
      configurable: true,
      enumerable: false,
      value: { [WEVU_SLOT_OWNER_ID_KEY]: scopedSlotState.ownerId },
      writable: false,
    })
  }
  const shouldDeferInitialSnapshot = Boolean(options?.deferSetData)
    || Boolean(setup)
    || Boolean(targetProperties && typeof targetProperties === 'object' && Object.keys(targetProperties).length > 0)
  if (shouldDeferInitialSnapshot) {
    Object.defineProperty(baseMountAdapter, '__wevu_deferInitialSnapshot', {
      configurable: true,
      enumerable: false,
      value: true,
      writable: false,
    })
  }
  const runtime = runtimeApp.mount(baseMountAdapter)
  attachRuntimeInstance(runtime as RuntimeInstance<any, any, any>, target)
  const runtimeProxy = runtime?.proxy ?? {}
  const runtimeState = runtime?.state ?? {}
  const runtimeSetupState = runtime?.setupState ?? Object.create(null)
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
  const runtimeWithDefaults = {
    ...(runtime ?? {}),
    state: runtimeState,
    setupState: runtimeSetupState,
    proxy: runtimeProxy,
    methods: runtimeMethods,
    computed: runtimeComputed,
    watch: runtimeWatch,
    bindModel: runtimeBindModel,
    snapshot: (runtime as any)?.snapshot ?? (() => Object.create(null)),
    unmount: (runtime as any)?.unmount ?? (() => {}),
  } satisfies RuntimeInstance<any, any, any>
  Object.defineProperty(runtimeWithDefaults, '__wevu_initialRuntimeSnapshot', {
    configurable: true,
    enumerable: false,
    value: cloneInitialSnapshotValue(runtimeState),
    writable: false,
  })
  const runtimeWithSyncFlush = runtimeWithDefaults as RuntimeInstanceWithSyncFlush<D, C, M>
  const internalRuntimeFields = {
    __wevu_flushSetupSnapshotSync: (runtime as RuntimeInstanceWithSyncFlush<D, C, M>).__wevu_flushSetupSnapshotSync,
    __wevu_touchSetupMethodsVersion: (runtime as RuntimeInstanceWithSyncFlush<D, C, M>).__wevu_touchSetupMethodsVersion,
    __wevu_trackSetupReactiveKey: (runtime as RuntimeInstanceWithSyncFlush<D, C, M>).__wevu_trackSetupReactiveKey,
    [WEVU_PROPS_DERIVED_KEYS_KEY]: (runtime as any)[WEVU_PROPS_DERIVED_KEYS_KEY],
  }
  for (const [key, value] of Object.entries(internalRuntimeFields)) {
    if (!value) {
      continue
    }
    Object.defineProperty(runtimeWithDefaults, key, {
      configurable: true,
      enumerable: false,
      value,
      writable: true,
    })
  }

  Object.defineProperty(target, WEVU_PUBLIC_RUNTIME_KEY, {
    value: runtimeWithDefaults,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  target.__wevu = runtimeWithDefaults
  const runtimeProps = ensureRuntimeProps(target, runtimeState as Record<string, any>)
  attachRuntimeSlots(runtimeState as Record<string, any>, runtimeProps)

  if (scopedSlotState) {
    scopedSlotHooks?.attachMount(target, runtimeWithDefaults, scopedSlotState, Boolean(options?.deferSetData))
  }
  syncNativeOwnerId()

  const watchStops = watchMap
    ? registerWatches(runtimeWithDefaults, watchMap, target, {
        deferMissingSourceBaseline: Boolean(setup),
      })
    : []
  if (watchStops.length) {
    target[WEVU_WATCH_STOPS_KEY] = watchStops
  }

  if (setup) {
    runRuntimeSetupPhase({
      target,
      runtime,
      runtimeWithDefaults,
      runtimeState: runtimeState as Record<string, any>,
      runtimeProxy: runtimeProxy as Record<string, any>,
      setup,
    })
    if (!options?.deferSetData) {
      runtimeWithSyncFlush.__wevu_flushSetupSnapshotSync?.()
    }
    if (!options?.deferSetData) {
      refreshOwnerSnapshot()
    }
    for (const stop of watchStops) {
      stop.resume()
    }
  }
  else if (
    !options?.deferSetData
    && (target as any).properties
    && typeof (target as any).properties === 'object'
    && Object.keys((target as any).properties).length > 0
  ) {
    runtimeWithSyncFlush.__wevu_flushSetupSnapshotSync?.()
    refreshOwnerSnapshot()
  }

  // 将 runtime.methods 透传到原生实例，供小程序事件处理直接调用
  bridgeRuntimeMethodsToTarget(target, runtime)

  return runtime
}

function preserveRuntimeFacadeIdentity<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  target: InternalRuntimeState,
  previousRuntime: RuntimeInstance<D, C, M>,
  nextRuntime: RuntimeInstance<D, C, M>,
) {
  for (const key of Reflect.ownKeys(previousRuntime)) {
    if (!Reflect.has(nextRuntime, key)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(previousRuntime, key)
      if (descriptor?.configurable) {
        Reflect.deleteProperty(previousRuntime, key)
      }
    }
  }
  for (const key of Reflect.ownKeys(nextRuntime)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(nextRuntime, key)
    if (!descriptor) {
      continue
    }
    try {
      Reflect.defineProperty(previousRuntime, key, descriptor)
    }
    catch {
      try {
        ;(previousRuntime as any)[key] = (nextRuntime as any)[key]
      }
      catch {
        // 宿主包装对象仍持有旧 runtime 时，保留无法覆盖的只读字段。
      }
    }
  }
  attachRuntimeRef(previousRuntime.state as Record<string, any>, previousRuntime)
  target.__wevu = previousRuntime
  Object.defineProperty(target, WEVU_PUBLIC_RUNTIME_KEY, {
    value: previousRuntime,
    configurable: true,
    enumerable: false,
    writable: false,
  })
  return previousRuntime
}

function createRuntimeStateSnapshot(
  runtime: RuntimeInstance<any, any, any>,
  nativeData: Record<string, any> | undefined,
  preferredState?: Record<string, any>,
) {
  const runtimeState = runtime.state as Record<string, any>
  const setupState = runtime.setupState as Record<string, any> | undefined
  const snapshot: Record<string, any> = {}
  for (const key of Object.keys(nativeData ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(runtimeState, key)) {
      continue
    }
    const setupBinding = setupState?.[key]
    if (setupState && Object.prototype.hasOwnProperty.call(setupState, key) && !isRef(setupBinding)) {
      continue
    }
    if (preferredState && Object.prototype.hasOwnProperty.call(preferredState, key)) {
      snapshot[key] = cloneInitialSnapshotValue(preferredState[key])
      continue
    }
    snapshot[key] = cloneInitialSnapshotValue(isRef(setupBinding) ? setupBinding.value : runtimeState[key])
  }
  return snapshot
}

function collectPlainSetupSnapshotKeys(
  runtime: RuntimeInstance<any, any, any>,
  nativeData: Record<string, any> | undefined,
) {
  const setupState = runtime.setupState as Record<string, any> | undefined
  if (!setupState || !nativeData || typeof nativeData !== 'object') {
    return []
  }
  return Object.keys(nativeData).filter((key) => {
    const setupBinding = setupState[key]
    return Object.prototype.hasOwnProperty.call(setupState, key) && !isRef(setupBinding)
  })
}

function syncRuntimeStateFromNativeData(
  target: InternalRuntimeState,
  options?: { includeSetupState?: boolean, nativeData?: Record<string, any> },
) {
  const runtime = target.__wevu
  const runtimeState = runtime?.state as Record<string, any> | undefined
  const setupState = runtime?.setupState as Record<string, any> | undefined
  const nativeData = options?.nativeData ?? (target as any).data as Record<string, any> | undefined
  if (!runtimeState || typeof runtimeState !== 'object' || !nativeData || typeof nativeData !== 'object') {
    return
  }
  const initialRuntimeSnapshot = (runtime as any)?.__wevu_initialRuntimeSnapshot as Record<string, any> | undefined
  for (const [key, value] of Object.entries(nativeData)) {
    if (!key || key === 'undefined') {
      continue
    }
    if (Object.prototype.hasOwnProperty.call(runtimeState, key)) {
      try {
        const setupBinding = setupState?.[key]
        const runtimeValue = cloneInitialSnapshotValue(value)
        if (!options?.includeSetupState && setupState && Object.prototype.hasOwnProperty.call(setupState, key)) {
          continue
        }
        if (
          !options?.includeSetupState
          && initialRuntimeSnapshot
          && Object.prototype.hasOwnProperty.call(initialRuntimeSnapshot, key)
          && !isDeepEqualValue(runtimeState[key], initialRuntimeSnapshot[key], 20, { keys: 10_000 })
        ) {
          continue
        }
        if (
          !options?.includeSetupState
          && initialRuntimeSnapshot
          && !Object.prototype.hasOwnProperty.call(initialRuntimeSnapshot, key)
        ) {
          continue
        }
        if (isRef(setupBinding)) {
          setupBinding.value = runtimeValue
          continue
        }
        runtimeState[key] = runtimeValue
      }
      catch {
        // DevTools 热更新期间可能带入响应式 state 拒绝写入的临时 data key，跳过即可。
      }
    }
  }
}

export function enableDeferredSetData(
  target: InternalRuntimeState,
  options?: { rehydrateSetupState?: boolean },
) {
  const adapter = (target as any).__wevu?.adapter
  syncRuntimeStateFromNativeData(target, {
    includeSetupState: options?.rehydrateSetupState,
  })
  if (adapter && typeof (adapter as any).__wevu_enableSetData === 'function') {
    ;(adapter as any).__wevu_enableSetData(true)
  }
  ;(target as any).__wevu?.__wevu_flushSetupSnapshotSync?.()
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
export function teardownRuntimeInstance(target: InternalRuntimeState, options?: { skipHooks?: boolean }) {
  const runtime = target.__wevu
  runtimeCapabilityRegistry.scopedSlots?.teardown(target)
  if (Array.isArray(target.__wevuTemplateRefs) && target.__wevuTemplateRefs.length > 0) {
    runtimeCapabilityRegistry.templateRefs?.clear(target)
  }
  // 触发卸载钩子（仅在 teardown 首次执行时触发）
  if (!options?.skipHooks && runtime && target[WEVU_HOOKS_KEY]) {
    callHookList(target, 'onUnload', [])
  }
  // 清理注册的生命周期钩子
  if (target[WEVU_HOOKS_KEY]) {
    target[WEVU_HOOKS_KEY] = undefined
  }
  const stops = target[WEVU_WATCH_STOPS_KEY]
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
  target[WEVU_WATCH_STOPS_KEY] = undefined
  let firstError: unknown
  let hasError = false
  const recordError = (error: unknown) => {
    if (hasError) {
      return
    }
    firstError = error
    hasError = true
  }

  const effectScope = target[WEVU_EFFECT_SCOPE_KEY]
  if (effectScope) {
    try {
      effectScope.stop()
    }
    catch (error) {
      recordError(error)
    }
  }
  target[WEVU_EFFECT_SCOPE_KEY] = undefined
  if (runtime) {
    try {
      runtime.unmount()
    }
    catch (error) {
      recordError(error)
    }
  }
  delete target.__wevu
  if (WEVU_PUBLIC_RUNTIME_KEY in target) {
    delete (target as any)[WEVU_PUBLIC_RUNTIME_KEY]
  }

  if (hasError) {
    throw firstError
  }
}

/**
 * 重建运行时实例，同时保持宿主包装对象持有的 runtime facade 身份稳定。
 * @internal
 */
export function refreshRuntimeInstance<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  target: InternalRuntimeState,
  runtimeApp: RuntimeApp<D, C, M>,
  watchMap: WatchMap | undefined,
  setup?: RuntimeSetupFunction<D, C, M>,
  options?: { snapshotOmitKeys?: string[], stateSnapshot?: Record<string, any> },
) {
  const previousRuntime = target.__wevu as RuntimeInstance<D, C, M> | undefined
  const previousRuntimeState = previousRuntime
    ? createRuntimeStateSnapshot(previousRuntime, (target as any).data, options?.stateSnapshot)
    : undefined
  const plainSetupSnapshotKeys = previousRuntime
    ? collectPlainSetupSnapshotKeys(previousRuntime, (target as any).data)
    : []
  teardownRuntimeInstance(target, { skipHooks: true })
  const nextRuntime = mountRuntimeInstance(target, runtimeApp, watchMap, setup, {
    deferSetData: true,
    snapshotOmitKeys: options?.snapshotOmitKeys,
  })
  if (previousRuntimeState) {
    const nativeData = (target as any).data
    if (nativeData && typeof nativeData === 'object') {
      for (const key of plainSetupSnapshotKeys) {
        delete nativeData[key]
      }
      Object.assign(nativeData, cloneInitialSnapshotValue(previousRuntimeState))
    }
    syncRuntimeStateFromNativeData(target, {
      includeSetupState: true,
      nativeData: previousRuntimeState,
    })
  }
  if (!previousRuntime || previousRuntime === nextRuntime) {
    return nextRuntime
  }
  return preserveRuntimeFacadeIdentity(target, previousRuntime, nextRuntime)
}
