import { describe, expect, it } from 'vitest'
import { computed, reactive } from '@/reactivity'
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
})
