import type { EffectScope } from '@/reactivity'
import { describe, expect, it } from 'vitest'
import { batch, computed, effect, effectScope, onScopeDispose, reactive, watchEffect, watchSyncEffect } from '@/reactivity'

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

  it('batch defers scheduled effects until the final state', () => {
    const state = reactive({ a: 0, b: 0 })
    const snapshots: string[] = []

    watchSyncEffect(() => {
      snapshots.push(`${state.a}:${state.b}`)
    })

    batch(() => {
      state.a = 1
      state.b = 2
    })

    expect(snapshots).toEqual(['0:0', '1:2'])
  })

  it('invalidates computed values before flushing their consumers', () => {
    const state = reactive({ a: 0, b: 0 })
    const total = computed(() => state.a + state.b)
    const rawFirst: string[] = []
    const computedFirst: string[] = []

    effect(() => {
      rawFirst.push(`${state.a}:${total.value}`)
    })
    effect(() => {
      computedFirst.push(`${total.value}:${state.a}`)
    })

    batch(() => {
      state.a = 1
      state.b = 2
    })

    expect(rawFirst).toEqual(['0:0', '1:3'])
    expect(computedFirst).toEqual(['0:0', '3:1'])
  })

  it('re-prioritizes computed effects between ordinary batch consumers', () => {
    const state = reactive({ source: 0, derived: 0 })
    const total = computed(() => state.derived)
    const snapshots: string[] = []

    effect(() => {
      if (state.source > 0) {
        state.derived = state.source
      }
    })
    effect(() => {
      snapshots.push(`${state.source}:${total.value}`)
    })

    batch(() => {
      state.source = 1
    })

    expect(snapshots).toEqual(['0:0', '1:1'])
  })

  it('keeps sibling effects in the outer flush across nested batches', () => {
    const state = reactive({ source: 0 })
    const snapshots: number[] = []
    let staged = 0

    effect(() => {
      if (state.source > 0) {
        batch(() => {})
        staged = state.source
      }
    })
    effect(() => {
      void state.source
      snapshots.push(staged)
    })

    batch(() => {
      state.source = 1
    })

    expect(snapshots).toEqual([0, 1])
  })

  it('drains reentrant effects before rethrowing a batch failure', () => {
    const state = reactive({ source: 0, downstream: 0 })
    const downstreamValues: number[] = []
    const failure = new Error('batch effect failed')

    effect(() => {
      if (state.source > 0) {
        state.downstream = state.source
        throw failure
      }
    })
    effect(() => {
      downstreamValues.push(state.downstream)
    })

    expect(() => batch(() => {
      state.source = 1
    })).toThrow(failure)
    expect(downstreamValues).toEqual([0, 1])

    expect(() => batch(() => {})).not.toThrow()
    expect(downstreamValues).toEqual([0, 1])
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
