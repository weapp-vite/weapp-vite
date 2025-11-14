import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from '@/reactivity'
import { createStore, defineStore, storeToRefs } from '@/store'

describe('store (setup)', () => {
  it('defines setup store and reacts', () => {
    const useCounter = defineStore('counter', () => {
      const count = ref(0)
      const double = computed(() => count.value * 2)
      function inc() {
        count.value++
      }
      return { count, double, inc }
    })
    const s = useCounter()
    const { count, double } = storeToRefs(s)
    expect(count.value).toBe(0)
    expect(double.value).toBe(0)
    s.inc()
    expect(count.value).toBe(1)
    expect(double.value).toBe(2)
  })

  it('$onAction supports after/onError for sync/async', async () => {
    const useOps = defineStore('ops', () => {
      const v = ref(0)
      function add(n: number) {
        v.value += n
        return v.value
      }
      async function fail() {
        throw new Error('x')
      }
      return { v, add, fail }
    })
    const s = useOps()
    const afterCb = vi.fn()
    const onErrorCb = vi.fn()
    const stop = s.$onAction(({ name: _name, after, onError }) => {
      after(afterCb)
      onError(onErrorCb)
    })
    const r = s.add(3)
    expect(r).toBe(3)
    expect(afterCb).toHaveBeenCalledTimes(1)
    await expect(s.fail()).rejects.toThrow()
    expect(onErrorCb).toHaveBeenCalledTimes(1)
    stop()
  })
})

describe('store (options)', () => {
  it('options store state/getters/actions + $patch/$reset/$state/$subscribe', async () => {
    const useUser = defineStore('user', {
      state: () => ({ name: 'a', age: 1 }),
      getters: {
        label(state: any) {
          return `${state.name}:${state.age}`
        },
      },
      actions: {
        grow() {
          this.age++
        },
      },
    })
    const s = useUser()
    const calls: any[] = []
    const unsub = s.$subscribe((m, state) => {
      calls.push([m.type, state.age])
    })
    expect(s.$id).toBe('user')
    expect(s.label).toBe('a:1')
    s.grow()
    // direct assignment triggers reactive but $subscribe listens to $patch/$state only
    s.$patch({ age: 10 })
    s.$patch((state) => {
      state.age = 20
    })
    s.$state = { name: 'b', age: 2 }
    s.$reset()
    unsub()
    expect(calls).toEqual([
      ['patch object', 10],
      ['patch function', 20],
      ['patch object', 2],
      ['patch object', 1], // reset to initial snapshot
    ])
  })

  it('createStore().use(plugin) extends store on create', () => {
    createStore().use(({ store }) => {
      ;(store as any).$extra = 123
    })
    const useX = defineStore('x', () => ({ n: ref(0) }))
    const s = useX() as any
    expect(s.$extra).toBe(123)
  })

  it('plugin errors are swallowed (do not break store creation)', () => {
    createStore().use(() => {
      throw new Error('plugin error')
    })
    const useX = defineStore('y', () => ({ n: ref(0) }))
    const s = useX()
    expect(s.n.value).toBe(0)
  })

  it('options store also runs plugins and storeToRefs setters write back', () => {
    createStore().use(({ store }) => {
      ;(store as any).$plugged = true
    })
    const useU = defineStore('u', {
      state: () => ({ a: 1 }),
      actions: {},
      getters: {},
    })
    const s = useU() as any
    expect(s.$plugged).toBe(true)
    const { a } = storeToRefs(s)
    a.value = 5
    expect(s.a).toBe(5)
  })
})
