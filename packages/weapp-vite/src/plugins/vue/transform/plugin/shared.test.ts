import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureSfcStyleBlocks, handleTransformEntryPageLayoutFlow, invalidatePageLayoutCaches, invalidateVueFileCaches, isVueLikeId, registerNativeLayoutChunksForEntry } from './shared'

const resolvePageLayoutPlanMock = vi.hoisted(() => vi.fn(async () => undefined))
const applyPageLayoutPlanMock = vi.hoisted(() => vi.fn())
const addResolvedPageLayoutWatchFilesMock = vi.hoisted(() => vi.fn(async () => {}))
const emitNativeLayoutScriptChunkIfNeededMock = vi.hoisted(() => vi.fn(async () => {}))

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

describe('vue transform plugin shared helpers', () => {
  beforeEach(() => {
    resolvePageLayoutPlanMock.mockReset()
    resolvePageLayoutPlanMock.mockResolvedValue(undefined)
    applyPageLayoutPlanMock.mockReset()
    addResolvedPageLayoutWatchFilesMock.mockReset()
    addResolvedPageLayoutWatchFilesMock.mockResolvedValue(undefined)
    emitNativeLayoutScriptChunkIfNeededMock.mockReset()
    emitNativeLayoutScriptChunkIfNeededMock.mockResolvedValue(undefined)
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
})
