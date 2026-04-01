import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileTransformEntryResult, createTransformStageMeasurer, ensureSfcStyleBlocks, finalizeTransformCompiledResult, finalizeTransformEntryCode, finalizeTransformEntryScript, handleTransformEntryPageLayoutFlow, handleTransformLayoutInvalidation, handleTransformVueFileInvalidation, inlineTransformAutoRoutes, invalidatePageLayoutCaches, invalidateVueFileCaches, isVueLikeId, loadTransformPageEntries, loadTransformSource, loadTransformStyleBlock, logTransformFileError, mayNeedInlineAutoRoutes, mayNeedTransformPageFeatureInjection, mayNeedTransformPageScrollDiagnostics, mayNeedTransformSetDataPick, preloadNativeLayoutEntries, preloadTransformSfcStyleBlocks, registerNativeLayoutChunksForEntry, resolveTransformEntryFlags, resolveTransformFilename } from './shared'

const resolvePageLayoutPlanMock = vi.hoisted(() => vi.fn(async () => undefined))
const applyPageLayoutPlanMock = vi.hoisted(() => vi.fn())
const addResolvedPageLayoutWatchFilesMock = vi.hoisted(() => vi.fn(async () => {}))
const emitNativeLayoutScriptChunkIfNeededMock = vi.hoisted(() => vi.fn(async () => {}))
const injectWevuPageFeaturesInJsWithViteResolverMock = vi.hoisted(() => vi.fn(async (_ctx: any, code: string) => ({
  transformed: false,
  code,
})))
const collectSetDataPickKeysFromTemplateMock = vi.hoisted(() => vi.fn(() => ['count']))
const injectSetDataPickInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
})))
const isAutoSetDataPickEnabledMock = vi.hoisted(() => vi.fn(() => false))
const collectOnPageScrollPerformanceWarningsMock = vi.hoisted(() => vi.fn(() => []))
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const resolveAstEngineMock = vi.hoisted(() => vi.fn(() => 'oxc'))
const buildWeappVueStyleRequestMock = vi.hoisted(() => vi.fn((filename: string, _block: any, index: number) => `${filename}?style=${index}`))
const fsReadFileMock = vi.hoisted(() => vi.fn(async () => 'loaded from fs'))
const toAbsoluteIdMock = vi.hoisted(() => vi.fn((id: string) => id))

vi.mock('../pageLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pageLayout')>()
  return {
    ...actual,
    applyPageLayoutPlan: applyPageLayoutPlanMock,
    resolvePageLayoutPlan: resolvePageLayoutPlanMock,
  }
})

vi.mock('../../../utils/pageLayout', () => ({
  addResolvedPageLayoutWatchFiles: addResolvedPageLayoutWatchFilesMock,
}))

vi.mock('../bundle', () => ({
  emitNativeLayoutScriptChunkIfNeeded: emitNativeLayoutScriptChunkIfNeededMock,
}))

vi.mock('../injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: injectWevuPageFeaturesInJsWithViteResolverMock,
}))

vi.mock('../injectSetDataPick', () => ({
  collectSetDataPickKeysFromTemplate: collectSetDataPickKeysFromTemplateMock,
  injectSetDataPickInJs: injectSetDataPickInJsMock,
  isAutoSetDataPickEnabled: isAutoSetDataPickEnabledMock,
}))

vi.mock('../../../performance/onPageScrollDiagnostics', () => ({
  collectOnPageScrollPerformanceWarnings: collectOnPageScrollPerformanceWarningsMock,
}))

vi.mock('../../../../logger', () => ({
  default: {
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}))

vi.mock('../../../../ast', () => ({
  resolveAstEngine: resolveAstEngineMock,
}))

vi.mock('../../../../utils/toAbsoluteId', () => ({
  toAbsoluteId: toAbsoluteIdMock,
}))

vi.mock('../styleRequest', () => ({
  buildWeappVueStyleRequest: buildWeappVueStyleRequestMock,
}))

vi.mock('fs-extra', () => ({
  default: {
    readFile: fsReadFileMock,
  },
}))

describe('vue transform plugin shared helpers', () => {
  beforeEach(() => {
    resolvePageLayoutPlanMock.mockReset()
    resolvePageLayoutPlanMock.mockResolvedValue(undefined)
    applyPageLayoutPlanMock.mockReset()
    addResolvedPageLayoutWatchFilesMock.mockReset()
    addResolvedPageLayoutWatchFilesMock.mockResolvedValue(undefined)
    emitNativeLayoutScriptChunkIfNeededMock.mockReset()
    emitNativeLayoutScriptChunkIfNeededMock.mockResolvedValue(undefined)
    injectWevuPageFeaturesInJsWithViteResolverMock.mockReset()
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: false,
      code: 'Page({})',
    })
    collectSetDataPickKeysFromTemplateMock.mockReset()
    collectSetDataPickKeysFromTemplateMock.mockReturnValue(['count'])
    injectSetDataPickInJsMock.mockReset()
    injectSetDataPickInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
    }))
    isAutoSetDataPickEnabledMock.mockReset()
    isAutoSetDataPickEnabledMock.mockReturnValue(false)
    collectOnPageScrollPerformanceWarningsMock.mockReset()
    collectOnPageScrollPerformanceWarningsMock.mockReturnValue([])
    loggerWarnMock.mockReset()
    loggerErrorMock.mockReset()
    resolveAstEngineMock.mockReset()
    resolveAstEngineMock.mockReturnValue('oxc')
    buildWeappVueStyleRequestMock.mockReset()
    buildWeappVueStyleRequestMock.mockImplementation((filename: string, _block: any, index: number) => `${filename}?style=${index}`)
    fsReadFileMock.mockReset()
    fsReadFileMock.mockResolvedValue('loaded from fs')
    toAbsoluteIdMock.mockReset()
    toAbsoluteIdMock.mockImplementation((id: string) => id)
  })

  it('detects vue-like ids', () => {
    expect(isVueLikeId('/project/src/pages/home/index.vue')).toBe(true)
    expect(isVueLikeId('/project/src/pages/home/index.jsx')).toBe(true)
    expect(isVueLikeId('/project/src/pages/home/index.tsx')).toBe(true)
    expect(isVueLikeId('/project/src/pages/home/index.ts')).toBe(false)
  })

  it('invalidates page layout related caches for page entries', () => {
    const compilationCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', { isPage: true, source: '<template />', result: {} }],
      ['/project/src/components/card.vue', { isPage: false, source: '<template />', result: {} }],
    ])
    const styleBlocksCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', []],
      ['/project/src/components/card.vue', []],
    ])

    invalidatePageLayoutCaches(
      {
        absoluteSrcRoot: '/project/src',
      } as any,
      compilationCache,
      styleBlocksCache,
    )

    expect(compilationCache.get('/project/src/pages/home/index.vue')?.source).toBeUndefined()
    expect(compilationCache.get('/project/src/components/card.vue')?.source).toBe('<template />')
    expect(styleBlocksCache.size).toBe(0)
  })

  it('invalidates single vue file caches based on file existence', () => {
    const compilationCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', { isPage: true, source: '<template />', result: {} }],
      ['/project/src/components/card.vue', { isPage: false, source: '<template />', result: {} }],
    ])
    const styleBlocksCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', []],
      ['/project/src/components/card.vue', []],
    ])

    invalidateVueFileCaches(
      '/project/src/pages/home/index.vue',
      compilationCache,
      styleBlocksCache,
      {
        existsSync: vi.fn(() => true),
      },
    )
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.source).toBeUndefined()
    expect(styleBlocksCache.has('/project/src/pages/home/index.vue')).toBe(false)

    invalidateVueFileCaches(
      '/project/src/components/card.vue',
      compilationCache,
      styleBlocksCache,
      {
        existsSync: vi.fn(() => false),
      },
    )
    expect(compilationCache.has('/project/src/components/card.vue')).toBe(false)
    expect(styleBlocksCache.has('/project/src/components/card.vue')).toBe(false)
  })

  it('handles transform layout invalidation only for layout files with config service', () => {
    const compilationCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', { isPage: true, source: '<template />', result: {} }],
    ])
    const styleBlocksCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', []],
    ])
    const invalidateLayouts = vi.fn()
    const isLayoutFile = vi.fn((file: string) => file.endsWith('layout.vue'))

    expect(handleTransformLayoutInvalidation('/project/src/layouts/default/layout.vue', {
      configService: {
        absoluteSrcRoot: '/project/src',
      } as any,
      compilationCache,
      styleBlocksCache,
      isLayoutFile,
      invalidateResolvedPageLayoutsCache: invalidateLayouts,
    })).toBe(true)

    expect(invalidateLayouts).toHaveBeenCalledWith('/project/src')
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.source).toBeUndefined()

    expect(handleTransformLayoutInvalidation('/project/src/pages/home/index.vue', {
      configService: {
        absoluteSrcRoot: '/project/src',
      } as any,
      compilationCache,
      styleBlocksCache,
      isLayoutFile,
      invalidateResolvedPageLayoutsCache: invalidateLayouts,
    })).toBe(false)
  })

  it('handles transform vue file invalidation only for vue-like files', () => {
    const compilationCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', { isPage: true, source: '<template />', result: {} }],
    ])
    const styleBlocksCache = new Map<string, any>([
      ['/project/src/pages/home/index.vue', []],
    ])
    const existsSync = vi.fn(() => true)

    expect(handleTransformVueFileInvalidation('/project/src/pages/home/index.vue', {
      compilationCache,
      styleBlocksCache,
      existsSync,
    })).toBe(true)
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.source).toBeUndefined()

    expect(handleTransformVueFileInvalidation('/project/src/pages/home/index.ts', {
      compilationCache,
      styleBlocksCache,
      existsSync,
    })).toBe(false)
  })

  it('loads and caches sfc style blocks', async () => {
    const styleBlocksCache = new Map<string, any>()
    const load = vi.fn(async () => [{ content: '.card{}' }])

    const first = await ensureSfcStyleBlocks('/project/src/components/card.vue', styleBlocksCache, {
      load,
    })
    const second = await ensureSfcStyleBlocks('/project/src/components/card.vue', styleBlocksCache, {
      load,
    })

    expect(first).toEqual([{ content: '.card{}' }])
    expect(second).toBe(first)
    expect(styleBlocksCache.get('/project/src/components/card.vue')).toBe(first)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('loads transform source from inline code, cache, or fs based on mode', async () => {
    const readFileCached = vi.fn(async () => 'loaded from cache')

    await expect(loadTransformSource({
      code: '<template />',
      filename: '/project/src/components/card.vue',
      isDev: true,
      readFileCached,
    })).resolves.toBe('<template />')

    await expect(loadTransformSource({
      code: undefined as any,
      filename: '/project/src/components/card.vue',
      isDev: true,
      readFileCached,
    })).resolves.toBe('loaded from cache')

    await expect(loadTransformSource({
      code: undefined as any,
      filename: '/project/src/components/card.vue',
      isDev: false,
      readFileCached,
    })).resolves.toBe('loaded from fs')

    expect(readFileCached).toHaveBeenCalledTimes(1)
    expect(fsReadFileMock).toHaveBeenCalledWith('/project/src/components/card.vue', 'utf-8')
  })

  it('creates transform stage measurer that records optional timing callbacks', async () => {
    const vueTransformTiming = vi.fn()
    const { measureStage, reportTiming } = createTransformStageMeasurer(vueTransformTiming)

    await expect(measureStage('compile', async () => 'done')).resolves.toBe('done')
    reportTiming('/project/src/components/demo.vue', false)

    expect(vueTransformTiming).toHaveBeenCalledWith(expect.objectContaining({
      id: '/project/src/components/demo.vue',
      isPage: false,
      totalMs: expect.any(Number),
      stages: expect.objectContaining({
        compile: expect.any(Number),
      }),
    }))
  })

  it('resolves transform filename only for absolute paths and registers watch files when supported', () => {
    const pluginCtx = {
      addWatchFile: vi.fn(),
    }
    const addWatchFile = vi.fn()

    expect(resolveTransformFilename({
      id: '/project/src/components/demo.vue',
      configService: {
        cwd: '/project',
      } as any,
      pluginCtx,
      getSourceFromVirtualId: vi.fn(id => id),
      addWatchFile,
    })).toBe('/project/src/components/demo.vue')

    expect(addWatchFile).toHaveBeenCalledWith(pluginCtx, '/project/src/components/demo.vue')

    expect(resolveTransformFilename({
      id: 'virtual:demo',
      configService: {
        cwd: '/project',
      } as any,
      pluginCtx: {},
      getSourceFromVirtualId: vi.fn(() => 'relative/demo.vue'),
      addWatchFile,
    })).toBeNull()
  })

  it('loads transform page entries from scan service and falls back when scan service is missing', async () => {
    await expect(loadTransformPageEntries(undefined)).resolves.toEqual({
      pages: [],
      subPackages: [],
      pluginPages: [],
    })

    await expect(loadTransformPageEntries({
      loadAppEntry: vi.fn(async () => ({
        json: {
          pages: ['pages/home/index'],
        },
      })),
      loadSubPackages: vi.fn(() => [
        {
          subPackage: {
            root: 'pkg',
            pages: ['detail/index'],
          },
        },
      ]),
      pluginJson: {
        pages: {
          settings: 'plugin/pages/settings/index',
        },
      },
    } as any)).resolves.toEqual({
      pages: ['pages/home/index'],
      subPackages: [{ root: 'pkg', pages: ['detail/index'] }],
      pluginPages: ['plugin/pages/settings/index'],
    })
  })

  it('preloads transform sfc style blocks only for vue files with style content and ignores parse failures', async () => {
    const styleBlocksCache = new Map<string, any>()
    const load = vi.fn(async () => [{ content: '.card{}' }])

    await expect(preloadTransformSfcStyleBlocks({
      filename: '/project/src/components/card.vue',
      source: '<template /><style>.card{}</style>',
      styleBlocksCache,
      load,
    })).resolves.toEqual([{ content: '.card{}' }])

    await expect(preloadTransformSfcStyleBlocks({
      filename: '/project/src/components/card.vue',
      source: '<template />',
      styleBlocksCache,
      load,
    })).resolves.toBeUndefined()

    load.mockRejectedValueOnce(new Error('parse failed'))
    await expect(preloadTransformSfcStyleBlocks({
      filename: '/project/src/components/broken.vue',
      source: '<template /><style>.broken{}</style>',
      styleBlocksCache,
      load,
    })).resolves.toBeUndefined()

    expect(load).toHaveBeenCalledTimes(2)
  })

  it('compiles transform entries with vue or jsx compiler based on filename', async () => {
    const compileVueFile = vi.fn(async () => ({ script: 'vue result' }))
    const compileJsxFile = vi.fn(async () => ({ script: 'jsx result' }))

    await expect(compileTransformEntryResult({
      transformedSource: '<template />',
      filename: '/project/src/components/demo.vue',
      compileOptions: { mode: 'vue' },
      compileVueFile,
      compileJsxFile,
    })).resolves.toEqual({ script: 'vue result' })

    await expect(compileTransformEntryResult({
      transformedSource: 'export default () => null',
      filename: '/project/src/components/demo.jsx',
      compileOptions: { mode: 'jsx' },
      compileVueFile,
      compileJsxFile,
    })).resolves.toEqual({ script: 'jsx result' })

    expect(compileVueFile).toHaveBeenCalledTimes(1)
    expect(compileJsxFile).toHaveBeenCalledTimes(1)
  })

  it('detects transform script post-process hints', () => {
    expect(mayNeedTransformSetDataPick('<view>{{ count }}</view>')).toBe(true)
    expect(mayNeedTransformSetDataPick('<view />')).toBe(false)
    expect(mayNeedTransformPageFeatureInjection('export default { onReachBottom() {} }')).toBe(true)
    expect(mayNeedTransformPageFeatureInjection('export default {}')).toBe(false)
    expect(mayNeedTransformPageScrollDiagnostics('export default { onPageScroll() {} }')).toBe(true)
    expect(mayNeedTransformPageScrollDiagnostics('export default {}')).toBe(false)
    expect(mayNeedInlineAutoRoutes('import routes from "weapp-vite/auto-routes"')).toBe(true)
    expect(mayNeedInlineAutoRoutes('await import("virtual:weapp-vite-auto-routes")')).toBe(true)
    expect(mayNeedInlineAutoRoutes('const routes = []')).toBe(false)
  })

  it('handles transform entry page layout flow through resolve, apply, watch, and native chunk emission', async () => {
    const result = { template: '<view />' } as any
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [
        { kind: 'native', file: '/project/src/layouts/default' },
        { kind: 'vue', file: '/project/src/layouts/fallback.vue' },
      ],
    })

    const resolved = await handleTransformEntryPageLayoutFlow({
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        configService: {
          outputExtensions: { js: 'js' },
        },
      } as any,
      filename: '/project/src/pages/home/index.vue',
      source: '<view />',
      result,
    })

    expect(resolved).toEqual({
      layouts: [
        { kind: 'native', file: '/project/src/layouts/default' },
        { kind: 'vue', file: '/project/src/layouts/fallback.vue' },
      ],
    })
    expect(applyPageLayoutPlanMock).toHaveBeenCalledWith(
      result,
      '/project/src/pages/home/index.vue',
      resolved,
    )
    expect(addResolvedPageLayoutWatchFilesMock).toHaveBeenCalledWith(
      expect.anything(),
      resolved.layouts,
    )
    expect(emitNativeLayoutScriptChunkIfNeededMock).toHaveBeenCalledTimes(1)
    expect(emitNativeLayoutScriptChunkIfNeededMock).toHaveBeenCalledWith({
      pluginCtx: expect.anything(),
      layoutBasePath: '/project/src/layouts/default',
      configService: { outputExtensions: { js: 'js' } },
      outputExtensions: { js: 'js' },
    })
  })

  it('returns early from transform entry page layout flow when config service or layout plan is missing', async () => {
    await expect(handleTransformEntryPageLayoutFlow({
      pluginCtx: {},
      ctx: {} as any,
      filename: '/project/src/pages/home/index.vue',
      source: '<view />',
    })).resolves.toBeUndefined()

    await expect(handleTransformEntryPageLayoutFlow({
      pluginCtx: {},
      ctx: {
        configService: {},
      } as any,
      filename: '/project/src/pages/home/index.vue',
      source: '<view />',
    })).resolves.toBeUndefined()

    expect(applyPageLayoutPlanMock).not.toHaveBeenCalled()
    expect(addResolvedPageLayoutWatchFilesMock).not.toHaveBeenCalled()
    expect(emitNativeLayoutScriptChunkIfNeededMock).not.toHaveBeenCalled()
  })

  it('registers native layout chunks for entries through shared layout flow', async () => {
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [
        { kind: 'native', file: '/project/src/layouts/default' },
      ],
    })

    await registerNativeLayoutChunksForEntry(
      { emitFile: vi.fn() },
      {
        configService: {
          outputExtensions: { js: 'js' },
        },
      } as any,
      '/project/src/pages/home/index.vue',
      '<view />',
    )

    expect(applyPageLayoutPlanMock).not.toHaveBeenCalled()
    expect(addResolvedPageLayoutWatchFilesMock).toHaveBeenCalledTimes(1)
    expect(emitNativeLayoutScriptChunkIfNeededMock).toHaveBeenCalledTimes(1)
  })

  it('finalizes transform entry scripts through shared diagnostics and injection flow', async () => {
    collectOnPageScrollPerformanceWarningsMock.mockReturnValue(['page-scroll warning'])
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ enhanced: true })',
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    injectSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ enhanced: true, __setDataPick: ["count"] })',
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view>{{ count }}</view>',
        script: 'Page({ onPageScroll() {}, onReachBottom() {} })',
      } as any,
      filename: '/project/src/pages/home/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(collectOnPageScrollPerformanceWarningsMock).toHaveBeenCalledTimes(1)
    expect(loggerWarnMock).toHaveBeenCalledWith('page-scroll warning')
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<view>{{ count }}</view>', {
      astEngine: 'oxc',
    })
    expect(injectSetDataPickInJsMock).toHaveBeenCalledWith('Page({ enhanced: true })', ['count'])
    expect(result.script).toBe('Page({ enhanced: true, __setDataPick: ["count"] })')
  })

  it('skips transform entry script finalize side effects when conditions are not met', async () => {
    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view />',
        script: 'App({})',
      } as any,
      filename: '/project/src/app.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: true,
    })

    expect(collectOnPageScrollPerformanceWarningsMock).not.toHaveBeenCalled()
    expect(loggerWarnMock).not.toHaveBeenCalled()
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).not.toHaveBeenCalled()
    expect(collectSetDataPickKeysFromTemplateMock).not.toHaveBeenCalled()
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(result.script).toBe('App({})')
  })

  it('finalizes transform entry code with style imports, scriptless stubs, and dev hashes', () => {
    const code = finalizeTransformEntryCode({
      result: {
        script: '',
        meta: {
          jsonMacroHash: 'json-hash',
          defineOptionsHash: 'define-options-hash',
        },
      } as any,
      filename: '/project/src/pages/home/index.vue',
      styleBlocks: [{ content: '.page{}' }, { content: '.more{}' }] as any,
      isPage: true,
      isApp: false,
      isDev: true,
    })

    expect(buildWeappVueStyleRequestMock).toHaveBeenCalledTimes(2)
    expect(code).toContain('import "/project/src/pages/home/index.vue?style=0";')
    expect(code).toContain('import "/project/src/pages/home/index.vue?style=1";')
    expect(code).toContain('Page({})')
    expect(code).toContain('__weappViteJsonMacroHash')
    expect(code).toContain('"json-hash"')
    expect(code).toContain('__weappViteDefineOptionsHash')
    expect(code).toContain('"define-options-hash"')
  })

  it('returns original entry code when finalize transform entry code has nothing extra to inject', () => {
    const code = finalizeTransformEntryCode({
      result: {
        script: 'App({})',
        meta: {
          jsonMacroHash: 'json-hash',
          defineOptionsHash: 'define-options-hash',
        },
      } as any,
      filename: '/project/src/app.vue',
      isPage: false,
      isApp: true,
      isDev: false,
    })

    expect(buildWeappVueStyleRequestMock).not.toHaveBeenCalled()
    expect(code).toBe('App({})')
  })

  it('inlines auto routes imports and dynamic imports through shared helper', async () => {
    const ensureFresh = vi.fn(async () => {})
    const getReference = vi.fn(() => ({
      pages: ['pages/home/index'],
      entries: [{ path: '/project/src/pages/home/index.vue' }],
      subPackages: [{ root: 'pkg', pages: ['detail/index'] }],
    }))

    const code = await inlineTransformAutoRoutes({
      source: `
import routes from "weapp-vite/auto-routes"
const promise = import("virtual:weapp-vite-auto-routes")
console.log(routes, promise)
      `.trim(),
      autoRoutesService: {
        ensureFresh,
        getReference,
      },
    })

    expect(ensureFresh).toHaveBeenCalledTimes(1)
    expect(getReference).toHaveBeenCalledTimes(1)
    expect(code).toContain('const routes = {"pages":["pages/home/index"],"entries":[{"path":"/project/src/pages/home/index.vue"}],"subPackages":[{"root":"pkg","pages":["detail/index"]}]};')
    expect(code).toContain('Promise.resolve({"pages":["pages/home/index"],"entries":[{"path":"/project/src/pages/home/index.vue"}],"subPackages":[{"root":"pkg","pages":["detail/index"]}]})')
  })

  it('inlines named auto routes imports through shared helper', async () => {
    const ensureFresh = vi.fn(async () => {})
    const getReference = vi.fn(() => ({
      pages: ['pages/home/index'],
      entries: [{ path: '/project/src/pages/home/index.vue' }],
      subPackages: [{ root: 'pkg', pages: ['detail/index'] }],
    }))

    const code = await inlineTransformAutoRoutes({
      source: `
import { pages, subPackages as routeSubPackages } from "weapp-vite/auto-routes"
console.log(pages, routeSubPackages)
      `.trim(),
      autoRoutesService: {
        ensureFresh,
        getReference,
      },
    })

    expect(ensureFresh).toHaveBeenCalledTimes(1)
    expect(getReference).toHaveBeenCalledTimes(1)
    expect(code).toContain('const { pages, subPackages: routeSubPackages } = {"pages":["pages/home/index"],"entries":[{"path":"/project/src/pages/home/index.vue"}],"subPackages":[{"root":"pkg","pages":["detail/index"]}]};')
  })

  it('skips auto routes inline work when source does not reference auto routes', async () => {
    const ensureFresh = vi.fn(async () => {})
    const getReference = vi.fn()
    const source = 'const routes = []'

    await expect(inlineTransformAutoRoutes({
      source,
      autoRoutesService: {
        ensureFresh,
        getReference,
      },
    })).resolves.toBe(source)

    expect(ensureFresh).not.toHaveBeenCalled()
    expect(getReference).not.toHaveBeenCalled()
  })

  it('logs transform file errors with normalized messages', () => {
    logTransformFileError('/project/src/components/demo.vue', new Error('compile failed'))
    logTransformFileError('/project/src/components/demo.vue', 'plain failure')

    expect(loggerErrorMock).toHaveBeenNthCalledWith(1, '[Vue 编译] 编译 /project/src/components/demo.vue 失败：compile failed')
    expect(loggerErrorMock).toHaveBeenNthCalledWith(2, '[Vue 编译] 编译 /project/src/components/demo.vue 失败：plain failure')
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('preloads native layout entries through resolved fallback pages and ignores preload failures', async () => {
    const collectFallbackPageEntryIds = vi.fn(async () => ['pages/home/index', 'pages/missing/index'])
    const findFirstResolvedVueLikeEntry = vi.fn(async (entryId: string) => entryId === 'pages/home/index'
      ? '/project/src/pages/home/index.vue'
      : undefined)
    const pathExists = vi.fn(async () => true)
    const readFile = vi.fn(async () => '<template />')
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [
        { kind: 'native', file: '/project/src/layouts/default' },
      ],
    })

    await preloadNativeLayoutEntries({
      pluginCtx: { emitFile: vi.fn() },
      ctx: {
        configService: {
          outputExtensions: { js: 'js' },
        },
      } as any,
      configService: {
        outputExtensions: { js: 'js' },
      } as any,
      scanService: {} as any,
      collectFallbackPageEntryIds,
      findFirstResolvedVueLikeEntry,
      pathExists,
      readFile,
    })

    expect(collectFallbackPageEntryIds).toHaveBeenCalledTimes(1)
    expect(findFirstResolvedVueLikeEntry).toHaveBeenCalledTimes(2)
    expect(readFile).toHaveBeenCalledWith('/project/src/pages/home/index.vue', 'utf8')
    expect(emitNativeLayoutScriptChunkIfNeededMock).toHaveBeenCalledTimes(1)
  })

  it('loads transform style blocks from scoped slot, parsed style requests, and fallback null branches', async () => {
    const styleBlocksCache = new Map<string, any>()
    const loadScopedSlotModule = vi.fn((id: string) => id === 'virtual:scoped-slot' ? 'scoped slot module' : null)
    const parseWeappVueStyleRequest = vi.fn((id: string) => id === 'virtual:style'
      ? { filename: '/project/src/components/card.vue', index: 0 }
      : null)
    const readAndParseSfc = vi.fn(async () => ({
      descriptor: {
        styles: [{ content: '.card{}' }],
      },
    }))
    const createReadAndParseSfcOptions = vi.fn(() => ({}))

    await expect(loadTransformStyleBlock({
      id: 'virtual:scoped-slot',
      pluginCtx: {},
      configService: {} as any,
      styleBlocksCache,
      loadScopedSlotModule,
      scopedSlotModules: new Map(),
      parseWeappVueStyleRequest,
      readAndParseSfc,
      createReadAndParseSfcOptions,
    })).resolves.toBe('scoped slot module')

    await expect(loadTransformStyleBlock({
      id: 'virtual:style',
      pluginCtx: {},
      configService: {} as any,
      styleBlocksCache,
      loadScopedSlotModule,
      scopedSlotModules: new Map(),
      parseWeappVueStyleRequest,
      readAndParseSfc,
      createReadAndParseSfcOptions,
    })).resolves.toEqual({
      code: '.card{}',
      map: null,
    })

    await expect(loadTransformStyleBlock({
      id: 'virtual:none',
      pluginCtx: {},
      configService: {} as any,
      styleBlocksCache,
      loadScopedSlotModule,
      scopedSlotModules: new Map(),
      parseWeappVueStyleRequest,
      readAndParseSfc,
      createReadAndParseSfcOptions,
    })).resolves.toBeNull()
  })

  it('finalizes compiled transform results through layout, watch deps, script finalize, cache, and scoped slots', async () => {
    const pluginCtx = {
      addWatchFile: vi.fn(),
    }
    const result = {
      template: '<view />',
      script: 'Page({ onReachBottom() {} })',
      meta: {
        sfcSrcDeps: ['/project/src/components/card.vue'],
      },
    } as any
    const compilationCache = new Map<string, any>()
    const scopedSlotEmitter = vi.fn()
    const addWatchFile = vi.fn()
    resolvePageLayoutPlanMock.mockResolvedValue({
      layouts: [
        { kind: 'native', file: '/project/src/layouts/default' },
      ],
    })

    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ enhanced: true })',
    })

    await expect(finalizeTransformCompiledResult({
      ctx: {
        configService: {
          outputExtensions: { js: 'js' },
          relativeOutputPath: vi.fn(() => 'pages/home/index'),
          isDev: true,
          weappViteConfig: {},
        },
      } as any,
      pluginCtx,
      filename: '/project/src/pages/home/index.vue',
      source: '<template />',
      result,
      compilationCache,
      configService: {
        outputExtensions: { js: 'js' },
        relativeOutputPath: vi.fn(() => 'pages/home/index'),
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
      scopedSlotModules: new Map(),
      emittedScopedSlotChunks: new Set(),
      addWatchFile,
      emitScopedSlotChunks: scopedSlotEmitter,
    })).resolves.toBe(result)

    expect(addResolvedPageLayoutWatchFilesMock).toHaveBeenCalledTimes(1)
    expect(addWatchFile).toHaveBeenCalledWith(pluginCtx, '/project/src/components/card.vue')
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(compilationCache.get('/project/src/pages/home/index.vue')).toEqual({
      result,
      source: '<template />',
      isPage: true,
    })
    expect(scopedSlotEmitter).toHaveBeenCalledWith(
      pluginCtx,
      'pages/home/index',
      result,
      expect.any(Map),
      expect.any(Set),
      { js: 'js' },
    )
  })

  it('resolves transform entry flags with page matcher creation, dirty invalidation, and app detection', async () => {
    const setPageMatcher = vi.fn()
    const isPageFile = vi.fn(async () => true)
    const markDirty = vi.fn()
    const createPageMatcher = vi.fn(() => ({
      isPageFile,
      markDirty,
    }))

    const resolved = await resolveTransformEntryFlags({
      pageMatcher: null,
      setPageMatcher,
      createPageMatcher,
      configService: {
        absoluteSrcRoot: '/project/src',
        weappLibConfig: {
          enabled: false,
        },
      } as any,
      scanService: {
        loadAppEntry: vi.fn(async () => ({
          json: {
            pages: ['pages/home/index'],
          },
        })),
        loadSubPackages: vi.fn(() => []),
        pluginJson: undefined,
      } as any,
      scanDirty: true,
      filename: '/project/src/app.vue',
    })

    expect(createPageMatcher).toHaveBeenCalledTimes(1)
    expect(setPageMatcher).toHaveBeenCalledWith(expect.objectContaining({
      isPageFile,
      markDirty,
    }))
    expect(markDirty).toHaveBeenCalledTimes(1)
    expect(isPageFile).toHaveBeenCalledWith('/project/src/app.vue')
    expect(resolved).toEqual({
      isPage: true,
      isApp: true,
      pageMatcher: expect.objectContaining({
        isPageFile,
        markDirty,
      }),
    })
  })

  it('reuses existing page matcher and skips page matching in lib mode', async () => {
    const setPageMatcher = vi.fn()
    const existingPageMatcher = {
      isPageFile: vi.fn(async () => false),
      markDirty: vi.fn(),
    }
    const createPageMatcher = vi.fn()

    await expect(resolveTransformEntryFlags({
      pageMatcher: existingPageMatcher,
      setPageMatcher,
      createPageMatcher,
      configService: {
        absoluteSrcRoot: '/project/src',
        weappLibConfig: {
          enabled: true,
        },
      } as any,
      scanService: undefined,
      scanDirty: false,
      filename: '/project/src/pages/home/index.vue',
    })).resolves.toEqual({
      isPage: false,
      isApp: false,
      pageMatcher: existingPageMatcher,
    })

    expect(createPageMatcher).not.toHaveBeenCalled()
    expect(setPageMatcher).not.toHaveBeenCalled()
    expect(existingPageMatcher.isPageFile).not.toHaveBeenCalled()
    expect(existingPageMatcher.markDirty).not.toHaveBeenCalled()
  })
})
