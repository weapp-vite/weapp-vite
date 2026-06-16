import { describe, expect, it, vi } from 'vitest'
import { createCoreLifecyclePlugin } from './index'

vi.mock('./emit', () => ({
  createGenerateBundleHook: vi.fn(() => vi.fn()),
  createRenderStartHook: vi.fn(() => vi.fn()),
}))

vi.mock('./end', () => ({
  createBuildEndHook: vi.fn(() => vi.fn()),
}))

vi.mock('./load', () => ({
  createLoadHook: vi.fn(() => vi.fn()),
  createOptionsHook: vi.fn(() => vi.fn()),
}))

vi.mock('./transform', () => ({
  createTransformHook: vi.fn(() => vi.fn()),
}))

vi.mock('./watch', () => ({
  createBuildStartHook: vi.fn(() => vi.fn()),
  createWatchChangeHook: vi.fn(() => vi.fn()),
}))

describe('createCoreLifecyclePlugin', () => {
  it('declares a rolldown filter for source transform hooks', () => {
    const plugin = createCoreLifecyclePlugin({
      ctx: {
        configService: {
          weappViteConfig: {},
        },
      },
    } as any)

    expect(plugin.transform).toEqual(expect.objectContaining({
      filter: {
        id: expect.any(RegExp),
      },
      handler: expect.any(Function),
    }))
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.ts')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.vue')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.wxss')).toBe(false)
  })
})
