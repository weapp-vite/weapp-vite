import logger from '../../src/logger'
import { callPluginHook } from '../pluginHook'

const createPageEntryMatcherMock = vi.fn()
const injectWevuPageFeaturesMock = vi.fn()

vi.mock('wevu/compiler', async () => {
  const actual = await vi.importActual<typeof import('wevu/compiler')>('wevu/compiler')
  return {
    ...actual,
    createPageEntryMatcher: createPageEntryMatcherMock,
    injectWevuPageFeaturesInJsWithResolver: injectWevuPageFeaturesMock,
  }
})

describe('wevu page features plugin', () => {
  let warnSpy: any

  beforeEach(() => {
    warnSpy = vi.spyOn(logger as any, 'warn').mockImplementation(() => {})
    createPageEntryMatcherMock.mockReset()
    injectWevuPageFeaturesMock.mockReset()
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('emits onPageScroll performance diagnostics for page js files', async () => {
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile: vi.fn(async () => true),
    })
    injectWevuPageFeaturesMock.mockResolvedValue({
      transformed: false,
      code: '',
    })

    const { createWevuAutoPageFeaturesPlugin } = await import('../../src/plugins/wevu')
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: {
        cwd: '/src',
        absoluteSrcRoot: '/src',
      },
      scanService: {
        loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
        loadSubPackages: () => [],
        pluginJson: undefined,
      },
      runtimeState: {
        scan: { isDirty: false },
      },
    } as any)

    await callPluginHook(plugin.transform as any, { resolve: async () => null } as any, `import { onPageScroll } from 'wevu'
onPageScroll(() => {
  wx.getStorageSync('token')
})`, '/src/pages/index/index.ts')

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('wx.getStorageSync'))
    expect(injectWevuPageFeaturesMock).toHaveBeenCalledTimes(1)
  })

  it('skips page feature injection when page script has no wevu hook hints', async () => {
    const isPageFile = vi.fn(async () => true)
    createPageEntryMatcherMock.mockReturnValue({
      markDirty: vi.fn(),
      isPageFile,
    })

    const { createWevuAutoPageFeaturesPlugin } = await import('../../src/plugins/wevu')
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: {
        cwd: '/src',
        absoluteSrcRoot: '/src',
      },
      scanService: {
        loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
        loadSubPackages: () => [],
        pluginJson: undefined,
      },
      runtimeState: {
        scan: { isDirty: false },
      },
    } as any)

    const result = await callPluginHook(
      plugin.transform as any,
      { resolve: async () => null } as any,
      'Page({ data: { title: "home" } })',
      '/src/pages/index/index.ts',
    )

    expect(result).toBeNull()
    expect(isPageFile).toHaveBeenCalledTimes(1)
    expect(injectWevuPageFeaturesMock).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('reuses page matcher results until scan is marked dirty', async () => {
    const markDirty = vi.fn()
    const isPageFile = vi.fn(async () => true)
    createPageEntryMatcherMock.mockReturnValue({
      markDirty,
      isPageFile,
    })
    injectWevuPageFeaturesMock.mockResolvedValue({
      transformed: false,
      code: '',
    })
    const runtimeState = {
      scan: { isDirty: false },
    }

    const { createWevuAutoPageFeaturesPlugin } = await import('../../src/plugins/wevu')
    const plugin = createWevuAutoPageFeaturesPlugin({
      configService: {
        cwd: '/src',
        absoluteSrcRoot: '/src',
      },
      scanService: {
        loadAppEntry: async () => ({ json: { pages: ['pages/index/index'] } }),
        loadSubPackages: () => [],
        pluginJson: undefined,
      },
      runtimeState,
    } as any)
    const pluginCtx = { resolve: async () => null } as any
    const code = `import { onReachBottom } from 'wevu'
Page({})`

    await callPluginHook(plugin.transform as any, pluginCtx, code, '/src/pages/index/index.ts')
    await callPluginHook(plugin.transform as any, pluginCtx, code, '/src/pages/index/index.ts')
    runtimeState.scan.isDirty = true
    await callPluginHook(plugin.transform as any, pluginCtx, code, '/src/pages/index/index.ts')

    expect(isPageFile).toHaveBeenCalledTimes(2)
    expect(markDirty).toHaveBeenCalledTimes(1)
    expect(injectWevuPageFeaturesMock).toHaveBeenCalledTimes(3)
  })
})
