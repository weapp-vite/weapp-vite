import type { SetDataAdapterSettlement, SetDataAdapterSettler, SetDataPayload } from '../app/setData/commitTracker'
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
import {
  WEVU_EFFECT_SCOPE_KEY,
  WEVU_HOOKS_KEY,
  WEVU_PAGE_LAYOUT_NAME_KEY,
  WEVU_PAGE_LAYOUT_PROPS_KEY,
  WEVU_PAGE_LAYOUT_SETTER_KEY,
  WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY,
  WEVU_PROPS_DERIVED_KEYS_KEY,
  WEVU_PROPS_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_RUNTIME_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_WATCH_STOPS_KEY,
} from '@weapp-core/constants'
import { isRef } from '../../reactivity'
import { observeSetDataCompletion } from '../app/setData/commitTracker'
import { applySnapshotUpdate, isDeepEqualValue } from '../app/setData/snapshot'
import { callHookList } from '../hooks'
import { resolveRuntimePageLayoutName, syncRuntimePageLayoutState } from '../pageLayout'
import { allocateOwnerId, attachOwnerSnapshot, mergeOwnerSnapshotProps, removeOwner, resolveOwnerSnapshot, updateOwnerSnapshot } from '../scopedSlots'
import { clearTemplateRefs, scheduleTemplateRefUpdate } from '../templateRefs'
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
import { createSetDataHighFrequencyWarningMonitor } from './setDataFrequencyWarning'
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
function mergeBufferedSetDataPayload(
  buffered: SetDataPayload | undefined,
  incoming: SetDataPayload,
): SetDataPayload {
  const merged = buffered ?? {}
  for (const [path, value] of Object.entries(incoming)) {
    let ancestorPath: string | undefined
    for (const candidate of Object.keys(merged)) {
      if (path.startsWith(`${candidate}.`)) {
        ancestorPath = candidate
        break
      }
    }
    if (ancestorPath) {
      const holder: Record<string, unknown> = { value: merged[ancestorPath] }
      applySnapshotUpdate(
        holder,
        `value.${path.slice(ancestorPath.length + 1)}`,
        value,
        'set',
        { cloneValue: false, clonedParents: new WeakSet<object>() },
      )
      merged[ancestorPath] = holder.value
      continue
    }
    const descendantPrefix = `${path}.`
    for (const candidate of Object.keys(merged)) {
      if (candidate.startsWith(descendantPrefix)) {
        delete merged[candidate]
      }
    }
    merged[path] = value
  }
  return merged
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
  __wevu_cloneDispatchedSnapshot?: () => Record<string, any>
}

interface BufferedSetDataSettlement {
  settle: SetDataAdapterSettler
  next: BufferedSetDataSettlement | undefined
}

function attachPageLayoutSetter(target: InternalRuntimeState) {
  if (typeof (target as any).route !== 'string' || !(target as any).route) {
    return
  }

  target[WEVU_PAGE_LAYOUT_SETTER_KEY] = (layout: string | false, props?: Record<string, any>) => {
    const runtimeState = target.__wevu?.state as Record<string, any> | undefined
    if (!runtimeState || typeof runtimeState !== 'object') {
      return
    }

    runtimeState[WEVU_PAGE_LAYOUT_NAME_KEY] = resolveRuntimePageLayoutName(layout)
    const nextProps = layout === false ? {} : (props ?? {})
    runtimeState[WEVU_PAGE_LAYOUT_PROPS_KEY] = nextProps
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
  options?: { deferSetData?: boolean, snapshotOmitKeys?: string[] },
) {
  if (target.__wevu) {
    return target.__wevu as RuntimeInstance<D, C, M>
  }
  attachRuntimeProvideParentContext(target, runtimeApp as RuntimeApp<any, any, any>)
  safeMarkNoSetData(target)
  const initialNativeOwnerId = (target as any).data?.[WEVU_SLOT_OWNER_ID_KEY]
  const ownerId = typeof initialNativeOwnerId === 'string' && initialNativeOwnerId
    ? initialNativeOwnerId
    : allocateOwnerId()
  const suspendWhenHidden = Boolean((runtimeApp as any)?.__wevuSetDataOptions?.suspendWhenHidden)
  const targetLabel = typeof (target as any).route === 'string' && (target as any).route
    ? `page:${(target as any).route}`
    : typeof (target as any).is === 'string' && (target as any).is
      ? `component:${(target as any).is}`
      : 'unknown-target'
  const highFrequencyWarning = createSetDataHighFrequencyWarningMonitor({
    option: (runtimeApp as any)?.__wevuSetDataOptions?.highFrequencyWarning,
    targetLabel,
    isInPageScrollHook: () => Number((target as any)[WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY] ?? 0) > 0,
  })
  let runtimeRef: RuntimeInstance<any, any, any> | undefined
  let visible = true
  let enabled = !options?.deferSetData
  let disposed = false
  let dispatchGeneration = 0
  let pendingPayload: SetDataPayload | undefined
  let pendingSettlementHead: BufferedSetDataSettlement | undefined
  let pendingSettlementTail: BufferedSetDataSettlement | undefined
  let pendingRawCallbacks: Array<() => void> = []

  const refreshOwnerSnapshot = () => {
    if (!runtimeRef) {
      return
    }
    const snapshot = resolveOwnerSnapshot(runtimeRef)
    const propsSource = (target as any)[WEVU_PROPS_KEY] ?? (target as any).properties
    mergeOwnerSnapshotProps(snapshot, propsSource)
    updateOwnerSnapshot(ownerId, snapshot, runtimeRef.proxy, target)
  }
  const completeSuccessfulSetData = () => {
    scheduleTemplateRefUpdate(target)
  }
  const appendPendingSettlement = (settle: SetDataAdapterSettler) => {
    const record: BufferedSetDataSettlement = {
      settle,
      next: undefined,
    }
    if (pendingSettlementTail) {
      pendingSettlementTail.next = record
    }
    else {
      pendingSettlementHead = record
    }
    pendingSettlementTail = record
  }
  const settlePendingRecords = (
    first: BufferedSetDataSettlement | undefined,
    settlement: SetDataAdapterSettlement,
    cause?: unknown,
  ) => {
    let current = first
    let isFirst = true
    while (current) {
      const next = current.next
      current.next = undefined
      if (settlement === 'failed' && !isFirst) {
        current.settle('abandoned')
      }
      else {
        current.settle(settlement, cause)
      }
      current = next
      isFirst = false
    }
  }
  const dispatchPhysicalSetData = (
    payload: SetDataPayload,
    settle: SetDataAdapterSettler,
  ) => {
    const generation = dispatchGeneration
    refreshOwnerSnapshot()
    observeSetDataCompletion({
      invoke: (callback) => {
        const setData = resolveNativeSetData(target)
        if (!setData) {
          callback()
          return undefined
        }
        return callNativeSetData(target, setData, payload, callback)
      },
      completion: 'callback',
      settle: (settlement, cause) => {
        if (disposed || generation !== dispatchGeneration) {
          return
        }
        if (settlement === 'committed') {
          completeSuccessfulSetData()
        }
        settle(settlement, cause)
      },
    })
  }
  const flushPendingSetData = () => {
    if (!pendingPayload) {
      return
    }
    const payload = pendingPayload
    const settlements = pendingSettlementHead
    const rawCallbacks = pendingRawCallbacks
    pendingPayload = undefined
    pendingSettlementHead = undefined
    pendingSettlementTail = undefined
    pendingRawCallbacks = []
    dispatchPhysicalSetData(payload, (settlement, cause) => {
      if (settlement === 'committed') {
        try {
          for (const callback of rawCallbacks) {
            callback()
          }
        }
        finally {
          settlePendingRecords(settlements, settlement, cause)
        }
        return
      }
      settlePendingRecords(settlements, settlement, cause)
    })
  }
  const abandonPendingSetData = () => {
    const settlements = pendingSettlementHead
    pendingPayload = undefined
    pendingSettlementHead = undefined
    pendingSettlementTail = undefined
    pendingRawCallbacks = []
    settlePendingRecords(settlements, 'abandoned')
  }
  const bufferPayload = (payload: SetDataPayload) => {
    pendingPayload = mergeBufferedSetDataPayload(pendingPayload, payload)
  }

  const adapter: AdapterWithSetData = {
    setData(payload: Record<string, any>, callback?: () => void) {
      highFrequencyWarning?.()
      if (!enabled || (suspendWhenHidden && !visible)) {
        bufferPayload(payload)
        if (callback) {
          pendingRawCallbacks.push(callback)
        }
        refreshOwnerSnapshot()
        return undefined
      }

      refreshOwnerSnapshot()
      const setData = resolveNativeSetData(target)
      if (!setData) {
        callback?.()
        completeSuccessfulSetData()
        return undefined
      }

      let invoking = true
      let callbackCalled = false
      let returnIsAuthoritative = false
      let successHandled = false
      const handleSuccess = () => {
        if (successHandled) {
          return
        }
        successHandled = true
        completeSuccessfulSetData()
      }
      const nativeCallback = () => {
        callback?.()
        if (invoking) {
          callbackCalled = true
          return
        }
        if (!returnIsAuthoritative) {
          handleSuccess()
        }
      }
      const result = callNativeSetData(target, setData, payload, nativeCallback)
      invoking = false
      returnIsAuthoritative = Boolean(result && typeof result.then === 'function')
      if (result && typeof result.then === 'function') {
        return result.then(() => {
          handleSuccess()
        })
      }
      if (callbackCalled) {
        handleSuccess()
      }
      return result
    },
    __wevu_dispatchSetData(payload, settle) {
      highFrequencyWarning?.()
      if (disposed) {
        settle('abandoned')
        return
      }
      if (!enabled || (suspendWhenHidden && !visible)) {
        bufferPayload(payload)
        appendPendingSettlement(settle)
        refreshOwnerSnapshot()
        return
      }
      dispatchPhysicalSetData(payload, settle)
    },
    __wevu_enableSetData(discardPending = false) {
      enabled = true
      if (discardPending) {
        abandonPendingSetData()
        return
      }
      flushPendingSetData()
    },
    __wevu_setVisibility(nextVisible: boolean) {
      visible = nextVisible
      if (visible && enabled) {
        flushPendingSetData()
      }
    },
    __wevu_disposeSetData() {
      if (disposed) {
        return
      }
      disposed = true
      dispatchGeneration += 1
      pendingPayload = undefined
      pendingSettlementHead = undefined
      pendingSettlementTail = undefined
      pendingRawCallbacks = []
    },
  }

  const baseMountAdapter = {
    ...adapter,
  }
  Object.defineProperty(baseMountAdapter, '__wevu_reportSetDataError', {
    configurable: true,
    enumerable: false,
    value: (error: Error) => {
      callHookList(target, 'onError', [error])
    },
    writable: false,
  })
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
    hasTemplateRuntimeBindings(runtimeApp)
      ? undefined
      : { [WEVU_SLOT_OWNER_ID_KEY]: ownerId },
  )
  if (initialSnapshot && Object.keys(initialSnapshot).length) {
    Object.defineProperty(baseMountAdapter, '__wevu_initialSnapshot', {
      configurable: true,
      enumerable: false,
      value: initialSnapshot,
      writable: false,
    })
  }
  Object.defineProperty(baseMountAdapter, '__wevu_initialState', {
    configurable: true,
    enumerable: false,
    value: { [WEVU_SLOT_OWNER_ID_KEY]: ownerId },
    writable: false,
  })
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
  runtimeRef = runtime
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
    __wevu_cloneDispatchedSnapshot: (runtime as RuntimeInstanceWithSyncFlush<D, C, M>).__wevu_cloneDispatchedSnapshot,
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
  attachPageLayoutSetter(target)
  const runtimeProps = ensureRuntimeProps(target, runtimeState as Record<string, any>)
  attachRuntimeSlots(runtimeState as Record<string, any>, runtimeProps)

  attachOwnerSnapshot(target, runtimeWithDefaults as any, ownerId, {
    deferSnapshot: options?.deferSetData,
  })

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
  const adapter = target.__wevu?.adapter as AdapterWithSetData | undefined
  syncRuntimeStateFromNativeData(target, {
    includeSetupState: options?.rehydrateSetupState,
  })
  adapter?.__wevu_enableSetData?.(true)
  ;(target as any).__wevu?.__wevu_flushSetupSnapshotSync?.()
}

export function setRuntimeSetDataVisibility(target: InternalRuntimeState, visible: boolean) {
  const adapter = target.__wevu?.adapter as AdapterWithSetData | undefined
  adapter?.__wevu_setVisibility?.(visible)
}

/**
 * 卸载运行时实例（框架内部注册流程使用）。
 * @internal
 */
export function teardownRuntimeInstance(target: InternalRuntimeState, options?: { skipHooks?: boolean }) {
  const runtime = target.__wevu
  const ownerId = (target as any)[WEVU_RUNTIME_OWNER_ID_KEY]
    ?? (target as any)[WEVU_SLOT_OWNER_ID_KEY]
  if (ownerId) {
    removeOwner(ownerId)
  }
  clearTemplateRefs(target)
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
    const adapter = runtime.adapter as AdapterWithSetData | undefined
    try {
      adapter?.__wevu_disposeSetData?.()
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
