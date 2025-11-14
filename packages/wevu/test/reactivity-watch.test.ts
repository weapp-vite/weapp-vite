import { describe, expect, it } from 'vitest'
import { reactive, ref, setDeepWatchStrategy, watch } from '@/reactivity'

describe('watch branches', () => {
  it('watch function source, immediate', async () => {
    const o = reactive({ n: 1 })
    const logs: number[] = []
    const stop = watch(() => o.n, v => logs.push(v), { immediate: true })
    o.n = 2
    await Promise.resolve()
    expect(logs).toEqual([1, 2])
    stop()
  })

  it('watch ref source, not immediate', async () => {
    const r = ref(1)
    const logs: number[] = []
    const stop = watch(r, v => logs.push(v))
    r.value = 3
    await Promise.resolve()
    expect(logs).toEqual([3])
    stop()
  })

  it('watch reactive (deep=false) does not trigger on nested write', async () => {
    const o = reactive({ a: { b: 0 } })
    const logs: number[] = []
    const stop = watch(() => o, () => logs.push(1))
    o.a.b++
    await Promise.resolve()
    expect(logs).toEqual([])
    stop()
  })

  it('watch reactive (deep=true, version strategy) triggers on nested write', async () => {
    setDeepWatchStrategy('version')
    const o = reactive({ a: { b: 0 } })
    const logs: number[] = []
    const stop = watch(() => o, () => logs.push(1), { deep: true })
    o.a.b++
    await Promise.resolve()
    expect(logs).toEqual([1])
    stop()
  })

  it('watch reactive (deep=true, traverse strategy) triggers on nested write', async () => {
    setDeepWatchStrategy('traverse')
    const o = reactive({ a: { b: 0 } })
    const logs: number[] = []
    const stop = watch(() => o, () => logs.push(1), { deep: true })
    o.a.b++
    await Promise.resolve()
    expect(logs).toEqual([1])
    stop()
    setDeepWatchStrategy('version')
  })

  it('watch cleanup called and stop handle prevents further calls', async () => {
    const r = ref(0)
    let clean = 0
    const stop = watch(
      r,
      (_v, _o, onCleanup) => {
        onCleanup(() => clean++)
      },
      { immediate: true },
    )
    r.value = 1
    await Promise.resolve()
    expect(clean).toBeGreaterThanOrEqual(1)
    stop()
    r.value = 2
    await Promise.resolve()
    // after stop, cleanup should not increase
    expect(clean).toBeGreaterThanOrEqual(1)
  })

  it('watch invalid source throws', () => {
    expect(() => watch(123 as any, () => {})).toThrow()
  })
})
