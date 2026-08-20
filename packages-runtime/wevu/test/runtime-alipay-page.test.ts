import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from '@/index'
import { getMiniProgramRuntimeGlobalObject } from '@/runtime/platform'

const registeredComponents: Record<string, any>[] = []
const registeredPages: Record<string, any>[] = []

beforeEach(() => {
  registeredComponents.length = 0
  registeredPages.length = 0
  ;(globalThis as any).my = {}
  ;(globalThis as any).Component = vi.fn((options: Record<string, any>) => {
    registeredComponents.push(options)
  })
  ;(globalThis as any).Page = vi.fn((options: Record<string, any>) => {
    registeredPages.push(options)
  })
})

afterEach(() => {
  delete (globalThis as any).my
  delete (globalThis as any).Component
  delete (globalThis as any).Page
})

describe('runtime: alipay page registration', () => {
  it('registers pages through Page and exposes template event methods at top level', () => {
    defineComponent({
      __wevu_isPage: true,
      methods: {
        __weapp_vite_inline_map: {
          i0: {
            keys: [],
            fn: (ctx: Record<string, any>) => ctx.increase(),
          },
        },
      } as any,
      setup() {
        const count = ref(0)
        function increase() {
          count.value += 1
        }
        return { count, increase }
      },
    })

    expect(registeredComponents).toHaveLength(0)
    expect(registeredPages).toHaveLength(1)
    expect(registeredPages[0].methods).toBeUndefined()
    expect(registeredPages[0].lifetimes).toBeUndefined()
    expect(registeredPages[0].properties).toBeUndefined()
    expect(registeredPages[0].__weapp_vite_inline).toEqual(expect.any(Function))
  })

  it('uses the alipay host object as the runtime global boundary', () => {
    expect(getMiniProgramRuntimeGlobalObject()).toBe((globalThis as any).my)
  })

  it('bridges Page lifecycle into the existing component runtime lifecycle', () => {
    const lifecycleCalls: string[] = []
    defineComponent({
      __wevu_isPage: true,
      setup() {
        lifecycleCalls.push('setup')
        return { count: ref(0) }
      },
      created() {
        lifecycleCalls.push('created')
      },
      mounted() {
        lifecycleCalls.push('mounted')
      },
      unmounted() {
        lifecycleCalls.push('unmounted')
      },
    })

    const page = registeredPages[0]
    const instance = {
      data: {},
      route: 'pages/demo/index',
      setData: vi.fn(),
    }

    page.onLoad.call(instance, {})
    page.onReady.call(instance)
    page.onUnload.call(instance)

    expect(lifecycleCalls).toEqual([
      'setup',
      'created',
      'mounted',
      'unmounted',
    ])
  })
})
