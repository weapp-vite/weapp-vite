import type { SetDataDebugInfo } from '../../types'
import { toPlain } from '../../diff'
import { checkPayloadSize, collapsePayload, mergeSiblingPayload } from './payload'
import { applySnapshotUpdate, isDeepEqualValue, isShallowEqualValue, normalizeSetDataValue } from './snapshot'

interface PatchEntry {
  kind: 'property' | 'array'
  op: 'set' | 'delete'
}

export function runPatchUpdate(options: {
  state: Record<string, any>
  computedRefs: Record<string, { value: any }>
  dirtyComputedKeys: Set<string>
  includeComputed: boolean
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
  plainCache: WeakMap<object, { version: number, value: any }>
  pendingPatches: Map<string, PatchEntry>
  fallbackTopKeys: Set<string>
  latestSnapshot: Record<string, any>
  latestComputedSnapshot: Record<string, any>
  needsFullSnapshot: { value: boolean }
  emitDebug: (info: SetDataDebugInfo) => void
  runDiffUpdate: (reason?: SetDataDebugInfo['reason']) => void
}) {
  const {
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
  } = options

  if (pendingPatches.size > maxPatchKeys) {
    needsFullSnapshot.value = true
    const pendingCount = pendingPatches.size
    pendingPatches.clear()
    dirtyComputedKeys.clear()
    emitDebug({
      mode: 'diff',
      reason: 'maxPatchKeys',
      pendingPatchKeys: pendingCount,
      payloadKeys: 0,
    })
    runDiffUpdate('maxPatchKeys')
    return
  }

  const seen = new WeakMap<object, any>()
  const plainByPath = new Map<string, any>()
  const payload: Record<string, any> = Object.create(null)
  const patchEntriesRaw = Array.from(pendingPatches.entries())

  if (Number.isFinite(elevateTopKeyThreshold) && elevateTopKeyThreshold > 0) {
    const counts = new Map<string, number>()
    for (const [path] of patchEntriesRaw) {
      const top = path.split('.', 1)[0]
      counts.set(top, (counts.get(top) ?? 0) + 1)
    }
    for (const [top, count] of counts) {
      if (count >= elevateTopKeyThreshold) {
        fallbackTopKeys.add(top)
      }
    }
  }

  const patchEntries = patchEntriesRaw.filter(([path]) => {
    for (const topKey of fallbackTopKeys) {
      if (path === topKey || path.startsWith(`${topKey}.`)) {
        return false
      }
    }
    return true
  })
  const entryMap = new Map(patchEntries)
  pendingPatches.clear()

  const getStateValueByPath = (path: string) => {
    const segments = path.split('.').filter(Boolean)
    let current: any = state as any
    for (const seg of segments) {
      if (current == null) {
        return current
      }
      current = current[seg]
    }
    return current
  }

  const getPlainByPath = (path: string) => {
    if (plainByPath.has(path)) {
      return plainByPath.get(path)
    }
    const value = normalizeSetDataValue(
      toPlain(getStateValueByPath(path), seen, { cache: plainCache, maxDepth: toPlainMaxDepth, maxKeys: toPlainMaxKeys }),
    )
    plainByPath.set(path, value)
    return value
  }

  if (fallbackTopKeys.size) {
    for (const topKey of fallbackTopKeys) {
      if (!shouldIncludeKey(topKey)) {
        continue
      }
      payload[topKey] = getPlainByPath(topKey)
      entryMap.set(topKey, { kind: 'property', op: 'set' })
    }
    fallbackTopKeys.clear()
  }

  for (const [path, entry] of patchEntries) {
    const effectiveOp = entry.kind === 'array' ? 'set' : entry.op
    if (effectiveOp === 'delete') {
      payload[path] = null
      continue
    }
    payload[path] = getPlainByPath(path)
  }

  let computedDirtyProcessed = 0
  if (includeComputed && dirtyComputedKeys.size) {
    const computedPatch: Record<string, any> = Object.create(null)
    const keys = Array.from(dirtyComputedKeys)
    dirtyComputedKeys.clear()
    computedDirtyProcessed = keys.length
    for (const key of keys) {
      if (!shouldIncludeKey(key)) {
        continue
      }
      const nextValue = toPlain(computedRefs[key].value, seen, { cache: plainCache, maxDepth: toPlainMaxDepth, maxKeys: toPlainMaxKeys })
      const prevValue = latestComputedSnapshot[key]
      const equal = computedCompare === 'deep'
        ? isDeepEqualValue(prevValue, nextValue, computedCompareMaxDepth, { keys: computedCompareMaxKeys })
        : computedCompare === 'shallow'
          ? isShallowEqualValue(prevValue, nextValue)
          : Object.is(prevValue, nextValue)
      if (equal) {
        continue
      }
      computedPatch[key] = normalizeSetDataValue(nextValue)
      latestComputedSnapshot[key] = nextValue
    }
    Object.assign(payload, computedPatch)
  }

  let collapsedPayload = collapsePayload(payload)
  let mergedSiblingParents = 0
  if (mergeSiblingThreshold) {
    const mergedResult = mergeSiblingPayload({
      input: collapsedPayload,
      entryMap,
      getPlainByPath,
      mergeSiblingThreshold,
      mergeSiblingSkipArray,
      mergeSiblingMaxParentBytes,
      mergeSiblingMaxInflationRatio,
    })
    mergedSiblingParents = mergedResult.merged
    collapsedPayload = collapsePayload(mergedResult.out)
  }
  const sizeCheck = checkPayloadSize(collapsedPayload, maxPayloadBytes)
  const shouldFallback = sizeCheck.fallback
  emitDebug({
    mode: shouldFallback ? 'diff' : 'patch',
    reason: shouldFallback ? 'maxPayloadBytes' : 'patch',
    pendingPatchKeys: patchEntries.length,
    payloadKeys: Object.keys(collapsedPayload).length,
    mergedSiblingParents: mergedSiblingParents || undefined,
    computedDirtyKeys: computedDirtyProcessed || undefined,
    estimatedBytes: sizeCheck.estimatedBytes,
    bytes: sizeCheck.bytes,
  })
  if (shouldFallback) {
    needsFullSnapshot.value = true
    pendingPatches.clear()
    dirtyComputedKeys.clear()
    runDiffUpdate('maxPayloadBytes')
    return
  }
  if (!Object.keys(collapsedPayload).length) {
    return
  }

  // 保持快照同步，确保 patch 模式可安全回退到 diff。
  for (const [path, value] of Object.entries(collapsedPayload)) {
    const entry = entryMap.get(path)
    if (entry) {
      applySnapshotUpdate(latestSnapshot, path, value, entry.kind === 'array' ? 'set' : entry.op)
    }
    else {
      // 计算属性或 diffSnapshots 生成的顶层键。
      applySnapshotUpdate(latestSnapshot, path, value, 'set')
    }
  }

  if (typeof currentAdapter.setData === 'function') {
    const result = currentAdapter.setData(collapsedPayload)
    if (result && typeof (result as Promise<any>).then === 'function') {
      ;(result as Promise<any>).catch(() => {})
    }
  }
  emitDebug({
    mode: 'patch',
    reason: 'patch',
    pendingPatchKeys: patchEntries.length,
    payloadKeys: Object.keys(collapsedPayload).length,
  })
}
