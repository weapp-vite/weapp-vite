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
  SetDataSnapshotOptions,
} from '../types'
import type { AdapterWithSetData } from './runtimeInstance/utils'
import type { WatchMap } from './watch'
import {
  WEVU_EFFECT_SCOPE_KEY,
  WEVU_EXPOSED_KEY,
  WEVU_HOOKS_KEY,
  WEVU_HOST_COMMIT_PROMISE_KEY,
  WEVU_ON_BEFORE_UNMOUNT_HOOK,
  WEVU_PAGE_SCROLL_HOOK_DEPTH_KEY,
  WEVU_PROPS_DERIVED_KEYS_KEY,
  WEVU_PUBLIC_RUNTIME_KEY,
  WEVU_SETUP_CONTEXT_INSTANCE_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_WATCH_STOPS_KEY,
} from '@weapp-core/constants'
import { effectScope as createEffectScope, isRef } from '../../reactivity'
import { observeSetDataCompletion } from '../app/setData/commitTracker'
import { applySnapshotUpdate, isDeepEqualValue } from '../app/setData/snapshot'
import {
  isSetDataHighFrequencyWarningRequested,
  requireRuntimeCapability,
  runtimeCapabilityRegistry,
} from '../capabilities'
import { callHookList } from '../hooks'
import { runTeardownSteps } from '../teardown'
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
  let visible = true
  let enabled = !options?.deferSetData
  let disposed = false
  let dispatchGeneration = 0
  let pendingPayload: SetDataPayload | undefined
  let pendingSettlementHead: BufferedSetDataSettlement | undefined
  let pendingSettlementTail: BufferedSetDataSettlement | undefined
  let pendingRawCallbacks: Array<() => void> = []
  const ownsHostCommit = !(WEVU_HOST_COMMIT_PROMISE_KEY in target)
  let pendingHostCommits = 0
  let hostCommitFailed = false
  let hostCommitCause: unknown
  let hostCommitPromise: Promise<void> | undefined
  let resolveHostCommit: (() => void) | undefined
  let rejectHostCommit: ((cause: unknown) => void) | undefined

  const resetHostCommitFailure = () => {
    if (!pendingHostCommits && !pendingPayload && !hostCommitPromise) {
      hostCommitFailed = false
      hostCommitCause = undefined
    }
  }
  const flushHostCommitWaiter = () => {
    if (pendingHostCommits || pendingPayload) {
      return
    }
    if (hostCommitFailed) {
      rejectHostCommit?.(hostCommitCause)
    }
    else {
      resolveHostCommit?.()
    }
    hostCommitPromise = undefined
    resolveHostCommit = undefined
    rejectHostCommit = undefined
  }
  const beginHostCommit = () => {
    if (ownsHostCommit) {
      pendingHostCommits += 1
    }
  }
  const finishHostCommit = (settlement: SetDataAdapterSettlement = 'committed', cause?: unknown) => {
    if (!ownsHostCommit || disposed) {
      return
    }
    if (settlement === 'failed' && !hostCommitFailed) {
      hostCommitFailed = true
      hostCommitCause = cause
    }
    pendingHostCommits -= 1
    flushHostCommitWaiter()
  }
  const failHostCommit = (cause: unknown) => finishHostCommit('failed', cause)
  if (ownsHostCommit) {
    Object.defineProperty(target, WEVU_HOST_COMMIT_PROMISE_KEY, {
      configurable: true,
      enumerable: false,
      get: () => {
        if (!pendingHostCommits && !pendingPayload) {
          return hostCommitFailed ? Promise.reject(hostCommitCause) : undefined
        }
        // 只有实例 $nextTick 消费宿主屏障时才创建 Promise。
        hostCommitPromise ??= new Promise<void>((resolve, reject) => {
          resolveHostCommit = resolve
          rejectHostCommit = reject
        })
        return hostCommitPromise
      },
    })
  }

  const refreshOwnerSnapshot = () => {
    if (scopedSlotState) {
      runtimeCapabilityRegistry.scopedSlots?.refresh(target, scopedSlotState)
    }
  }
  const completeSuccessfulSetData = () => {
    if (disposed) {
      return
    }
    const bindings = target.__wevuTemplateRefs
    if (!runtimeCapabilityRegistry.templateRefs && (!Array.isArray(bindings) || !bindings.length)) {
      if (ownsHostCommit) {
        finishHostCommit()
      }
      return
    }
    requireRuntimeCapability(
      'templateRefs',
      'mountRuntimeInstance(template ref completion)',
    ).schedule(
      target,
      ownsHostCommit ? finishHostCommit : undefined,
      target,
      ownsHostCommit ? failHostCommit : undefined,
    )
  }
  const syncNativeOwnerId = () => {
    if (scopedSlotState) {
      scopedSlotHooks?.syncNativeOwnerId(target, scopedSlotState)
    }
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
    beginHostCommit()
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
        if (settlement !== 'committed') {
          finishHostCommit(settlement, cause)
          settle(settlement, cause)
          return
        }
        // 物理提交已成功，但实例屏障仍需等待原始回调；回调失败不能回滚快照账本。
        try {
          settle(settlement, cause)
        }
        catch (error) {
          finishHostCommit('failed', error)
          throw error
        }
        completeSuccessfulSetData()
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
    flushHostCommitWaiter()
  }
  const bufferPayload = (payload: SetDataPayload) => {
    resetHostCommitFailure()
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
      resetHostCommitFailure()
      beginHostCommit()
      const setData = resolveNativeSetData(target)
      if (!setData) {
        try {
          callback?.()
        }
        catch (cause) {
          finishHostCommit('failed', cause)
          throw cause
        }
        completeSuccessfulSetData()
        return undefined
      }

      let invoking = true
      let callbackCalled = false
      let returnIsAuthoritative = false
      let successHandled = false
      const handleFailure = (cause: unknown) => {
        if (successHandled) {
          return
        }
        successHandled = true
        finishHostCommit('failed', cause)
      }
      const handleSuccess = () => {
        if (successHandled) {
          return
        }
        successHandled = true
        completeSuccessfulSetData()
      }
      const nativeCallback = () => {
        try {
          callback?.()
        }
        catch (cause) {
          handleFailure(cause)
          throw cause
        }
        if (invoking) {
          callbackCalled = true
          return
        }
        if (!returnIsAuthoritative) {
          handleSuccess()
        }
      }
      let result: void | Promise<void>
      try {
        result = callNativeSetData(target, setData, payload, nativeCallback)
      }
      catch (cause) {
        handleFailure(cause)
        throw cause
      }
      invoking = false
      returnIsAuthoritative = Boolean(result && typeof result.then === 'function')
      if (result && typeof result.then === 'function') {
        return result.then(
          () => {
            handleSuccess()
          },
          (cause) => {
            handleFailure(cause)
            throw cause
          },
        )
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
      resetHostCommitFailure()
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
      pendingHostCommits = 0
      hostCommitFailed = false
      hostCommitCause = undefined
      flushHostCommitWaiter()
      if (ownsHostCommit) {
        Reflect.deleteProperty(target, WEVU_HOST_COMMIT_PROMISE_KEY)
      }
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
    try {
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
    catch (error) {
      try {
        // eslint-disable-next-line ts/no-use-before-define -- setup 失败后复用统一 teardown 回滚已安装运行时
        teardownRuntimeInstance(target, { skipHooks: true })
      }
      catch {
        // setup 异常优先，回滚异常不能覆盖原始失败。
      }
      throw error
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

  const stops = target[WEVU_WATCH_STOPS_KEY]
  const effectScope = target[WEVU_EFFECT_SCOPE_KEY]

  runTeardownSteps([
    () => {
      if (!options?.skipHooks && runtime && target[WEVU_HOOKS_KEY]?.[WEVU_ON_BEFORE_UNMOUNT_HOOK]) {
        if (effectScope?.active) {
          effectScope.run(() => callHookList(target, WEVU_ON_BEFORE_UNMOUNT_HOOK))
        }
        else {
          const teardownScope = createEffectScope(true)
          runTeardownSteps([
            () => teardownScope.run(() => callHookList(target, WEVU_ON_BEFORE_UNMOUNT_HOOK)),
            () => teardownScope.stop(),
          ])
        }
      }
    },
    () => runtimeCapabilityRegistry.scopedSlots?.teardown(target),
    () => {
      if (Array.isArray(target.__wevuTemplateRefs) && target.__wevuTemplateRefs.length > 0) {
        requireRuntimeCapability('templateRefs', 'teardownRuntimeInstance(template refs)').clear(target)
      }
    },
    () => {
      // 触发卸载钩子（仅在 teardown 首次执行时触发）
      if (!options?.skipHooks && runtime && target[WEVU_HOOKS_KEY]) {
        callHookList(target, 'onUnload', [])
      }
    },
    () => {
      // 清理注册的生命周期钩子
      if (target[WEVU_HOOKS_KEY]) {
        target[WEVU_HOOKS_KEY] = undefined
      }
    },
    () => {
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
    },
    () => {
      target[WEVU_WATCH_STOPS_KEY] = undefined
    },
    () => {
      effectScope?.stop()
    },
    () => {
      target[WEVU_EFFECT_SCOPE_KEY] = undefined
    },
    () => runtime?.unmount(),
    () => {
      const adapter = runtime?.adapter as AdapterWithSetData | undefined
      adapter?.__wevu_disposeSetData?.()
    },
    () => {
      delete (target as any)[WEVU_SETUP_CONTEXT_INSTANCE_KEY]
      delete (target as any)[WEVU_EXPOSED_KEY]
    },
    () => {
      delete target.__wevu
    },
    () => {
      if (WEVU_PUBLIC_RUNTIME_KEY in target) {
        delete (target as any)[WEVU_PUBLIC_RUNTIME_KEY]
      }
    },
  ])
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
