import { describe, expect, it, vi } from 'vitest'
import { runPatchUpdate } from '@/runtime/app/setData/patchScheduler'

function createBaseOptions() {
  const adapter = { setData: vi.fn() }
  const runDiffUpdate = vi.fn()
  const emitDebug = vi.fn()
  const needsFullSnapshot = { value: false }
  const latestSnapshot = { a: { b: 1 } }

  return {
    adapter,
    runDiffUpdate,
    emitDebug,
    needsFullSnapshot,
    latestSnapshot,
    options: {
      state: { a: { b: 1 } },
      computedRefs: {},
      dirtyComputedKeys: new Set<string>(),
      includeComputed: false,
      computedCompare: 'reference' as const,
      computedCompareMaxDepth: 2,
      computedCompareMaxKeys: 10,
      currentAdapter: adapter,
      shouldIncludeKey: () => true,
      maxPatchKeys: 10,
      maxPayloadBytes: Number.POSITIVE_INFINITY,
      mergeSiblingThreshold: 0,
      mergeSiblingMaxInflationRatio: 0,
      mergeSiblingMaxParentBytes: 0,
      mergeSiblingSkipArray: false,
      elevateTopKeyThreshold: 0,
      toPlainMaxDepth: 4,
      toPlainMaxKeys: 100,
      plainCache: new WeakMap(),
      pendingPatches: new Map(),
      fallbackTopKeys: new Set<string>(),
      latestSnapshot,
      latestComputedSnapshot: Object.create(null),
      needsFullSnapshot,
      emitDebug,
      runDiffUpdate,
    },
  }
}

describe('runtime: patch scheduler helpers', () => {
  it('falls back to diff when maxPatchKeys is exceeded', () => {
    const { options, adapter, runDiffUpdate, needsFullSnapshot } = createBaseOptions()
    options.maxPatchKeys = 0
    options.pendingPatches.set('a', { kind: 'property', op: 'set' })

    runPatchUpdate(options)

    expect(needsFullSnapshot.value).toBe(true)
    expect(runDiffUpdate).toHaveBeenCalledWith('maxPatchKeys')
    expect(adapter.setData).not.toHaveBeenCalled()
  })

  it('emits patch payload and updates latest snapshot', () => {
    const { options, adapter, runDiffUpdate, latestSnapshot } = createBaseOptions()
    options.state.a.b = 2
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })

    runPatchUpdate(options)

    expect(runDiffUpdate).not.toHaveBeenCalled()
    expect(adapter.setData).toHaveBeenCalledWith({ 'a.b': 2 })
    expect(latestSnapshot).toEqual({ a: { b: 2 } })
  })
})
