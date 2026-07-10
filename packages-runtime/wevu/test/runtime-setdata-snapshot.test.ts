import { describe, expect, it } from 'vitest'
import { computed, effect, reactive, toRaw } from '@/reactivity'
import { createSetDataScheduler } from '@/runtime/app/setData/scheduler'
import {
  applySnapshotUpdate,
  cloneSnapshotValue,
  collectSnapshot,
  isDeepEqualValue,
  isPlainObjectLike,
  isShallowEqualValue,
  normalizeSetDataValue,
} from '@/runtime/app/setData/snapshot'

describe('runtime: setData snapshot helpers', () => {
  it('normalizes undefined and clones nested arrays/plain objects', () => {
    const source = {
      list: [1, { nested: 2 }],
      plain: Object.assign(Object.create(null), { ok: true }),
      date: new Date('2024-01-01T00:00:00.000Z'),
    }

    const cloned = cloneSnapshotValue(source)
    expect(normalizeSetDataValue(undefined)).toBeNull()
    expect(normalizeSetDataValue(1)).toBe(1)
    expect(cloned).toEqual(source)
    expect(cloned).not.toBe(source)
    expect(cloned.list).not.toBe(source.list)
    expect(cloned.list[1]).not.toBe(source.list[1])
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(cloned.plain)).toBe(Object.prototype)
    expect(cloned.date).toBe(source.date)
  })

  it('recognizes plain objects and compares shallow values', () => {
    expect(isPlainObjectLike({})).toBe(true)
    expect(isPlainObjectLike(Object.create(null))).toBe(true)
    expect(isPlainObjectLike([])).toBe(false)
    expect(isPlainObjectLike(new Map())).toBe(false)
    expect(isPlainObjectLike(null)).toBe(false)

    expect(isShallowEqualValue([1, 2], [1, 2])).toBe(true)
    expect(isShallowEqualValue([1], [1, 2])).toBe(false)
    expect(isShallowEqualValue({ a: 1 }, { a: 1 })).toBe(true)
    expect(isShallowEqualValue({ a: 1 }, { a: 2 })).toBe(false)
    expect(isShallowEqualValue({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(isShallowEqualValue({ a: 1 }, Object.create({ a: 1 }))).toBe(false)
  })

  it('compares deep values with depth and key budget limits', () => {
    expect(isDeepEqualValue({ a: { b: 1 } }, { a: { b: 1 } }, 3, { keys: 10 })).toBe(true)
    expect(isDeepEqualValue({ a: { b: 1 } }, { a: { b: 2 } }, 3, { keys: 10 })).toBe(false)
    expect(isDeepEqualValue({ a: 1 }, { a: 1 }, 0, { keys: 10 })).toBe(false)
    expect(isDeepEqualValue([1, [2]], [1, [2]], 3, { keys: 10 })).toBe(true)
    expect(isDeepEqualValue({ a: 1, b: 2 }, { a: 1, b: 2 }, 3, { keys: 1 })).toBe(false)
  })

  it('applies set and delete updates with nested-path fallback handling', () => {
    const snapshot: Record<string, any> = {}

    applySnapshotUpdate(snapshot, '', 1, 'set')
    expect(snapshot).toEqual({})

    applySnapshotUpdate(snapshot, 'foo.bar', { count: 1 }, 'set')
    expect(snapshot.foo.bar).toEqual({ count: 1 })
    expect(snapshot.foo.bar).not.toBe(snapshot.foo)
    expect(Object.getPrototypeOf(snapshot.foo)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(snapshot.foo.bar)).toBe(Object.prototype)

    applySnapshotUpdate(snapshot, 'foo.bar', undefined, 'delete')
    expect('bar' in snapshot.foo).toBe(false)

    const throwingTarget = new Proxy({ leaf: 1 }, {
      deleteProperty() {
        throw new Error('delete failed')
      },
    })
    snapshot.throwing = throwingTarget
    applySnapshotUpdate(snapshot, 'throwing.leaf', undefined, 'delete')
    expect(snapshot.throwing.leaf).toBeNull()
  })

  it('collects snapshot data from raw reactive state and computed refs', () => {
    const state = reactive({
      plain: { keep: true },
      skip: 'ignored',
      nested: { value: 2 },
    }) as Record<string, any>
    const computedRefs = {
      doubled: computed(() => state.nested.value * 2),
      skippedComputed: computed(() => 999),
    }
    const plainCache = new WeakMap<object, { version: number, value: any }>()

    const withoutComputed = collectSnapshot({
      state,
      computedRefs,
      includeComputed: false,
      shouldIncludeKey: key => key !== 'skip',
      plainCache,
      toPlainMaxDepth: 5,
      toPlainMaxKeys: 20,
    })
    expect(withoutComputed).toEqual({
      plain: { keep: true },
      nested: { value: 2 },
    })
    expect(Object.getPrototypeOf(withoutComputed)).toBe(Object.prototype)

    const withComputed = collectSnapshot({
      state,
      computedRefs,
      includeComputed: true,
      shouldIncludeKey: key => !key.startsWith('skip'),
      plainCache,
      toPlainMaxDepth: 5,
      toPlainMaxKeys: 20,
    })
    expect(withComputed).toEqual({
      plain: { keep: true },
      nested: { value: 2 },
      doubled: 4,
    })
    expect(Object.getPrototypeOf(withComputed)).toBe(Object.prototype)
  })

  it('collects setup state alongside reactive state in snapshot output', () => {
    const state = reactive({
      plain: 'data',
    }) as Record<string, any>
    const setupState = reactive({
      setupOnly: 'value',
    }) as Record<string, any>
    const computedRefs = {}
    const plainCache = new WeakMap<object, { version: number, value: any }>()

    const snapshot = collectSnapshot({
      state,
      setupState,
      computedRefs,
      includeComputed: false,
      shouldIncludeKey: _key => true,
      plainCache,
      toPlainMaxDepth: 5,
      toPlainMaxKeys: 20,
    })

    expect(snapshot).toEqual({
      plain: 'data',
      setupOnly: 'value',
    })
  })

  it('diffs setup computed refs that feed template computed values', () => {
    const state = reactive({}) as Record<string, any>
    const setupState = reactive({
      hasError: { value: false },
      isActive: { value: false },
    }) as Record<string, any>
    const styleObject = computed(() => ({
      color: setupState.hasError.value ? '#b91c1c' : setupState.isActive.value ? '#ffffff' : '#1f1a3f',
    }))
    setupState.styleObject = styleObject
    const computedRefs = {
      __wv_style_0: computed(() => styleObject.value),
    }
    const payloads: Record<string, any>[] = []
    let mounted = true
    let tracker: ReturnType<typeof effect> | undefined
    const scheduler = createSetDataScheduler({
      state,
      setupState,
      computedRefs,
      dirtyComputedKeys: new Set<string>(),
      includeComputed: true,
      setDataStrategy: 'diff',
      computedCompare: 'reference',
      computedCompareMaxDepth: 3,
      computedCompareMaxKeys: 20,
      currentAdapter: {
        setData(payload) {
          payloads.push(payload)
        },
      },
      shouldIncludeKey: () => true,
      maxPatchKeys: 10,
      maxPayloadBytes: 100_000,
      mergeSiblingThreshold: 0,
      mergeSiblingMaxInflationRatio: 1.5,
      mergeSiblingMaxParentBytes: 20_000,
      mergeSiblingSkipArray: true,
      elevateTopKeyThreshold: 0,
      toPlainMaxDepth: 5,
      toPlainMaxKeys: 50,
      functionPaths: [],
      debug: undefined,
      debugWhen: 'fallback',
      debugSampleRate: 1,
      loopWarning: false,
      runTracker: () => tracker?.(),
      isMounted: () => mounted,
    })

    tracker = effect(() => {
      void setupState.hasError.value
      void setupState.isActive.value
      void setupState.styleObject.value
    }, {
      lazy: true,
      scheduler: () => scheduler.job(toRaw(state) as object),
    })

    scheduler.job(toRaw(state) as object)
    payloads.length = 0
    setupState.hasError.value = true

    expect(payloads.at(-1)).toMatchObject({
      '__wv_style_0.color': '#b91c1c',
      'styleObject.color': '#b91c1c',
    })
    mounted = false
  })
})
