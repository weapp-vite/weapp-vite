import { describe, expect, it } from 'vitest'
import { implementations } from './helpers/storeImplementations'

for (const implementation of implementations) {
  describe(`store edge contract: ${implementation.name}`, () => {
    const api: any = implementation.api
    const r: any = implementation.reactive
    function setup(definition: any) {
      const owner = api.createPinia()
      implementation.app().use(owner)
      return { owner, store: api.defineStore('edges', definition)(owner) }
    }

    it('deduplicates subscriptions and keeps duplicate unsubscribe inert', async () => {
      const { owner, store } = setup({ state: () => ({ n: 0 }), actions: { inc(this: any) {
        this.n++
      } } })
      const calls: string[] = []
      const callback = () => calls.push('state')
      const action = () => calls.push('action')
      const stop = store.$subscribe(callback)
      const duplicate = store.$subscribe(callback)
      const stopAction = store.$onAction(action)
      const duplicateAction = store.$onAction(action)
      duplicate()
      duplicateAction()
      store.inc()
      await implementation.tick()
      expect(calls).toEqual(['state'])
      stop()
      stop()
      stopAction()
      stopAction()
      store.inc()
      await implementation.tick()
      expect(calls).toEqual(['state'])
      api.disposePinia(owner)
    })

    it('tracks nested refs and replacement without duplicate sync events', () => {
      const { owner, store } = setup(() => ({
        nested: r.reactive({ n: r.ref(0), object: { count: 0 } }),
        list: r.ref([{ n: 0 }]),
      }))
      let calls = 0
      store.$subscribe(() => calls++, { flush: 'sync' })
      store.nested.n++
      expect(calls).toBe(1)
      store.nested.object.count++
      expect(calls).toBe(2)
      store.list[0].n++
      expect(calls).toBe(3)
      store.nested.object = { count: 5 }
      expect(calls).toBe(4)
      store.nested.object.count++
      expect(calls).toBe(5)
      api.disposePinia(owner)
    })

    it('respects shallow and bounded deep subscriptions', () => {
      const { owner, store } = setup({ state: () => ({ n: 0, nested: { n: 0 } }) })
      const calls: string[] = []
      store.$subscribe(() => calls.push('shallow'), { deep: false, flush: 'sync' })
      store.$subscribe(() => calls.push('one'), { deep: 1, flush: 'sync' })
      store.$subscribe(() => calls.push('two'), { deep: 2, flush: 'sync' })
      store.nested.n++
      expect(calls).toEqual(['two'])
      calls.length = 0
      store.n++
      expect(calls).toEqual(['one', 'two'])
      api.disposePinia(owner)
    })

    it('tracks key additions, deletions, array growth and refs inside arrays', () => {
      const { owner, store } = setup(() => ({ data: r.reactive({ n: 0 }), list: r.ref([r.ref(0)]) }))
      let calls = 0
      store.$subscribe(() => calls++, { flush: 'sync' })
      store.data.extra = 1
      expect(calls).toBe(1)
      delete store.data.n
      expect(calls).toBe(2)
      store.list[0].value++
      expect(calls).toBe(3)
      store.list.push(r.ref(1))
      expect(calls).toBe(4)
      api.disposePinia(owner)
    })

    it('resolves other stores in getters against the owning Pinia', () => {
      const first = api.createPinia()
      const second = api.createPinia()
      const useSource = api.defineStore('source', { state: () => ({ n: 0 }) })
      const useDerived = api.defineStore('derived', { getters: { result: () => useSource().n } })
      useSource(first).n = 1
      const derived = useDerived(first)
      useSource(second).n = 2
      expect(derived.result).toBe(1)
      api.disposePinia(first)
      api.disposePinia(second)
    })

    it('delivers immediate and once direct watchers but still delivers patches', async () => {
      const { owner, store } = setup({ state: () => ({ n: 0 }) })
      const calls: string[] = []
      store.$subscribe((m: any) => calls.push(m.type), { immediate: true, once: true })
      store.n++
      await implementation.tick()
      store.$patch({ n: 3 })
      expect(calls).toEqual(['direct', 'patch object'])
      api.disposePinia(owner)
    })

    it('propagates subscription errors and stops notification at the throw', () => {
      const { owner, store } = setup({ state: () => ({ n: 0 }), actions: { inc(this: any) {
        this.n++
      } } })
      const error = new Error('subscriber')
      const calls: string[] = []
      store.$subscribe(() => {
        calls.push('first')
        throw error
      })
      store.$subscribe(() => calls.push('last'))
      expect(() => store.$patch({ n: 1 })).toThrow(error)
      expect(calls).toEqual(['first'])
      store.$onAction(() => {
        throw error
      })
      expect(() => store.inc()).toThrow(error)
      expect(store.n).toBe(1)
      api.disposePinia(owner)
    })
  })
}
