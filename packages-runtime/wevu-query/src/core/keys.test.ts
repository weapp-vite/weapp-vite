import { describe, expect, it } from 'vitest'
import { createQueryMatcher, hashQueryKey, snapshotQueryKey } from './keys'

describe('query keys', () => {
  it('sorts nested object fields while preserving array order', () => {
    const left = ['orders', { filter: { state: 'open', page: 2 }, tenant: 1 }] as const
    const right = ['orders', { tenant: 1, filter: { page: 2, state: 'open' } }] as const

    expect(hashQueryKey(left)).toBe(hashQueryKey(right))
    expect(hashQueryKey(['orders', 1])).not.toBe(hashQueryKey([1, 'orders']))
  })

  it('returns a detached frozen snapshot', () => {
    const filter = { state: 'open' }
    const key = ['orders', filter] as const
    const snapshot = snapshotQueryKey(key)

    filter.state = 'closed'
    expect(snapshot).toEqual(['orders', { state: 'open' }])
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot[1])).toBe(true)
  })

  it('rejects values that cannot participate in collision-free JSON identity', () => {
    const cyclic: unknown[] = []
    cyclic.push(cyclic)
    const sparse = Array.from({ length: 2 })
    delete sparse[0]

    for (const key of [
      ['orders', undefined],
      ['orders', () => 1],
      ['orders', Symbol('orders')],
      ['orders', 1n],
      ['orders', Number.NaN],
      ['orders', Number.POSITIVE_INFINITY],
      ['orders', new Date(0)],
      cyclic,
      sparse,
    ]) {
      expect(() => hashQueryKey(key)).toThrow(TypeError)
    }
  })

  it('matches root prefixes and nested object subsets without relaxing nested arrays', () => {
    const key = snapshotQueryKey([
      'orders',
      { filters: { states: ['open', 'paid'], tenant: 7 }, page: 2 },
      'detail',
    ] as const)
    const hash = hashQueryKey(key)

    expect(createQueryMatcher({ key: ['orders', { filters: { tenant: 7 } }] })(key, hash)).toBe(true)
    expect(createQueryMatcher({ key: ['orders', { page: 3 }] })(key, hash)).toBe(false)
    expect(createQueryMatcher({ key: ['orders', { filters: { states: ['open'] } }] })(key, hash)).toBe(false)
    expect(createQueryMatcher({ key: ['orders'], exact: true })(key, hash)).toBe(false)
    expect(createQueryMatcher({ key, exact: true })(key, hash)).toBe(true)
  })
})
