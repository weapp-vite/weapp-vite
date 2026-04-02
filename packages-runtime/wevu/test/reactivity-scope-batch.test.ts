import { describe, expect, it } from 'vitest'
import { batch, effect, effectScope, reactive, watchEffect } from '@/reactivity'

describe('reactivity (batch + effectScope)', () => {
  it('batch dedupes sync effects', () => {
    const state = reactive({ a: 0, b: 0 })
    let runs = 0

    effect(() => {
      void state.a
      void state.b
      runs++
    })

    expect(runs).toBe(1)

    batch(() => {
      state.a++
      state.b++
    })

    // 整个批量更新只需要重新执行一次
    expect(runs).toBe(2)
  })

  it('effectScope stops inner effects/watchers', async () => {
    const state = reactive({ n: 0 })
    const scope = effectScope()
    let runs = 0

    scope.run(() => {
      watchEffect(() => {
        void state.n
        runs++
      })
    })

    expect(runs).toBe(1)

    state.n++
    await Promise.resolve()
    expect(runs).toBe(2)

    scope.stop()

    state.n++
    await Promise.resolve()
    expect(runs).toBe(2)
  })
})
