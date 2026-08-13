import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onAttached, onUnload, ref } from '@/index'

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

  it('keeps ref snapshots while letting plain setup values refresh from new code', async () => {
    const defineRuntime = (label: string) => defineComponent({
      setup() {
        const input = ref('')
        return { input, label }
      },
    })
    defineRuntime('before')

    const instance: any = {
      data: {},
      properties: {},
      setData(payload: Record<string, any>) {
        Object.assign(this.data, payload)
      },
    }
    registeredDefinition!.lifetimes.attached.call(instance)
    expect(instance.data).toMatchObject({ input: '', label: 'before' })

    instance.__wevu.setupState.input.value = 'held-input'
    await nextTick()
    await nextTick()
    applying = true
    defineRuntime('after')
    refresh!(instance, { input: 'held-input', label: 'before' })
    applying = false

    expect(instance.__wevu.setupState.input.value).toBe('held-input')
    expect(instance.__wevu.setupState.label).toBe('after')
    expect(instance.data).toMatchObject({ input: 'held-input', label: 'after' })
  })
})
