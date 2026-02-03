import { beforeEach, describe, expect, it } from 'vitest'
import { createAdvancedChunkNameResolver } from './advancedChunks'
import { __clearSharedChunkDiagnosticsForTest, DEFAULT_SHARED_CHUNK_STRATEGY, SHARED_CHUNK_VIRTUAL_PREFIX } from './chunkStrategy'

const ROOT = '/project/src'

function relativeAbsoluteSrcRoot(id: string) {
  return id.startsWith(`${ROOT}/`) ? id.slice(ROOT.length + 1) : id
}

type ImportGraph = Record<string, string[] | undefined | null>

function createCtx(graph: ImportGraph) {
  return {
    getModuleInfo: (id: string) => {
      if (id in graph) {
        const importers = graph[id]
        return importers ? { importers } : { importers: [] }
      }
      return { importers: [] }
    },
  }
}

describe('advanced chunk resolvers', () => {
  beforeEach(() => {
    __clearSharedChunkDiagnosticsForTest()
  })

  it('prefers vendor buckets and resets regex state between calls', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => [],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
    })

    const ctx = { getModuleInfo: () => null }
    const id = `${ROOT}/../node_modules/pkg/index.js`

    expect(resolveAdvancedChunkName(id, ctx)).toBe('vendors')
    expect(resolveAdvancedChunkName(id, ctx)).toBe('vendors')
  })

  it('duplicates third-party modules across sub-packages in duplicate mode', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => ['packageA', 'packageB'],
      strategy: 'duplicate',
    })

    const ctx = createCtx({
      [`${ROOT}/../node_modules/pkg/index.js`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`],
    })
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

    const ctx = createCtx({
      [`${ROOT}/../node_modules/pkg/index.js`]: [`${ROOT}/packageA/foo.ts`, `${ROOT}/packageB/bar.ts`],
    })
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

    const ctx = createCtx({
      [`${ROOT}/utils.ts`]: [`${ROOT}/packageA/foo.ts`],
    })
    const id = `${ROOT}/utils.ts`

    expect(resolveAdvancedChunkName(id, ctx)).toBeUndefined()
  })

  it('avoids shared chunks when sharedMode is inline', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => [],
      strategy: 'hoist',
      sharedMode: 'inline',
    })

    const ctx = createCtx({
      [`${ROOT}/shared.ts`]: [`${ROOT}/pages/a.ts`, `${ROOT}/pages/b.ts`],
      [`${ROOT}/../node_modules/pkg/index.js`]: [`${ROOT}/pages/a.ts`, `${ROOT}/pages/b.ts`],
    })

    expect(resolveAdvancedChunkName(`${ROOT}/shared.ts`, ctx)).toBeUndefined()
    expect(resolveAdvancedChunkName(`${ROOT}/../node_modules/pkg/index.js`, ctx)).toBeUndefined()
  })

  it('emits shared chunks by source-relative paths when sharedMode is path', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => [],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
      sharedMode: 'path',
      resolveSharedPath: (id) => {
        if (id === `${ROOT}/utils/shared.ts`) {
          return 'utils/shared.ts'
        }
        return undefined
      },
    })

    const ctx = createCtx({
      [`${ROOT}/utils/shared.ts`]: [`${ROOT}/pages/a.ts`, `${ROOT}/pages/b.ts`],
    })

    expect(resolveAdvancedChunkName(`${ROOT}/utils/shared.ts`, ctx)).toBe('utils/shared')
  })

  it('supports shared overrides for specific modules', () => {
    const resolveAdvancedChunkName = createAdvancedChunkNameResolver({
      vendorsMatchers: [[/[\\/]node_modules[\\/]/gi]],
      relativeAbsoluteSrcRoot,
      getSubPackageRoots: () => [],
      strategy: DEFAULT_SHARED_CHUNK_STRATEGY,
      sharedMode: 'common',
      resolveSharedMode: relativeId => (relativeId.startsWith('utils/') ? 'path' : 'common'),
      resolveSharedPath: (id) => {
        if (id === `${ROOT}/utils/feature.ts`) {
          return 'utils/feature.ts'
        }
        return undefined
      },
    })

    const ctx = createCtx({
      [`${ROOT}/utils/feature.ts`]: [`${ROOT}/pages/a.ts`, `${ROOT}/pages/b.ts`],
      [`${ROOT}/shared.ts`]: [`${ROOT}/pages/a.ts`, `${ROOT}/pages/b.ts`],
    })

    expect(resolveAdvancedChunkName(`${ROOT}/utils/feature.ts`, ctx)).toBe('utils/feature')
    expect(resolveAdvancedChunkName(`${ROOT}/shared.ts`, ctx)).toBe('common')
  })
})
