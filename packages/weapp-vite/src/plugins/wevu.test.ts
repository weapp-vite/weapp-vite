import path from 'node:path'
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
  it.each(['buildStart', 'closeBundle', 'closeWatcher'] as const)('refreshes page classification after %s when the plugin is reused', async (boundary) => {
    const { createPageEntryMatcher } = await import('wevu/compiler')
    const { createWevuAutoPageFeaturesPlugin } = await import('./wevu')
    const first = { isPageFile: vi.fn(async () => false), markDirty: vi.fn() }
    const next = { isPageFile: vi.fn(async () => true), markDirty: vi.fn() }
    vi.mocked(createPageEntryMatcher).mockReset().mockReturnValueOnce(first).mockReturnValueOnce(next)
    const root = path.resolve('page-classification-fixture')
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src') },
      scanService: {},
      runtimeState: { scan: { isDirty: false } },
    } as any)
    const transform = (plugin.transform as any).handler
    const filename = path.join(root, 'src/pages/home.ts')
    await transform.call({}, 'Page({})', filename)
    await transform.call({}, 'Page({})', filename)
    expect(first.isPageFile).toHaveBeenCalledTimes(1)
    const hook = plugin[boundary] as any
    await (typeof hook === 'function' ? hook : hook.handler).call({})
    await transform.call({}, 'Page({})', filename)
    expect(next.isPageFile).toHaveBeenCalledExactlyOnceWith(filename)
  })

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
