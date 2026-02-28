import type { MutationRecord } from '../../../reactivity'
import type { SetDataDebugInfo } from '../../types'
import { isRef, toRaw } from '../../../reactivity'
import { diffSnapshots } from '../../diff'
import { runPatchUpdate } from './patchScheduler'
import { cloneSnapshotValue, collectSnapshot } from './snapshot'

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
  const needsFullSnapshot = { value: setDataStrategy === 'patch' }
  const pendingPatches = new Map<string, { kind: 'property' | 'array', op: 'set' | 'delete' }>()
  const fallbackTopKeys = new Set<string>()

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

  const runDiffUpdate = (reason: SetDataDebugInfo['reason'] = 'diff') => {
    const snapshot = collect()
    const diff = diffSnapshots(latestSnapshot, snapshot)
    latestSnapshot = cloneSnapshotValue(snapshot)
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
      const result = currentAdapter.setData(cloneSnapshotValue(diff))
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

  return {
    job,
    mutationRecorder,
    snapshot,
    getLatestSnapshot: () => latestSnapshot,
  }
}
