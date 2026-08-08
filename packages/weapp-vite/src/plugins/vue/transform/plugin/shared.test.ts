import { WEAPP_VITE_RUNTIME_VIRTUAL_IDS } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileTransformEntryResult, createTransformStageMeasurer, ensureSfcStyleBlocks, finalizeTransformCompiledResult, finalizeTransformEntryCode, finalizeTransformEntryScript, handleTransformEntryPageLayoutFlow, handleTransformLayoutInvalidation, handleTransformVueFileInvalidation, inlineTransformAutoRoutes, invalidatePageLayoutCaches, invalidateVueFileCaches, isVueLikeId, loadTransformPageEntries, loadTransformSource, loadTransformStyleBlock, logTransformFileError, mayNeedInlineAutoRoutes, mayNeedTransformPageFeatureInjection, mayNeedTransformPageScrollDiagnostics, mayNeedTransformSetDataPick, preloadNativeLayoutEntries, preloadTransformSfcStyleBlocks, registerNativeLayoutChunksForEntry, resolveTransformEntryFlags, resolveTransformFilename } from './shared'

const resolvePageLayoutPlanMock = vi.hoisted(() => vi.fn(async () => undefined))
const applyPageLayoutPlanMock = vi.hoisted(() => vi.fn())
const registerResolvedPageLayoutDependenciesMock = vi.hoisted(() => vi.fn(async () => {}))
const injectWevuPageFeaturesInJsWithViteResolverMock = vi.hoisted(() => vi.fn(async (_ctx: any, code: string) => ({
  transformed: false,
  code,
  map: null,
})))
const collectSetDataPickKeysFromTemplateMock = vi.hoisted(() => vi.fn(() => ['count']))
const injectSetDataPickInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
  map: null,
})))
const injectScopedSlotOwnerSetDataPickInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
  map: null,
})))
const injectScopedSlotHostPropertiesInJsMock = vi.hoisted(() => vi.fn((code: string) => ({
  transformed: false,
  code,
  map: null,
})))
const mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock = vi.hoisted(() => vi.fn(() => false))
const isAutoSetDataPickEnabledMock = vi.hoisted(() => vi.fn(() => false))
const mayNeedInjectSetDataPickInJsMock = vi.hoisted(() => vi.fn(() => true))
const pruneScopedSlotOwnerAutoSetDataPickKeysMock = vi.hoisted(() => vi.fn((keys: string[]) => keys.filter(key => !key.startsWith('__wv_bind_'))))
const shouldUseScopedSlotOwnerOnlySetDataPickMock = vi.hoisted(() => vi.fn(() => false))
const collectOnPageScrollPerformanceWarningsMock = vi.hoisted(() => vi.fn(() => []))
const loggerWarnMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const resolveAstEngineMock = vi.hoisted(() => vi.fn(() => 'oxc'))
const buildWeappVueStyleRequestsMock = vi.hoisted(() => vi.fn((filename: string, styleBlocks: any[]) => styleBlocks.map((_block, index) => `${filename}?style=${index}`)))
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
  registerResolvedPageLayoutDependencies: registerResolvedPageLayoutDependenciesMock,
}))

vi.mock('../injectPageFeatures', () => ({
  injectWevuPageFeaturesInJsWithViteResolver: injectWevuPageFeaturesInJsWithViteResolverMock,
}))

vi.mock('../injectSetDataPick', () => ({
  collectSetDataPickKeysFromTemplate: collectSetDataPickKeysFromTemplateMock,
  injectScopedSlotHostPropertiesInJs: injectScopedSlotHostPropertiesInJsMock,
  injectScopedSlotOwnerSetDataPickInJs: injectScopedSlotOwnerSetDataPickInJsMock,
  injectSetDataPickInJs: injectSetDataPickInJsMock,
  isAutoSetDataPickEnabled: isAutoSetDataPickEnabledMock,
  mayNeedInjectSetDataPickInJs: mayNeedInjectSetDataPickInJsMock,
  mayNeedScopedSlotHostPropertiesForSetupSlotsInJs: mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock,
  pruneScopedSlotOwnerAutoSetDataPickKeys: pruneScopedSlotOwnerAutoSetDataPickKeysMock,
  shouldUseScopedSlotOwnerOnlySetDataPick: shouldUseScopedSlotOwnerOnlySetDataPickMock,
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
  buildWeappVueStyleRequests: buildWeappVueStyleRequestsMock,
}))

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      readFile: fsReadFileMock,
    },
  }
})

describe('vue transform plugin shared helpers', () => {
  beforeEach(() => {
    resolvePageLayoutPlanMock.mockReset()
    resolvePageLayoutPlanMock.mockResolvedValue(undefined)
    applyPageLayoutPlanMock.mockReset()
    registerResolvedPageLayoutDependenciesMock.mockReset()
    registerResolvedPageLayoutDependenciesMock.mockResolvedValue(undefined)
    injectWevuPageFeaturesInJsWithViteResolverMock.mockReset()
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: false,
      code: 'Page({})',
      map: null,
    })
    collectSetDataPickKeysFromTemplateMock.mockReset()
    collectSetDataPickKeysFromTemplateMock.mockReturnValue(['count'])
    injectSetDataPickInJsMock.mockReset()
    injectSetDataPickInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
      map: null,
    }))
    injectScopedSlotOwnerSetDataPickInJsMock.mockReset()
    injectScopedSlotOwnerSetDataPickInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
      map: null,
    }))
    injectScopedSlotHostPropertiesInJsMock.mockReset()
    injectScopedSlotHostPropertiesInJsMock.mockImplementation((code: string) => ({
      transformed: false,
      code,
      map: null,
    }))
    mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock.mockReset()
    mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock.mockReturnValue(false)
    isAutoSetDataPickEnabledMock.mockReset()
    isAutoSetDataPickEnabledMock.mockReturnValue(false)
    mayNeedInjectSetDataPickInJsMock.mockReset()
    mayNeedInjectSetDataPickInJsMock.mockReturnValue(true)
    pruneScopedSlotOwnerAutoSetDataPickKeysMock.mockReset()
    pruneScopedSlotOwnerAutoSetDataPickKeysMock.mockImplementation((keys: string[]) => keys.filter(key => !key.startsWith('__wv_bind_')))
    shouldUseScopedSlotOwnerOnlySetDataPickMock.mockReset()
    shouldUseScopedSlotOwnerOnlySetDataPickMock.mockReturnValue(false)
    collectOnPageScrollPerformanceWarningsMock.mockReset()
    collectOnPageScrollPerformanceWarningsMock.mockReturnValue([])
    loggerWarnMock.mockReset()
    loggerErrorMock.mockReset()
    resolveAstEngineMock.mockReset()
    resolveAstEngineMock.mockReturnValue('oxc')
    buildWeappVueStyleRequestsMock.mockReset()
    buildWeappVueStyleRequestsMock.mockImplementation((filename: string, styleBlocks: any[]) => styleBlocks.map((_block, index) => `${filename}?style=${index}`))
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
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.source).toBe('<template />')
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.refreshToken).toBe(1)
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
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.source).toBe('<template />')
    expect(compilationCache.get('/project/src/pages/home/index.vue')?.refreshToken).toBe(1)

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

  it('resolves transform filename only for absolute paths', () => {
    const pluginCtx = {
      addWatchFile: vi.fn(),
    }

    expect(resolveTransformFilename({
      id: '/project/src/components/demo.vue',
      configService: {
        cwd: '/project',
      } as any,
      pluginCtx,
      getSourceFromVirtualId: vi.fn(id => id),
    })).toBe('/project/src/components/demo.vue')

    expect(resolveTransformFilename({
      id: 'virtual:demo',
      configService: {
        cwd: '/project',
      } as any,
      pluginCtx: {},
      getSourceFromVirtualId: vi.fn(() => 'relative/demo.vue'),
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
    expect(mayNeedTransformSetDataPick('<view a:if="visible" />', { platform: 'alipay' })).toBe(true)
    expect(mayNeedTransformPageFeatureInjection('export default { onReachBottom() {} }')).toBe(true)
    expect(mayNeedTransformPageFeatureInjection('import { defineComponent } from "wevu"; export default defineComponent({})')).toBe(true)
    for (const runtimeModuleId of Object.values(WEAPP_VITE_RUNTIME_VIRTUAL_IDS)) {
      expect(mayNeedTransformPageFeatureInjection(`import { ref } from "${runtimeModuleId}"`)).toBe(true)
    }
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
      {
        platform: undefined,
      },
    )
    expect(registerResolvedPageLayoutDependenciesMock).toHaveBeenCalledWith(
      expect.anything(),
      '/project/src/pages/home/index.vue',
      resolved.layouts,
    )
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
    expect(registerResolvedPageLayoutDependenciesMock).not.toHaveBeenCalled()
  })

  it('registers native layout dependencies for entries through shared layout flow', async () => {
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
    expect(registerResolvedPageLayoutDependenciesMock).toHaveBeenCalledTimes(1)
  })

  it('finalizes transform entry scripts through shared diagnostics and injection flow', async () => {
    collectOnPageScrollPerformanceWarningsMock.mockReturnValue(['page-scroll warning'])
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ enhanced: true })',
      map: {
        version: 3,
        names: [],
        sources: ['/project/src/pages/home/index.vue'],
        sourcesContent: ['Page({ onPageScroll() {}, onReachBottom() {} })'],
        mappings: 'AAAA',
      },
    })
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    injectSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ enhanced: true, __setDataPick: ["count"] })',
      map: {
        version: 3,
        names: [],
        sources: ['/project/src/pages/home/index.vue'],
        sourcesContent: ['Page({ enhanced: true })'],
        mappings: 'AAAA',
      },
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
    expect(injectSetDataPickInJsMock).toHaveBeenCalledWith('Page({ enhanced: true })', ['count'], { sourceMap: true })
    expect(result.script).toBe('Page({ enhanced: true, __setDataPick: ["count"] })')
  })

  it('finalizes transform entry scripts with alipay directive-prefixed templates', async () => {
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    injectSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ onReachBottom() {}, __setDataPick: ["count"] })',
      map: {
        version: 3,
        names: [],
        sources: ['/project/src/pages/home/index.vue'],
        sourcesContent: ['Page({ onReachBottom() {} })'],
        mappings: 'AAAA',
      },
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view a:if="visible" />',
        script: 'Page({ onReachBottom() {} })',
      } as any,
      filename: '/project/src/pages/home/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        platform: 'alipay',
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<view a:if="visible" />', {
      astEngine: 'oxc',
    })
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(injectSetDataPickInJsMock).toHaveBeenCalledWith('Page({ onReachBottom() {} })', ['count'], { sourceMap: true })
    expect(result.script).toBe('Page({ onReachBottom() {}, __setDataPick: ["count"] })')
  })

  it('injects scoped slot owner setDataPick even when auto pick is disabled', async () => {
    injectScopedSlotOwnerSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ __slotOwnerPick: true })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />',
        script: 'Page({})',
      } as any,
      filename: '/project/src/pages/home/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        platform: 'weapp',
        weappViteConfig: {
          wevu: {
            autoSetDataPick: false,
          },
        },
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />', {
      astEngine: 'oxc',
    })
    expect(pruneScopedSlotOwnerAutoSetDataPickKeysMock).toHaveBeenCalledWith(['count'])
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(injectScopedSlotOwnerSetDataPickInJsMock).toHaveBeenCalledWith('Page({})', ['count'], { sourceMap: true })
    expect(result.script).toBe('Page({ __slotOwnerPick: true })')
  })

  it('uses scoped slot owner setDataPick when auto pick collects too many bind keys', async () => {
    const keys = ['currentStep', ...Array.from({ length: 201 }, (_, index) => `__wv_bind_${index}`), 'formState']
    collectSetDataPickKeysFromTemplateMock.mockReturnValue(keys)
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    shouldUseScopedSlotOwnerOnlySetDataPickMock.mockReturnValue(true)
    injectScopedSlotOwnerSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ __slotOwnerPick: true })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />',
        script: 'Page({})',
      } as any,
      filename: '/project/src/pages/home/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        platform: 'weapp',
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" p0="{{__wv_bind_0}}" />', {
      astEngine: 'oxc',
    })
    expect(shouldUseScopedSlotOwnerOnlySetDataPickMock).toHaveBeenCalledWith(keys)
    expect(pruneScopedSlotOwnerAutoSetDataPickKeysMock).toHaveBeenCalledWith(keys)
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(injectScopedSlotOwnerSetDataPickInJsMock).toHaveBeenCalledWith('Page({})', ['currentStep', 'formState'], { sourceMap: true })
    expect(result.script).toBe('Page({ __slotOwnerPick: true })')
  })

  it('injects scoped slot owner setDataPick when template has only owner id binding', async () => {
    isAutoSetDataPickEnabledMock.mockReturnValue(true)
    collectSetDataPickKeysFromTemplateMock.mockReturnValue([])
    injectScopedSlotOwnerSetDataPickInJsMock.mockReturnValue({
      transformed: true,
      code: 'Page({ __slotOwnerPick: true })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" />',
        script: 'Page({})',
      } as any,
      filename: '/project/src/pages/home/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        platform: 'weapp',
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(collectSetDataPickKeysFromTemplateMock).toHaveBeenCalledWith('<SlotCell __wvSlotOwnerId="{{__wvOwnerId || \'\'}}" />', {
      astEngine: 'oxc',
    })
    expect(injectSetDataPickInJsMock).not.toHaveBeenCalled()
    expect(injectScopedSlotOwnerSetDataPickInJsMock).toHaveBeenCalledWith('Page({})', [], { sourceMap: true })
    expect(result.script).toBe('Page({ __slotOwnerPick: true })')
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

  it('injects slot presence host properties when native slot fallback uses vueSlots', async () => {
    injectScopedSlotHostPropertiesInJsMock.mockReturnValue({
      transformed: true,
      code: 'Component({ properties: { vueSlots: { type: null, value: null } } })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<block wx:if="{{vueSlots&&vueSlots.default}}"><slot /></block>',
        script: 'Component({ setup() { return {} } })',
      } as any,
      filename: '/project/src/components/PlainSlotCard/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
    })

    expect(injectScopedSlotHostPropertiesInJsMock).toHaveBeenCalledWith('Component({ setup() { return {} } })', { sourceMap: true })
    expect(result.script).toContain('vueSlots')
  })

  it('injects slot host properties when component template declares a slot outlet', async () => {
    injectScopedSlotHostPropertiesInJsMock.mockReturnValue({
      transformed: true,
      code: 'Component({ properties: { vueSlots: { type: null, value: null } } })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view><slot /></view>',
        script: 'Component({ setup() { return {} } })',
      } as any,
      filename: '/project/src/layouts/default.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
    })

    expect(injectScopedSlotHostPropertiesInJsMock).toHaveBeenCalledWith('Component({ setup() { return {} } })', { sourceMap: true })
    expect(result.script).toContain('vueSlots')
  })

  it('injects slot host properties when setup uses slots without template vueSlots fallback', async () => {
    mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock.mockReturnValue(true)
    injectScopedSlotHostPropertiesInJsMock.mockReturnValue({
      transformed: true,
      code: 'Component({ properties: { vueSlots: { type: null, value: null } } })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view><slot /></view>',
        script: 'import { useSlots } from "wevu/internal-runtime"; Component({ setup() { return { slots: useSlots() } } })',
      } as any,
      filename: '/project/src/components/SlotProbe/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
    })

    expect(mayNeedScopedSlotHostPropertiesForSetupSlotsInJsMock).toHaveBeenCalledWith(expect.stringContaining('useSlots'))
    expect(injectScopedSlotHostPropertiesInJsMock).toHaveBeenCalledWith(expect.stringContaining('useSlots'), { sourceMap: true })
    expect(result.script).toContain('vueSlots')
  })

  it('finalizes transform entry code with style imports, scriptless stubs, and dev hashes', () => {
    const output = finalizeTransformEntryCode({
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

    expect(buildWeappVueStyleRequestsMock).toHaveBeenCalledTimes(1)
    expect(output.code).toContain('import "/project/src/pages/home/index.vue?style=0";')
    expect(output.code).toContain('import "/project/src/pages/home/index.vue?style=1";')
    expect(output.code).toContain('Page({})')
    expect(output.code).toContain('__weappViteJsonMacroHash')
    expect(output.code).toContain('"json-hash"')
    expect(output.code).toContain('__weappViteDefineOptionsHash')
    expect(output.code).toContain('"define-options-hash"')
    expect(output.map).toBeTruthy()
    expect(output.map?.sources).toEqual(['index.vue'])
  })

  it('skips transform entry sourcemap generation when disabled', () => {
    const output = finalizeTransformEntryCode({
      result: {
        script: 'Page({})',
        scriptMap: {
          version: 3,
          names: [],
          sources: ['/project/src/pages/home/index.vue'],
          sourcesContent: ['Page({})'],
          mappings: 'AAAA',
        },
      } as any,
      filename: '/project/src/pages/home/index.vue',
      styleBlocks: [{ content: '.page{}' }] as any,
      isPage: true,
      isApp: false,
      isDev: true,
      sourceMap: false,
    })

    expect(output.code).toContain('import "/project/src/pages/home/index.vue?style=0";')
    expect(output.map).toBeNull()
  })

  it('passes hmr style token into transform entry style requests', () => {
    finalizeTransformEntryCode({
      result: {
        script: 'Page({})',
      } as any,
      filename: '/project/src/pages/home/index.vue',
      styleBlocks: [{ content: '.page{}' }] as any,
      isPage: true,
      isApp: false,
      isDev: true,
      hmrStyleToken: 7,
    })

    expect(buildWeappVueStyleRequestsMock).toHaveBeenCalledWith(
      '/project/src/pages/home/index.vue',
      [{ content: '.page{}' }],
      { hmrToken: 7 },
    )
  })

  it('skips resolver-based page feature injection without direct page hook hints', async () => {
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: false,
      code: 'Page({ setup() { usePageFeatureHooks() } })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view />',
        script: 'Page({ setup() { usePageFeatureHooks() } })',
      } as any,
      filename: '/project/src/pages/issue-479/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
    })

    expect(injectWevuPageFeaturesInJsWithViteResolverMock).not.toHaveBeenCalled()
    expect(collectOnPageScrollPerformanceWarningsMock).not.toHaveBeenCalled()
    expect(result.script).toBe('Page({ setup() { usePageFeatureHooks() } })')
  })

  it('can force resolver-based page feature injection for real page entries without direct page hook hints', async () => {
    injectWevuPageFeaturesInJsWithViteResolverMock.mockResolvedValue({
      transformed: true,
      code: 'Page({ setup() { usePageFeatureHooks() }, __injected: true })',
      map: null,
    })

    const result = await finalizeTransformEntryScript({
      result: {
        template: '<view />',
        script: 'Page({ setup() { usePageFeatureHooks() } })',
      } as any,
      filename: '/project/src/pages/issue-479/index.vue',
      pluginCtx: {},
      configService: {
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: true,
      isApp: false,
      forcePageFeatureInjection: true,
    })

    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(result.script).toBe('Page({ setup() { usePageFeatureHooks() }, __injected: true })')
  })

  it('returns original entry code when finalize transform entry code has nothing extra to inject', () => {
    const output = finalizeTransformEntryCode({
      result: {
        script: 'App({})',
        scriptMap: {
          version: 3,
          names: [],
          sources: ['/project/src/app.vue'],
          sourcesContent: ['App({})'],
          mappings: 'AAAA',
        },
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

    expect(buildWeappVueStyleRequestsMock).not.toHaveBeenCalled()
    expect(output.code).toBe('App({})')
    expect(output.map?.sources).toEqual(['/project/src/app.vue'])
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
        moduleGraphService: {
          replaceEntryDependencies: vi.fn(),
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
  })

  it('preloads native layout entries concurrently', async () => {
    const collectFallbackPageEntryIds = vi.fn(async () => ['pages/slow/index', 'pages/fast/index'])
    const findFirstResolvedVueLikeEntry = vi.fn(async (entryId: string) => `/project/src/${entryId}.vue`)
    const pathExists = vi.fn(async () => true)
    let releaseSlowRead!: () => void
    const slowReadStarted = new Promise<void>((resolve) => {
      releaseSlowRead = resolve
    })
    const readFile = vi.fn(async (file: string) => {
      if (file.includes('/slow/')) {
        await slowReadStarted
      }
      return '<template />'
    })
    resolvePageLayoutPlanMock.mockResolvedValue(undefined)

    const preloadTask = preloadNativeLayoutEntries({
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

    await vi.waitFor(() => {
      expect(readFile).toHaveBeenCalledWith('/project/src/pages/fast/index.vue', 'utf8')
    })

    releaseSlowRead()
    await preloadTask
    expect(readFile).toHaveBeenCalledTimes(2)
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
      ctx: {
        moduleGraphService: {
          replaceEntryDependencies: vi.fn(),
        },
      } as any,
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
      ctx: {
        moduleGraphService: {
          replaceEntryDependencies: vi.fn(),
        },
      } as any,
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

    styleBlocksCache.set('/project/src/components/card.vue', [
      { content: '.stale{}', src: 'vant/es/space/index.css' },
    ])
    readAndParseSfc.mockResolvedValueOnce({
      descriptor: {
        styles: [{ content: '.external{}', src: 'vant/es/space/index.css' }],
      },
    })
    await expect(loadTransformStyleBlock({
      id: 'virtual:style',
      pluginCtx: {},
      ctx: {
        moduleGraphService: {
          replaceEntryDependencies: vi.fn(),
        },
      } as any,
      configService: {} as any,
      styleBlocksCache,
      loadScopedSlotModule,
      scopedSlotModules: new Map(),
      parseWeappVueStyleRequest,
      readAndParseSfc,
      createReadAndParseSfcOptions,
    })).resolves.toEqual({
      code: '.external{}',
      map: null,
    })
    expect(readAndParseSfc).toHaveBeenLastCalledWith('/project/src/components/card.vue', {})
    expect(styleBlocksCache.get('/project/src/components/card.vue')).toEqual([
      { content: '.external{}', src: 'vant/es/space/index.css' },
    ])
    expect(fsReadFileMock).not.toHaveBeenCalled()

    await expect(loadTransformStyleBlock({
      id: 'virtual:none',
      pluginCtx: {},
      ctx: {} as any,
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
    const replaceEntryDependencies = vi.fn()
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
        runtimeState: {
          build: {
            hmr: {
              vueEntryHasTemplate: new Map(),
              vueEntryNonJsonSignatures: new Map(),
              vueEntryScriptSignatures: new Map(),
              vueEntryTailwindContentSignatures: new Map(),
            },
          },
        },
        moduleGraphService: {
          replaceEntryDependencies,
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
      emitScopedSlotChunks: scopedSlotEmitter,
    })).resolves.toBe(result)

    expect(registerResolvedPageLayoutDependenciesMock).toHaveBeenCalledTimes(1)
    expect(replaceEntryDependencies).toHaveBeenCalledWith(
      '/project/src/pages/home/index.vue',
      'style',
      ['/project/src/components/card.vue'],
    )
    expect(injectWevuPageFeaturesInJsWithViteResolverMock).toHaveBeenCalledTimes(1)
    expect(compilationCache.get('/project/src/pages/home/index.vue')).toEqual({
      result,
      source: '<template />',
      isPage: true,
      autoRoutesSignature: undefined,
      refreshToken: 0,
      styleIndependentSignature: undefined,
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

  it('syncs vue sfc signatures after transform compilation', async () => {
    const result = {
      script: 'Component({})',
      template: '<view />',
      meta: {},
    } as any
    const hmr = {
      vueEntryHasTemplate: new Map<string, boolean>(),
      vueEntryNonJsonSignatures: new Map<string, string>(),
      vueEntryScriptSignatures: new Map<string, string>(),
      vueEntryTailwindContentSignatures: new Map<string, string>(),
    }
    const source = '<template><view /></template><script setup>const count = 1</script>'

    await finalizeTransformCompiledResult({
      ctx: {
        runtimeState: {
          build: {
            hmr,
          },
        },
      } as any,
      pluginCtx: {},
      filename: '/project/src/components/card.vue',
      source,
      result,
      compilationCache: new Map(),
      configService: {
        outputExtensions: { js: 'js' },
        relativeOutputPath: vi.fn(() => 'components/card/index'),
        isDev: true,
        weappViteConfig: {},
      } as any,
      isPage: false,
      isApp: false,
      scopedSlotModules: new Map(),
      emittedScopedSlotChunks: new Set(),
      addWatchFile: vi.fn(),
      emitScopedSlotChunks: vi.fn(),
    })

    expect(hmr.vueEntryHasTemplate.get('/project/src/components/card.vue')).toBe(true)
    expect(hmr.vueEntryNonJsonSignatures.get('/project/src/components/card.vue')).toEqual(expect.any(String))
    expect(hmr.vueEntryScriptSignatures.get('/project/src/components/card.vue')).toEqual(expect.any(String))
    expect(hmr.vueEntryTailwindContentSignatures.get('/project/src/components/card.vue')).toEqual(expect.any(String))
  })

  it('resolves transform entry flags with page matcher creation, dirty invalidation, and app detection', async () => {
    const setPageMatcher = vi.fn()
    const setScanDirtySynced = vi.fn()
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
      scanDirtySynced: false,
      setScanDirtySynced,
      filename: '/project/src/app.vue',
    })

    expect(createPageMatcher).toHaveBeenCalledTimes(1)
    expect(createPageMatcher).toHaveBeenCalledWith(expect.objectContaining({
      srcRoot: '/project/src',
    }))
    expect(setPageMatcher).toHaveBeenCalledWith(expect.objectContaining({
      isPageFile,
      markDirty,
    }))
    expect(markDirty).toHaveBeenCalledTimes(1)
    expect(setScanDirtySynced).toHaveBeenCalledWith(true)
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

  it('matches plugin pages relative to the plugin root in plugin-only builds', async () => {
    const createPageMatcher = vi.fn(() => ({
      isPageFile: vi.fn(async () => true),
      markDirty: vi.fn(),
    }))

    const resolved = await resolveTransformEntryFlags({
      pageMatcher: null,
      setPageMatcher: vi.fn(),
      createPageMatcher,
      configService: {
        absoluteSrcRoot: '/project/miniprogram',
        absolutePluginRoot: '/project/plugin',
        pluginOnly: true,
        weappLibConfig: {
          enabled: false,
        },
      } as any,
      scanService: undefined,
      scanDirty: false,
      scanDirtySynced: false,
      setScanDirtySynced: vi.fn(),
      filename: '/project/plugin/pages/hello/index.vue',
    })

    expect(createPageMatcher).toHaveBeenCalledWith(expect.objectContaining({
      srcRoot: '/project/plugin',
    }))
    expect(resolved.isPage).toBe(true)
  })

  it('reuses existing page matcher and skips page matching in lib mode', async () => {
    const setPageMatcher = vi.fn()
    const setScanDirtySynced = vi.fn()
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
      scanDirtySynced: false,
      setScanDirtySynced,
      filename: '/project/src/pages/home/index.vue',
    })).resolves.toEqual({
      isPage: false,
      isApp: false,
      pageMatcher: existingPageMatcher,
    })

    expect(createPageMatcher).not.toHaveBeenCalled()
    expect(setPageMatcher).not.toHaveBeenCalled()
    expect(setScanDirtySynced).not.toHaveBeenCalled()
    expect(existingPageMatcher.isPageFile).not.toHaveBeenCalled()
    expect(existingPageMatcher.markDirty).not.toHaveBeenCalled()
  })

  it('avoids repeating page matcher dirty sync within the same dirty phase', async () => {
    const setPageMatcher = vi.fn()
    const setScanDirtySynced = vi.fn()
    const existingPageMatcher = {
      isPageFile: vi.fn(async () => true),
      markDirty: vi.fn(),
    }

    const resolved = await resolveTransformEntryFlags({
      pageMatcher: existingPageMatcher,
      setPageMatcher,
      createPageMatcher: vi.fn(),
      configService: {
        absoluteSrcRoot: '/project/src',
        weappLibConfig: {
          enabled: false,
        },
      } as any,
      scanService: undefined,
      scanDirty: true,
      scanDirtySynced: true,
      setScanDirtySynced,
      filename: '/project/src/pages/home/index.vue',
    })

    expect(existingPageMatcher.markDirty).not.toHaveBeenCalled()
    expect(setScanDirtySynced).not.toHaveBeenCalled()
    expect(resolved.isPage).toBe(true)
  })
})
