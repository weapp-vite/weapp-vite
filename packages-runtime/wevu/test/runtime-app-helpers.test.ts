import { describe, expect, it } from 'vitest'
import { batch, effect, reactive } from '@/reactivity'
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

  it('invalidates runtime computed values before batch consumers', () => {
    const state = reactive({ alternate: false, primary: 0, secondary: 0 })
    const { computedRefs, computedProxy, createTrackedComputed } = createComputedAccessors({
      includeComputed: true,
      setDataStrategy: 'patch',
    })
    computedRefs.value = createTrackedComputed(
      'value',
      () => state.alternate ? state.secondary : state.primary,
    )
    const snapshots: string[] = []

    effect(() => {
      snapshots.push(`${state.secondary}:${(computedProxy as any).value}`)
    })
    state.alternate = true
    snapshots.length = 0

    batch(() => {
      state.secondary = 1
    })

    expect(snapshots).toEqual(['1:1'])
  })

  it('reads fresh runtime computed values within a batch', () => {
    const state = reactive({ count: 1, saved: 0 })
    const { computedRefs, computedProxy, createTrackedComputed } = createComputedAccessors({
      includeComputed: true,
      setDataStrategy: 'patch',
    })
    computedRefs.doubled = createTrackedComputed('doubled', () => state.count * 2)
    // 此测试只注册 doubled，访问器返回值由上面的 getter 确定。
    const proxy = computedProxy as { doubled: number }
    const snapshots: number[] = []
    effect(() => {
      snapshots.push(proxy.doubled)
    })

    batch(() => {
      state.count = 2
      state.saved = proxy.doubled
      expect(state.saved).toBe(4)
      expect(snapshots).toEqual([2])
    })

    expect(snapshots).toEqual([2, 4])
  })
})
