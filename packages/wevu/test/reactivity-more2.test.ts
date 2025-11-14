import { describe, expect, it } from 'vitest'
import { computed, effect, reactive, readonly } from '@/reactivity'

describe('reactivity (extra branches)', () => {
  it('writable computed setter triggers scheduler and updates dependents', async () => {
    const s = reactive({ n: 1 })
    const doubled = computed({
      get() {
        return s.n * 2
      },
      set(v: number) {
        s.n = v / 2
      },
    })
    let observed = 0
    effect(() => {
      // depend on doubled
      observed = doubled.value
    })
    expect(observed).toBe(2)
    doubled.value = 10
    // effect should rerun via scheduler
    await Promise.resolve()
    expect(observed).toBe(10)
    expect(s.n).toBe(5)
  })

  it('readonly object throws on delete/defineProperty', () => {
    const o = readonly({ a: 1 } as any)
    expect(() => {
      // @ts-expect-error deleting should throw
      delete (o as any).a
    }).toThrow()
    expect(() => {
      Object.defineProperty(o as any, 'b', { value: 1 })
    }).toThrow()
  })
})
