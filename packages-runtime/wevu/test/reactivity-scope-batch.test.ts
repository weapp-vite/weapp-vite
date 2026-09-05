import type { ComputedRef, EffectScope } from '@/reactivity'
import type { ReactiveEffect } from '@/reactivity/core'
import { describe, expect, it, vi } from 'vitest'
import { batch, computed, effect, effectScope, onScopeDispose, reactive, ref, watch, watchEffect } from '@/reactivity'

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
