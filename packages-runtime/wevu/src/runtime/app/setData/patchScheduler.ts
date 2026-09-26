import type { SetDataDebugInfo } from '../../types'
import type { SetDataPayload, SetDataSnapshot } from './commitTracker'
import { toPlain } from '../../diff'
import { checkPayloadSize, collapsePayload, mergeSiblingPayload } from './payload'
import { applySnapshotUpdate, cloneSnapshotValue, isDeepEqualValue, isShallowEqualValue, normalizeSetDataValue } from './snapshot'

interface PatchEntry {
  kind: 'property' | 'array'
  op: 'set' | 'delete'
}

export type PatchPreparation
  = | undefined
    | {
      type: 'fallback'
      reason: 'maxPatchKeys' | 'maxPayloadBytes'
      debug: SetDataDebugInfo
    }
    | {
      type: 'patch'
      payload: SetDataPayload
      snapshot: SetDataSnapshot
      computedUpdates?: SetDataSnapshot
      debug: SetDataDebugInfo
    }

export interface PatchPrepareOptions {
  state: Record<string, unknown>
  computedRefs: Record<string, { value: unknown }>
  dirtyComputedKeys: Set<string>
  includeComputed: boolean
  computedCompare: 'reference' | 'shallow' | 'deep'
  computedCompareMaxDepth: number
  computedCompareMaxKeys: number
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
  includeFunctions?: boolean
  functionPaths: string[]
  plainCache: WeakMap<object, { version: number, value: unknown }>
  plainCacheEligibility?: WeakMap<object, boolean>
  pendingPatches: Map<string, PatchEntry>
  fallbackTopKeys: Set<string>
  dispatchedSnapshot: SetDataSnapshot
  dispatchedComputedSnapshot: SetDataSnapshot
}

export function preparePatchUpdate(options: PatchPrepareOptions): PatchPreparation {
  const {
    state,
    computedRefs,
    dirtyComputedKeys,
    includeComputed,
    computedCompare,
    computedCompareMaxDepth,
    computedCompareMaxKeys,
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
    includeFunctions = false,
    functionPaths,
    plainCache,
    plainCacheEligibility,
    pendingPatches,
    fallbackTopKeys,
    dispatchedSnapshot,
    dispatchedComputedSnapshot,
  } = options

  if (pendingPatches.size > maxPatchKeys) {
    const pendingCount = pendingPatches.size
    pendingPatches.clear()
    dirtyComputedKeys.clear()
    return {
      type: 'fallback',
      reason: 'maxPatchKeys',
      debug: {
        mode: 'diff',
        reason: 'maxPatchKeys',
        pendingPatchKeys: pendingCount,
        payloadKeys: 0,
      },
    }
  }

  const seen = new WeakMap<object, unknown>()
  const plainByPath = new Map<string, unknown>()
  const payload: SetDataPayload = Object.create(null) as SetDataPayload
  const patchEntriesRaw = [...pendingPatches.entries()]

  if (Number.isFinite(elevateTopKeyThreshold) && elevateTopKeyThreshold > 0) {
    const counts = new Map<string, number>()
    for (const [path] of patchEntriesRaw) {
      const top = path.split('.', 1)[0]!
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
  const entryMap = new Map<string, PatchEntry>(patchEntries)
  pendingPatches.clear()

  const getStateValueByPath = (path: string) => {
    const segments = path.split('.').filter(Boolean)
    let current: unknown = state
    for (const segment of segments) {
      if (current == null || typeof current !== 'object') {
        return current
      }
      current = Reflect.get(current, segment)
    }
    return current
  }

  const getPlainByPath = (path: string) => {
    if (plainByPath.has(path)) {
      return plainByPath.get(path)
    }
    const value = normalizeSetDataValue(
      toPlain(getStateValueByPath(path), seen, {
        cache: plainCache,
        cacheEligibility: plainCacheEligibility,
        maxDepth: toPlainMaxDepth,
        maxKeys: toPlainMaxKeys,
        includeFunctions,
        functionPaths,
        _path: path,
      }),
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
    payload[path] = effectiveOp === 'delete'
      ? null
      : getPlainByPath(path)
  }

  let computedDirtyProcessed = 0
  const computedUpdates: SetDataSnapshot = Object.create(null) as SetDataSnapshot
  if (includeComputed && dirtyComputedKeys.size) {
    const keys = [...dirtyComputedKeys]
    dirtyComputedKeys.clear()
    computedDirtyProcessed = keys.length
    for (const key of keys) {
      if (!shouldIncludeKey(key)) {
        continue
      }
      const nextValue = toPlain(computedRefs[key]!.value, seen, {
        cache: plainCache,
        cacheEligibility: plainCacheEligibility,
        maxDepth: toPlainMaxDepth,
        maxKeys: toPlainMaxKeys,
        includeFunctions,
        functionPaths,
        _path: key,
      })
      const prevValue = dispatchedComputedSnapshot[key]
      const equal = computedCompare === 'deep'
        ? isDeepEqualValue(prevValue, nextValue, computedCompareMaxDepth, { keys: computedCompareMaxKeys })
        : computedCompare === 'shallow'
          ? isShallowEqualValue(prevValue, nextValue)
          : Object.is(prevValue, nextValue)
      if (equal) {
        continue
      }
      payload[key] = normalizeSetDataValue(nextValue)
      computedUpdates[key] = cloneSnapshotValue(nextValue)
    }
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
  const payloadKeys = Object.keys(collapsedPayload).length
  const debug: SetDataDebugInfo = {
    mode: sizeCheck.fallback ? 'diff' : 'patch',
    reason: sizeCheck.fallback ? 'maxPayloadBytes' : 'patch',
    pendingPatchKeys: patchEntries.length,
    payloadKeys,
    mergedSiblingParents: mergedSiblingParents || undefined,
    computedDirtyKeys: computedDirtyProcessed || undefined,
    estimatedBytes: sizeCheck.estimatedBytes,
    bytes: sizeCheck.bytes,
  }
  if (sizeCheck.fallback) {
    return {
      type: 'fallback',
      reason: 'maxPayloadBytes',
      debug,
    }
  }
  if (!payloadKeys) {
    return undefined
  }

  const snapshot: SetDataSnapshot = { ...dispatchedSnapshot }
  const clonedParents = new WeakSet<object>()
  for (const [path, value] of Object.entries(collapsedPayload)) {
    const entry = entryMap.get(path)
    applySnapshotUpdate(
      snapshot,
      path,
      value,
      entry?.kind === 'array' ? 'set' : (entry?.op ?? 'set'),
      { cloneValue: false, clonedParents },
    )
  }

  return {
    type: 'patch',
    payload: collapsedPayload,
    snapshot,
    computedUpdates: Object.keys(computedUpdates).length ? computedUpdates : undefined,
    debug,
  }
}
