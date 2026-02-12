import { describe, expect, it, vi } from 'vitest'
import { reactive, ref } from '@/reactivity'
import { createStore, defineStore, storeToRefs } from '@/store'
import { wrapAction } from '@/store/actions'
import { createBaseApi } from '@/store/base'

describe('store base and actions', () => {
  it('supports base api patches and reset', () => {
    const notify = vi.fn()
    const state = reactive({ count: 0 }) as any
    const { api } = createBaseApi('id', state, notify, () => {
      state.count = 1
    })

    api.$state = { count: 2 }
    expect(state.count).toBe(2)

    api.$patch({ count: 3 })
    expect(state.count).toBe(3)

    api.$patch((s: any) => {
      s.count = 4
    })
    expect(state.count).toBe(4)

    api.$reset()
    expect(state.count).toBe(1)

    const { api: looseApi } = createBaseApi('id2', undefined, notify)
    looseApi.$patch({ a: 1 })
    looseApi.$patch((s: any) => {
      s.a = 2
    })
  })

  it('wraps actions with subscribers and errors', async () => {
    const store = { count: 0 }
    const subs = new Set<any>()

    const action = wrapAction(store, 'boom', () => {
      throw new Error('boom')
    }, subs)

    const errSpy = vi.fn()
    subs.add(({ onError }: any) => {
      onError(errSpy)
    })

    expect(() => action()).toThrow('boom')
    expect(errSpy).toHaveBeenCalledTimes(1)

    const asyncAction = wrapAction(store, 'async', () => Promise.resolve('ok'), subs)
    await expect(asyncAction()).resolves.toBe('ok')
  })
})

describe('defineStore and storeToRefs', () => {
  it('reuses setup store instance and handles subscriber errors', () => {
    createStore()
    const useCounter = defineStore('counter', () => ({
      count: 0,
      inc() {
        this.count += 1
      },
    }))

    const store = useCounter()
    const again = useCounter()
    expect(again).toBe(store)

    const unsubscribe = store.$subscribe(() => {
      throw new Error('ignore')
    })
    store.$patch({ count: 2 })
    unsubscribe()
  })

  it('prevents re-entrant subscribe loops when callback mutates state', () => {
    createStore()
    const useCounter = defineStore('counter-reentrant', () => ({
      count: ref(0),
      inc() {
        this.count.value += 1
      },
    }))

    const store = useCounter()
    const mutationTypes: string[] = []

    store.$subscribe((mutation) => {
      mutationTypes.push(mutation.type)
      if (mutation.type === 'direct' && mutationTypes.length < 2) {
        store.inc()
      }
    })

    store.inc()

    expect(store.count.value).toBe(2)
    expect(mutationTypes).toEqual(['direct'])
  })

  it('prevents re-entrant notify loops in options store subscriptions', () => {
    createStore()
    const useCounter = defineStore('counter-options-reentrant', {
      state: () => ({
        count: 0,
      }),
    })

    const store = useCounter()
    const mutationTypes: string[] = []

    store.$subscribe((mutation) => {
      mutationTypes.push(mutation.type)
      if (mutation.type === 'direct' && mutationTypes.length < 2) {
        store.count += 1
      }
    })

    store.count += 1

    expect(store.count).toBe(2)
    expect(mutationTypes).toEqual(['direct'])
  })

  it('supports options stores and storeToRefs', () => {
    createStore().use(() => {})

    const useOptions = defineStore('options', {
      state: () => ({ count: 1 }),
      getters: {
        double(state) {
          return state.count * 2
        },
      },
      actions: {
        inc() {
          this.count += 1
        },
      },
    })

    const store = useOptions()
    store.inc()
    expect(store.double).toBe(4)

    const refs = storeToRefs(store as any)
    refs.count.value = 10
    expect(store.count).toBe(10)

    const withRef = { value: ref(1), action() {} }
    const refResult = storeToRefs(withRef as any)
    expect(refResult.value).toBe(withRef.value)
    expect(refResult.action).toBe(withRef.action)
  })
})
