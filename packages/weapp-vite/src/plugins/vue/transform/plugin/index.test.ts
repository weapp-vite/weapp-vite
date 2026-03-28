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

vi.mock('fs-extra', () => ({
  default: {
    pathExists: fsPathExistsMock,
    readFile: fsReadFileMock,
    existsSync: fsExistsSyncMock,
  },
}))

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

    const result = await plugin.load!.call({ loader: true } as any, 'virtual:style')

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

    await expect(plugin.transform!.call({ addWatchFile: vi.fn() } as any, 'code', '/project/src/demo.ts')).resolves.toBeNull()
    await expect(plugin.transform!.call({ addWatchFile: vi.fn() } as any, 'code', '/project/src/demo.vue')).resolves.toEqual({
      code: 'transformed',
      map: null,
    })

    expect(transformVueLikeFileMock).toHaveBeenCalledTimes(1)
    expect(transformVueLikeFileMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'code',
      id: '/project/src/demo.vue',
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
    const plugin = createVueTransformPlugin({
      configService: { absoluteSrcRoot: '/project/src' },
    } as any)

    plugin.watchChange!('/project/src/pages/home/index.vue')

    expect(normalizeFsResolvedIdMock).toHaveBeenCalledWith('/project/src/pages/home/index.vue')
    expect(handleTransformLayoutInvalidationMock).toHaveBeenCalledTimes(1)
    expect(handleTransformVueFileInvalidationMock).toHaveBeenCalledTimes(1)
    expect(handleTransformVueFileInvalidationMock).toHaveBeenCalledWith('/project/src/pages/home/index.vue', expect.objectContaining({
      existsSync: fsExistsSyncMock,
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
    const plugin = createVueTransformPlugin({} as any)

    expect(plugin.resolveId!('virtual:slot')).toBe('resolved:virtual:slot')
    expect(resolveScopedSlotVirtualIdMock).toHaveBeenCalledWith('virtual:slot')
  })
})
