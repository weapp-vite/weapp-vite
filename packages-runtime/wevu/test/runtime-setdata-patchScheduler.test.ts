import type { PatchPrepareOptions } from '@/runtime/app/setData/patchScheduler'
import { describe, expect, it } from 'vitest'
import { preparePatchUpdate } from '@/runtime/app/setData/patchScheduler'

function createBaseOptions(): PatchPrepareOptions {
  return {
    state: { a: { b: 1 } },
    computedRefs: {},
    dirtyComputedKeys: new Set<string>(),
    includeComputed: false,
    functionPaths: [],
    computedCompare: 'reference',
    computedCompareMaxDepth: 2,
    computedCompareMaxKeys: 10,
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
    dispatchedSnapshot: { a: { b: 1 } },
    dispatchedComputedSnapshot: Object.create(null) as Record<string, unknown>,
  }
}

function expectPatch(options: PatchPrepareOptions) {
  const result = preparePatchUpdate(options)
  if (!result || result.type !== 'patch') {
    throw new Error('expected patch preparation')
  }
  return result
}

describe('runtime: patch scheduler helpers', () => {
  it('returns a max-key fallback without dispatching or changing the baseline', () => {
    const options = createBaseOptions()
    const baseline = options.dispatchedSnapshot
    options.maxPatchKeys = 0
    options.pendingPatches.set('a', { kind: 'property', op: 'set' })

    const result = preparePatchUpdate(options)

    expect(result).toEqual({
      type: 'fallback',
      reason: 'maxPatchKeys',
      debug: {
        mode: 'diff',
        reason: 'maxPatchKeys',
        pendingPatchKeys: 1,
        payloadKeys: 0,
      },
    })
    expect(options.dispatchedSnapshot).toBe(baseline)
    expect(options.dispatchedSnapshot).toEqual({ a: { b: 1 } })
    expect(options.pendingPatches.size).toBe(0)
  })

  it('prepares a patch without mutating the dispatched snapshot', () => {
    const options = createBaseOptions()
    const previousBranch = options.dispatchedSnapshot.a
    options.state = { a: { b: 2 } }
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })

    const result = expectPatch(options)

    expect(result.payload).toEqual({ 'a.b': 2 })
    expect(result.snapshot).toEqual({ a: { b: 2 } })
    expect(result.snapshot).not.toBe(options.dispatchedSnapshot)
    expect(result.snapshot.a).not.toBe(previousBranch)
    expect(options.dispatchedSnapshot).toEqual({ a: { b: 1 } })
  })

  it('clones only touched ancestors and shares untouched branches', () => {
    const untouched = { value: 1 }
    const nestedUntouched = { stable: true }
    const touched = {
      child: { count: 0 },
      nestedUntouched,
    }
    const options = createBaseOptions()
    options.state = {
      touched: {
        child: { count: 1 },
        nestedUntouched,
      },
      untouched,
    }
    options.dispatchedSnapshot = { touched, untouched }
    options.pendingPatches.set('touched.child.count', { kind: 'property', op: 'set' })

    const result = expectPatch(options)
    const resultTouched = result.snapshot.touched as Record<string, unknown>

    expect(result.snapshot.untouched).toBe(untouched)
    expect(result.snapshot.touched).not.toBe(touched)
    expect(resultTouched.child).not.toBe(touched.child)
    expect(resultTouched.nestedUntouched).toBe(nestedUntouched)
    expect(options.dispatchedSnapshot).toEqual({
      touched: {
        child: { count: 0 },
        nestedUntouched: { stable: true },
      },
      untouched: { value: 1 },
    })
  })

  it('does not mutate computed planning state when payload size falls back', () => {
    const options = createBaseOptions()
    const computedBaseline = { total: { value: 1 } }
    options.maxPayloadBytes = 1
    options.includeComputed = true
    options.computedRefs = { total: { value: { value: 2 } } }
    options.dispatchedComputedSnapshot = computedBaseline
    options.dirtyComputedKeys.add('total')
    options.state = { a: { b: 2 } }
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })

    const result = preparePatchUpdate(options)

    expect(result?.type).toBe('fallback')
    expect(result).toMatchObject({ reason: 'maxPayloadBytes' })
    expect(options.dispatchedComputedSnapshot).toBe(computedBaseline)
    expect(options.dispatchedComputedSnapshot).toEqual({ total: { value: 1 } })
    expect(options.dirtyComputedKeys.size).toBe(0)
  })

  it('normalizes array patches and returns accepted computed updates separately', () => {
    const options = createBaseOptions()
    options.includeComputed = true
    options.computedCompare = 'shallow'
    options.computedRefs = {
      sum: { value: { total: 2 } },
      equal: { value: [1, 2] },
    }
    options.dispatchedComputedSnapshot = {
      sum: { total: 1 },
      equal: [1, 2],
    }
    options.dirtyComputedKeys.add('sum')
    options.dirtyComputedKeys.add('equal')
    options.state = { a: { list: [99] } }
    options.dispatchedSnapshot = { a: { list: [1] }, sum: { total: 1 } }
    options.pendingPatches.set('a.list.0', { kind: 'array', op: 'delete' })

    const result = expectPatch(options)

    expect(result.payload).toEqual({
      'a.list.0': 99,
      'sum': { total: 2 },
    })
    expect(result.computedUpdates).toEqual({ sum: { total: 2 } })
    expect(options.dispatchedComputedSnapshot).toEqual({
      sum: { total: 1 },
      equal: [1, 2],
    })
  })

  it('clears filtered signals without preparing a dispatch or advancing baselines', () => {
    const options = createBaseOptions()
    const snapshotBaseline = options.dispatchedSnapshot
    const computedBaseline = {
      same: { total: 1 },
      skip: 1,
    }
    options.includeComputed = true
    options.shouldIncludeKey = key => key !== 'skip'
    options.fallbackTopKeys.add('skip')
    options.pendingPatches.set('skip.deep', { kind: 'property', op: 'set' })
    options.computedRefs = {
      same: { value: { total: 1 } },
      skip: { value: 2 },
    }
    options.dispatchedComputedSnapshot = computedBaseline
    options.computedCompare = 'deep'
    options.dirtyComputedKeys.add('same')
    options.dirtyComputedKeys.add('skip')

    expect(preparePatchUpdate(options)).toBeUndefined()
    expect(options.fallbackTopKeys.size).toBe(0)
    expect(options.pendingPatches.size).toBe(0)
    expect(options.dirtyComputedKeys.size).toBe(0)
    expect(options.dispatchedSnapshot).toBe(snapshotBaseline)
    expect(options.dispatchedSnapshot).toEqual({ a: { b: 1 } })
    expect(options.dispatchedComputedSnapshot).toBe(computedBaseline)
    expect(options.dispatchedComputedSnapshot).toEqual({
      same: { total: 1 },
      skip: 1,
    })
  })

  it('prepares computed-only changes with missing nested state values', () => {
    const options = createBaseOptions()
    const snapshotBaseline = options.dispatchedSnapshot
    const computedBaseline = { total: 1 }
    options.includeComputed = true
    options.state = { a: null }
    options.pendingPatches.set('a.b', { kind: 'property', op: 'set' })
    options.computedRefs = {
      total: { value: 3 },
    }
    options.dispatchedComputedSnapshot = computedBaseline
    options.dirtyComputedKeys.add('total')

    const result = expectPatch(options)

    expect(result.payload).toEqual({
      'a.b': null,
      'total': 3,
    })
    expect(result.snapshot).toEqual({
      a: { b: null },
      total: 3,
    })
    expect(result.computedUpdates).toEqual({ total: 3 })
    expect(options.dispatchedSnapshot).toBe(snapshotBaseline)
    expect(options.dispatchedSnapshot).toEqual({ a: { b: 1 } })
    expect(options.dispatchedComputedSnapshot).toBe(computedBaseline)
    expect(options.dispatchedComputedSnapshot).toEqual({ total: 1 })
  })

  it('preserves deletion semantics while merging sibling property patches', () => {
    const options = createBaseOptions()
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
    options.dispatchedSnapshot = {
      a: {
        profile: {
          name: 'old',
          age: 10,
        },
        extra: 'keep',
        obsolete: true,
      },
    }
    options.pendingPatches.set('a.profile.name', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.profile.age', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.obsolete', { kind: 'property', op: 'delete' })

    const result = expectPatch(options)

    expect(result.payload).toEqual({
      'a.obsolete': null,
      'a.profile': {
        name: 'alice',
        age: 18,
      },
    })
    expect(result.snapshot).toEqual({
      a: {
        profile: {
          name: 'alice',
          age: 18,
        },
        extra: 'keep',
      },
    })
    expect(options.dispatchedSnapshot).toHaveProperty('a.obsolete', true)
  })

  it('elevates dense sibling paths to one cached top-level payload', () => {
    const options = createBaseOptions()
    const topBranch = {
      profile: {
        name: 'alice',
        age: 18,
      },
    }
    options.elevateTopKeyThreshold = 2
    options.state = { a: topBranch }
    options.dispatchedSnapshot = {
      a: {
        profile: {
          name: 'old',
          age: 10,
        },
      },
    }
    options.pendingPatches.set('a.profile.name', { kind: 'property', op: 'set' })
    options.pendingPatches.set('a.profile.age', { kind: 'property', op: 'set' })

    const result = expectPatch(options)

    expect(result.payload).toEqual({ a: topBranch })
    expect(result.snapshot).toEqual({ a: topBranch })
    expect(options.fallbackTopKeys.size).toBe(0)
  })
})
