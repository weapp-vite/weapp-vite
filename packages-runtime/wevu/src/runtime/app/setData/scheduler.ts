import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type { SetDataScheduler } from '../../capabilities'
import type { SetDataDebugInfo } from '../../types'
import type { CommitAwareSetDataAdapter, PreparedSetDataUpdate, SetDataCommitFailure, SetDataSnapshot } from './commitTracker'
import { getReactiveVersion, isReactive, isRef, toRaw } from '../../../reactivity'
import { hasOwn } from '../../../utils'
import { resolveBindingDiagnostics } from '../../bindingManifest'
import { diffSnapshots, toPlain } from '../../diff'
import { hasTrackableSetupBinding } from '../../setupTracking'
import { createSetDataCommitTracker } from './commitTracker'
import { collectSnapshot } from './snapshot'

export interface SetDataSchedulerOptions {
  state: Record<string, any>
  setupState?: Record<string, any>
  snapshotOmitKeys?: Set<string>
  computedRefs: Record<string, { value: any }>
  dirtyComputedKeys: Set<string>
  includeComputed: boolean
  setDataStrategy: 'diff' | 'patch'
  computedCompare: 'reference' | 'shallow' | 'deep'
  computedCompareMaxDepth: number
  computedCompareMaxKeys: number
  currentAdapter: CommitAwareSetDataAdapter
  shouldIncludeKey: (key: string) => boolean
  maxPatchKeys: number
  maxPayloadBytes: number
  mergeSiblingThreshold: number
  mergeSiblingMaxInflationRatio: number
  mergeSiblingMaxParentBytes: number
  mergeSiblingSkipArray: boolean
  elevateTopKeyThreshold: number
  prelinkMaxDepth?: number
  prelinkMaxKeys?: number
  toPlainMaxDepth: number
  toPlainMaxKeys: number
  includeFunctions?: boolean
  functionPaths: string[]
  debug: ((info: SetDataDebugInfo) => void) | undefined
  debugWhen: 'fallback' | 'always'
  debugSampleRate: number
  bindingManifest?: WevuRuntimeBindingManifestV1
  loopWarning: false | {
    sampleWindowMs: number
    maxFlushes: number
    coolDownMs: number
  }
  targetLabel?: string
  runTracker: () => void
  isMounted: () => boolean
  initialSnapshot?: Record<string, any>
  initialState?: Record<string, any>
}

export interface SetDataSchedulerInternals extends SetDataScheduler {
  job: (stateRootRaw?: object) => void | Promise<void>
  collect: () => Record<string, unknown>
  dispatchUpdate: (update: PreparedSetDataUpdate) => number
  dispose: () => void
  emitDebug: (info: SetDataDebugInfo, pathSource?: Iterable<string> | (() => Iterable<string>)) => void
  getLatestSnapshot: () => Record<string, unknown>
  needsFullSnapshot: () => boolean
  plainCache: WeakMap<object, { version: number, value: unknown }>
  plainCacheEligibility: WeakMap<object, boolean>
  prepareJob: (pendingPatchKeys?: number, pathSource?: Iterable<string> | (() => Iterable<string>)) => boolean
  resolveTopKeysByRoot: (root: object) => string[]
  runDiffUpdate: (reason?: SetDataDebugInfo['reason'], pendingPatchKeys?: number) => void
  shouldIncludeSnapshotKey: (key: string) => boolean
}

export function createSetDataScheduler(options: SetDataSchedulerOptions): SetDataSchedulerInternals {
  const {
    state,
    setupState,
    snapshotOmitKeys,
    computedRefs,
    dirtyComputedKeys,
    includeComputed,
    setDataStrategy,
    currentAdapter,
    shouldIncludeKey,
    toPlainMaxDepth,
    toPlainMaxKeys,
    includeFunctions = false,
    functionPaths,
    debug,
    debugWhen,
    debugSampleRate,
    bindingManifest,
    loopWarning,
    targetLabel,
    runTracker,
    isMounted,
    initialSnapshot,
    initialState,
  } = options

  const plainCache = new WeakMap<object, { version: number, value: any }>()
  const plainCacheEligibility = new WeakMap<object, boolean>()
  const initialSnapshotBaseline: SetDataSnapshot = {}
  const dispatchedStateTokens = Object.create(null) as Record<string, unknown>
  const dispatchedComputedTokens = Object.create(null) as Record<string, unknown>
  const flushTimes: number[] = []
  let lastLoopWarningAt = Number.NEGATIVE_INFINITY
  const initialStateKeys = new Set(
    initialState && typeof initialState === 'object'
      ? Object.keys(initialState)
      : [],
  )

  const isPlainObject = (value: unknown): value is Record<string, any> => {
    if (Object.prototype.toString.call(value) !== '[object Object]') {
      return false
    }
    const proto = Object.getPrototypeOf(value)
    return proto === null || proto === Object.prototype
  }

  const isDeepEqual = (left: any, right: any): boolean => {
    if (Object.is(left, right)) {
      return true
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        return false
      }
      return left.every((item, index) => isDeepEqual(item, right[index]))
    }
    if (isPlainObject(left) && isPlainObject(right)) {
      const leftKeys = Object.keys(left)
      const rightKeys = Object.keys(right)
      if (leftKeys.length !== rightKeys.length) {
        return false
      }
      return leftKeys.every(key => hasOwn(right, key) && isDeepEqual(left[key], right[key]))
    }
    return false
  }

  const createValueToken = (value: unknown) => {
    const candidate = isRef(value) ? value.value : value
    if (candidate == null || typeof candidate !== 'object') {
      return candidate
    }
    if (!isReactive(candidate) && hasTrackableSetupBinding(candidate)) {
      return {
        snapshot: toPlain(candidate, new WeakMap(), {
          cacheEligibility: plainCacheEligibility,
          maxDepth: toPlainMaxDepth,
          maxKeys: toPlainMaxKeys,
          includeFunctions,
          functionPaths,
        }),
      }
    }
    const raw = isReactive(candidate) ? toRaw(candidate as any) : candidate
    return {
      raw,
      version: getReactiveVersion(raw as any),
    }
  }

  const isSameToken = (left: unknown, right: unknown) => {
    if (Object.is(left, right)) {
      return true
    }
    if (
      !left
      || !right
      || typeof left !== 'object'
      || typeof right !== 'object'
      || !hasOwn(left as object, 'raw')
      || !hasOwn(right as object, 'raw')
    ) {
      if (
        left
        && right
        && typeof left === 'object'
        && typeof right === 'object'
        && hasOwn(left as object, 'snapshot')
        && hasOwn(right as object, 'snapshot')
      ) {
        return isDeepEqual((left as any).snapshot, (right as any).snapshot)
      }
      return false
    }
    return (left as any).raw === (right as any).raw && (left as any).version === (right as any).version
  }

  const shouldIncludeSnapshotKey = (key: string) => shouldIncludeKey(key) && !snapshotOmitKeys?.has(key)

  if (initialSnapshot) {
    for (const [key, value] of Object.entries(initialSnapshot)) {
      if (shouldIncludeSnapshotKey(key)) {
        initialSnapshotBaseline[key] = value
      }
    }
  }

  const syncInitialSnapshotTokens = () => {
    if (!initialSnapshot) {
      return
    }
    const rawState = (isReactive(state) ? toRaw(state as any) : state) as Record<string, any>
    const rawSetupState = setupState && typeof setupState === 'object'
      ? (isReactive(setupState) ? toRaw(setupState as any) : setupState)
      : undefined

    for (const key of Object.keys(initialSnapshot)) {
      if (!shouldIncludeSnapshotKey(key)) {
        continue
      }
      if (rawSetupState && hasOwn(rawSetupState, key)) {
        dispatchedStateTokens[key] = createValueToken(rawSetupState[key])
        continue
      }
      if (hasOwn(rawState, key)) {
        if (initialStateKeys.has(key)) {
          continue
        }
        rawState[key] = initialSnapshot[key]
        dispatchedStateTokens[key] = createValueToken(rawState[key])
      }
    }
  }

  const resolveTopKeysByRoot = (root: object) => {
    const matches: string[] = []
    const rawSetupState = setupState && typeof setupState === 'object'
      ? (isReactive(setupState) ? toRaw(setupState as any) : setupState)
      : undefined
    for (const key of new Set([...Object.keys(state), ...(rawSetupState ? Object.keys(rawSetupState) : [])])) {
      if (!shouldIncludeSnapshotKey(key)) {
        continue
      }
      const value = rawSetupState && hasOwn(rawSetupState, key) ? rawSetupState[key] : state[key]
      const candidate = isRef(value) ? value.value : value
      if (!candidate || typeof candidate !== 'object') {
        continue
      }
      if (toRaw(candidate as any) === root) {
        matches.push(key)
      }
    }
    return matches
  }

  const emitDebug = (
    info: SetDataDebugInfo,
    pathSource?: Iterable<string> | (() => Iterable<string>),
  ) => {
    if (!debug) {
      return
    }
    const isFallback = info.reason !== 'patch' && info.reason !== 'diff'
    if (debugWhen === 'fallback' && !isFallback) {
      return
    }
    if (info.reason !== 'commitFailure' && debugSampleRate < 1 && Math.random() > debugSampleRate) {
      return
    }
    let debugInfo = info
    if (bindingManifest) {
      const paths = typeof pathSource === 'function'
        ? pathSource()
        : pathSource ?? []
      const wholeSnapshotFallback = info.reason === 'needsFullSnapshot'
        || info.reason === 'maxPatchKeys'
        || info.reason === 'maxPayloadBytes'
      debugInfo = {
        ...info,
        bindings: resolveBindingDiagnostics(bindingManifest, paths, wholeSnapshotFallback),
      }
    }
    try {
      debug(debugInfo)
    }
    catch {
      // 忽略异常
    }
  }

  const commitTracker = createSetDataCommitTracker({
    initialSnapshot: initialSnapshotBaseline,
    adapter: currentAdapter,
    onFailure: (failure: SetDataCommitFailure) => {
      emitDebug({
        mode: failure.mode,
        reason: 'commitFailure',
        pendingPatchKeys: failure.pendingPatchKeys,
        payloadKeys: failure.payloadKeys,
        revision: failure.revision,
        committedRevision: failure.committedRevision,
        targetLabel,
        message: failure.error.message,
      })
      try {
        currentAdapter.__wevu_reportSetDataError?.(failure.error)
      }
      catch {
        // 宿主错误钩子不得反向破坏提交状态机。
      }
    },
  })

  const recordFlushForLoopWarning = (
    pendingPatchKeys = 0,
    pathSource?: Iterable<string> | (() => Iterable<string>),
  ) => {
    if (!loopWarning) {
      return
    }
    const current = Date.now()
    flushTimes.push(current)
    const windowStart = current - loopWarning.sampleWindowMs
    while (flushTimes.length && flushTimes[0] < windowStart) {
      flushTimes.shift()
    }
    if (flushTimes.length <= loopWarning.maxFlushes) {
      return
    }
    if (loopWarning.coolDownMs > 0 && current - lastLoopWarningAt < loopWarning.coolDownMs) {
      return
    }
    lastLoopWarningAt = current
    emitDebug({
      mode: setDataStrategy,
      reason: 'loopWarning',
      pendingPatchKeys,
      payloadKeys: 0,
      computedDirtyKeys: includeComputed ? dirtyComputedKeys.size : 0,
      flushCount: flushTimes.length,
      windowMs: loopWarning.sampleWindowMs,
      targetLabel,
      message: `${targetLabel ? `${targetLabel} ` : ''}疑似运行时更新循环：${flushTimes.length} 次 setData flush/${loopWarning.sampleWindowMs}ms`,
    }, pathSource)
  }

  const collect = () => collectSnapshot({
    state,
    setupState,
    computedRefs,
    includeComputed,
    shouldIncludeKey: shouldIncludeSnapshotKey,
    plainCache,
    plainCacheEligibility,
    toPlainMaxDepth,
    toPlainMaxKeys,
    includeFunctions,
    functionPaths,
  })

  syncInitialSnapshotTokens()

  const collectDiffSnapshot = () => {
    const rawState = (isReactive(state) ? toRaw(state as any) : state) as Record<string, any>
    const rawSetupState = setupState && typeof setupState === 'object'
      ? (isReactive(setupState) ? toRaw(setupState as any) : setupState)
      : undefined
    const dispatchedSnapshot = commitTracker.state.dispatchedSnapshot
    const nextSnapshot: Record<string, any> = { ...dispatchedSnapshot }
    const seen = new WeakMap<object, any>()
    const includedStateKeys = new Set<string>()
    const includedComputedKeys = new Set<string>()
    const replacedTopLevelKeys = new Set<string>()

    for (const key of new Set([...Object.keys(rawState), ...(rawSetupState ? Object.keys(rawSetupState) : [])])) {
      if (!shouldIncludeSnapshotKey(key)) {
        continue
      }
      includedStateKeys.add(key)
      const source = rawSetupState && hasOwn(rawSetupState, key) ? rawSetupState : rawState
      const token = createValueToken(source[key])
      const previousToken = dispatchedStateTokens[key]
      if (
        previousToken
        && token
        && typeof previousToken === 'object'
        && typeof token === 'object'
        && hasOwn(previousToken as object, 'raw')
        && hasOwn(token as object, 'raw')
        && Array.isArray((previousToken as any).raw)
        && Array.isArray((token as any).raw)
        && (previousToken as any).raw !== (token as any).raw
      ) {
        replacedTopLevelKeys.add(key)
      }
      if (!isSameToken(previousToken, token) || !hasOwn(dispatchedSnapshot, key)) {
        nextSnapshot[key] = toPlain(source[key], seen, {
          cache: plainCache,
          cacheEligibility: plainCacheEligibility,
          maxDepth: toPlainMaxDepth,
          maxKeys: toPlainMaxKeys,
          includeFunctions,
          functionPaths,
          _path: key,
        })
      }
      dispatchedStateTokens[key] = token
    }

    for (const key of Object.keys(dispatchedStateTokens)) {
      if (!includedStateKeys.has(key)) {
        delete dispatchedStateTokens[key]
        if (!includeComputed || !hasOwn(computedRefs, key)) {
          delete nextSnapshot[key]
        }
      }
    }

    if (!includeComputed) {
      for (const key of Object.keys(dispatchedComputedTokens)) {
        delete dispatchedComputedTokens[key]
      }
      return {
        snapshot: nextSnapshot,
        replacedTopLevelKeys,
      }
    }

    for (const key of Object.keys(computedRefs)) {
      if (!shouldIncludeSnapshotKey(key)) {
        continue
      }
      includedComputedKeys.add(key)
      const value = computedRefs[key].value
      const token = createValueToken(value)
      if (!isSameToken(dispatchedComputedTokens[key], token) || !hasOwn(dispatchedSnapshot, key)) {
        nextSnapshot[key] = toPlain(value, seen, {
          cache: plainCache,
          cacheEligibility: plainCacheEligibility,
          maxDepth: toPlainMaxDepth,
          maxKeys: toPlainMaxKeys,
          includeFunctions,
          functionPaths,
          _path: key,
        })
      }
      dispatchedComputedTokens[key] = token
    }

    for (const key of Object.keys(dispatchedComputedTokens)) {
      if (!includedComputedKeys.has(key)) {
        delete dispatchedComputedTokens[key]
        if (!hasOwn(rawState, key) || !shouldIncludeSnapshotKey(key)) {
          delete nextSnapshot[key]
        }
      }
    }

    return {
      snapshot: nextSnapshot,
      replacedTopLevelKeys,
    }
  }

  const runDiffUpdate = (
    reason: SetDataDebugInfo['reason'] = 'diff',
    pendingPatchKeys = 0,
  ): void => {
    const diffCollection = setDataStrategy === 'diff' ? collectDiffSnapshot() : undefined
    const snapshot = diffCollection?.snapshot ?? collect()
    const dispatchedSnapshot = commitTracker.state.dispatchedSnapshot
    const needsRecovery = commitTracker.state.needsFullSnapshot
    const payload = needsRecovery
      ? commitTracker.createFullPayload(snapshot)
      : diffCollection
        ? (() => {
            const fastDiff: Record<string, any> = {}
            for (const key of diffCollection.replacedTopLevelKeys) {
              fastDiff[key] = snapshot[key]
            }
            const baseDiff = diffSnapshots(dispatchedSnapshot, snapshot, {
              skipKeys: diffCollection.replacedTopLevelKeys,
            })
            return {
              ...baseDiff,
              ...fastDiff,
            }
          })()
        : diffSnapshots(dispatchedSnapshot, snapshot)
    const payloadKeys = Object.keys(payload).length
    if (!payloadKeys && !needsRecovery) {
      return
    }
    const effectiveReason = needsRecovery ? 'needsFullSnapshot' : reason
    emitDebug({
      mode: 'diff',
      reason: effectiveReason,
      pendingPatchKeys,
      payloadKeys,
    }, Object.keys(payload))
    commitTracker.dispatch({
      mode: 'diff',
      kind: needsRecovery ? 'full' : 'delta',
      reason: effectiveReason,
      snapshot,
      payload,
      pendingPatchKeys,
    })
  }

  const prepareJob = (
    pendingPatchKeys = 0,
    pathSource?: Iterable<string> | (() => Iterable<string>),
  ) => {
    if (!isMounted()) {
      return false
    }
    recordFlushForLoopWarning(pendingPatchKeys, pathSource)
    // 生成快照前刷新依赖（setup 中的 ref / 新增 key）
    runTracker()
    return true
  }

  const job = (_stateRootRaw?: object) => {
    if (!prepareJob()) {
      return
    }
    return runDiffUpdate('diff')
  }

  const snapshot = () => (
    setDataStrategy === 'patch'
      ? collect()
      : { ...commitTracker.state.dispatchedSnapshot }
  )
  const cloneLatestSnapshot = () => ({ ...commitTracker.state.dispatchedSnapshot })

  return {
    collect,
    emitDebug,
    getLatestSnapshot: () => commitTracker.state.dispatchedSnapshot,
    dispatchUpdate: commitTracker.dispatch,
    needsFullSnapshot: () => commitTracker.state.needsFullSnapshot,
    job,
    plainCache,
    plainCacheEligibility,
    prepareJob,
    resolveTopKeysByRoot,
    runDiffUpdate,
    shouldIncludeSnapshotKey,
    snapshot,
    cloneLatestSnapshot,
    dispose: commitTracker.dispose,
  }
}
