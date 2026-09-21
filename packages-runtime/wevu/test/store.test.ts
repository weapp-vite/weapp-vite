import type { InternalRuntimeState } from '@/runtime/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effect, effectScope, ref, watch } from '@/reactivity'
import { createApp } from '@/runtime/app'
import { mountRuntimeInstance, teardownRuntimeInstance } from '@/runtime/register/runtimeInstance'
import { nextTick } from '@/scheduler'
import { createPinia, defineStore, disposePinia, setActivePinia, storeToRefs } from '@/store'

let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  pinia = setActivePinia(createPinia())
})
afterEach(() => {
  disposePinia(pinia)
  setActivePinia(undefined)
})

describe('store runtime integration', () => {
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
    expect(store!.double).toBe(2)

    pageScope.stop()
    store!.inc()

    expect(store!.count).toBe(2)
    expect(store!.double).toBe(4)
  })

  it('$patch and $reset notify effects for each write but group subscriptions', () => {
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

    expect(effectRuns).toBe(3)
    expect(fullName).toBe('Grace Hopper')
    expect(mutations).toEqual(['patch object'])

    store.$patch((state) => {
      state.firstName = 'Katherine'
      state.lastName = 'Johnson'
    })

    expect(effectRuns).toBe(5)
    expect(fullName).toBe('Katherine Johnson')

    expect(mutations).toEqual(['patch object', 'patch function'])

    mutations.length = 0
    effectRuns = 0
    store.$reset()

    expect(effectRuns).toBe(2)
    expect(fullName).toBe('Ada Lovelace')
    expect(mutations).toEqual(['patch function'])
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
    watch(() => store.saved, saved => snapshots.push(`${saved}:${store.doubled}`), { flush: 'sync', immediate: true })

    store.$patch((state) => {
      state.n = 2
      state.saved = store.doubled
      expect(state.saved).toBe(4)
      state.n = 3
      store.saveDoubled()
      expect(state.saved).toBe(6)
      expect(snapshots).toEqual(['0:2', '4:4', '6:6'])
    })

    expect(snapshots).toEqual(['0:2', '4:4', '6:6'])
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
    expect(setData.mock.calls[0]?.[0]).toEqual({
      firstName: 'Grace',
      lastName: 'Hopper',
    })
    teardownRuntimeInstance(target)
  })
})
