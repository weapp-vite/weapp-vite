import { describe, expect, it, vi } from 'vitest'

vi.mock('wevu/compiler', () => ({
  createPageEntryMatcher: vi.fn(),
  injectWevuPageFeaturesInJsWithResolver: vi.fn(),
}))

vi.mock('../logger', () => ({
  default: {
    warn: vi.fn(),
  },
}))

describe('createWevuAutoPageFeaturesPlugin', () => {
  it('declares a rolldown filter for js-like page feature transforms', async () => {
    const { createWevuAutoPageFeaturesPlugin } = await import('./wevu')
    const plugin = createWevuAutoPageFeaturesPlugin({} as any)

    expect(plugin.transform).toEqual(expect.objectContaining({
      filter: {
        id: expect.any(RegExp),
      },
      handler: expect.any(Function),
    }))
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.ts')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.tsx')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.vue')).toBe(false)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.wxss')).toBe(false)
  })
})
