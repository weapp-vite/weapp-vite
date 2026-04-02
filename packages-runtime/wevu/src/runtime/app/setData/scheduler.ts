import type { MutationRecord } from '../../../reactivity'
import type { SetDataDebugInfo } from '../../types'
import { getReactiveVersion, isReactive, isRef, toRaw } from '../../../reactivity'
import { diffSnapshots, toPlain } from '../../diff'
import { hasTrackableSetupBinding } from '../../setupTracking'
import { runPatchUpdate } from './patchScheduler'
import { collectSnapshot } from './snapshot'

export function createSetDataScheduler(options: {
  state: Record<string, any>
  computedRefs: Record<string, { value: any }>
  dirtyComputedKeys: Set<string>
  includeComputed: boolean
  setDataStrategy: 'diff' | 'patch'
  computedCompare: 'reference' | 'shallow' | 'deep'
  computedCompareMaxDepth: number
  computedCompareMaxKeys: number
  currentAdapter: { setData?: (payload: Record<string, any>) => void | Promise<void> }
  shouldIncludeKey: (key: string) => boolean
  maxPatchKeys: number
  maxPayloadBytes: number
  mergeSiblingThreshold: number
  mergeSiblingMaxInflationRatio: number
  mergeSiblingMaxParentBytes: number
  mergeSiblingSkipArray: boolean
  elevateTopKeyThreshold: number
  toPlainMaxDepth: number
  toPlainMaxKeys: number
  debug: ((info: SetDataDebugInfo) => void) | undefined
  debugWhen: 'fallback' | 'always'
  debugSampleRate: number
  runTracker: () => void
  isMounted: () => boolean
}) {
  const {
    state,
    computedRefs,
    dirtyComputedKeys,
    includeComputed,
    setDataStrategy,
    computedCompare,
    computedCompareMaxDepth,
    computedCompareMaxKeys,
    currentAdapter,
    shouldIncludeKey,
    maxPatchKeys,
    maxPayloadBytes,
    mergeSiblingThreshold,
    mergeSiblingMaxInflationRatio,
    mergeSiblingMaxParentBytes,
    mergeSiblingSkipArray,
    elevateTopKeyThreshold,
    toPlainMaxDepth,
    toPlainMaxKeys,
    debug,
    debugWhen,
    debugSampleRate,
    runTracker,
    isMounted,
  } = options

  const plainCache = new WeakMap<object, { version: number, value: any }>()
  let latestSnapshot: Record<string, any> = {}
  let latestComputedSnapshot: Record<string, any> = Object.create(null)
  const latestStateTokens = Object.create(null) as Record<string, unknown>
  const latestComputedTokens = Object.create(null) as Record<string, unknown>
  const needsFullSnapshot = { value: setDataStrategy === 'patch' }
  const pendingPatches = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>()
  const fallbackTopKeys = new Set<string>()

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
      return leftKeys.every(key => Object.hasOwn(right, key) && isDeepEqual(left[key], right[key]))
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
          maxDepth: toPlainMaxDepth,
          maxKeys: toPlainMaxKeys,
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
      || !Object.hasOwn(left as object, 'raw')
      || !Object.hasOwn(right as object, 'raw')
    ) {
      if (
        typeof left === 'object'
        && typeof right === 'object'
        && Object.hasOwn(left as object, 'snapshot')
        && Object.hasOwn(right as object, 'snapshot')
      ) {
        return isDeepEqual((left as any).snapshot, (right as any).snapshot)
      }
      return false
    }
    return (left as any).raw === (right as any).raw && (left as any).version === (right as any).version
  }

  const resolveTopKeysByRoot = (root: object) => {
    const matches: string[] = []
    for (const key of Object.keys(state)) {
      if (!shouldIncludeKey(key)) {
        continue
      }
      const value = state[key]
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

  const emitDebug = (info: SetDataDebugInfo) => {
    if (!debug) {
      return
    }
    const isFallback = info.reason !== 'patch' && info.reason !== 'diff'
    if (debugWhen === 'fallback' && !isFallback) {
      return
    }
    if (debugSampleRate < 1 && Math.random() > debugSampleRate) {
      return
    }
    try {
      debug(info)
    }
    catch {
      // 忽略异常
    }
  }

  const collect = () => collectSnapshot({
    state,
    computedRefs,
    includeComputed,
    shouldIncludeKey,
    plainCache,
    toPlainMaxDepth,
    toPlainMaxKeys,
  })

  const collectDiffSnapshot = () => {
    const rawState = (isReactive(state) ? toRaw(state as any) : state) as Record<string, any>
    const nextSnapshot: Record<string, any> = { ...latestSnapshot }
    const seen = new WeakMap<object, any>()
    const includedStateKeys = new Set<string>()
    const includedComputedKeys = new Set<string>()
    const replacedTopLevelKeys = new Set<string>()

    for (const key of Object.keys(rawState)) {
      if (!shouldIncludeKey(key)) {
        continue
      }
      includedStateKeys.add(key)
      const token = createValueToken(rawState[key])
      const previousToken = latestStateTokens[key]
      if (
        previousToken
        && token
        && typeof previousToken === 'object'
        && typeof token === 'object'
        && Object.hasOwn(previousToken as object, 'raw')
        && Object.hasOwn(token as object, 'raw')
        && Array.isArray((previousToken as any).raw)
        && Array.isArray((token as any).raw)
        && (previousToken as any).raw !== (token as any).raw
      ) {
        replacedTopLevelKeys.add(key)
      }
      if (!isSameToken(previousToken, token) || !Object.hasOwn(latestSnapshot, key)) {
        nextSnapshot[key] = toPlain(rawState[key], seen, {
          cache: plainCache,
          maxDepth: toPlainMaxDepth,
          maxKeys: toPlainMaxKeys,
        })
      }
      latestStateTokens[key] = token
    }

    for (const key of Object.keys(latestStateTokens)) {
      if (!includedStateKeys.has(key)) {
        delete latestStateTokens[key]
        if (!includeComputed || !Object.hasOwn(computedRefs, key)) {
          delete nextSnapshot[key]
        }
      }
    }

    if (!includeComputed) {
      for (const key of Object.keys(latestComputedTokens)) {
        delete latestComputedTokens[key]
      }
      return {
        snapshot: nextSnapshot,
        replacedTopLevelKeys,
      }
    }

    for (const key of Object.keys(computedRefs)) {
      if (!shouldIncludeKey(key)) {
        continue
      }
      includedComputedKeys.add(key)
      const value = computedRefs[key].value
      const token = createValueToken(value)
      if (!isSameToken(latestComputedTokens[key], token) || !Object.hasOwn(latestSnapshot, key)) {
        nextSnapshot[key] = toPlain(value, seen, {
          cache: plainCache,
          maxDepth: toPlainMaxDepth,
          maxKeys: toPlainMaxKeys,
        })
      }
      latestComputedTokens[key] = token
    }

    for (const key of Object.keys(latestComputedTokens)) {
      if (!includedComputedKeys.has(key)) {
        delete latestComputedTokens[key]
        if (!Object.hasOwn(rawState, key) || !shouldIncludeKey(key)) {
          delete nextSnapshot[key]
        }
      }
    }

    return {
      snapshot: nextSnapshot,
      replacedTopLevelKeys,
    }
  }

  const runDiffUpdate = (reason: SetDataDebugInfo['reason'] = 'diff') => {
    const diffCollection = setDataStrategy === 'diff' ? collectDiffSnapshot() : undefined
    const snapshot = diffCollection?.snapshot ?? collect()
    const diff = diffCollection
      ? (() => {
          const fastDiff: Record<string, any> = {}
          for (const key of diffCollection.replacedTopLevelKeys) {
            fastDiff[key] = snapshot[key]
          }
          const baseDiff = diffSnapshots(latestSnapshot, snapshot, {
            skipKeys: diffCollection.replacedTopLevelKeys,
          })
          return {
            ...baseDiff,
            ...fastDiff,
          }
        })()
      : diffSnapshots(latestSnapshot, snapshot)
    latestSnapshot = snapshot
    needsFullSnapshot.value = false
    pendingPatches.clear()
    if (setDataStrategy === 'patch' && includeComputed) {
      latestComputedSnapshot = Object.create(null)
      for (const key of Object.keys(computedRefs)) {
        if (!shouldIncludeKey(key)) {
          continue
        }
        latestComputedSnapshot[key] = snapshot[key]
      }
      dirtyComputedKeys.clear()
    }
    if (!Object.keys(diff).length) {
      return
    }
    if (typeof currentAdapter.setData === 'function') {
      const result = currentAdapter.setData(diff)
      if (result && typeof (result as Promise<any>).then === 'function') {
        ;(result as Promise<any>).catch(() => {})
      }
    }
    emitDebug({
      mode: 'diff',
      reason,
      pendingPatchKeys: 0,
      payloadKeys: Object.keys(diff).length,
    })
  }

  const mutationRecorder = (record: MutationRecord, stateRootRaw: object) => {
    if (!isMounted()) {
      return
    }
    if (record.root !== stateRootRaw) {
      const topKeys = resolveTopKeysByRoot(record.root)
      if (topKeys.length) {
        for (const key of topKeys) {
          fallbackTopKeys.add(key)
        }
      }
      return
    }
    if (!record.path) {
      if (Array.isArray(record.fallbackTopKeys) && record.fallbackTopKeys.length) {
        for (const key of record.fallbackTopKeys) {
          fallbackTopKeys.add(key)
        }
      }
      else {
        needsFullSnapshot.value = true
      }
      return
    }
    const topKey = record.path.split('.', 1)[0]
    if (!shouldIncludeKey(topKey)) {
      return
    }
    pendingPatches.set(record.path, { kind: record.kind, op: record.op })
  }

  const job = (_stateRootRaw: object) => {
    if (!isMounted()) {
      return
    }
    // 生成快照前刷新依赖（setup 中的 ref / 新增 key）
    runTracker()

    if (setDataStrategy === 'patch' && !needsFullSnapshot.value) {
      const hasPatchSignal = pendingPatches.size > 0
        || fallbackTopKeys.size > 0
        || (includeComputed && dirtyComputedKeys.size > 0)
      // setup 返回的 ref/computed 变更不会进入 mutation recorder，patch 信号为空时兜底走 diff。
      if (!hasPatchSignal) {
        runDiffUpdate('diff')
        return
      }
      runPatchUpdate({
        state,
        computedRefs,
        dirtyComputedKeys,
        includeComputed,
        computedCompare,
        computedCompareMaxDepth,
        computedCompareMaxKeys,
        currentAdapter,
        shouldIncludeKey,
        maxPatchKeys,
        maxPayloadBytes,
        mergeSiblingThreshold,
        mergeSiblingMaxInflationRatio,
        mergeSiblingMaxParentBytes,
        mergeSiblingSkipArray,
        elevateTopKeyThreshold,
        toPlainMaxDepth,
        toPlainMaxKeys,
        plainCache,
        pendingPatches,
        fallbackTopKeys,
        latestSnapshot,
        latestComputedSnapshot,
        needsFullSnapshot,
        emitDebug,
        runDiffUpdate,
      })
    }
    else {
      runDiffUpdate(needsFullSnapshot.value ? 'needsFullSnapshot' : 'diff')
    }
  }

  const snapshot = () => (setDataStrategy === 'patch' ? collect() : ({ ...latestSnapshot }))
  const cloneLatestSnapshot = () => ({ ...latestSnapshot })

  return {
    job,
    mutationRecorder,
    snapshot,
    cloneLatestSnapshot,
    getLatestSnapshot: () => latestSnapshot,
  }
}
