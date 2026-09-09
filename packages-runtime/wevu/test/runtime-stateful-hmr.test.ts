import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, defineStore, nextTick, onAttached, onUnload, reactive, ref } from '@/index'
import { applySnapshotUpdate } from '@/runtime/app/setData/snapshot'

describe('runtime: stateful HMR', () => {
  let applying = false
  let refresh: ((instance: any, stateSnapshot?: Record<string, any>) => void) | undefined
  let registeredDefinition: Record<string, any> | undefined
  let trackedDefinition: Record<string, any> | undefined

  beforeEach(() => {
    refresh = undefined
    registeredDefinition = undefined
    trackedDefinition = undefined
    applying = false
    ;(globalThis as any).Component = vi.fn((definition: Record<string, any>) => {
      registeredDefinition = definition
    })
    ;(globalThis as any)[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY] = {
      isApplying: () => applying,
      trackWevuComponent(
        definition: Record<string, any>,
        callback: (instance: any, stateSnapshot?: Record<string, any>) => void,
      ) {
        refresh = callback
        trackedDefinition = {
          ...definition,
          __tracked: true,
        }
        return trackedDefinition
      },
      Component: vi.fn((definition: Record<string, any>) => {
        ;(globalThis as any).Component(definition)
      }),
      Page: vi.fn((definition: Record<string, any>) => {
        ;(globalThis as any).Page?.(definition)
      }),
    }
  })

  afterEach(() => {
    delete (globalThis as any).Component
    delete (globalThis as any)[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  })

  it('rehydrates setup state from native data without replaying user lifecycle hooks', async () => {
    const attached = vi.fn()
    const unloaded = vi.fn()
    const defineRuntime = (delta: number) => defineComponent({
      methods: {
        __weapp_vite_inline_map: {
          i0: {
            keys: [],
            fn: (ctx: any) => ctx.increment(),
          },
        },
      } as any,
      setup() {
        const count = ref(0)
        const input = ref('')
        const increment = () => {
          count.value += delta
        }
        onAttached(attached)
        onUnload(unloaded)
        return { count, increment, input }
      },
    })
    defineRuntime(1)
    expect(registeredDefinition).toBe(trackedDefinition)
    expect(registeredDefinition?.__tracked).toBe(true)

    const instance: any = {
      data: {},
      properties: {},
      setData(payload: Record<string, any>) {
        Object.assign(this.data, payload)
      },
    }
    registeredDefinition!.lifetimes.attached.call(instance)
    const runtimeFacade = instance.__wevu
    const previousIncrement = runtimeFacade.methods.increment
    runtimeFacade.methods.increment()
    runtimeFacade.methods.increment()
    await nextTick()
    await nextTick()
    instance.setData({ input: 'held-input' })
    expect(instance.data.count).toBe(2)
    expect(instance.data.input).toBe('held-input')
    const pageWrapper = { __wevu: runtimeFacade }

    Object.assign(instance.data, { count: 0, input: '' })
    applying = true
    defineRuntime(2)
    refresh!(instance, { count: 2, input: 'held-input' })
    applying = false
    expect(instance.__wevu.setupState.count.value).toBe(2)
    expect(instance.__wevu.setupState.input.value).toBe('held-input')
    expect(instance.__wevu.methods.increment).not.toBe(previousIncrement)
    registeredDefinition!.methods.__weapp_vite_inline.call(pageWrapper, {
      type: 'tap',
      currentTarget: {
        dataset: {
          wiTap: 'i0',
        },
      },
    })
    await nextTick()
    await nextTick()

    expect(instance.__wevu).toBe(runtimeFacade)
    expect(pageWrapper.__wevu).toBe(runtimeFacade)
    expect(instance.__wevu.setupState.count.value).toBe(4)
    expect(instance.__wevu.setupState.input.value).toBe('held-input')
    expect(instance.data.count).toBe(4)
    expect(instance.data.input).toBe('held-input')
    expect(attached).toHaveBeenCalledTimes(1)
    expect(unloaded).not.toHaveBeenCalled()
  })

  it.each([false, true])('keeps plain setup values rendered across consecutive updates with an existing runtime: %s', async (existingRuntime) => {
    const defineRuntime = (label: string) => defineComponent({
      setup() {
        const input = ref('')
        return { input, label }
      },
    })
    defineRuntime('before')

    const instance: any = {
      data: { input: 'held-input', label: 'before' },
      properties: {},
      setData(payload: Record<string, any>) {
        Object.assign(this.data, payload)
      },
    }
    if (existingRuntime) {
      registeredDefinition!.lifetimes.attached.call(instance)
      instance.__wevu.setupState.input.value = 'held-input'
      await nextTick()
      await nextTick()
    }
    for (const label of ['after', 'after', 'before']) {
      const snapshot = { ...instance.data }
      applying = true
      defineRuntime(label)
      refresh!(instance, snapshot)
      applying = false
      await nextTick()
      await nextTick()

      expect(instance.__wevu.setupState.input.value).toBe('held-input')
      expect(instance.__wevu.setupState.label).toBe(label)
      expect(instance.data).toMatchObject({ input: 'held-input', label })
    }
  })

  it.each([false, true])('restores explicit reactive snapshots with an existing runtime: %s', async (existingRuntime) => {
    const attached = vi.fn()
    const defineRuntime = (label: string, delta: number) => defineComponent({
      setup() {
        const count = ref(0)
        const details = reactive({ count: 0 })
        const items = reactive(['initial'])
        onAttached(attached)
        const increment = () => {
          count.value += delta
          details.count += delta
          items.push('updated')
        }
        return { count, details, increment, items, label }
      },
    })
    defineRuntime('before', 1)
    const instance: any = {
      data: { count: 0, details: { count: 0 }, items: ['initial'], label: 'before' },
      properties: {},
      setData(payload: Record<string, any>) {
        for (const [key, value] of Object.entries(payload)) {
          applySnapshotUpdate(this.data, key, value, 'set')
        }
      },
    }
    if (existingRuntime) {
      registeredDefinition!.lifetimes.attached.call(instance)
    }
    const snapshot = { count: 2, details: { count: 3 }, items: ['held'], label: 'before' }
    applying = true
    defineRuntime('after', 2)
    refresh!(instance, snapshot)
    applying = false

    expect(instance.__wevu.setupState.count.value).toBe(2)
    expect(instance.__wevu.setupState.details).toEqual({ count: 3 })
    expect(instance.__wevu.setupState.items).toEqual(['held'])
    expect(instance.__wevu.setupState.label).toBe('after')
    expect(instance.data).toMatchObject({ ...snapshot, label: 'after' })
    instance.__wevu.methods.increment()
    await nextTick()
    await nextTick()
    expect(instance.__wevu.setupState.count.value).toBe(4)
    expect(instance.__wevu.setupState.details.count).toBe(5)
    expect(instance.__wevu.setupState.items).toEqual(['held', 'updated'])
    expect(instance.data).toMatchObject({ count: 4, details: { count: 5 }, items: ['held', 'updated'], label: 'after' })
    expect(snapshot).toEqual({ count: 2, details: { count: 3 }, items: ['held'], label: 'before' })
    expect(attached).toHaveBeenCalledTimes(existingRuntime ? 1 : 0)
  })

  it('preserves deleted reactive fields while adding defaults introduced by updated setup code', async () => {
    const defineRuntime = (updated: boolean) => defineComponent({
      setup() {
        const details = reactive<Record<string, any>>({
          count: 0,
          selected: 'initial',
          nested: { removed: 'initial', kept: 'initial', ...(updated ? { added: 'new nested default' } : {}) },
          ...(updated ? { added: 'new default' } : {}),
        })
        const nested = details.nested
        return {
          details,
          increment: () => {
            details.count++
            nested.kept = 'updated through closure'
          },
        }
      },
    })
    defineRuntime(false)
    const instance: any = {
      data: {},
      properties: {},
      setData(payload: Record<string, any>) {
        for (const [key, value] of Object.entries(payload)) {
          applySnapshotUpdate(this.data, key, value, 'set')
        }
      },
    }
    registeredDefinition!.lifetimes.attached.call(instance)
    const details = instance.__wevu.setupState.details
    delete details.selected
    delete details.nested.removed
    details.count = 3
    details.nested.kept = 'held'
    await nextTick()
    await nextTick()
    const snapshot = { details: { count: 3, nested: { kept: 'held' } } }
    applying = true
    defineRuntime(true)
    refresh!(instance, snapshot)
    applying = false
    expect(instance.__wevu.setupState.details).toEqual({
      count: 3,
      nested: { kept: 'held', added: 'new nested default' },
      added: 'new default',
    })
    instance.__wevu.methods.increment()
    await nextTick()
    await nextTick()
    expect(instance.data.details).toEqual({
      count: 4,
      nested: { kept: 'updated through closure', added: 'new nested default', removed: null },
      added: 'new default',
      selected: null,
    })
    expect(instance.__wevu.setupState.details).not.toHaveProperty('selected')
    expect(instance.__wevu.setupState.details.nested).not.toHaveProperty('removed')
    expect(snapshot).toEqual({ details: { count: 3, nested: { kept: 'held' } } })
  })

  it.each([
    { replaceStore: false, serializedAction: false },
    { replaceStore: false, serializedAction: true },
    { replaceStore: true, serializedAction: false },
    { replaceStore: true, serializedAction: true },
  ])('keeps store refs and actions after HMR (module replacement: $replaceStore, null action: $serializedAction)', async ({ replaceStore, serializedAction }) => {
    const createCounter = () => defineStore('hmr-counter', () => {
      const count = ref(0)
      return {
        count,
        increment: (delta: number) => { count.value += delta },
      }
    })
    let useCounter = createCounter()
    const defineRuntime = (delta: number) => defineComponent({
      setup() {
        const store = useCounter()
        const count = ref(0)
        return {
          count,
          store,
          storeCount: store.count,
          increment: () => {
            count.value += delta
            store.increment(delta)
          },
        }
      },
    })
    defineRuntime(1)
    const instance: any = {
      data: {},
      properties: {},
      setData(payload: Record<string, any>) { Object.assign(this.data, payload) },
    }
    registeredDefinition!.lifetimes.attached.call(instance)
    instance.__wevu.methods.increment()
    instance.__wevu.methods.increment()
    await nextTick()
    await nextTick()
    expect(instance.data).toMatchObject({ count: 2, storeCount: 2 })
    if (replaceStore) {
      useCounter = createCounter()
    }
    const storeRef = useCounter().count
    const storeAction = useCounter().increment
    applying = true
    defineRuntime(2)
    refresh!(instance, {
      count: 2,
      store: { count: 2, ...(serializedAction ? { increment: null } : {}) },
      storeCount: 2,
    })
    applying = false
    expect(useCounter().count).toBe(storeRef)
    expect(useCounter().increment).toBe(storeAction)
    expect(useCounter().count.value).toBe(2)
    expect(instance.data).toMatchObject({ count: 2, storeCount: 2 })
    instance.__wevu.methods.increment()
    await nextTick()
    await nextTick()
    expect(instance.data).toMatchObject({ count: 4, storeCount: 4 })
    expect(useCounter().count.value).toBe(4)
  })
})
