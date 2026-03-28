import { describe, expect, it, vi } from 'vitest'
import { invalidatePageLayoutCaches, invalidateVueFileCaches } from './shared'

describe('vue transform plugin shared helpers', () => {
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
})
