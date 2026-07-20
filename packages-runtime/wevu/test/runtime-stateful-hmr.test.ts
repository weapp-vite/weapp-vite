import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, onAttached, onUnload, ref } from '@/index'

describe('runtime: stateful HMR', () => {
  let applying = false
  let refresh: ((instance: any) => void) | undefined
  let registeredDefinition: Record<string, any> | undefined

  beforeEach(() => {
    refresh = undefined
    registeredDefinition = undefined
    applying = false
    ;(globalThis as any).Component = vi.fn((definition: Record<string, any>) => {
      registeredDefinition = definition
    })
    ;(globalThis as any)[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY] = {
      isApplying: () => applying,
      trackWevuComponent(definition: Record<string, any>, callback: (instance: any) => void) {
        refresh = callback
        return definition
      },
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
        const increment = () => {
          count.value += delta
        }
        onAttached(attached)
        onUnload(unloaded)
        return { count, increment }
      },
    })
    defineRuntime(1)

    const instance: any = {
      data: {},
      properties: {},
      setData(payload: Record<string, any>) {
        Object.assign(this.data, payload)
      },
    }
    registeredDefinition!.lifetimes.attached.call(instance)
    instance.setData({ count: 2 })
    expect(instance.data.count).toBe(2)
    const runtimeFacade = instance.__wevu
    const pageWrapper = { __wevu: runtimeFacade }

    applying = true
    defineRuntime(2)
    refresh!(instance)
    applying = false
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
    expect(instance.data.count).toBe(4)
    expect(attached).toHaveBeenCalledTimes(1)
    expect(unloaded).not.toHaveBeenCalled()
  })
})
