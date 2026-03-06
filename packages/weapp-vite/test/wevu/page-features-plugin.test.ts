import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../src/logger'

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

    await plugin.transform!.call(
      { resolve: async () => null } as any,
      `import { onPageScroll } from 'wevu'
onPageScroll(() => {
  wx.getStorageSync('token')
})`,
      '/src/pages/index/index.ts',
    )

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('wx.getStorageSync'))
    expect(injectWevuPageFeaturesMock).toHaveBeenCalledTimes(1)
  })
})
