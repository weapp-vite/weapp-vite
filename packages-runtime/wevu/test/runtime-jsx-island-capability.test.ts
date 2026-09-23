import { WEVU_JSX_ISLAND_HANDLER, WEVU_JSX_ISLAND_HANDLER_MAP_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

describe('JSX island capability boundary', () => {
  it('does not register an island event entry for a plain internal component', async () => {
    const registerComponent = vi.fn()
    vi.stubGlobal('Component', registerComponent)
    const { createWevuComponent } = await import('@/internal-runtime')

    createWevuComponent({ setup: () => ({ count: 1 }) })

    expect(registerComponent).toHaveBeenCalledOnce()
    expect(registerComponent.mock.calls[0]![0].methods).not.toHaveProperty(WEVU_JSX_ISLAND_HANDLER)
  })

  it('installs dispatch before registration and preserves user-provided handlers', async () => {
    const { createComponentMethods } = await import('@/runtime/register/component/methods')
    const { installJsxIslands } = await import('@/internal-runtime')
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    installJsxIslands()
    const installed = runtimeCapabilityRegistry.jsxIslands
    installJsxIslands()
    expect(runtimeCapabilityRegistry.jsxIslands).toBe(installed)

    const target = {
      __wevu: {
        proxy: {
          value: 3,
          [WEVU_JSX_ISLAND_HANDLER_MAP_KEY]: {
            'i0:0': function (this: { value: number }) { return this.value },
          },
        },
      },
    }
    const { finalMethods } = createComponentMethods({ userMethods: {}, runtimeMethods: {} })
    expect(finalMethods[WEVU_JSX_ISLAND_HANDLER]!.call(target, {
      currentTarget: { dataset: { wvJsxHandler: 'i0:0' } },
    })).toBe(3)

    const custom = vi.fn()
    const overridden = createComponentMethods({
      userMethods: { [WEVU_JSX_ISLAND_HANDLER]: custom },
      runtimeMethods: {},
    })
    expect(overridden.finalMethods[WEVU_JSX_ISLAND_HANDLER]).toBe(custom)
  })

  it.each(['defineComponent', 'createWevuComponent'] as const)(
    'keeps the public %s factory compatible with dynamic options',
    async (factoryName) => {
      const registerComponent = vi.fn()
      vi.stubGlobal('Component', registerComponent)
      const runtime = await import('@/runtime/publicRuntime')
      const options = { setup: () => ({ count: 0 }) }
      if (factoryName === 'defineComponent') {
        runtime.defineComponent(options)
      }
      else {
        runtime.createWevuComponent(options)
      }

      expect(registerComponent.mock.calls[0]![0].methods[WEVU_JSX_ISLAND_HANDLER]).toBeTypeOf('function')
    },
  )
})
