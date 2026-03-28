import { describe, expect, it, vi } from 'vitest'
import { ensureSfcStyleBlocks, invalidatePageLayoutCaches, invalidateVueFileCaches, isVueLikeId, resolveSfcSrc } from './shared'

describe('vue transform plugin shared helpers', () => {
  it('detects vue-like ids and resolves sfc src ids', async () => {
    expect(isVueLikeId('/project/src/pages/home/index.vue')).toBe(true)
    expect(isVueLikeId('/project/src/pages/home/index.jsx')).toBe(true)
    expect(isVueLikeId('/project/src/pages/home/index.tsx')).toBe(true)
    expect(isVueLikeId('/project/src/pages/home/index.ts')).toBe(false)

    expect(await resolveSfcSrc({}, './child.vue', '/project/src/pages/home/index.vue')).toBeUndefined()
    expect(await resolveSfcSrc({
      resolve: vi.fn(async () => ({ id: '/project/src/components/child.vue' })),
    }, './child.vue', '/project/src/pages/home/index.vue')).toBe('/project/src/components/child.vue')
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
})
