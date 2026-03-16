import { describe, expect, it, vi } from 'vitest'
import { runPatchUpdate } from '@/runtime/app/setData/patchScheduler'

type PatchUpdateOptions = Parameters<typeof runPatchUpdate>[0]

function createBaseOptions(): {
  adapter: PatchUpdateOptions['currentAdapter']
  runDiffUpdate: ReturnType<typeof vi.fn>
  emitDebug: ReturnType<typeof vi.fn>
  needsFullSnapshot: { value: boolean }
  latestSnapshot: Record<string, any>
  options: PatchUpdateOptions
} {
  const adapter: PatchUpdateOptions['currentAdapter'] = { setData: vi.fn() }
  const runDiffUpdate = vi.fn()
  const emitDebug = vi.fn()
  const needsFullSnapshot = { value: false }
  const latestSnapshot: Record<string, any> = { a: { b: 1 } }

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
      computedCompare: 'reference',
      computedCompareMaxDepth: 2,
      computedCompareMaxKeys: 10,
      currentAdapter: adapter,
      shouldIncludeKey: (_key: string) => true,
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
    } satisfies PatchUpdateOptions,
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

  it('falls back to diff when payload size exceeds limit after collapsing', () => {
    const { options, adapter, runDiffUpdate, needsFullSnapshot } = createBaseOptions()
    options.maxPayloadBytes = 1
    options.state.a.b = 2
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })

    runPatchUpdate(options)

    expect(needsFullSnapshot.value).toBe(true)
    expect(runDiffUpdate).toHaveBeenCalledWith('maxPayloadBytes')
    expect(adapter.setData).not.toHaveBeenCalled()
  })

  it('elevates dense sibling patches to top-level payloads and swallows async setData rejection', async () => {
    const { options, latestSnapshot } = createBaseOptions()
    const setData: NonNullable<PatchUpdateOptions['currentAdapter']['setData']> = vi.fn(() => Promise.reject(new Error('async boom')))
    options.currentAdapter = { setData }
    options.elevateTopKeyThreshold = 2
    options.state = {
      a: { b: 2, c: 3 },
    }
    options.latestSnapshot.a = { b: 1, c: 1 }
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.c', { kind: 'property', op: 'set' })

    expect(() => runPatchUpdate(options)).not.toThrow()
    await Promise.resolve()

    expect(setData).toHaveBeenCalledWith({ a: { b: 2, c: 3 } })
    expect(latestSnapshot).toEqual({ a: { b: 2, c: 3 } })
    expect(options.fallbackTopKeys.size).toBe(0)
  })

  it('handles computed dirty keys with shallow comparison and array patch normalization', () => {
    const { options, adapter } = createBaseOptions()
    options.includeComputed = true
    options.computedCompare = 'shallow'
    options.computedRefs = {
      sum: { value: { total: 2 } },
      equal: { value: [1, 2] },
    }
    options.latestComputedSnapshot = {
      sum: { total: 1 },
      equal: [1, 2],
    }
    options.dirtyComputedKeys.add('sum')
    options.dirtyComputedKeys.add('equal')
    options.pendingPatches.set('a.list.0', { kind: 'array', op: 'delete' })
    ;(options.state as any).a.list = [99]

    runPatchUpdate(options)

    expect(adapter.setData).toHaveBeenCalledWith({
      'a.list.0': 99,
      'sum': { total: 2 },
    })
    expect(options.latestComputedSnapshot).toEqual({
      sum: { total: 2 },
      equal: [1, 2],
    })
  })

  it('returns early when filtered payload becomes empty after fallback top keys and computed checks', () => {
    const { options, adapter } = createBaseOptions()
    options.includeComputed = true
    options.shouldIncludeKey = key => key !== 'skip'
    options.fallbackTopKeys.add('skip')
    options.pendingPatches.set('skip.deep', { kind: 'property', op: 'set' })
    options.computedRefs = {
      same: { value: { total: 1 } },
      skip: { value: 2 },
    }
    options.latestComputedSnapshot = {
      same: { total: 1 },
      skip: 1,
    }
    options.computedCompare = 'deep'
    options.dirtyComputedKeys.add('same')
    options.dirtyComputedKeys.add('skip')
    options.currentAdapter = {} as PatchUpdateOptions['currentAdapter']

    runPatchUpdate(options)

    expect(adapter.setData).not.toHaveBeenCalled()
    expect(options.fallbackTopKeys.size).toBe(0)
    expect(options.pendingPatches.size).toBe(0)
    expect(options.dirtyComputedKeys.size).toBe(0)
    expect(options.latestComputedSnapshot).toEqual({
      same: { total: 1 },
      skip: 1,
    })
  })

  it('updates snapshot for computed-only payloads and tolerates missing nested state values', () => {
    const { options, adapter, latestSnapshot } = createBaseOptions()
    options.includeComputed = true
    options.state = { a: null as any }
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })
    options.computedRefs = {
      total: { value: 3 },
    }
    options.latestComputedSnapshot = {
      total: 1,
    }
    options.dirtyComputedKeys.add('total')

    runPatchUpdate(options)

    expect(adapter.setData).toHaveBeenCalledWith({
      'a.b': null,
      'total': 3,
    })
    expect(latestSnapshot).toEqual({
      a: { b: null },
      total: 3,
    })
    expect(options.latestComputedSnapshot).toEqual({
      total: 3,
    })
  })

  it('emits delete payloads and merges sibling property patches through the scheduler', () => {
    const { options, adapter, latestSnapshot } = createBaseOptions()
    options.mergeSiblingThreshold = 2
    options.mergeSiblingMaxInflationRatio = Number.POSITIVE_INFINITY
    options.mergeSiblingMaxParentBytes = Number.POSITIVE_INFINITY
    options.state = {
      a: {
        profile: {
          name: 'alice',
          age: 18,
        },
        extra: 'keep',
      },
    }
    options.latestSnapshot.a = {
      profile: {
        name: 'old',
        age: 10,
      },
      extra: 'keep',
      obsolete: true,
    }
    options.pendingPatches.set('a.profile.name', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.profile.age', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.obsolete', { kind: 'property', op: 'delete' })

    runPatchUpdate(options)

    expect(adapter.setData).toHaveBeenCalledWith({
      'a.obsolete': null,
      'a.profile': {
        name: 'alice',
        age: 18,
      },
    })
    expect(latestSnapshot).toEqual({
      a: {
        profile: {
          name: 'alice',
          age: 18,
        },
        extra: 'keep',
      },
    })
  })

  it('reuses cached plain values when fallback top keys and sibling merge both read the same branch', () => {
    const { options, adapter } = createBaseOptions()
    options.mergeSiblingThreshold = 2
    options.mergeSiblingMaxInflationRatio = Number.POSITIVE_INFINITY
    options.mergeSiblingMaxParentBytes = Number.POSITIVE_INFINITY
    options.elevateTopKeyThreshold = 2
    const topBranch = {
      profile: {
        name: 'alice',
        age: 18,
      },
    }
    options.state = {
      a: topBranch,
    }
    options.pendingPatches.set('a.profile.name', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.profile.age', { kind: 'property', op: 'set' })

    runPatchUpdate(options)

    expect(adapter.setData).toHaveBeenCalledWith({
      a: topBranch,
    })
  })
})
