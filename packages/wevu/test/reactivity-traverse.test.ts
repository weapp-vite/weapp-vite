import { describe, expect, it } from 'vitest'
import { markRaw, ref, traverse } from '@/reactivity'

describe('traverse', () => {
  it('skips markRaw values', () => {
    let hits = 0
    const raw = markRaw({
      get touched() {
        hits += 1
        return 1
      },
    })
    traverse(raw)
    expect(hits).toBe(0)
  })

  it('handles refs, maps, and sets', () => {
    const hits: string[] = []
    const mapValue = {
      get value() {
        hits.push('map')
        return 1
      },
    }
    const setValue = {
      get value() {
        hits.push('set')
        return 1
      },
    }
    const refValue = {
      get value() {
        hits.push('ref')
        return 1
      },
    }

    traverse(ref(refValue))
    traverse(new Map([['a', mapValue]]))
    traverse(new Set([setValue]))

    expect(hits).toEqual(expect.arrayContaining(['ref', 'map', 'set']))
  })

  it('respects depth limits', () => {
    let hits = 0
    const state = { a: {} as Record<string, number> }
    Object.defineProperty(state.a, 'b', {
      enumerable: true,
      get() {
        hits += 1
        return 1
      },
    })

    traverse(state, 1)
    expect(hits).toBe(0)

    traverse(state, 2)
    expect(hits).toBe(1)
  })
})
