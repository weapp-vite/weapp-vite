import path from 'pathe'
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
    const { createPageEntryMatcher, injectWevuPageFeaturesInJsWithResolver } = await import('wevu/compiler')
    const { createWevuAutoPageFeaturesPlugin } = await import('./wevu')
    const first = { isPageFile: vi.fn(async () => false), markDirty: vi.fn() }
    const next = { isPageFile: vi.fn(async () => true), markDirty: vi.fn() }
    vi.mocked(createPageEntryMatcher).mockReset().mockReturnValueOnce(first).mockReturnValueOnce(next)
    vi.mocked(injectWevuPageFeaturesInJsWithResolver).mockReset().mockResolvedValue({ transformed: false } as any)
    const root = path.resolve('page-classification-fixture')
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src') },
      scanService: {},
      runtimeState: { scan: { isDirty: false } },
    } as any)
    const transform = (plugin.transform as any).handler
    const filename = path.join(root, 'src/pages/home.ts')
    const source = 'Page({ onReachBottom() {} })'
    await transform.call({}, source, filename)
    await transform.call({}, source, filename)
    expect(first.isPageFile).toHaveBeenCalledTimes(1)
    const hook = plugin[boundary] as any
    await (typeof hook === 'function' ? hook : hook.handler).call({})
    await transform.call({}, source, filename)
    expect(next.isPageFile).toHaveBeenCalledExactlyOnceWith(filename)
    expect(injectWevuPageFeaturesInJsWithResolver).toHaveBeenCalledTimes(1)
  })

  it('does not create a page matcher for scripts without page features across build generations', async () => {
    const { createPageEntryMatcher } = await import('wevu/compiler')
    const { createWevuAutoPageFeaturesPlugin } = await import('./wevu')
    vi.mocked(createPageEntryMatcher).mockReset()
    const root = path.resolve('page-classification-fixture')
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src') },
      scanService: {},
      runtimeState: { scan: { isDirty: false } },
    } as any)
    const transform = (plugin.transform as any).handler
    for (const boundary of ['buildStart', 'closeBundle', 'closeWatcher'] as const) {
      expect(await transform.call({}, 'Page({})', path.join(root, 'src/pages/home.ts'))).toBeNull()
      expect(await transform.call({}, 'export const value = 1', path.join(root, 'src/shared.ts'))).toBeNull()
      const hook = plugin[boundary] as any
      await (typeof hook === 'function' ? hook : hook.handler).call({})
    }
    expect(createPageEntryMatcher).not.toHaveBeenCalled()
  })

  it('analyzes a later feature edit and retains page classification after a fast rejection', async () => {
    const { createPageEntryMatcher, injectWevuPageFeaturesInJsWithResolver } = await import('wevu/compiler')
    const { createWevuAutoPageFeaturesPlugin } = await import('./wevu')
    const root = path.resolve('page-classification-fixture')
    const filename = path.join(root, 'src/pages/home.ts')
    const componentFile = path.join(root, 'src/components/card.ts')
    const pageMatcher = { isPageFile: vi.fn(async (file: string) => file === filename), markDirty: vi.fn() }
    vi.mocked(createPageEntryMatcher).mockReset().mockReturnValue(pageMatcher)
    vi.mocked(injectWevuPageFeaturesInJsWithResolver).mockReset().mockResolvedValue({ transformed: true, code: 'page-feature-output' } as any)
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src') },
      scanService: {},
      runtimeState: { scan: { isDirty: false } },
    } as any)
    const transform = (plugin.transform as any).handler
    expect(await transform.call({}, 'Page({})', filename)).toBeNull()
    expect(createPageEntryMatcher).not.toHaveBeenCalled()
    const source = 'Page({ onReachBottom() {} })'
    expect(await transform.call({}, source, filename)).toEqual({ code: 'page-feature-output', map: null })
    expect(await transform.call({}, source, componentFile)).toBeNull()
    expect(pageMatcher.isPageFile.mock.calls).toEqual([[filename], [componentFile]])
    expect(injectWevuPageFeaturesInJsWithResolver).toHaveBeenCalledExactlyOnceWith(source, expect.objectContaining({ id: filename }))
  })

  it('invalidates an existing page matcher while fast rejecting a script after routes change', async () => {
    const { createPageEntryMatcher, injectWevuPageFeaturesInJsWithResolver } = await import('wevu/compiler')
    const { createWevuAutoPageFeaturesPlugin } = await import('./wevu')
    const pageMatcher = { isPageFile: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true), markDirty: vi.fn() }
    vi.mocked(createPageEntryMatcher).mockReset().mockReturnValue(pageMatcher)
    vi.mocked(injectWevuPageFeaturesInJsWithResolver).mockReset().mockResolvedValue({ transformed: false } as any)
    const root = path.resolve('page-classification-fixture')
    const runtimeState = { scan: { isDirty: false } }
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: { cwd: root, absoluteSrcRoot: path.join(root, 'src') },
      scanService: {},
      runtimeState,
    } as any)
    const transform = (plugin.transform as any).handler
    const filename = path.join(root, 'src/pages/home.ts')
    const source = 'Page({ onReachBottom() {} })'
    await transform.call({}, source, filename)
    runtimeState.scan.isDirty = true
    await transform.call({}, 'Page({})', filename)
    expect(pageMatcher.markDirty).toHaveBeenCalledTimes(1)
    runtimeState.scan.isDirty = false
    await transform.call({}, source, filename)
    expect(pageMatcher.isPageFile).toHaveBeenCalledTimes(2)
    expect(injectWevuPageFeaturesInJsWithResolver).toHaveBeenCalledTimes(1)
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
