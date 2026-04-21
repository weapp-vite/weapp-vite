import { beforeEach, describe, expect, it, vi } from 'vitest'

const compileVueFileMock = vi.hoisted(() => vi.fn())
const compileJsxFileMock = vi.hoisted(() => vi.fn())
const collectSetDataPickKeysFromTemplateMock = vi.hoisted(() => vi.fn())
const injectSetDataPickInJsMock = vi.hoisted(() => vi.fn())
const isAutoSetDataPickEnabledMock = vi.hoisted(() => vi.fn())
const createCompileVueFileOptionsMock = vi.hoisted(() => vi.fn(() => ({ mock: true })))
const readAndParseSfcMock = vi.hoisted(() => vi.fn())
const createReadAndParseSfcOptionsMock = vi.hoisted(() => vi.fn((_pluginCtx: any, _configService: any, options?: any) => ({
  source: options?.source,
  checkMtime: options?.checkMtime ?? false,
  resolveSrc: {
    resolveId: vi.fn(),
    checkMtime: false,
  },
})))
const injectWevuPageFeaturesInJsWithViteResolverMock = vi.hoisted(() => vi.fn(async (_ctx: any, code: string) => ({
  transformed: false,
  code,
})))
const collectOnPageScrollPerformanceWarningsMock = vi.hoisted(() => vi.fn(() => []))
const pageMatcherIsPageFileMock = vi.hoisted(() => vi.fn(async () => false))
const pageMatcherMarkDirtyMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const toAbsoluteIdMock = vi.hoisted(() => vi.fn((id: string) => id))

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
  createReadAndParseSfcOptions: createReadAndParseSfcOptionsMock,
  readAndParseSfc: readAndParseSfcMock,
}))

vi.mock('../../wevu', () => ({
  createPageEntryMatcher: vi.fn(() => ({
    isPageFile: pageMatcherIsPageFileMock,
    markDirty: pageMatcherMarkDirtyMock,
  })),
}))

vi.mock('../resolver', () => ({
  getSourceFromVirtualId: vi.fn((id: string) => id),
}))

vi.mock('../../../utils/toAbsoluteId', () => ({
  toAbsoluteId: toAbsoluteIdMock,
}))

vi.mock('../../../utils/path', () => ({
  normalizeWatchPath: vi.fn((id: string) => id),
  toPosixPath: vi.fn((id: string) => id),
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
  injectWevuPageFeaturesInJsWithViteResolver: injectWevuPageFeaturesInJsWithViteResolverMock,
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
  collectOnPageScrollPerformanceWarnings: collectOnPageScrollPerformanceWarningsMock,
}))

vi.mock('../../../logger', () => ({
  default: {
    warn: vi.fn(),
    error: loggerErrorMock,
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
    injectWevuPageFeaturesInJsWithViteResolverMock.mockClear()
    collectOnPageScrollPerformanceWarningsMock.mockClear()
    pageMatcherIsPageFileMock.mockReset()
    pageMatcherIsPageFileMock.mockResolvedValue(false)
    pageMatcherMarkDirtyMock.mockReset()
    loggerErrorMock.mockReset()
    toAbsoluteIdMock.mockReset()
    toAbsoluteIdMock.mockImplementation((id: string) => id)
  })

  it('returns null when config service is missing', async () => {
    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    await expect(plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/components/demo.vue')).resolves.toBeNull()
  })

  it('returns null when resolved filename is not absolute', async () => {
    toAbsoluteIdMock.mockReturnValueOnce('relative/demo.vue')

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

    await expect(plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/components/demo.vue')).resolves.toBeNull()
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

    expect(result).toMatchObject({
      code: 'Component({})',
    })
    expect(result?.map).toBeTruthy()
    expect(result?.map?.sources).toEqual(['empty-shell.vue'])
    expect(readAndParseSfcMock).not.toHaveBeenCalled()
    expect(collectSetDataPickKeysFromTemplateMock).not.toHaveBeenCalled()
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

  it('skips setData pick collection for static templates', async () => {
    compileVueFileMock.mockResolvedValueOnce({
      script: 'export default {}',
      template: '<view>static</view>',
      meta: {},
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(true)

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
    } as any, '<template><view>static</view></template>', '/project/src/components/static-only.vue')

    expect(collectSetDataPickKeysFromTemplateMock).not.toHaveBeenCalled()
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
  })

  it('still runs page feature injection for pages without direct page hook hints', async () => {
    compileVueFileMock.mockResolvedValueOnce({
      script: 'export default { setup() { const count = 1; return { count } } }',
      template: '<view>{{ count }}</view>',
      meta: {},
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(false)
    pageMatcherIsPageFileMock.mockResolvedValue(true)

    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      configService: {
        isDev: false,
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        outputExtensions: {},
        relativeOutputPath: vi.fn(() => undefined),
        weappLibConfig: {
          enabled: false,
        },
        weappViteConfig: {},
      },
      scanService: {
        loadAppEntry: vi.fn(async () => ({
          json: {
            pages: ['pages/home/index'],
          },
        })),
        loadSubPackages: vi.fn(() => []),
        pluginJson: undefined,
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    await plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view>{{ count }}</view></template>', '/project/src/pages/home/index.vue')

    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(collectOnPageScrollPerformanceWarningsMock).not.toHaveBeenCalled()
  })

  it('runs page scroll diagnostics only when onPageScroll hint exists', async () => {
    compileVueFileMock.mockResolvedValueOnce({
      script: 'export default { methods: { onPageScroll() {} } }',
      template: '<view />',
      meta: {},
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(false)
    pageMatcherIsPageFileMock.mockResolvedValue(true)

    const { createVueTransformPlugin } = await import('./plugin')
    const plugin = createVueTransformPlugin({
      configService: {
        isDev: false,
        cwd: '/project',
        absoluteSrcRoot: '/project/src',
        outputExtensions: {},
        relativeOutputPath: vi.fn(() => undefined),
        weappLibConfig: {
          enabled: false,
        },
        weappViteConfig: {},
      },
      scanService: {
        loadAppEntry: vi.fn(async () => ({
          json: {
            pages: ['pages/home/index'],
          },
        })),
        loadSubPackages: vi.fn(() => []),
        pluginJson: undefined,
      },
      runtimeState: {
        scan: {
          isDirty: false,
        },
      },
    } as any)

    await plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/pages/home/index.vue')

    expect(collectOnPageScrollPerformanceWarningsMock).toHaveBeenCalledTimes(1)
  })

  it('logs and rethrows transform errors when compilation fails', async () => {
    compileVueFileMock.mockRejectedValueOnce(new Error('compile exploded'))

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

    await expect(plugin.transform!.call({
      addWatchFile: vi.fn(),
    } as any, '<template><view /></template>', '/project/src/components/demo.vue')).rejects.toThrow('compile exploded')

    expect(loggerErrorMock).toHaveBeenCalledWith('[Vue 编译] 编译 /project/src/components/demo.vue 失败：compile exploded')
  })
})
