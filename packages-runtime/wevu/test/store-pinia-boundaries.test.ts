import { describe, expect, it } from 'vitest'
import { implementations } from './helpers/storeImplementations'

for (const implementation of implementations) {
  describe(`store boundary contract: ${implementation.name}`, () => {
    const api: any = implementation.api
    const r: any = implementation.reactive
    function manager() {
      const owner = api.createPinia()
      implementation.app().use(owner)
      return owner
    }

    it.each(['object', 'function', 'reset'])('keeps nested %s patch notifications stable across ticks', async (kind) => {
      const owner = manager()
      try {
        const store = api.defineStore('nested', { state: () => ({ n: 0 }) })(owner)
        const sync: string[] = []
        const async: string[] = []
        store.$subscribe((m: any, s: any) => sync.push(`${m.type}:${s.n}`), { flush: 'sync' })
        store.$subscribe((m: any, s: any) => async.push(`${m.type}:${s.n}`))
        store.$patch((state: any) => {
          state.n = 1
          if (kind === 'object') {
            store.$patch({ n: 2 })
          }
          else if (kind === 'function') {
            store.$patch((s: any) => s.n = 2)
          }
          else {
            store.$reset()
          }
          state.n = 3
        })
        const nested = `${kind === 'object' ? 'patch object' : 'patch function'}:${kind === 'reset' ? 0 : 2}`
        expect(sync).toEqual([nested, 'direct:3', 'patch function:3'])
        expect(async).toEqual([nested, 'patch function:3'])
        await implementation.tick()
        expect(async).toEqual([nested, 'patch function:3'])
        store.n = 4
        await implementation.tick()
        expect(async).toEqual([nested, 'patch function:3', 'direct:4'])
      }
      finally {
        api.disposePinia(owner)
      }
    })

    it('preserves synchronous watchers inside a function patch', () => {
      const owner = manager()
      try {
        const store = api.defineStore('watch', { state: () => ({ n: 0 }) })(owner)
        const values: number[] = []
        const stop = r.watch(() => store.n, (n: number) => values.push(n), { flush: 'sync' })
        store.$patch((state: any) => {
          state.n = 1
          expect(values).toEqual([1])
          state.n = 2
        })
        expect(values).toEqual([1, 2])
        stop()
      }
      finally {
        api.disposePinia(owner)
      }
    })

    it('preserves shallow ref identity, replacement and hydration', () => {
      const owner = manager()
      try {
        let source: any
        const useStore = api.defineStore('shallow-ref', () => ({ data: source = r.shallowRef({ n: 0 }) }))
        const store = useStore(owner)
        const refs = api.storeToRefs(store)
        const events: string[] = []
        store.$subscribe((m: any) => events.push(m.type), { flush: 'sync' })
        expect(store.data).toBe(source.value)
        expect(refs.data.value).toBe(source.value)
        expect(r.isReactive(store.data)).toBe(false)
        store.data.n++
        expect(events).toEqual([])
        const replacement = { n: 5 }
        refs.data.value = replacement
        expect(store.data).toBe(replacement)
        expect(events).toEqual(['direct'])
        store.$dispose()
        const recreated = useStore(owner)
        expect(recreated.data).toBe(replacement)
        expect(recreated.data).toBe(source.value)
        expect(r.isReactive(recreated.data)).toBe(false)
      }
      finally {
        api.disposePinia(owner)
      }
    })

    it('preserves shallow reactive properties without unwrapping nested refs', () => {
      const owner = manager()
      try {
        let source: any
        const useStore = api.defineStore('shallow-reactive', () => ({
          data: source = r.shallowReactive({ nested: { n: 0 }, nestedRef: r.ref(1) }),
        }))
        const store = useStore(owner)
        const refs = api.storeToRefs(store)
        const events: string[] = []
        store.$subscribe((m: any) => events.push(m.type), { flush: 'sync' })
        expect(store.data).toBe(source)
        expect(store.data.nestedRef).toBe(source.nestedRef)
        expect(r.isReactive(store.data.nested)).toBe(false)
        refs.data.value.nested.n++
        expect(events).toEqual([])
        const replacement = { n: 5 }
        store.data.nested = replacement
        expect(store.data.nested).toBe(replacement)
        expect(events).toEqual(['direct'])
        store.$dispose()
        const recreated = useStore(owner)
        expect(recreated.data).toBe(source)
        expect(recreated.data.nested.n).toBe(5)
        expect(r.isReactive(recreated.data.nested)).toBe(false)
      }
      finally {
        api.disposePinia(owner)
      }
    })

    it.each([false, true])('matches plugin subscriptions during initialization (patch: %s)', async (patch) => {
      const owner = api.createPinia()
      const sync: string[] = []
      const async: string[] = []
      owner.use(({ store }: any) => {
        store.$subscribe((m: any, s: any) => sync.push(`${m.type}:${s.n}`), { flush: 'sync' })
        store.$subscribe((m: any, s: any) => async.push(`${m.type}:${s.n}`))
        store.n = 1
        if (patch) {
          store.$patch({ n: 2 })
        }
      })
      implementation.app().use(owner)
      try {
        const store = api.defineStore('plugin', { state: () => ({ n: 0 }) })(owner)
        expect(sync).toEqual(patch ? ['patch object:2'] : [])
        expect(async).toEqual(patch ? ['patch object:2'] : [])
        await implementation.tick()
        expect(async).toEqual(patch ? ['patch object:2', 'direct:2'] : ['direct:1'])
        store.n = 3
        expect(sync).toEqual(patch ? ['patch object:2', 'direct:3'] : ['direct:3'])
        await implementation.tick()
        expect(async.at(-1)).toBe('direct:3')
      }
      finally {
        api.disposePinia(owner)
      }
    })
  })
}
