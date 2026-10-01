import { WEVU_BINDING_MANIFEST_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createIsolatedWevuComponentDefinition,
  createWevuComponentDefinition,
  getWevuComponentLifecycleDefinition,
} from '@/internal-runtime'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime: component definition factory', () => {
  it.each([undefined, { count: 0 }])('seeds manifest style bindings before native rendering with data %j', (data) => {
    const setup = vi.fn(() => ({ color: 'red' }))
    const styleGetter = vi.fn(() => 'color:red')
    const definition = createWevuComponentDefinition({
      data,
      setup,
      computed: { __wv_style_0: styleGetter },
      [WEVU_BINDING_MANIFEST_KEY]: {
        version: 1,
        sourceFile: 'src/pages/style.vue',
        bindings: [{ id: 'style', outputPath: '__wv_style_0' }],
      },
    })
    const nativeDefinition = getWevuComponentLifecycleDefinition(definition)
    expect(nativeDefinition?.data).toEqual({ ...data, __wv_style_0: '' })
    expect(styleGetter).not.toHaveBeenCalled()
    expect(setup).not.toHaveBeenCalled()
  })

  it('creates the production lifecycle definition without native registration', () => {
    const componentConstructor = vi.fn()
    vi.stubGlobal('Component', componentConstructor)

    const definition = createWevuComponentDefinition({
      props: { count: { type: Number, default: 1 } },
      setup: props => ({ count: props.count }),
    })
    const lifecycleDefinition = getWevuComponentLifecycleDefinition(definition)

    expect(componentConstructor).not.toHaveBeenCalled()
    expect(lifecycleDefinition?.properties.count.value).toBe(1)
    expect(lifecycleDefinition?.lifetimes.created).toBeTypeOf('function')
    expect(lifecycleDefinition?.lifetimes.attached).toBeTypeOf('function')
    expect(lifecycleDefinition?.lifetimes.ready).toBeTypeOf('function')
    expect(lifecycleDefinition?.lifetimes.detached).toBeTypeOf('function')
  })

  it('derives equivalent lifecycle definitions with isolated runtime apps', () => {
    const definition = createWevuComponentDefinition({
      props: { count: { type: Number, default: 1 } },
      setup: props => ({ count: props.count }),
    })
    const isolated = createIsolatedWevuComponentDefinition(definition)
    const lifecycleDefinition = getWevuComponentLifecycleDefinition(definition)
    const isolatedLifecycleDefinition = getWevuComponentLifecycleDefinition(isolated)

    expect(isolated.__wevu_runtime).not.toBe(definition.__wevu_runtime)
    expect(isolated.__wevu_options).toBe(definition.__wevu_options)
    expect(isolatedLifecycleDefinition).not.toBe(lifecycleDefinition)
    expect(Object.keys(isolatedLifecycleDefinition ?? {}).sort()).toEqual(
      Object.keys(lifecycleDefinition ?? {}).sort(),
    )
    expect(isolatedLifecycleDefinition?.properties.count.value).toBe(1)
    expect(isolatedLifecycleDefinition?.lifetimes.created).toBeTypeOf('function')
  })
})
