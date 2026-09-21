import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, onScopeDispose, ref, watch } from '@/reactivity'
import { nextTick } from '@/scheduler'
import { createPinia, createStore, defineStore, disposePinia, getActivePinia, setActivePinia } from '@/store'

let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  pinia = setActivePinia(createPinia())
})
afterEach(() => {
  disposePinia(pinia)
  setActivePinia(undefined)
})

describe('store ownership and failure recovery', () => {
  it('requires an installed or explicit manager and keeps the legacy name as an alias', () => {
    expect(createStore).toBe(createPinia)
    setActivePinia(undefined)
    const useCounter = defineStore('counter', () => ({ n: ref(0) }))
    expect(() => useCounter()).toThrow('Pinia')
    expect(useCounter(pinia).n).toBe(0)
    expect(getActivePinia()).toBe(pinia)
  })

  it('releases a failed initialization and retries without partial state', () => {
    const cleanup = vi.fn()
    let shouldFail = true
    const failure = new Error('setup failed')
    const useCounter = defineStore('retry', () => {
      onScopeDispose(cleanup)
      onScopeDispose(() => {
        throw new Error('cleanup failed')
      })
      if (shouldFail) {
        throw failure
      }
      return { n: ref(2) }
    })
    expect(() => useCounter()).toThrow(failure)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(pinia.state.value.retry).toBeUndefined()
    shouldFail = false
    expect(useCounter().n).toBe(2)
    expect(() => useCounter().$dispose()).toThrow('cleanup failed')
  })

  it('finishes all cleanup and never deletes a new instance on repeated disposal', () => {
    const calls: string[] = []
    const useCounter = defineStore('cleanup', () => {
      onScopeDispose(() => {
        calls.push('first')
        throw new Error('cleanup')
      })
      onScopeDispose(() => calls.push('second'))
      return { n: ref(1) }
    })
    const old = useCounter()
    old.n = 3
    expect(() => old.$dispose()).toThrow('cleanup')
    expect(calls).toEqual(['first', 'second'])
    const current = useCounter()
    expect(current).not.toBe(old)
    expect(current.n).toBe(3)
    old.$dispose()
    expect(useCounter()).toBe(current)
    expect(() => current.$dispose()).toThrow('cleanup')
  })

  it('stops store watchers and detached subscriptions while retaining shared state', async () => {
    const events: number[] = []
    const source = ref(1)
    const useCounter = defineStore('watchers', () => {
      watch(source, value => events.push(value))
      const n = ref(1)
      return { n, doubled: computed(() => n.value * 2) }
    })
    const store = useCounter()
    const notify = vi.fn()
    store.$subscribe(notify, { detached: true })
    source.value++
    store.n++
    await nextTick()
    expect(events).toEqual([2])
    expect(notify).toHaveBeenCalledTimes(1)
    store.$dispose()
    source.value++
    store.n++
    await nextTick()
    expect(events).toEqual([2])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(pinia.state.value.watchers.n).toBe(3)
  })

  it('unsubscribing one page leaves the other page reactive', async () => {
    const store = defineStore('pages', () => ({ n: ref(0) }))()
    const first = effectScope()
    const second = effectScope()
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()
    first.run(() => store.$subscribe(firstCallback))
    second.run(() => store.$subscribe(secondCallback))
    first.stop()
    store.n++
    await nextTick()
    expect(firstCallback).not.toHaveBeenCalled()
    expect(secondCallback).toHaveBeenCalledTimes(1)
    second.stop()
  })
})
