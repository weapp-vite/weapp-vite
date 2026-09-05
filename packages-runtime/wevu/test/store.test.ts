import type { InternalRuntimeState } from '@/runtime/types'
import { describe, expect, it, vi } from 'vitest'
import { batch, computed, effect, effectScope, reactive, ref, watchSyncEffect } from '@/reactivity'
import { createApp } from '@/runtime/app'
import { mountRuntimeInstance, teardownRuntimeInstance } from '@/runtime/register/runtimeInstance'
import { nextTick } from '@/scheduler'
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

  it('$subscribe triggers on direct setup mutations', () => {
    const useCounter = defineStore('counter-direct', () => {
      const count = ref(0)
      function inc() {
        count.value += 1
      }
      return { count, inc }
    })
    const s = useCounter()
    const calls: any[] = []
    const unsub = s.$subscribe((m) => {
      calls.push(m.type)
    })
    s.count.value += 1
    s.inc()
    unsub()
    expect(calls).toEqual(['direct', 'direct'])
  })

  it('$reset restores setup store state', () => {
    const useCounter = defineStore('counter-reset', () => {
      const count = ref(0)
      const info = reactive({ name: 'a', tags: ['x'] })
      const double = computed(() => count.value * 2)
      const plain = 1
      return { count, double, info, plain }
    })
    const s = useCounter()
    const calls: string[] = []
    s.$subscribe((m) => {
      calls.push(m.type)
    })
    s.count.value = 2
    s.info.name = 'b'
    s.info.tags.push('y')
    s.plain = 3
    s.$reset()
    expect(s.count.value).toBe(0)
    expect(s.double.value).toBe(0)
    expect(s.info.name).toBe('a')
    expect(s.info.tags).toEqual(['x'])
    expect(s.plain).toBe(1)
    expect(calls.at(-1)).toBe('patch object')
  })

  it('$reset batches setup store effects', () => {
    const useProfile = defineStore('setup-reset-batch', () => ({
      firstName: ref('Ada'),
      lastName: ref('Lovelace'),
    }))
    const store = useProfile()
    const mutations: string[] = []
    store.$subscribe(mutation => mutations.push(mutation.type))
    let effectRuns = 0
    let fullName = ''
    effect(() => {
      effectRuns++
      fullName = `${store.firstName.value} ${store.lastName.value}`
    })

    store.firstName.value = 'Grace'
    store.lastName.value = 'Hopper'
    mutations.length = 0
    effectRuns = 0
    store.$reset()

    expect(effectRuns).toBe(1)
    expect(fullName).toBe('Ada Lovelace')
    expect(mutations).toEqual(['patch object'])
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

  it('keeps setup store computed reactive after the creating scope is stopped', () => {
    const useCounter = defineStore('counter-scope-detached', () => {
      const count = ref(1)
      const double = computed(() => count.value * 2)
      function inc() {
        count.value += 1
      }
      return { count, double, inc }
    })

    const pageScope = effectScope(true)
    const store = pageScope.run(() => useCounter())
    expect(store).toBeTruthy()

    // 先读一次 computed，确保它已经建立缓存并订阅到创建时的作用域。
    expect(store!.double.value).toBe(2)

    pageScope.stop()
    store!.inc()

    expect(store!.count.value).toBe(2)
    expect(store!.double.value).toBe(4)
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
    const unsub = s.$subscribe((m: any, state: any) => {
      calls.push([m.type, state.age])
    })
    expect(s.$id).toBe('user')
    expect(s.label).toBe('a:1')
    s.grow()
    // 直接赋值会触发 $subscribe（direct）
    s.$patch({ age: 10 })
    s.$patch((state: any) => {
      state.age = 20
    })
    s.$state = { name: 'b', age: 2 }
    s.$reset()
    unsub()
    expect(calls).toEqual([
      ['direct', 2],
      ['patch object', 10],
      ['patch function', 20],
      ['patch object', 2],
      ['patch object', 1], // reset to initial snapshot
    ])
  })

  it('$patch and $reset batch options store effects', () => {
    const useProfile = defineStore('options-patch-reset-batch', {
      state: () => ({
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    })
    const store = useProfile()
    const mutations: string[] = []
    let effectRuns = 0
    let fullName = ''
    effect(() => {
      effectRuns++
      fullName = `${store.firstName} ${store.lastName}`
    })
    store.$subscribe(mutation => mutations.push(mutation.type))

    store.$patch({
      firstName: 'Grace',
      lastName: 'Hopper',
    })

    expect(effectRuns).toBe(2)
    expect(fullName).toBe('Grace Hopper')
    expect(mutations).toEqual(['patch object'])

    store.$patch((state) => {
      state.firstName = 'Katherine'
      state.lastName = 'Johnson'
    })

    expect(effectRuns).toBe(3)
    expect(fullName).toBe('Katherine Johnson')

    expect(mutations).toEqual(['patch object', 'patch function'])

    mutations.length = 0
    effectRuns = 0
    store.$reset()

    expect(effectRuns).toBe(1)
    expect(fullName).toBe('Ada Lovelace')
    expect(mutations).toEqual(['patch object'])
  })

  it('$patch flushes effects before notifying subscribers', () => {
    const useProfile = defineStore('options-patch-notify-order', {
      state: () => ({
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    })
    const store = useProfile()
    const calls: string[] = []
    watchSyncEffect(() => {
      calls.push(`effect:${store.firstName} ${store.lastName}`)
    })
    store.$subscribe((mutation) => {
      calls.push(`subscriber:${mutation.type}`)
    })
    calls.length = 0

    store.$patch({
      firstName: 'Grace',
      lastName: 'Hopper',
    })

    expect(calls).toEqual([
      'effect:Grace Hopper',
      'subscriber:patch object',
    ])
  })

  it('$patch notifies once with final state after nested patch and reset', () => {
    const useProfile = defineStore('options-nested-patch-batch', {
      state: () => ({
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    })
    const store = useProfile()
    const calls: string[] = []
    effect(() => {
      calls.push(`effect:${store.firstName} ${store.lastName}`)
    })
    store.$subscribe((mutation, state) => {
      calls.push(`subscriber:${mutation.type}:${state.firstName} ${state.lastName}`)
    })
    calls.length = 0

    store.$patch((state) => {
      state.firstName = 'Grace'
      store.$patch({ lastName: 'Hopper' })
      store.$reset()
      state.firstName = 'Katherine'
      state.lastName = 'Johnson'
    })

    expect(store.firstName).toBe('Katherine')
    expect(store.lastName).toBe('Johnson')
    expect(calls).toEqual([
      'effect:Katherine Johnson',
      'subscriber:patch function:Katherine Johnson',
    ])
  })

  it('$patch callbacks and nested actions read fresh cached getters', () => {
    const useCounter = defineStore('options-patch-cached-getter', {
      state: () => ({ n: 1, saved: 0 }),
      getters: {
        doubled: state => state.n * 2,
      },
      actions: {
        saveDoubled() {
          this.saved = this.doubled
        },
      },
    })
    const store = useCounter()
    const snapshots: string[] = []
    watchSyncEffect(() => {
      snapshots.push(`${store.n}:${store.saved}:${store.doubled}`)
    })

    store.$patch((state) => {
      state.n = 2
      state.saved = store.doubled
      expect(state.saved).toBe(4)
      state.n = 3
      store.saveDoubled()
      expect(state.saved).toBe(6)
      expect(snapshots).toEqual(['1:0:2'])
    })

    expect(snapshots).toEqual(['1:0:2', '3:6:6'])
  })

  it.each(['patch object', 'patch function', 'reset', 'state'] as const)(
    'publishes nested %s once after cross-store consumers flush',
    (operation) => {
      const source = defineStore(`nested-source-${operation}`, {
        state: () => ({ n: 0 }),
      })()
      const target = defineStore(`nested-target-${operation}`, {
        state: () => ({ n: 0 }),
      })()
      target.n = 9
      effect(() => {
        if (source.n === 0) {
          return
        }
        switch (operation) {
          case 'patch object':
            target.$patch({ n: source.n })
            break
          case 'patch function':
            target.$patch((state) => {
              state.n = source.n
            })
            break
          case 'reset':
            target.$reset()
            break
          case 'state':
            target.$state = { n: source.n }
            break
        }
      })
      const events: string[] = []
      watchSyncEffect(() => {
        events.push(`effect:${target.n}`)
      })
      target.$subscribe((mutation, state) => {
        events.push(`subscriber:${mutation.type}:${state.n}`)
      })
      events.length = 0

      source.$patch({ n: 2 })

      const expectedValue = operation === 'reset' ? 0 : 2
      const expectedType = operation === 'patch function' ? operation : 'patch object'
      expect(events).toEqual([
        `effect:${expectedValue}`,
        `subscriber:${expectedType}:${expectedValue}`,
      ])
    },
  )

  it('retains setup reset provenance until the outer batch flushes', () => {
    const source = ref(false)
    const store = defineStore('setup-nested-reset-notification', () => ({
      n: ref(0),
    }))()
    store.n.value = 2
    effect(() => {
      if (source.value) {
        store.$reset()
      }
    })
    const events: string[] = []
    watchSyncEffect(() => {
      events.push(`effect:${store.n.value}`)
    })
    store.$subscribe((mutation) => {
      events.push(`subscriber:${mutation.type}:${store.n.value}`)
    })
    events.length = 0

    batch(() => {
      source.value = true
    })

    expect(events).toEqual(['effect:0', 'subscriber:patch object:0'])
  })

  it('holds patch notifications until an explicit outer batch finishes', () => {
    const store = defineStore('options-explicit-outer-batch', {
      state: () => ({ n: 0 }),
    })()
    const events: string[] = []
    watchSyncEffect(() => {
      events.push(`effect:${store.n}`)
    })
    store.$subscribe((mutation) => {
      events.push(`subscriber:${mutation.type}:${store.n}`)
    })
    events.length = 0

    batch(() => {
      store.$patch((state) => {
        state.n = 1
        store.$patch({ n: 2 })
      })
      expect(events).toEqual([])
    })

    expect(events).toEqual(['effect:2', 'subscriber:patch function:2'])
  })

  it('preserves subscriber-driven downstream patches without recursive publication', () => {
    const source = ref(0)
    const target = defineStore('options-subscriber-patch-target', {
      state: () => ({ n: 0 }),
    })()
    const downstream = defineStore('options-subscriber-patch-downstream', {
      state: () => ({ n: 0 }),
    })()
    effect(() => {
      if (source.value > 0) {
        target.$patch({ n: source.value })
      }
    })
    const events: string[] = []
    watchSyncEffect(() => {
      events.push(`target:${target.n}`)
    })
    watchSyncEffect(() => {
      events.push(`downstream:${downstream.n}`)
    })
    let notifications = 0
    target.$subscribe((mutation) => {
      events.push(`target subscriber:${mutation.type}`)
      notifications++
      if (notifications < 2) {
        target.$patch({ n: 2 })
        downstream.$patch({ n: 3 })
      }
    })
    downstream.$subscribe((mutation) => {
      events.push(`downstream subscriber:${mutation.type}`)
    })
    events.length = 0

    batch(() => {
      source.value = 1
    })

    expect(events).toEqual([
      'target:1',
      'target subscriber:patch object',
      'target:2',
      'downstream:3',
      'downstream subscriber:patch object',
    ])
  })

  it('defers a pending notification while a subscriber expands that transaction', () => {
    const source = ref(0)
    const first = defineStore('options-expanded-first', {
      state: () => ({ n: 0 }),
    })()
    const target = defineStore('options-expanded-target', {
      state: () => ({ n: 0 }),
    })()
    effect(() => {
      if (source.value > 0) {
        first.$patch({ n: source.value })
        target.$patch({ n: source.value })
      }
    })
    const events: string[] = []
    watchSyncEffect(() => {
      events.push(`effect:${target.n}`)
    })
    first.$subscribe(() => {
      events.push('first subscriber')
      target.$patch((state) => {
        state.n = 2
      })
    })
    target.$subscribe((mutation, state) => {
      events.push(`subscriber:${mutation.type}:${state.n}`)
    })
    events.length = 0

    batch(() => {
      source.value = 1
    })

    expect(events).toEqual([
      'effect:1',
      'first subscriber',
      'effect:2',
      'subscriber:patch function:2',
    ])
  })

  it('drains successful nested notifications and releases failed transactions before rethrowing', () => {
    const source = ref(0)
    const successful = defineStore('options-nested-success-before-error', {
      state: () => ({ n: 0 }),
    })()
    const failed = defineStore('options-nested-failed-transaction', {
      state: () => ({ n: 0 }),
    })()
    const firstError = new Error('outer consumer failed')
    const patchError = new Error('nested patch failed')
    effect(() => {
      if (source.value > 0) {
        successful.$patch({ n: source.value })
        throw firstError
      }
    })
    effect(() => {
      if (source.value > 0) {
        failed.$patch((state) => {
          state.n = source.value
          throw patchError
        })
      }
    })
    const snapshots: string[] = []
    watchSyncEffect(() => {
      snapshots.push(`${successful.n}:${failed.n}`)
    })
    const mutations: string[] = []
    successful.$subscribe(mutation => mutations.push(`successful:${mutation.type}`))
    failed.$subscribe(mutation => mutations.push(`failed:${mutation.type}`))

    expect(() => batch(() => {
      source.value = 1
    })).toThrow(firstError)

    expect(snapshots).toEqual(['0:0', '1:1'])
    expect(mutations).toEqual(['successful:patch object'])
    failed.n = 2
    expect(snapshots).toEqual(['0:0', '1:1', '1:2'])
    expect(mutations).toEqual(['successful:patch object', 'failed:direct'])
  })

  it('$patch releases the batch after a callback throws', () => {
    const useProfile = defineStore('options-patch-error-batch', {
      state: () => ({
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    })
    const store = useProfile()
    const mutations: string[] = []
    let effectRuns = 0
    effect(() => {
      effectRuns++
      void store.firstName
      void store.lastName
    })
    store.$subscribe(mutation => mutations.push(mutation.type))

    expect(() => store.$patch((state) => {
      state.firstName = 'Grace'
      store.$patch({ lastName: 'Byron' })
      throw new Error('patch failed')
    })).toThrow('patch failed')
    expect(effectRuns).toBe(2)
    expect(mutations).toEqual([])

    store.lastName = 'Hopper'
    expect(effectRuns).toBe(3)
    expect(mutations).toEqual(['direct'])
  })

  it('$patch produces one runtime setData dispatch', async () => {
    const useProfile = defineStore('store-set-data-batch', {
      state: () => ({
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    })
    const store = useProfile()
    const app = createApp({})
    const data: Record<string, unknown> = {
      firstName: 'Ada',
      lastName: 'Lovelace',
    }
    const setData = vi.fn((payload: Record<string, unknown>) => {
      Object.assign(data, payload)
    })
    const target = { data, setData } as unknown as InternalRuntimeState
    mountRuntimeInstance(target, app, undefined, () => storeToRefs(store))
    await nextTick()
    setData.mockClear()

    store.$patch({
      firstName: 'Grace',
      lastName: 'Hopper',
    })
    await nextTick()

    expect(setData).toHaveBeenCalledTimes(1)
    expect(setData).toHaveBeenCalledWith({
      firstName: 'Grace',
      lastName: 'Hopper',
    })
    teardownRuntimeInstance(target)
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
