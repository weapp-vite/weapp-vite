import type { SetDataSnapshotOptions } from '../types'

export interface ResolvedSetDataOptions {
  includeComputed: boolean
  setDataStrategy: 'diff' | 'patch'
  maxPatchKeys: number
  maxPayloadBytes: number
  mergeSiblingThreshold: number
  mergeSiblingMaxInflationRatio: number
  mergeSiblingMaxParentBytes: number
  mergeSiblingSkipArray: boolean
  computedCompare: 'reference' | 'shallow' | 'deep'
  computedCompareMaxDepth: number
  computedCompareMaxKeys: number
  prelinkMaxDepth: number | undefined
  prelinkMaxKeys: number | undefined
  debug: SetDataSnapshotOptions['debug']
  debugWhen: 'fallback' | 'always'
  debugSampleRate: number
  elevateTopKeyThreshold: number
  toPlainMaxDepth: number
  toPlainMaxKeys: number
  pickSet: Set<string> | undefined
  omitSet: Set<string> | undefined
  shouldIncludeKey: (key: string) => boolean
}

export function resolveSetDataOptions(
  setDataOptions?: SetDataSnapshotOptions,
): ResolvedSetDataOptions {
  const includeComputed = setDataOptions?.includeComputed ?? true
  const setDataStrategy = setDataOptions?.strategy ?? 'diff'
  const maxPatchKeys = typeof setDataOptions?.maxPatchKeys === 'number'
    ? Math.max(0, setDataOptions!.maxPatchKeys!)
    : Number.POSITIVE_INFINITY
  const maxPayloadBytes = typeof setDataOptions?.maxPayloadBytes === 'number'
    ? Math.max(0, setDataOptions!.maxPayloadBytes!)
    : Number.POSITIVE_INFINITY
  const mergeSiblingThreshold = typeof setDataOptions?.mergeSiblingThreshold === 'number'
    ? Math.max(2, Math.floor(setDataOptions!.mergeSiblingThreshold!))
    : 0
  const mergeSiblingMaxInflationRatio = typeof setDataOptions?.mergeSiblingMaxInflationRatio === 'number'
    ? Math.max(0, setDataOptions!.mergeSiblingMaxInflationRatio!)
    : 1.25
  const mergeSiblingMaxParentBytes = typeof setDataOptions?.mergeSiblingMaxParentBytes === 'number'
    ? Math.max(0, setDataOptions!.mergeSiblingMaxParentBytes!)
    : Number.POSITIVE_INFINITY
  const mergeSiblingSkipArray = setDataOptions?.mergeSiblingSkipArray ?? true
  const computedCompare = setDataOptions?.computedCompare ?? (setDataStrategy === 'patch' ? 'deep' : 'reference')
  const computedCompareMaxDepth = typeof setDataOptions?.computedCompareMaxDepth === 'number'
    ? Math.max(0, Math.floor(setDataOptions!.computedCompareMaxDepth!))
    : 4
  const computedCompareMaxKeys = typeof setDataOptions?.computedCompareMaxKeys === 'number'
    ? Math.max(0, Math.floor(setDataOptions!.computedCompareMaxKeys!))
    : 200
  const prelinkMaxDepth = setDataOptions?.prelinkMaxDepth
  const prelinkMaxKeys = setDataOptions?.prelinkMaxKeys
  const debug = setDataOptions?.debug
  const debugWhen = setDataOptions?.debugWhen ?? 'fallback'
  const debugSampleRate = typeof setDataOptions?.debugSampleRate === 'number'
    ? Math.min(1, Math.max(0, setDataOptions!.debugSampleRate!))
    : 1
  const elevateTopKeyThreshold = typeof setDataOptions?.elevateTopKeyThreshold === 'number'
    ? Math.max(0, Math.floor(setDataOptions!.elevateTopKeyThreshold!))
    : Number.POSITIVE_INFINITY
  const toPlainMaxDepth = typeof setDataOptions?.toPlainMaxDepth === 'number'
    ? Math.max(0, Math.floor(setDataOptions!.toPlainMaxDepth!))
    : Number.POSITIVE_INFINITY
  const toPlainMaxKeys = typeof setDataOptions?.toPlainMaxKeys === 'number'
    ? Math.max(0, Math.floor(setDataOptions!.toPlainMaxKeys!))
    : Number.POSITIVE_INFINITY
  const pickSet = Array.isArray(setDataOptions?.pick) && setDataOptions!.pick!.length > 0
    ? new Set(setDataOptions!.pick)
    : undefined
  const omitSet = Array.isArray(setDataOptions?.omit) && setDataOptions!.omit!.length > 0
    ? new Set(setDataOptions!.omit)
    : undefined
  const shouldIncludeKey = (key: string) => {
    if (pickSet && !pickSet.has(key)) {
      return false
    }
    if (omitSet && omitSet.has(key)) {
      return false
    }
    return true
  }

  return {
    includeComputed,
    setDataStrategy,
    maxPatchKeys,
    maxPayloadBytes,
    mergeSiblingThreshold,
    mergeSiblingMaxInflationRatio,
    mergeSiblingMaxParentBytes,
    mergeSiblingSkipArray,
    computedCompare,
    computedCompareMaxDepth,
    computedCompareMaxKeys,
    prelinkMaxDepth,
    prelinkMaxKeys,
    debug,
    debugWhen,
    debugSampleRate,
    elevateTopKeyThreshold,
    toPlainMaxDepth,
    toPlainMaxKeys,
    pickSet,
    omitSet,
    shouldIncludeKey,
  }
}
