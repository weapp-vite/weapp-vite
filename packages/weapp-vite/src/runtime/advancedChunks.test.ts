import { describe, expect, it } from 'vitest'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { DEFAULT_SHARED_CHUNK_STRATEGY, SHARED_CHUNK_VIRTUAL_PREFIX } from './chunkStrategy'

const ROOT = '/project/src'

function relativeAbsoluteSrcRoot(id: string) {
  return id.startsWith(`${ROOT}/`) ? id.slice(ROOT.length + 1) : id
}

function createCtx(importers: string[]) {
  return {
    getModuleInfo: () => ({ importers }),
  }
}

describe('advanced chunk resolvers', () => {
  it('prefers vendor buckets and resets regex state between calls', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => [],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    const ctx = { getModuleInfo: () => null }
    const id = `${ROOT}/../node_modules/pkg/index.js`

    expect(resolveAdvancedChunkName(id, ctx)).toBeUndefined()
    expect(resolveAdvancedChunkName(id, ctx)).toBeUndefined()
  })

  it('duplicates third-party modules across sub-packages in duplicate mode', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => ['packageA', 'packageB'],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    const ctx = createCtx([`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`])
    const id = `${ROOT}/../node_modules/pkg/index.js`
    const resolved = resolveAdvancedChunkName(id, ctx)

    expect(resolved).toBe(`${SHARED_CHUNK_VIRTUAL_PREFIX}/packageA+packageB/common`)
  })

  it('hoists vendor code when strategy is hoist', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => ['packageA', 'packageB'],
      strategy: 'hoist',
    })

    const ctx = createCtx([`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`])
    const id = `${ROOT}/../node_modules/pkg/index.js`

    expect(resolveAdvancedChunkName(id, ctx)).toBe('vendors')
  })

  it('returns undefined when only one importer participates', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => ['packageA'],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    const ctx = createCtx([`${ROOT}/packageA/foo.ts`])
    const id = `${ROOT}/utils.ts`

    expect(resolveAdvancedChunkName(id, ctx)).toBeUndefined()
  })
})
