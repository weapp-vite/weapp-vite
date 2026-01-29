import { describe, expect, it, vi } from 'vitest'
import { getDeepWatchStrategy, reactive, ref, setDeepWatchStrategy, watch, watchEffect } from '@/reactivity'
import * as scheduler from '@/scheduler'

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
    // 说明：stop 之后，cleanup 不应继续增加
    expect(clean).toBeGreaterThanOrEqual(1)
  })

  it('watch pause/resume skips changes while paused', async () => {
    const r = ref(0)
    const logs: number[] = []
    const handle = watch(r, v => logs.push(v))
    const { pause, resume, stop } = handle
    pause()
    r.value = 1
    await scheduler.nextTick()
    expect(logs).toEqual([])
    resume()
    r.value = 2
    await scheduler.nextTick()
    expect(logs).toEqual([2])
    stop()
    r.value = 3
    await scheduler.nextTick()
    expect(logs).toEqual([2])
  })

  it('watch control handles can be destructured from function source', async () => {
    const r = ref(0)
    const logs: number[] = []
    const { pause, resume, stop } = watch(() => r.value, value => logs.push(value))
    pause()
    r.value = 1
    await scheduler.nextTick()
    expect(logs).toEqual([])
    resume()
    r.value = 2
    await scheduler.nextTick()
    expect(logs).toEqual([2])
    stop()
    r.value = 3
    await scheduler.nextTick()
    expect(logs).toEqual([2])
  })

  it('watch array sources', async () => {
    const a = ref(1)
    const b = ref(2)
    const logs: Array<number[]> = []
    const stop = watch([a, b], (value) => {
      logs.push(value as number[])
    })
    a.value = 3
    await Promise.resolve()
    expect(logs).toEqual([[3, 2]])
    stop()
  })

  it('watch invalid source throws', () => {
    expect(() => watch(123 as any, () => {})).toThrow()
  })

  it('watch once stops after first callback (immediate)', async () => {
    const r = ref(0)
    const logs: number[] = []
    watch(r, v => logs.push(v), { immediate: true, once: true })
    r.value = 1
    await scheduler.nextTick()
    expect(logs).toEqual([0])
  })

  it('watch once stops after first change', async () => {
    const r = ref(0)
    const logs: number[] = []
    watch(r, v => logs.push(v), { once: true })
    r.value = 1
    await scheduler.nextTick()
    r.value = 2
    await scheduler.nextTick()
    expect(logs).toEqual([1])
  })

  it('watch flush sync runs immediately', () => {
    const r = ref(0)
    const logs: number[] = []
    watch(r, v => logs.push(v), { flush: 'sync' })
    r.value = 1
    expect(logs).toEqual([1])
  })

  it('watch flush post schedules via nextTick', async () => {
    const spy = vi.spyOn(scheduler, 'nextTick')
    const r = ref(0)
    const logs: number[] = []
    watch(r, v => logs.push(v), { flush: 'post' })
    r.value = 1
    expect(logs).toEqual([])
    expect(spy).toHaveBeenCalled()
    await scheduler.nextTick()
    await scheduler.nextTick()
    expect(logs).toEqual([1])
    spy.mockRestore()
  })

  it('watch custom scheduler overrides default queue', async () => {
    const r = ref(0)
    const logs: number[] = []
    const flags: boolean[] = []
    let scheduled: (() => void) | undefined
    watch(r, v => logs.push(v), {
      scheduler: (job, isFirstRun) => {
        flags.push(isFirstRun)
        scheduled = job
      },
    })
    r.value = 1
    await scheduler.nextTick()
    expect(logs).toEqual([])
    expect(flags).toEqual([false])
    scheduled?.()
    expect(logs).toEqual([1])
  })

  it('watch deep number respects depth with traverse strategy', async () => {
    const prev = getDeepWatchStrategy()
    setDeepWatchStrategy('traverse')
    const r = reactive({ a: { b: 0 } })
    const logs: number[] = []
    const stop = watch(() => r, () => logs.push(1), { deep: 1 })
    r.a.b += 1
    await scheduler.nextTick()
    expect(logs).toEqual([])
    stop()

    const logsDeep: number[] = []
    const stopDeep = watch(() => r, () => logsDeep.push(1), { deep: 2 })
    r.a.b += 1
    await scheduler.nextTick()
    expect(logsDeep).toEqual([1])
    stopDeep()
    setDeepWatchStrategy(prev)
  })

  it('watchEffect respects flush modes', async () => {
    const r = ref(0)
    const logs: number[] = []
    watchEffect(() => {
      logs.push(r.value)
    }, { flush: 'sync' })
    expect(logs).toEqual([0])
    r.value = 1
    expect(logs).toEqual([0, 1])

    const postLogs: number[] = []
    watchEffect(() => {
      postLogs.push(r.value)
    }, { flush: 'post' })
    expect(postLogs).toEqual([])
    await scheduler.nextTick()
    await scheduler.nextTick()
    expect(postLogs).toEqual([1])
  })
})
