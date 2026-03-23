import { beforeEach, describe, expect, it, vi } from 'vitest'

const compileVueFileMock = vi.hoisted(() => vi.fn())
const compileJsxFileMock = vi.hoisted(() => vi.fn())
const collectSetDataPickKeysFromTemplateMock = vi.hoisted(() => vi.fn())
const injectSetDataPickInJsMock = vi.hoisted(() => vi.fn())
const isAutoSetDataPickEnabledMock = vi.hoisted(() => vi.fn())
const createCompileVueFileOptionsMock = vi.hoisted(() => vi.fn(() => ({ mock: true })))
const readAndParseSfcMock = vi.hoisted(() => vi.fn())

vi.mock('wevu/compiler', () => ({
  compileVueFile: compileVueFileMock,
  compileJsxFile: compileJsxFileMock,
}))

vi.mock('./injectSetDataPick', () => ({
  collectSetDataPickKeysFromTemplate: collectSetDataPickKeysFromTemplateMock,
  injectSetDataPickInJs: injectSetDataPickInJsMock,
  isAutoSetDataPickEnabled: isAutoSetDataPickEnabledMock,
}))

vi.mock('./compileOptions', () => ({
  createCompileVueFileOptions: createCompileVueFileOptionsMock,
}))

vi.mock('../../utils/vueSfc', () => ({
  getSfcCheckMtime: vi.fn(() => false),
  readAndParseSfc: readAndParseSfcMock,
}))

vi.mock('../../wevu', () => ({
  createPageEntryMatcher: vi.fn(() => ({
    isPageFile: vi.fn(async () => false),
    markDirty: vi.fn(),
  })),
}))

vi.mock('../resolver', () => ({
  getSourceFromVirtualId: vi.fn((id: string) => id),
}))

vi.mock('../../../utils/toAbsoluteId', () => ({
  toAbsoluteId: vi.fn((id: string) => id),
}))

vi.mock('../../../utils/path', () => ({
  normalizeWatchPath: vi.fn((id: string) => id),
}))

vi.mock('../../../utils/resolvedId', () => ({
  normalizeFsResolvedId: vi.fn((id: string) => id),
}))

vi.mock('../index', () => ({
  VUE_PLUGIN_NAME: 'weapp-vite:vue',
}))

vi.mock('./bundle', () => ({
  emitVueBundleAssets: vi.fn(),
}))

vi.mock('./injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: vi.fn(async (_ctx: any, code: string) => ({
    transformed: false,
    code,
  })),
}))

vi.mock('./scopedSlot', () => ({
  emitScopedSlotChunks: vi.fn(),
  loadScopedSlotModule: vi.fn(() => null),
  resolveScopedSlotVirtualId: vi.fn(() => null),
}))

vi.mock('./styleRequest', () => ({
  buildWeappVueStyleRequest: vi.fn(),
  parseWeappVueStyleRequest: vi.fn(() => null),
}))

vi.mock('../../performance/onPageScrollDiagnostics', () => ({
  collectOnPageScrollPerformanceWarnings: vi.fn(() => []),
}))

vi.mock('../../../logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('createVueTransformPlugin ast engine smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readAndParseSfcMock.mockResolvedValue({
      descriptor: {
        styles: [],
      },
    })
    compileVueFileMock.mockResolvedValue({
      script: 'export default {}',
      template: '<view>{{ count }}</view>',
      meta: {},
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    collectSetDataPickKeysFromTemplateMock.mockReturnValue(['count'])
    injectSetDataPickInJsMock.mockReturnValue({
      transformed: false,
      code: 'export default {}',
    })
  })

  it('passes resolved astEngine into setData pick collection', async () => {
    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      configService: {
        isDev: false,
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        outputExtensions: {},
        relativeOutputPath: vi.fn(() => undefined),
        weappLibConfig: {
          enabled: true,
        },
        weappViteConfig: {
          ast: {
            engine: 'oxc',
          },
        },
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    const result = await plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/components/demo.vue')

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<view>{{ count }}</view>', {
      astEngine: 'oxc',
    })
    expect(result).toEqual({
      code: 'export default {}',
      map: null,
    })
  })

  it('returns a component stub for scriptless vue components', async () => {
    compileVueFileMock.mockResolvedValueOnce({
      template: '<view />',
      meta: {},
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(false)

    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      configService: {
        isDev: false,
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        outputExtensions: {},
        relativeOutputPath: vi.fn(() => undefined),
        weappLibConfig: {
          enabled: true,
        },
        weappViteConfig: {},
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    const result = await plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/components/empty-shell.vue')

    expect(result).toEqual({
      code: 'Component({})',
      map: null,
    })
    expect(readAndParseSfcMock).not.toHaveBeenCalled()
  })

  it('reports vue transform timing when debug callback is configured', async () => {
    const vueTransformTiming = vi.fn()
    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      configService: {
        isDev: false,
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        outputExtensions: {},
        relativeOutputPath: vi.fn(() => undefined),
        weappLibConfig: {
          enabled: true,
        },
        weappViteConfig: {
          debug: {
            vueTransformTiming,
          },
        },
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    await plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/components/timing.vue')

    expect(vueTransformTiming).toHaveBeenCalledTimes(1)
    expect(vueTransformTiming).toHaveBeenCalledWith(expect.objectContaining({
      id: '/project/src/components/timing.vue',
      isPage: false,
      totalMs: expect.any(Number),
      stages: expect.objectContaining({
        readSource: expect.any(Number),
        compile: expect.any(Number),
      }),
    }))
  })

  it('pre-parses sfc styles only when style blocks exist', async () => {
    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      configService: {
        isDev: false,
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        outputExtensions: {},
        relativeOutputPath: vi.fn(() => undefined),
        weappLibConfig: {
          enabled: true,
        },
        weappViteConfig: {},
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    await plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template><style>.a{}</style>', '/project/src/components/with-style.vue')

    expect(readAndParseSfcMock).toHaveBeenCalledTimes(1)
  })
})
