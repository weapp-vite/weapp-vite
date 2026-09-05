import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 这些用例必须重载模块图，才能分别观察公开入口和 internal-runtime 的首次安装状态。
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime public capability compatibility', () => {
  it('keeps bare public factories compatible with dynamic patch options', async () => {
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    const { createApp } = await import('@/runtime/publicRuntime')
    const { nextTick } = await import('@/scheduler')
    const payloads: Array<Record<string, unknown>> = []

    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { strategy: 'patch' },
    })
    const first = app.mount({
      setData(payload) {
        payloads.push(payload)
      },
    })

    expect(runtimeCapabilityRegistry.patchStrategy).toBeTruthy()
    expect(runtimeCapabilityRegistry.setDataHighFrequencyWarning).toBeTruthy()
    expect(payloads.length).toBeGreaterThan(0)

    first.proxy.count = 1
    await nextTick()
    await nextTick()
    expect(payloads.at(-1)).toMatchObject({ count: 1 })
    first.unmount()
    first.unmount()

    const second = app.mount({ setData: vi.fn() })
    second.unmount()
    second.unmount()
  })

  it('requires explicit installers for dynamic internal-runtime options', async () => {
    const runtime = await import('@/internal-runtime')

    const installers = [
      runtime.installPatchStrategy,
      runtime.installTemplateRefs,
      runtime.installInlineEvents,
      runtime.installSetDataHighFrequencyWarning,
      runtime.installScopedSlots,
      runtime.installLayout,
    ]
    expect(installers.every(installer => typeof installer === 'function')).toBe(true)
    const nativeRegisterComponent = vi.fn()
    vi.stubGlobal('Component', nativeRegisterComponent)
    const leanApp = runtime.createApp({})
    const templateOptions = {
      __wevuTemplateRefs: [
        { selector: '.leaf', inFor: false, name: 'leaf', kind: 'component' },
      ],
    } as unknown as Parameters<typeof runtime.registerComponent>[4]
    expect(() => runtime.registerComponent(
      leanApp,
      {},
      undefined,
      undefined,
      templateOptions,
    )).toThrow('runtime capability "templateRefs"')
    expect(nativeRegisterComponent).not.toHaveBeenCalled()

    expect(() => runtime.createApp({
      setData: { strategy: 'patch' },
    })).toThrow('runtime capability "patchStrategy"')

    runtime.installPatchStrategy()
    const app = runtime.createApp({
      data: () => ({ count: 0 }),
      setData: { strategy: 'patch' },
    })
    const instance = app.mount({ setData: vi.fn() })
    instance.unmount()

    expect(() => runtime.createApp({
      setData: { highFrequencyWarning: true },
    })).toThrow('runtime capability "setDataHighFrequencyWarning"')
    runtime.installSetDataHighFrequencyWarning()
    expect(() => runtime.createApp({
      setData: { highFrequencyWarning: true },
    })).not.toThrow()
  })

  it('installs option capabilities through the public defaults wrapper', async () => {
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    const { resetWevuDefaults } = await import('@/runtime/defaults')
    const { createApp, setWevuDefaults } = await import('@/runtime/publicRuntime')

    setWevuDefaults({
      app: {
        setData: { strategy: 'patch' },
      },
    })
    expect(runtimeCapabilityRegistry.patchStrategy).toBeTruthy()
    expect(runtimeCapabilityRegistry.setDataHighFrequencyWarning).toBeTruthy()

    const app = createApp({ data: () => ({ ready: true }) })
    const instance = app.mount({ setData: vi.fn() })
    expect(instance.proxy.ready).toBe(true)
    const patchStrategy = runtimeCapabilityRegistry.patchStrategy
    const highFrequencyWarning = runtimeCapabilityRegistry.setDataHighFrequencyWarning
    resetWevuDefaults()
    expect(runtimeCapabilityRegistry.patchStrategy).toBe(patchStrategy)
    expect(runtimeCapabilityRegistry.setDataHighFrequencyWarning).toBe(highFrequencyWarning)
    instance.unmount()
  })

  it('keeps the public scoped-slot creator compatible and installs nested support', async () => {
    const registerComponent = vi.fn()
    vi.stubGlobal('Component', registerComponent)
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    const { createWevuScopedSlotComponent } = await import('@/runtime/publicRuntime')

    createWevuScopedSlotComponent({
      layoutHosts: [
        { key: 'toast', selector: '#toast', kind: 'component' },
      ],
    })

    expect(runtimeCapabilityRegistry.scopedSlots).toBeTruthy()
    expect(runtimeCapabilityRegistry.inlineEvents).toBeTruthy()
    expect(runtimeCapabilityRegistry.templateRefs).toBeTruthy()
    expect(runtimeCapabilityRegistry.layout).toBeTruthy()
    expect(registerComponent).toHaveBeenCalledTimes(1)
  })

  it('installs capabilities for root low-level registration wrappers at call time', async () => {
    const nativeRegisterComponent = vi.fn()
    vi.stubGlobal('Component', nativeRegisterComponent)
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    const { createApp } = await import('@/runtime/app')
    const { registerComponent } = await import('@/index')
    const runtimeApp = createApp({ data: () => ({ ready: true }) })
    Object.defineProperty(runtimeApp, '__wevuHasTemplateRuntimeBindings', {
      configurable: true,
      value: true,
    })
    const methods = {
      __weapp_vite_inline_map: {
        e0: { keys: [], fn: () => undefined },
      },
    } as unknown as Parameters<typeof registerComponent>[1]
    const mpOptions = {
      __wevuTemplateRefs: [
        { selector: '.leaf', inFor: false, name: 'leaf', kind: 'component' },
      ],
      __wevuLayoutHosts: [
        { key: 'toast', selector: '#toast', kind: 'component' },
      ],
    } as unknown as Parameters<typeof registerComponent>[4]

    expect(runtimeCapabilityRegistry.patchStrategy).toBeUndefined()
    expect(runtimeCapabilityRegistry.inlineEvents).toBeUndefined()
    expect(runtimeCapabilityRegistry.templateRefs).toBeUndefined()
    expect(runtimeCapabilityRegistry.scopedSlots).toBeUndefined()
    expect(runtimeCapabilityRegistry.layout).toBeUndefined()

    registerComponent(runtimeApp, methods, undefined, undefined, mpOptions)

    expect(runtimeCapabilityRegistry.patchStrategy).toBeTruthy()
    expect(runtimeCapabilityRegistry.setDataHighFrequencyWarning).toBeTruthy()
    expect(runtimeCapabilityRegistry.inlineEvents).toBeTruthy()
    expect(runtimeCapabilityRegistry.templateRefs).toBeTruthy()
    expect(runtimeCapabilityRegistry.scopedSlots).toBeTruthy()
    expect(runtimeCapabilityRegistry.layout).toBeTruthy()
    expect(nativeRegisterComponent).toHaveBeenCalledTimes(1)
  })

  it('installs direct template-ref and layout APIs only when called', async () => {
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    const { useTemplateRef } = await import('@/runtime/vueCompat/templateRef')
    const { setPageLayout } = await import('@/runtime/features/publicLayout')

    expect(runtimeCapabilityRegistry.templateRefs).toBeUndefined()
    expect(() => useTemplateRef('leaf')).toThrow('useTemplateRef()')
    expect(runtimeCapabilityRegistry.templateRefs).toBeTruthy()

    expect(runtimeCapabilityRegistry.layout).toBeUndefined()
    expect(() => setPageLayout('default')).toThrow('setPageLayout()')
    expect(runtimeCapabilityRegistry.layout).toBeTruthy()
  })
})
