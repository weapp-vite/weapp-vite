import { describe, expect, it } from 'vitest'
import { implementations } from './helpers/storeImplementations'

for (const implementation of implementations) {
  describe(`store contract: ${implementation.name}`, () => {
    const api: any = implementation.api
    const r: any = implementation.reactive
    function manager() {
      const result = api.createPinia()
      implementation.app().use(result)
      return result
    }

    it('unwraps setup state, excludes actions and plain fields from storeToRefs', () => {
      const owner = manager()
      const useCounter = api.defineStore('counter', () => {
        const count = r.ref(1)
        return { count, double: r.computed(() => count.value * 2), plain: 'label', inc: () => ++count.value }
      })
      const store = useCounter(owner)
      expect(store.count).toBe(1)
      expect(store.double).toBe(2)
      store.count++
      expect(store.double).toBe(4)
      const refs = api.storeToRefs(store)
      expect(Object.keys(refs).sort()).toEqual(['count', 'double'])
      refs.count.value++
      const { inc } = store
      expect(inc()).toBe(4)
      expect(store.$state).toEqual({ count: 4 })
      owner._e.stop()
    })

    it('patches state deeply and preserves fields on $state assignment', () => {
      const owner = manager()
      const useStore = api.defineStore('nested', () => ({ profile: r.ref({ name: 'Ada', age: 1 }), items: r.ref([1]) }))
      const store = useStore(owner)
      store.$patch({ profile: { age: 2 }, items: [2, 3] })
      expect(store.$state).toEqual({ profile: { name: 'Ada', age: 2 }, items: [2, 3] })
      store.$state = { items: [4] }
      expect(store.profile).toEqual({ name: 'Ada', age: 2 })
      store.$patch((state: any) => state.profile.age++)
      expect(store.profile.age).toBe(3)
      owner._e.stop()
    })

    it('reuses state after disposal and isolates managers', () => {
      const first = manager()
      const useStore = api.defineStore('shared', () => ({ count: r.ref(1) }))
      const old = useStore(first)
      old.count = 7
      old.$dispose()
      const next = useStore(first)
      expect(next).not.toBe(old)
      expect(next.count).toBe(7)
      const second = manager()
      expect(useStore(second).count).toBe(1)
      next.$dispose()
      delete first.state.value.shared
      expect(useStore(first).count).toBe(1)
      api.disposePinia(first)
      api.disposePinia(second)
    })

    it('cleans scoped subscriptions but keeps detached subscriptions', async () => {
      const owner = manager()
      const store = api.defineStore('subscriptions', { state: () => ({ n: 0 }), actions: { inc(this: any) {
        this.n++
      } } })(owner)
      const scope = r.effectScope()
      const calls: string[] = []
      scope.run(() => {
        store.$subscribe(() => calls.push('normal'))
        store.$subscribe(() => calls.push('detached'), { detached: true })
        store.$onAction(() => calls.push('action'))
        store.$onAction(() => calls.push('detached action'), true)
      })
      store.inc()
      await implementation.tick()
      expect(calls).toEqual(['action', 'detached action', 'normal', 'detached'])
      calls.length = 0
      scope.stop()
      store.inc()
      await implementation.tick()
      expect(calls).toEqual(['detached action', 'detached'])
      api.disposePinia(owner)
    })

    it('preserves callbacks of an action already in flight after unsubscribe', async () => {
      const owner = manager()
      let finish!: (value: number) => void
      const promise = new Promise<number>(resolve => finish = resolve)
      const store = api.defineStore('async', { actions: { work: () => promise } })(owner)
      const calls: number[] = []
      const stop = store.$onAction(({ after }: any) => after((value: number) => calls.push(value)))
      const result = store.work()
      stop()
      store.$dispose()
      finish(42)
      expect(await result).toBe(42)
      expect(calls).toEqual([42])
      api.disposePinia(owner)
    })

    it('resets options from the factory and permits a custom setup reset', () => {
      const owner = manager()
      let initial = 1
      const store = api.defineStore('options', { state: () => ({ n: initial }) })(owner)
      initial = 2
      store.$reset()
      expect(store.n).toBe(2)
      const custom = api.defineStore('custom', () => {
        const n = r.ref(1)
        return { n, $reset() {
          n.value = 5
        } }
      })(owner)
      custom.$reset()
      expect(custom.n).toBe(5)
      const withoutReset = api.defineStore('without-reset', () => ({ n: r.ref(1) }))(owner)
      expect(() => withoutReset.$reset()).toThrow()
      api.disposePinia(owner)
    })

    it('matches direct, patch, reset and $state mutation timing', async () => {
      const owner = manager()
      const store = api.defineStore('timing', { state: () => ({ n: 0, nested: { a: 1, b: 2 } }) })(owner)
      const calls: string[] = []
      store.$subscribe((mutation: any, state: any) => calls.push(`sync:${mutation.type}:${state.n}`), { flush: 'sync' })
      store.$subscribe((mutation: any, state: any) => calls.push(`pre:${mutation.type}:${state.n}`))
      store.n++
      expect(calls).toEqual(['sync:direct:1'])
      await implementation.tick()
      expect(calls).toEqual(['sync:direct:1', 'pre:direct:1'])
      calls.length = 0
      store.$patch({ n: 2 })
      store.$state = { n: 3 }
      store.$reset()
      expect(calls).toEqual([
        'sync:patch object:2',
        'pre:patch object:2',
        'sync:patch function:3',
        'pre:patch function:3',
        'sync:patch function:0',
        'pre:patch function:0',
      ])
      await implementation.tick()
      expect(calls).toHaveLength(6)
      api.disposePinia(owner)
    })

    it('keeps every nested patch notification instead of merging its public identity', () => {
      const owner = manager()
      const store = api.defineStore('nested-patch', { state: () => ({ n: 0 }) })(owner)
      const calls: string[] = []
      store.$subscribe((mutation: any, state: any) => calls.push(`${mutation.type}:${state.n}`))
      store.$patch((state: any) => {
        state.n = 1
        store.$patch({ n: 2 })
        store.$reset()
        state.n = 3
      })
      expect(calls).toEqual(['patch object:2', 'patch function:0', 'patch function:3'])
      api.disposePinia(owner)
    })

    it('supports writable computed and preserves state identity', () => {
      const owner = manager()
      const store = api.defineStore('writable', () => {
        const n = r.ref(1)
        return { n, double: r.computed({ get: () => n.value * 2, set: (value: number) => n.value = value / 2 }) }
      })(owner)
      const state = store.$state
      const refs = api.storeToRefs(store)
      refs.double.value = 10
      expect(store.n).toBe(5)
      store.$state = { n: 7 }
      expect(store.$state).toBe(state)
      expect(refs.n.value).toBe(7)
      expect(Object.keys(store.$state)).toEqual(['n'])
      api.disposePinia(owner)
    })

    it('preserves rejected in-flight action callbacks after page scope disposal', async () => {
      const owner = manager()
      let reject!: (error: Error) => void
      const promise = new Promise<never>((_resolve, fail) => reject = fail)
      const store = api.defineStore('reject', { actions: { work: () => promise } })(owner)
      const scope = r.effectScope()
      const errors: unknown[] = []
      scope.run(() => store.$onAction(({ onError }: any) => onError((error: unknown) => errors.push(error))))
      const running = store.work()
      scope.stop()
      const failure = new Error('request failed')
      reject(failure)
      await expect(running).rejects.toBe(failure)
      expect(errors).toEqual([failure])
      api.disposePinia(owner)
    })

    it('applies plugins and exposes reactive plugin properties', () => {
      const owner = api.createPinia()
      owner.use(({ store, pinia: contextOwner, app, options }: any) => {
        expect(contextOwner).toBe(owner)
        expect(app).toBeTruthy()
        expect(options.actions).toHaveProperty('inc')
        return { extra: r.ref(store.n + 1), label: 'plain' }
      })
      implementation.app().use(owner)
      const store = api.defineStore('plugins', { state: () => ({ n: 1 }), actions: { inc(this: any) {
        this.n++
      } } })(owner)
      expect(store.extra).toBe(2)
      expect(Object.keys(api.storeToRefs(store)).sort()).toEqual(['extra', 'n'])
      api.disposePinia(owner)
    })
  })
}
