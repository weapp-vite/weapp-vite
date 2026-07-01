import { beforeEach, describe, expect, it, vi } from 'vitest'

const preloadNativeLayoutEntriesMock = vi.hoisted(() => vi.fn(async () => {}))
const loadTransformStyleBlockMock = vi.hoisted(() => vi.fn(async () => null))
const handleTransformLayoutInvalidationMock = vi.hoisted(() => vi.fn(() => false))
const handleTransformVueFileInvalidationMock = vi.hoisted(() => vi.fn(() => false))
const isVueLikeIdMock = vi.hoisted(() => vi.fn(() => true))
const transformVueLikeFileMock = vi.hoisted(() => vi.fn(async () => ({ code: 'transformed', map: null })))
const emitVueBundleAssetsMock = vi.hoisted(() => vi.fn(async () => {}))
const resolveScopedSlotVirtualIdMock = vi.hoisted(() => vi.fn((id: string) => `resolved:${id}`))
const fsPathExistsMock = vi.hoisted(() => vi.fn(async () => true))
const fsReadFileMock = vi.hoisted(() => vi.fn(async () => '<template />'))
const fsExistsSyncMock = vi.hoisted(() => vi.fn(() => true))
const normalizeFsResolvedIdMock = vi.hoisted(() => vi.fn((id: string) => id))

vi.mock('./shared', () => ({
  preloadNativeLayoutEntries: preloadNativeLayoutEntriesMock,
  loadTransformStyleBlock: loadTransformStyleBlockMock,
  handleTransformLayoutInvalidation: handleTransformLayoutInvalidationMock,
  handleTransformVueFileInvalidation: handleTransformVueFileInvalidationMock,
  isVueLikeId: isVueLikeIdMock,
}))

vi.mock('./transformFile', () => ({
  transformVueLikeFile: transformVueLikeFileMock,
}))

vi.mock('../bundle', () => ({
  emitVueBundleAssets: emitVueBundleAssetsMock,
}))

vi.mock('../scopedSlot', () => ({
  loadScopedSlotModule: vi.fn(),
  resolveScopedSlotVirtualId: resolveScopedSlotVirtualIdMock,
}))

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      pathExists: fsPathExistsMock,
      readFile: fsReadFileMock,
      existsSync: fsExistsSyncMock,
    },
  }
})

vi.mock('../../../../utils/resolvedId', () => ({
  normalizeFsResolvedId: normalizeFsResolvedIdMock,
}))

vi.mock('../../index', () => ({
  VUE_PLUGIN_NAME: 'weapp-vite:vue',
}))

vi.mock('../fallbackEntries', () => ({
  collectFallbackPageEntryIds: vi.fn(),
}))

vi.mock('../shared', () => ({
  findFirstResolvedVueLikeEntry: vi.fn(),
}))

vi.mock('../pageLayout', () => ({
  invalidateResolvedPageLayoutsCache: vi.fn(),
  isLayoutFile: vi.fn(),
}))

vi.mock('../styleRequest', () => ({
  parseWeappVueStyleRequest: vi.fn(),
}))

vi.mock('../../../utils/vueSfc', () => ({
  createReadAndParseSfcOptions: vi.fn(),
  readAndParseSfc: vi.fn(),
}))

function getHookHandler<T extends (...args: any[]) => any>(hook: T | { handler: T } | undefined): T {
  return typeof hook === 'function' ? hook : hook!.handler
}

describe('createVueTransformPlugin lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preloadNativeLayoutEntriesMock.mockResolvedValue(undefined)
    loadTransformStyleBlockMock.mockResolvedValue(null)
    handleTransformLayoutInvalidationMock.mockReturnValue(false)
    handleTransformVueFileInvalidationMock.mockReturnValue(false)
    isVueLikeIdMock.mockReturnValue(true)
    transformVueLikeFileMock.mockResolvedValue({ code: 'transformed', map: null })
    emitVueBundleAssetsMock.mockResolvedValue(undefined)
    resolveScopedSlotVirtualIdMock.mockImplementation((id: string) => `resolved:${id}`)
    normalizeFsResolvedIdMock.mockImplementation((id: string) => id)
  })

  it('invalidates cached compiled vue entries marked dirty by HMR', async () => {
    const { invalidateDirtyVueEntryCaches } = await import('./index')
    const compilationCache = new Map<string, any>([
      ['/project/src/app.vue', {
        source: '<template />',
        refreshToken: 1,
      }],
      ['/project/src/pages/index.vue', {
        source: '<template />',
        refreshToken: 0,
      }],
    ])

    invalidateDirtyVueEntryCaches(new Set(['/project/src/app.vue']), compilationCache)

    expect(compilationCache.get('/project/src/app.vue')).toEqual({
      source: '<template />',
      refreshToken: 2,
    })
    expect(compilationCache.get('/project/src/pages/index.vue')).toEqual({
      source: '<template />',
      refreshToken: 0,
    })
  })

  it('invalidates dirty vue entry caches with normalized path keys', async () => {
    normalizeFsResolvedIdMock.mockImplementation((id: string) => id.replace(/\\/g, '/'))
    const { invalidateDirtyVueEntryCaches } = await import('./index')
    const compilationCache = new Map<string, any>([
      ['D:\\project\\src\\app.vue', {
        source: '<script setup />',
        refreshToken: 0,
      }],
    ])

    invalidateDirtyVueEntryCaches(new Set(['D:/project/src/app.vue']), compilationCache)

    expect(compilationCache.get('D:\\project\\src\\app.vue')).toEqual({
      source: '<script setup />',
      refreshToken: 1,
    })
  })

  it('invalidates component metadata cache with raw and normalized path keys', async () => {
    normalizeFsResolvedIdMock.mockImplementation((id: string) => id.replace(/\\/g, '/'))
    const { invalidateComponentMetaCache } = await import('./index')
    const cache = new Map<string, any>([
      ['D:\\project\\src\\components\\card.vue', Promise.resolve({ isMiniProgramComponent: false })],
      ['D:/project/src/components/card.vue', Promise.resolve({ isMiniProgramComponent: true })],
      ['D:/project/src/components/other.vue', Promise.resolve({ isMiniProgramComponent: true })],
    ])

    invalidateComponentMetaCache(cache, 'D:\\project\\src\\components\\card.vue')

    expect(cache.has('D:\\project\\src\\components\\card.vue')).toBe(false)
    expect(cache.has('D:/project/src/components/card.vue')).toBe(false)
    expect(cache.has('D:/project/src/components/other.vue')).toBe(true)
  })

  it('preloads native layout entries during buildStart', async () => {
    const { createVueTransformPlugin } = await import('./index')
    const plugin = createVueTransformPlugin({
      configService: { cwd: '/project' },
      scanService: { value: true },
    } as any)

    await plugin.buildStart!.call({ meta: 'plugin-ctx' } as any)

    expect(preloadNativeLayoutEntriesMock).toHaveBeenCalledTimes(1)
    expect(preloadNativeLayoutEntriesMock).toHaveBeenCalledWith(expect.objectContaining({
      pluginCtx: { meta: 'plugin-ctx' },
      ctx: expect.any(Object),
      configService: { cwd: '/project' },
      scanService: { value: true },
      pathExists: fsPathExistsMock,
      readFile: fsReadFileMock,
    }))
  })

  it('delegates load flow to shared style block loader', async () => {
    loadTransformStyleBlockMock.mockResolvedValueOnce({ code: '.card{}', map: null })

    const { createVueTransformPlugin } = await import('./index')
    const plugin = createVueTransformPlugin({
      configService: { cwd: '/project' },
    } as any)

    const load = getHookHandler(plugin.load as any)
    const result = await load.call({ loader: true } as any, 'virtual:style')

    expect(loadTransformStyleBlockMock).toHaveBeenCalledTimes(1)
    expect(loadTransformStyleBlockMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'virtual:style',
      pluginCtx: { loader: true },
      configService: { cwd: '/project' },
    }))
    expect(result).toEqual({ code: '.card{}', map: null })
  })

  it('returns null from transform for non-vue-like ids and delegates vue-like ids', async () => {
    isVueLikeIdMock.mockReturnValueOnce(false)

    const { createVueTransformPlugin } = await import('./index')
    const plugin = createVueTransformPlugin({
      configService: { cwd: '/project' },
    } as any)

    const transform = getHookHandler(plugin.transform as any)
    await expect(transform.call({ addWatchFile: vi.fn() } as any, 'code', '/project/src/demo.ts')).resolves.toBeNull()
    await expect(transform.call({ addWatchFile: vi.fn() } as any, 'code', '/project/src/demo.vue')).resolves.toEqual({
      code: 'transformed',
      map: null,
    })

    expect(transformVueLikeFileMock).toHaveBeenCalledTimes(1)
    expect(transformVueLikeFileMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'code',
      id: '/project/src/demo.vue',
      styleRefreshTokens: expect.any(Map),
    }))
  })

  it('delegates generateBundle output emission', async () => {
    const { createVueTransformPlugin } = await import('./index')
    const plugin = createVueTransformPlugin({
      configService: { cwd: '/project' },
    } as any)

    await plugin.generateBundle!.call({ bundleCtx: true } as any, {}, { 'app.js': {} } as any)

    expect(emitVueBundleAssetsMock).toHaveBeenCalledTimes(1)
    expect(emitVueBundleAssetsMock).toHaveBeenCalledWith({ 'app.js': {} }, expect.objectContaining({
      pluginCtx: { bundleCtx: true },
      ctx: expect.any(Object),
    }))
  })

  it('handles watchChange through shared invalidation helpers', async () => {
    const { createVueTransformPlugin } = await import('./index')
    const profile = {}
    const plugin = createVueTransformPlugin({
      configService: { absoluteSrcRoot: '/project/src' },
      runtimeState: {
        build: {
          hmr: {
            profile,
          },
        },
      },
    } as any)

    plugin.watchChange!('/project/src/pages/home/index.vue', { event: 'update' })

    expect(normalizeFsResolvedIdMock).toHaveBeenCalledWith('/project/src/pages/home/index.vue')
    expect(handleTransformLayoutInvalidationMock).toHaveBeenCalledTimes(1)
    expect(handleTransformVueFileInvalidationMock).toHaveBeenCalledTimes(1)
    expect(handleTransformVueFileInvalidationMock).toHaveBeenCalledWith('/project/src/pages/home/index.vue', expect.objectContaining({
      existsSync: fsExistsSyncMock,
    }))
    expect(profile).toEqual(expect.objectContaining({
      event: 'update',
      eventId: expect.any(String),
      file: '/project/src/pages/home/index.vue',
      watchToDirtyMs: expect.any(Number),
    }))
  })

  it('handles hot updates for layout files, vue files, and ignored files', async () => {
    handleTransformLayoutInvalidationMock.mockReturnValueOnce(true)
    handleTransformVueFileInvalidationMock.mockReturnValueOnce(true).mockReturnValueOnce(false)

    const { createVueTransformPlugin } = await import('./index')
    const plugin = createVueTransformPlugin({
      configService: { absoluteSrcRoot: '/project/src' },
    } as any)

    await expect(plugin.handleHotUpdate!({ file: '/project/src/layouts/default.vue' } as any)).resolves.toEqual([])
    await expect(plugin.handleHotUpdate!({ file: '/project/src/pages/home/index.vue' } as any)).resolves.toEqual([])
    await expect(plugin.handleHotUpdate!({ file: '/project/src/pages/home/index.ts' } as any)).resolves.toBeUndefined()
  })

  it('delegates resolveId to scoped slot resolution', async () => {
    const { createVueTransformPlugin } = await import('./index')
    const profile = {}
    const plugin = createVueTransformPlugin({
      runtimeState: {
        build: {
          hmr: {
            profile,
          },
        },
      },
    } as any)

    const resolveId = getHookHandler(plugin.resolveId as any)
    expect(resolveId('virtual:slot')).toBe('resolved:virtual:slot')
    expect(resolveScopedSlotVirtualIdMock).toHaveBeenCalledWith('virtual:slot')
    expect(profile).toEqual(expect.objectContaining({
      pluginResolveMs: expect.any(Number),
      resolveCount: 1,
    }))
  })

  it('declares rolldown filters for hot transform paths', async () => {
    const { createVueTransformPlugin } = await import('./index')
    const plugin = createVueTransformPlugin({} as any)

    expect(plugin.transform).toEqual(expect.objectContaining({
      filter: {
        id: expect.any(RegExp),
      },
      handler: expect.any(Function),
    }))
    expect(plugin.load).toEqual(expect.objectContaining({
      filter: {
        id: expect.any(RegExp),
      },
      handler: expect.any(Function),
    }))
    expect(plugin.resolveId).toEqual(expect.objectContaining({
      filter: {
        id: expect.any(RegExp),
      },
      handler: expect.any(Function),
    }))

    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.vue')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/utils/plain.ts')).toBe(false)
    expect((plugin.load as any).filter.id.test('\0weapp-vite:scoped-slot:pages/home.__scoped-slot-0')).toBe(true)
    expect((plugin.load as any).filter.id.test('/project/src/pages/home.vue?weapp-vite-vue&type=style&index=0')).toBe(true)
    expect((plugin.resolveId as any).filter.id.test('\0weapp-vite:scoped-slot:pages/home.__scoped-slot-0')).toBe(true)
  })
})
