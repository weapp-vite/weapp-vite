import { describe, expect, it } from 'vitest'
import { reactive } from '@/reactivity'
import { createComputedAccessors } from '@/runtime/app/computed'
import { resolveSetDataOptions } from '@/runtime/app/setDataOptions'

describe('runtime: app helpers', () => {
  it('resolves setData options with defaults and clamps', () => {
    const resolved = resolveSetDataOptions({
      strategy: 'patch',
      maxPatchKeys: -1,
      mergeSiblingThreshold: 1,
      pick: ['a'],
      omit: ['b'],
    })

    expect(resolved.setDataStrategy).toBe('patch')
    expect(resolved.maxPatchKeys).toBe(0)
    expect(resolved.mergeSiblingThreshold).toBe(2)
    expect(resolved.computedCompare).toBe('deep')
    expect(resolved.shouldIncludeKey('a')).toBe(true)
    expect(resolved.shouldIncludeKey('b')).toBe(false)
  })

  it('enables setData loop warnings by default', () => {
    const resolved = resolveSetDataOptions()

    expect(resolved.loopWarning).toEqual({
      sampleWindowMs: 1000,
      maxFlushes: 50,
      coolDownMs: 5000,
    })
  })

  it('allows disabling setData loop warnings explicitly', () => {
    expect(resolveSetDataOptions({ loopWarning: false }).loopWarning).toBe(false)
    expect(resolveSetDataOptions({ loopWarning: { enabled: false } }).loopWarning).toBe(false)
  })

  it('tracks computed values and marks dirty keys', () => {
    const state = reactive({ count: 0 })
    const { computedRefs, computedProxy, dirtyComputedKeys, createTrackedComputed } = createComputedAccessors({
      includeComputed: true,
      setDataStrategy: 'patch',
    })

    computedRefs.count = createTrackedComputed('count', () => state.count)
    expect((computedProxy as any).count).toBe(0)
    state.count += 1
    expect(dirtyComputedKeys.has('count')).toBe(true)
    expect(computedRefs.count.value).toBe(1)
  })
})
