import type { EffectScope } from '@/reactivity'
import { describe, expect, it } from 'vitest'
import { batch, effect, effectScope, onScopeDispose, reactive, watchEffect } from '@/reactivity'

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

  it('stops every effect, cleanup, and nested scope before rethrowing the first failure', () => {
    const parent = effectScope()
    const calls: string[] = []
    const firstFailure = new Error('effect stop failed')
    const cleanupFailure = new Error('scope cleanup failed')
    const childFailure = new Error('child scope cleanup failed')
    let firstChild!: EffectScope
    let secondChild!: EffectScope

    parent.run(() => {
      effect(() => 0, {
        onStop() {
          calls.push('effect:first')
          throw firstFailure
        },
      })
      effect(() => 0, {
        onStop() {
          calls.push('effect:second')
        },
      })
      onScopeDispose(() => {
        calls.push('parent:first')
        throw cleanupFailure
      })
      onScopeDispose(() => {
        calls.push('parent:second')
      })

      firstChild = effectScope()
      firstChild.run(() => {
        onScopeDispose(() => {
          calls.push('child:first')
          throw childFailure
        })
      })

      secondChild = effectScope()
      secondChild.run(() => {
        onScopeDispose(() => {
          calls.push('child:second')
        })
      })
    })

    expect(() => parent.stop()).toThrow(firstFailure)
    expect(calls).toEqual([
      'effect:first',
      'effect:second',
      'parent:first',
      'parent:second',
      'child:first',
      'child:second',
    ])
    expect(parent.active).toBe(false)
    expect(firstChild.active).toBe(false)
    expect(secondChild.active).toBe(false)
  })
})
