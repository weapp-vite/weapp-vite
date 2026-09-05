import type { ComputedRef, EffectScope } from '@/reactivity'
import type { ReactiveEffect } from '@/reactivity/core'
import { describe, expect, it, vi } from 'vitest'
import { batch, computed, effect, effectScope, onScopeDispose, reactive, ref, stop, watch, watchEffect, watchSyncEffect } from '@/reactivity'
import { queueBatchCallback } from '@/reactivity/core'

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

  it('reads fresh computed chains inside a batch without flushing consumers', () => {
    const source = ref(1)
    const doubled = computed(() => source.value * 2)
    const label = computed(() => `value:${doubled.value}`)
    const snapshots: string[] = []
    watchSyncEffect(() => {
      snapshots.push(label.value)
    })

    batch(() => {
      source.value = 2
      expect(label.value).toBe('value:4')
      source.value = 3
      expect(label.value).toBe('value:6')
      expect(snapshots).toEqual(['value:2'])
    })

    expect(snapshots).toEqual(['value:2', 'value:6'])
  })

  it('reads a fresh cached computed after writing from a flushing consumer', () => {
    const state = reactive({ source: 0, n: 1, saved: 0 })
    const doubled = computed(() => state.n * 2)
    expect(doubled.value).toBe(2)
    effect(() => {
      if (state.source > 0) {
        state.n = state.source
        state.saved = doubled.value
      }
    })

    batch(() => {
      state.source = 2
    })

    expect(state.saved).toBe(4)
  })

  it('preserves reentrant watch callbacks after their dependency runner finishes', () => {
    const source = ref(0)
    const values: number[] = []
    watch(source, (value) => {
      values.push(value)
      if (value === 1) {
        source.value = 2
      }
    }, { flush: 'sync' })

    batch(() => {
      source.value = 1
    })

    expect(values).toEqual([1, 2])
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

  it('drains completion callbacks after effect errors and preserves the first failure', () => {
    const state = reactive({ n: 0 })
    const events: string[] = []
    const effectError = new Error('effect failed')
    const callbackError = new Error('completion failed')
    effect(() => {
      if (state.n === 1) {
        events.push('effect')
        throw effectError
      }
    })

    expect(() => batch(() => {
      state.n = 1
      queueBatchCallback(() => {
        events.push('first completion')
        throw callbackError
      })
      queueBatchCallback(() => {
        events.push('second completion')
      })
    })).toThrow(effectError)
    expect(events).toEqual(['effect', 'first completion', 'second completion'])

    expect(() => batch(() => {
      queueBatchCallback(() => {
        throw callbackError
      })
    })).toThrow(callbackError)
    batch(() => {
      queueBatchCallback(() => events.push('next completion'))
    })
    expect(events).toEqual(['effect', 'first completion', 'second completion', 'next completion'])
  })

  it('cancels a stopped scheduler but preserves explicit runner invocation', () => {
    const state = reactive({ n: 0 })
    const events: string[] = []
    const runner = effect(() => state.n, {
      scheduler: () => events.push('scheduled'),
      onStop: () => events.push('stopped'),
    })

    batch(() => {
      state.n = 1
      stop(runner)
    })

    expect(events).toEqual(['stopped'])
    expect(runner()).toBe(1)
    state.n = 2
    expect(events).toEqual(['stopped'])
  })

  it('cancels scoped queued work stopped by an earlier flush consumer', () => {
    const state = reactive({ n: 0 })
    const scope = effectScope()
    const events: string[] = []
    effect(() => {
      if (state.n > 0) {
        scope.stop()
      }
    })
    scope.run(() => {
      effect(() => state.n, {
        scheduler: () => events.push('scheduled'),
        onStop: () => events.push('stopped'),
      })
      effect(() => events.push(`effect:${state.n}`))
    })
    effect(() => state.n, {
      scheduler: () => events.push('sibling'),
    })
    events.length = 0

    batch(() => {
      state.n = 1
    })

    expect(events).toEqual(['stopped', 'sibling'])
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

    expect(() => parent.stop()).not.toThrow()
    expect(calls).toHaveLength(6)
  })

  it('deactivates child scopes created while a parent teardown is running', () => {
    const parent = effectScope()
    let cleanupScope!: EffectScope
    let nestedCleanupScope!: EffectScope
    const escapedRun = vi.fn()

    parent.run(() => {
      onScopeDispose(() => {
        cleanupScope = effectScope()
        cleanupScope.run(escapedRun)
      })

      const child = effectScope()
      child.run(() => {
        onScopeDispose(() => {
          nestedCleanupScope = effectScope()
          nestedCleanupScope.run(escapedRun)
        })
      })
    })

    parent.stop()

    expect(cleanupScope.active).toBe(false)
    expect(nestedCleanupScope.active).toBe(false)
    expect(escapedRun).not.toHaveBeenCalled()
  })

  it('deactivates effects created while a scope teardown is running', () => {
    const state = reactive({ count: 0 })
    const scope = effectScope()
    let escapedEffect!: ReactiveEffect
    let runs = 0

    scope.run(() => {
      onScopeDispose(() => {
        escapedEffect = effect(() => {
          void state.count
          runs++
        })
      })
    })

    scope.stop()

    expect(escapedEffect.active).toBe(false)
    expect(runs).toBe(1)

    state.count++
    expect(runs).toBe(1)
  })

  it('preserves the owner of live synchronous subscribers during another scope teardown', () => {
    const changed = ref(0)
    const input = ref(1)
    const live = effectScope()
    const dying = effectScope()
    let derived!: ComputedRef<number>
    let child!: EffectScope
    const disposed = vi.fn()

    live.run(() => watch(changed, () => {
      derived = computed(() => input.value * 2)
      child = effectScope()
      child.run(() => onScopeDispose(disposed))
    }, { flush: 'sync' }))
    dying.run(() => onScopeDispose(() => changed.value++))

    dying.stop()
    expect(derived.value).toBe(2)
    input.value = 2
    expect(derived.value).toBe(4)
    expect(child.active).toBe(true)
    expect(disposed).not.toHaveBeenCalled()
    live.stop()
    expect(child.active).toBe(false)
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  it('restores the owner scope while a raw effect reruns', () => {
    const changed = ref(0)
    const live = effectScope()
    const dying = effectScope()
    let child!: EffectScope
    const disposed = vi.fn()

    live.run(() => effect(() => {
      if (changed.value === 0) {
        return
      }
      child = effectScope()
      child.run(() => onScopeDispose(disposed))
    }))
    dying.run(() => onScopeDispose(() => changed.value++))

    dying.stop()
    expect(child.active).toBe(true)
    expect(disposed).not.toHaveBeenCalled()
    live.stop()
    expect(child.active).toBe(false)
    expect(disposed).toHaveBeenCalledTimes(1)
  })

  it('does not attach an unowned subscriber to the stopping scope', () => {
    const changed = ref(0)
    const input = ref(1)
    let derived!: ComputedRef<number>
    const stopWatch = watch(changed, () => {
      derived = computed(() => input.value * 2)
    }, { flush: 'sync' })
    const dying = effectScope()
    dying.run(() => onScopeDispose(() => changed.value++))

    dying.stop()
    expect(derived.value).toBe(2)
    input.value = 2
    expect(derived.value).toBe(4)
    stopWatch()
  })
})
