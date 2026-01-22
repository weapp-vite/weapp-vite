import { describe, expect, it, vi } from 'vitest'
import {
  batch,
  computed,
  effect,
  effectScope,
  endBatch,
  getDeepWatchStrategy,
  markRaw,
  nextTick,
  reactive,
  ref,
  setDeepWatchStrategy,
  shallowReactive,
  toRef,
  toRefs,
  watch,
} from '@/index'
import { isRaw, isShallowReactive } from '@/reactivity/reactive'
import { customRef, isRef, markAsRef, toValue } from '@/reactivity/ref'
import { isShallowRef, shallowRef, triggerRef } from '@/reactivity/shallowRef'
import { capitalize, toPathSegments } from '@/utils'

describe('utils and scheduler', () => {
  it('handles empty inputs', async () => {
    expect(capitalize('')).toBe('')
    expect(capitalize('foo')).toBe('Foo')
    expect(toPathSegments('')).toEqual([])
    expect(toPathSegments(' a . b .c ')).toEqual(['a', 'b', 'c'])

    await expect(nextTick()).resolves.toBeUndefined()
    await expect(nextTick(() => 42)).resolves.toBe(42)
  })
})

describe('ref and customRef branches', () => {
  it('supports markAsRef fallback when defineProperty fails', () => {
    const backing: any = {}
    const target = new Proxy(backing, {
      defineProperty() {
        throw new Error('fail')
      },
      set(obj, prop, value) {
        ;(obj as any)[prop] = value
        return true
      },
    })
    markAsRef(target as any)
    expect(backing.__v_isRef).toBe(true)
  })

  it('returns existing ref instance', () => {
    const original = ref(1)
    const wrapped = ref(original)
    expect(wrapped).toBe(original)
    expect(isRef(original)).toBe(true)
  })

  it('customRef factory respects fallback and triggers', () => {
    let tracked = 0
    let triggered = 0
    const r = customRef<number>((track, trigger) => ({
      get() {
        track()
        tracked += 1
        return undefined as any
      },
      set(value) {
        triggered = value
        trigger()
      },
    }), 7)

    expect(r.value).toBe(7)
    r.value = 3
    expect(triggered).toBe(3)
    expect(tracked).toBeGreaterThan(0)
  })

  it('toValue unwraps refs and getters', () => {
    const n = ref(1)
    const c = computed(() => n.value + 1)
    expect(toValue(n)).toBe(1)
    expect(toValue(c)).toBe(2)
    expect(toValue(() => n.value)).toBe(1)
    expect(toValue(3)).toBe(3)
  })
})

describe('computed', () => {
  it('throws on readonly computed set', () => {
    const c = computed(() => 1)
    expect(() => {
      ;(c as any).value = 2
    }).toThrow('计算属性是只读的')
  })
})

describe('shallowRef and toRefs', () => {
  it('tracks shallowRef only on value replacement', () => {
    const state = shallowRef({ count: 0 })
    let calls = 0
    effect(() => {
      void state.value
      calls += 1
    })

    state.value.count += 1
    expect(calls).toBe(1)

    state.value = { count: 1 }
    expect(calls).toBe(2)

    expect(isShallowRef(state)).toBe(true)
    triggerRef(state)
    expect(calls).toBe(3)
  })

  it('converts reactive objects to refs and warns on plain objects', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const plain = { a: 1 }
    const plainRefs = toRefs(plain as any)
    expect(warn).toHaveBeenCalled()
    expect(plainRefs.a.value).toBe(1)

    warn.mockRestore()

    const state = reactive({ foo: 1, bar: ref(2) })
    const refs = toRefs(state)
    refs.foo.value = 3
    expect(state.foo).toBe(3)
    expect(refs.bar).toBe(state.bar)
  })

  it('handles array toRefs and default toRef values', () => {
    const list = reactive([1, 2])
    const refs = toRefs(list)
    refs[0].value = 5
    expect(list[0]).toBe(5)

    const obj = reactive({}) as any
    const missing = toRef(obj, 'missing', 9)
    expect(missing.value).toBe(9)
    missing.value = 11
    expect(obj.missing).toBe(11)
  })
})

describe('watch and effect scopes', () => {
  it('watches reactive sources and supports deep strategy', async () => {
    const state = reactive({ count: 0 })
    const events: number[] = []
    const stop = watch(state as any, (value) => {
      events.push(value.count)
    })

    state.count += 1
    await nextTick()
    expect(events).toEqual([1])
    stop()

    const prev = getDeepWatchStrategy()
    setDeepWatchStrategy('traverse')
    expect(getDeepWatchStrategy()).toBe('traverse')
    setDeepWatchStrategy(prev)
  })

  it('skips queued job after stop', async () => {
    const count = ref(0)
    let calls = 0
    const stop = watch(count, () => {
      calls += 1
    })

    count.value = 1
    stop()
    await nextTick()
    expect(calls).toBe(0)
  })

  it('handles nested effect scopes and cleanup', () => {
    const parent = effectScope()
    let childRuns = 0
    let grandchildRuns = 0

    parent.run(() => {
      const child = effectScope()
      child.run(() => {
        effect(() => {
          childRuns += 1
        })
        const grandchild = effectScope()
        grandchild.run(() => {
          effect(() => {
            grandchildRuns += 1
          })
        })
      })
      child.stop()
      child.stop()
    })

    parent.stop()
    expect(childRuns).toBeGreaterThan(0)
    expect(grandchildRuns).toBeGreaterThan(0)
  })

  it('ignores endBatch when not started', () => {
    endBatch()
    batch(() => {
      // no-op batch
    })
  })
})

describe('shallowReactive and raw helpers', () => {
  it('tracks shallowReactive deletes and raw helpers', () => {
    const state = shallowReactive({ a: 1 })
    let hits = 0
    effect(() => {
      void state.a
      hits += 1
    })

    delete (state as any).a
    expect(hits).toBe(2)
    expect(isShallowReactive(state)).toBe(true)

    expect(markRaw(1 as any)).toBe(1)
    const rawObj = markRaw({})
    expect(isRaw(rawObj)).toBe(true)
    expect(isRaw(1 as any)).toBe(false)
  })
})
