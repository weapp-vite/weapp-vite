import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from '@/reactivity'
import { createApp } from '@/runtime'
import { createPinia, createStore, defineStore, disposePinia, getActivePinia, setActivePinia, storeToRefs } from '@/store'

afterEach(() => setActivePinia(undefined))

describe.each([createPinia, createStore])('Store manager creation entry %s', (create) => {
  it('shares the factory identity and installs queued plugins for new stores only', () => {
    expect(create).toBe(createPinia)
    const pinia = create()
    const app = createApp({})
    const plugin = vi.fn(() => ({ label: ref('installed') }))
    const useEarly = defineStore('early', { state: () => ({ count: 0 }) })
    const useCounter = defineStore('counter', { state: () => ({ count: 0 }) })
    try {
      expect(getActivePinia()).toBeUndefined()
      expect(pinia.use(plugin)).toBe(pinia)
      const early = useEarly(pinia)
      expect(plugin).not.toHaveBeenCalled()
      app.use(pinia)
      expect(getActivePinia()).toBe(pinia)
      expect(useEarly(pinia)).toBe(early)
      expect(plugin).not.toHaveBeenCalled()
      const store = useCounter()
      expect(plugin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pinia, app, store }))
      expect(Reflect.get(storeToRefs(store), 'label').value).toBe('installed')
      expect(useCounter(pinia)).toBe(store)
    }
    finally {
      disposePinia(pinia)
    }
  })

  it('isolates managers and caches definitions with the same ID per manager', () => {
    const first = create()
    const second = create()
    const useCounter = defineStore('shared-id', () => ({ count: ref(0) }))
    const useSameId = defineStore('shared-id', () => ({ count: ref(9) }))
    try {
      const a = useCounter(first)
      a.count = 4
      expect(useSameId(first)).toBe(a)
      expect(useCounter(second).count).toBe(0)
      expect(first.state.value['shared-id'].count).toBe(4)
      expect(second.state.value['shared-id'].count).toBe(0)
    }
    finally {
      disposePinia(first)
      disposePinia(second)
    }
  })
})
