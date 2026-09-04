import type { RuntimeCapabilityRegistry } from '@/runtime/capabilities'
import type { InternalRuntimeState, MethodDefinitions } from '@/runtime/types'
import { WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 每个用例重载模块图，以验证能力槽位的首次加载、模块求值和显式安装边界。

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime capability registry', () => {
  it('starts empty and feature modules do not register during evaluation', async () => {
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')

    await Promise.all([
      import('@/runtime/features/patchStrategy'),
      import('@/runtime/features/templateRefs'),
      import('@/runtime/features/inlineEvents'),
      import('@/runtime/features/setDataHighFrequencyWarning'),
      import('@/runtime/features/scopedSlots'),
      import('@/runtime/features/layout'),
    ])

    expect(runtimeCapabilityRegistry).toEqual({})
  })

  it('keeps repeated installation stable and lets a new HMR implementation replace the slot', async () => {
    const {
      registerRuntimeCapability,
      runtimeCapabilityRegistry,
    } = await import('@/runtime/capabilities')
    const { installInlineEvents } = await import('@/runtime/features/inlineEvents')

    installInlineEvents()
    const installed = runtimeCapabilityRegistry.inlineEvents
    installInlineEvents()
    expect(runtimeCapabilityRegistry.inlineEvents).toBe(installed)

    const replacement: NonNullable<RuntimeCapabilityRegistry['inlineEvents']> = {
      handler(this: InternalRuntimeState) {
        return this
      },
      run() {
        return 'hmr'
      },
    }
    registerRuntimeCapability('inlineEvents', replacement)

    expect(runtimeCapabilityRegistry.inlineEvents).toBe(replacement)
    expect(runtimeCapabilityRegistry.inlineEvents?.run({}, undefined, {})).toBe('hmr')
  })

  it('installs template refs before layout and remains idempotent', async () => {
    const { runtimeCapabilityRegistry } = await import('@/runtime/capabilities')
    const { installLayout } = await import('@/runtime/features/layout')

    installLayout()
    const templateRefs = runtimeCapabilityRegistry.templateRefs
    const layout = runtimeCapabilityRegistry.layout

    expect(templateRefs).toBeTruthy()
    expect(layout).toBeTruthy()

    installLayout()
    expect(runtimeCapabilityRegistry.templateRefs).toBe(templateRefs)
    expect(runtimeCapabilityRegistry.layout).toBe(layout)
  })

  it('does not activate an installed capability without matching options or metadata', async () => {
    const createScheduler = vi.fn(() => ({
      job() {},
      snapshot: () => ({}),
      cloneLatestSnapshot: () => ({}),
    }))
    const { registerRuntimeCapability } = await import('@/runtime/capabilities')
    const { createApp } = await import('@/runtime/app')
    registerRuntimeCapability('patchStrategy', { createScheduler })

    const app = createApp({
      data: () => ({ count: 0 }),
      setData: { strategy: 'diff' },
    })
    const instance = app.mount({ setData: vi.fn() })

    expect(createScheduler).not.toHaveBeenCalled()
    instance.unmount()
  })

  it('fails before state or host allocation when requested capabilities are absent', async () => {
    const createData = vi.fn(() => ({ count: 0 }))
    const registerComponent = vi.fn()
    vi.stubGlobal('Component', registerComponent)
    const { createApp } = await import('@/runtime/app')
    const { createWevuComponent } = await import('@/runtime/define')

    expect(() => createApp({
      data: createData,
      setData: { strategy: 'patch' },
    })).toThrow('runtime capability "patchStrategy"')
    expect(createData).not.toHaveBeenCalled()

    expect(() => createApp({
      data: createData,
      setData: { highFrequencyWarning: true },
    })).toThrow('runtime capability "setDataHighFrequencyWarning"')
    expect(createData).not.toHaveBeenCalled()

    const diffApp = createApp({
      data: () => ({ count: 1 }),
      setData: { strategy: 'diff' },
    })
    const diffInstance = diffApp.mount({ setData: vi.fn() })
    expect(diffInstance.proxy.count).toBe(1)
    diffInstance.unmount()

    expect(() => createWevuComponent({
      __wevuTemplateRefs: [
        { selector: '.leaf', inFor: false, name: 'leaf', kind: 'component' },
      ],
    })).toThrow('runtime capability "templateRefs"')
    expect(registerComponent).not.toHaveBeenCalled()

    expect(() => createWevuComponent({
      __wevuLayoutHosts: [
        { key: 'toast', selector: '#toast', kind: 'component' },
      ],
    })).toThrow('runtime capability "layout"')
    expect(registerComponent).not.toHaveBeenCalled()
  })

  it('fails closed for inline metadata and scoped-slot owner metadata', async () => {
    const registerComponent = vi.fn()
    vi.stubGlobal('Component', registerComponent)
    const { createApp } = await import('@/runtime/app')
    const { createWevuComponent } = await import('@/runtime/define')

    expect(() => createWevuComponent({
      methods: {
        __weapp_vite_inline_map: {
          e0: { keys: [], fn: () => undefined },
        },
      } as unknown as MethodDefinitions,
    })).toThrow('runtime capability "inlineEvents"')

    expect(() => createApp({
      [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: true,
      computed: {
        __wv_bind_0: () => null,
      },
    })).toThrow('runtime capability "scopedSlots"')
    expect(registerComponent).not.toHaveBeenCalled()
  })

  it('matches the opt-in high-frequency warning predicate', async () => {
    const { isSetDataHighFrequencyWarningRequested } = await import('@/runtime/capabilities')

    expect(isSetDataHighFrequencyWarningRequested(undefined)).toBe(false)
    expect(isSetDataHighFrequencyWarningRequested(false)).toBe(false)
    expect(isSetDataHighFrequencyWarningRequested(true)).toBe(true)
    expect(isSetDataHighFrequencyWarningRequested({ enabled: false })).toBe(false)
    expect(isSetDataHighFrequencyWarningRequested({ enabled: true })).toBe(true)
    expect(isSetDataHighFrequencyWarningRequested({})).toBe(true)
    class WarningOptions {
      constructor(public enabled: boolean | undefined) {}
    }
    expect(isSetDataHighFrequencyWarningRequested(1 as never)).toBe(false)
    expect(isSetDataHighFrequencyWarningRequested(new Date() as never)).toBe(true)
    expect(isSetDataHighFrequencyWarningRequested(new WarningOptions(undefined))).toBe(true)
    expect(isSetDataHighFrequencyWarningRequested(new WarningOptions(false))).toBe(false)
  })
})
