import { describe, expect, it } from 'vitest'
import { effect, isReactive, reactive, readonly, ref, setDeepWatchStrategy, stop, touchReactive, watch, watchEffect } from '@/reactivity'

describe('reactivity (root version)', () => {
  it('touchReactive reacts to nested writes without deep traverse', () => {
    const state = reactive({ a: { b: 0 } })
    let ticks = 0
    const runner = effect(() => {
      touchReactive(state)
      // access nested child to establish child -> root mapping
      void state.a
      ticks++
    })
    expect(ticks).toBe(1)
    state.a.b = 1
    expect(ticks).toBe(2)
    state.a.b = 2
    expect(ticks).toBe(3)
    stop(runner)
  })

  it('deep watch uses version strategy for reactive values', () => {
    setDeepWatchStrategy('version')
    const state = reactive({ x: { y: 1 } })
    const calls: any[] = []
    const stopWatch = watch(
      () => state,
      (val) => {
        calls.push(val.x.y)
      },
      { deep: true, immediate: false },
    )
    state.x.y = 2
    state.x.y = 3
    // uses microtask scheduler; quickly poll stack
    return Promise.resolve().then(() => {
      expect(calls).toEqual([3])
      stopWatch()
      setDeepWatchStrategy('version')
    })
  })

  it('deep watch falls back to traverse for non-reactive sources', async () => {
    setDeepWatchStrategy('version')
    const src = ref({ k: 1 })
    const calls: any[] = []
    const stopWatch = watch(
      () => src.value,
      (val) => {
        calls.push(val.k)
      },
      { deep: true, immediate: false },
    )
    src.value.k = 2
    await Promise.resolve()
    expect(calls).toEqual([2])
    stopWatch()
    setDeepWatchStrategy('version')
  })

  it('isReactive returns true for reactive', () => {
    const o = reactive({ n: 1 })
    expect(isReactive(o)).toBe(true)
    expect(isReactive({})).toBe(false)
  })

  it('effect onStop is called and lazy option', () => {
    let cleaned = 0
    const runner = effect(() => {}, {
      onStop: () => {
        cleaned++
      },
      lazy: true,
    })
    // not executed until run
    runner()
    stop(runner)
    expect(cleaned).toBe(1)
  })

  it('readonly for object and ref throws on write', () => {
    const ro = readonly({ a: 1 } as any)
    expect(() => {
      ;(ro as any).a = 2
    }).toThrow()
    const rr = readonly(ref(1)) as any
    expect(() => {
      rr.value = 2
    }).toThrow()
  })
  it('readonly returns primitive as is', () => {
    expect(readonly(1 as any)).toBe(1)
  })

  it('watchEffect cleanup works', async () => {
    const c = ref(0)
    let cleaned = 0
    const stopEf = watchEffect((onCleanup) => {
      onCleanup(() => {
        cleaned++
      })
      // access
      void c.value
    })
    c.value++
    await Promise.resolve()
    expect(cleaned).toBeGreaterThanOrEqual(1)
    stopEf()
  })
})
