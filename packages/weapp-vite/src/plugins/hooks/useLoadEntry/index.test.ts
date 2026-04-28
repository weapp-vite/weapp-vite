import { describe, expect, it, vi } from 'vitest'
import { useLoadEntry } from './index'

function createContext() {
  return {
    runtimeState: {
      build: {
        hmr: {
          loadedEntrySet: new Set<string>(),
          dirtyEntrySet: new Set<string>(),
          dirtyEntryReasons: new Map<string, 'direct' | 'dependency' | 'metadata'>(),
          resolvedEntryMap: new Map<string, { id: string }>(),
          entriesMap: new Map<string, any>(),
          layoutEntryDependents: new Map<string, Set<string>>(),
          entryLayoutDependencies: new Map<string, Set<string>>(),
          profile: {},
        },
      },
    },
    configService: {
      isDev: true,
      absoluteSrcRoot: '/project/src',
      aliasEntries: [],
      packageJson: { dependencies: {} },
      options: { cwd: '/project' },
      relativeOutputPath(id: string) {
        return id
      },
      relativeAbsoluteSrcRoot(id: string) {
        return id.replace('/project/src/', '')
      },
    },
    scanService: {
      subPackageMap: new Map(),
    },
    wxmlService: {
      scan: vi.fn(async () => null),
      setWxmlComponentsMap: vi.fn(),
      wxmlComponentsMap: new Map<string, Record<string, unknown>>(),
    },
    autoImportService: {
      resolve: vi.fn(() => null),
    },
  } as any
}

function createPluginContext() {
  return {
    load: vi.fn(async () => null),
    emitFile: vi.fn(),
  } as any
}

function seedResolvedEntries(
  resolvedEntryMap: Map<string, { id: string }>,
  ids: string[],
) {
  for (const id of ids) {
    resolvedEntryMap.set(id, { id })
  }
}

describe('useLoadEntry emitDirtyEntries', () => {
  it('reuses runtimeState-backed hmr containers across hook creation', () => {
    const ctx = createContext()
    const first = useLoadEntry(ctx, {})
    first.markEntryDirty('/project/src/pages/logs/index.vue')
    first.resolvedEntryMap.set('/project/src/pages/logs/index.vue', { id: '/project/src/pages/logs/index.vue' } as any)

    const second = useLoadEntry(ctx, {})

    expect(second.dirtyEntrySet).toBe(first.dirtyEntrySet)
    expect(second.resolvedEntryMap).toBe(first.resolvedEntryMap)
    expect(second.dirtyEntrySet.has('/project/src/pages/logs/index.vue')).toBe(true)
    expect(second.resolvedEntryMap.has('/project/src/pages/logs/index.vue')).toBe(true)
  })

  it('emits all entries in full mode', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'full',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
  })

  it('clears unresolved dirty entries after an emit pass', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {})

    hook.markEntryDirty('/project/src/pages/a.js', 'direct')
    hook.markEntryDirty('/project/src/pages/missing.js', 'direct')
    hook.resolvedEntryMap.set('/project/src/pages/a.js', { id: '/project/src/pages/a.js' } as any)

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(hook.dirtyEntrySet.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.size).toBe(0)
  })

  it('falls back to full when shared chunk is only partially updated', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set([ids[0], ids[1]]))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'dependency')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(2)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['shared-chunk(common.js)+1:dependency'])
    expect(ctx.runtimeState.build.hmr.profile.sharedChunkResolveMs).toBeTypeOf('number')
  })

  it('keeps partial rebuild when shared chunk importers are fully dirty', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set([ids[0], ids[1]]))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    sharedChunksByEntry.set(ids[1], new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'dependency')
    hook.markEntryDirty(ids[1], 'dependency')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(2)
  })

  it('respects off mode for incremental rebuilds', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('keeps incremental rebuilds when no shared chunks are detected', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('keeps direct entry updates incremental when shared chunk importers are unavailable', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('records only entries that were actually emitted during hmr', async () => {
    const ctx = createContext()
    const setDidEmitAllEntries = vi.fn()
    const setLastEmittedEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        setDidEmitAllEntries,
        setLastEmittedEntries,
      },
    })

    hook.markEntryDirty('/project/src/components/HotCard/index.vue')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set())
  })

  it('expands dependency-driven updates across all affected shared chunk importers', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js', '/project/src/d.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common-a.js', new Set([ids[0], ids[1]]))
    sharedChunkImporters.set('common-b.js', new Set([ids[2], ids[3]]))
    sharedChunkImporters.set('common-c.js', new Set([ids[0], ids[2], ids[3]]))
    sharedChunksByEntry.set(ids[0], new Set(['common-a.js', 'common-c.js']))
    hook.markEntryDirty(ids[0], 'dependency')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(4)
  })

  it('keeps direct entry updates incremental across shared chunk importers', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set([ids[0], ids[1], ids[2]]))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('expands direct entry updates across bounded source shared chunk importers', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['shared-chunk(common.js)+2:direct'])
  })

  it('keeps direct entry updates incremental across large source shared chunk importer sets', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
      },
    })

    const ids = Array.from({ length: 130 }, (_, index) => `/project/src/page-${index}.js`)
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('expands dependency entry updates when the imported shared chunk contains source modules', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'dependency')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['shared-chunk(common.js)+2:dependency'])
  })

  it('keeps metadata entry updates incremental across source shared chunk importers', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.vue', '/project/src/b.vue', '/project/src/c.vue']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps direct updates incremental when a shared chunk spans main package and subpackage entries', async () => {
    const ctx = createContext()
    ctx.scanService.subPackageMap.set('subpackages/account', {})

    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = [
      '/project/src/app.ts',
      '/project/src/subpackages/account/address/index.ts',
    ]
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('src/shared/common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['src/shared/common.js']))
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('expands mixed direct and dependency updates through dependency-driven shared chunks', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    sharedChunksByEntry.set(ids[1], new Set(['common.js']))
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(ids[0], 'direct')
    hook.markEntryDirty(ids[1], 'dependency')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(3)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['shared-chunk(common.js)+1:mixed'])
  })

  it('keeps incremental rebuilds when dirty entries have no related shared chunk index hit', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set('/project/src/other.js', new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'dependency')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
  })

  it('records emit profile metrics for incremental hmr rebuilds', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0])

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(ctx.runtimeState.build.hmr.profile.emitMs).toBeTypeOf('number')
    expect(ctx.runtimeState.build.hmr.profile.dirtyCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(1)
  })

  it('records full rebuild explanation when sharedChunks mode is full', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'full',
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['full-rebuild'])
  })

  it('derives layout propagation explanation from upstream dirty causes', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['layout-self:1', 'layout-dependent:2'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })

    const ids = ['/project/src/layouts/default/index.ts', '/project/src/pages/a.ts', '/project/src/pages/b.ts']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    for (const id of ids) {
      hook.markEntryDirty(id, 'dependency')
    }

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['layout-propagation'])
  })

  it('derives fallback-full explanation from upstream layout dirty causes', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['layout-fallback-full:3'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })

    const ids = ['/project/src/a.ts', '/project/src/b.ts']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    for (const id of ids) {
      hook.markEntryDirty(id, 'dependency')
    }

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['layout-fallback-full'])
  })

  it('derives auto-routes topology explanation from upstream dirty causes', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['auto-routes-topology:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })

    const ids = ['/project/src/pages/logs/index.vue']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['auto-routes-topology'])
  })
})
