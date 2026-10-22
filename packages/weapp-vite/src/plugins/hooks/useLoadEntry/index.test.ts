import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLogicalEntryId } from '../../../moduleGraph/protocol'
import { createHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from '../../../runtime/hmrStyleUpdate'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { useLoadEntry } from './index'

const loadEntryMock = vi.hoisted(() => vi.fn(async () => ({ code: '' })))
const entryLoaderOptionsRef = vi.hoisted(() => ({ current: undefined as any }))

vi.mock('./loadEntry', () => ({
  createEntryLoader: vi.fn((options) => {
    entryLoaderOptionsRef.current = options
    return Object.assign(
      async function loadEntry(this: any, id: string, type: 'app' | 'page' | 'component') {
        return await loadEntryMock.call(this, id, type)
      },
      {
        invalidateResolveCache: vi.fn(),
      },
    )
  }),
}))

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
          profile: {},
        },
      },
    },
    moduleGraphService: {
      replaceEntryDependencies: vi.fn(),
    },
    configService: {
      isDev: true,
      absoluteSrcRoot: '/project/src',
      aliasEntries: [],
      outputExtensions: {
        wxss: 'wxss',
      },
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

function expectEmittedEntry(pluginCtx: { emitFile: ReturnType<typeof vi.fn> }, sourceId: string) {
  const emitted = pluginCtx.emitFile.mock.calls.some(([asset]) => {
    return asset.type === 'chunk' && (parseLogicalEntryId(asset.id)?.sourceId ?? asset.id) === sourceId
  })
  expect(emitted).toBe(true)
}

function countEmittedEntries(pluginCtx: { emitFile: ReturnType<typeof vi.fn> }, sourceId: string) {
  return pluginCtx.emitFile.mock.calls.filter(([asset]) => {
    return asset.type === 'chunk' && (parseLogicalEntryId(asset.id)?.sourceId ?? asset.id) === sourceId
  }).length
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
  beforeEach(() => {
    loadEntryMock.mockClear()
  })

  it('keeps a save discovered during a topology scan eligible for the next load', async () => {
    const ctx = createContext()
    ctx.runtimeState = createRuntimeState()
    const app = 'app.ts'
    const child = 'pages/next.ts'
    ctx.scanService.markDirty = vi.fn()
    ctx.scanService.loadAppEntry = vi.fn(async () => ({ path: app }))
    ctx.scanService.independentSubPackageMap = new Map()
    ctx.scanService.loadSubPackages = vi.fn()
    ctx.scanService.drainIndependentDirtyRoots = vi.fn(() => [])
    ctx.runtimeState.build.hmr.fullEntryScan = true
    const hook = useLoadEntry(ctx)
    loadEntryMock.mockImplementationOnce(async () => {
      ctx.runtimeState.build.hmr.profile.eventId = 'next'
      hook.resolvedEntryMap.set(child, { id: child } as any)
      hook.markEntryDirty(child, 'direct')
      hook.loadedEntrySet.add(child)
      return { code: '' }
    })
    await hook.emitDirtyEntries.call(createPluginContext())
    expect(hook.dirtyEntrySet).toEqual(new Set([child]))
    expect(hook.loadedEntrySet.has(child)).toBe(false)
    ctx.runtimeState.build.hmr.fullEntryScan = false
    const next = createPluginContext()
    await hook.emitDirtyEntries.call(next)
    expect(next.load).toHaveBeenCalled()
    expect(hook.dirtyEntrySet.size).toBe(0)
  })

  it.each([
    ['wxml-importer-import:3'],
    ['shared-chunk-source:3', 'compiler-content:1'],
    [],
  ])('emits the required registration graph despite representative or metadata selection: %j', async (...summary) => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = { dirtyReasonSummary: summary }
    const ids = ['pages/current.ts', 'components/retained.ts', 'layouts/default.ts']
    const requiredPublicationEntryIds = new Set(ids)
    const setLastEmittedEntries = vi.fn()
    const setDidEmitAllEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        requiredPublicationEntryIds,
        sharedChunks: 'auto',
        sharedChunkImporters: new Map([['weapp-vendors/runtime.js', new Set(ids)]]),
        sharedChunksByEntry: new Map(ids.map(id => [id, new Set(['weapp-vendors/runtime.js'])])),
        sourceSharedChunks: new Set(['weapp-vendors/runtime.js']),
        setLastEmittedEntries,
        setDidEmitAllEntries,
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    for (const id of ids) {
      hook.markEntryDirty(id, 'metadata')
    }
    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    for (const id of ids) {
      expectEmittedEntry(pluginCtx, id)
    }
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.forceEmitUnchangedChunks).toBe(false)
    // 完整注册图只是 tree-shaking 的编译边界，不能清退本轮缓存省略的原生 JSON。
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    // 下一代只使用当前必需集合；删除的入口与上一代计划均不能继续参与。
    requiredPublicationEntryIds.clear()
    hook.resolvedEntryMap.delete(ids[1]!)
    hook.markEntryDirty(ids[0]!, 'direct')
    const next = createPluginContext()
    await hook.emitDirtyEntries.call(next)
    expect(countEmittedEntries(next, ids[1]!)).toBe(0)
  })

  it.each(['direct', 'metadata'] as const)('keeps %s HMR owners separate from the complete classic registration graph', async (reason) => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = [reason === 'metadata' ? 'entry-local-asset:1' : 'entry-direct:1']
    const ids = ['pages/current.ts', 'components/retained.ts', 'layouts/default.ts']
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    const setDidEmitAllEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        requiredPublicationEntryIds: new Set(ids),
        setLastEmittedEntries,
        setLastHmrEntries,
        setDidEmitAllEntries,
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0]!, reason)

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    for (const id of ids) {
      expectEmittedEntry(pluginCtx, id)
    }
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([ids[0]]))
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 1,
      pendingCount: 1,
      emittedCount: 1,
      chunkEmitCount: 3,
      loadCount: 3,
    })
    expect(ctx.runtimeState.build.hmr.forceEmitUnchangedChunks).toBe(false)
    expect(hook.dirtyEntrySet.size).toBe(0)
  })

  it('keeps representative HMR selection while registering every classic compiler entry', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['shared-chunk-source:3']
    const ids = ['pages/current.ts', 'components/retained.ts', 'layouts/default.ts']
    const sharedChunk = 'weapp-vendors/shared-source.js'
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        requiredPublicationEntryIds: new Set(ids),
        sharedChunkImporters: new Map([[sharedChunk, new Set(ids)]]),
        sharedChunksByEntry: new Map(ids.map(id => [id, new Set([sharedChunk])])),
        sourceSharedChunks: new Set([sharedChunk]),
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    for (const id of ids) {
      hook.markEntryDirty(id, 'dependency')
    }

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    for (const id of ids) {
      expectEmittedEntry(pluginCtx, id)
    }
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 3,
      pendingCount: 1,
      emittedCount: 3,
      chunkEmitCount: 3,
      loadCount: 3,
      pendingReasonSummary: ['shared-chunk-representative:1/3'],
    })
  })

  it.each([false, true])('preserves saves outside the active event while compiling required entries (root input=%s)', async (rootInput) => {
    const ctx = createContext()
    const ids = ['pages/current.ts', 'components/next.ts']
    const hook = useLoadEntry(ctx, {
      hmr: {
        requiredPublicationEntryIds: new Set(ids),
        rootInputIds: rootInput ? new Set([ids[0]!]) : undefined,
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    ctx.runtimeState.build.hmr.profile.eventId = 'current'
    hook.markEntryDirty(ids[0]!, 'metadata')
    ctx.runtimeState.build.hmr.profile.eventId = 'next'
    hook.markEntryDirty(ids[1]!, 'direct')
    ctx.runtimeState.build.hmr.profile.eventId = 'current'
    const pluginCtx = createPluginContext()
    pluginCtx.load.mockImplementationOnce(async () => {
      ctx.runtimeState.build.hmr.profile.eventId = 'next'
      hook.markEntryDirty(ids[0]!, 'direct')
      return null
    })
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(hook.dirtyEntrySet).toEqual(new Set(ids))
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons).toEqual(new Map(ids.map(id => [id, 'direct'])))
    expect(countEmittedEntries(pluginCtx, ids[0]!)).toBe(rootInput ? 0 : 1)
    expect(countEmittedEntries(pluginCtx, ids[1]!)).toBe(1)
    for (const id of ids) {
      expect(hook.loadedEntrySet.has(id)).toBe(false)
    }
    const next = createPluginContext()
    await hook.emitDirtyEntries.call(next)
    expect(next.load).toHaveBeenCalled()
    expect(hook.dirtyEntrySet.size).toBe(0)
  })

  it.each(['metadata', 'direct', 'dependency'] as const)('derives unchanged chunk publication from %s invalidation', async (reason) => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx)
    const pageId = '/project/src/pages/index/index.ts'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(pageId)), { type: 'page', path: pageId } as any)
    hook.resolvedEntryMap.set(pageId, { id: pageId } as any)
    hook.markEntryDirty(pageId, reason)

    await hook.emitDirtyEntries.call(createPluginContext())

    expect(ctx.runtimeState.build.hmr.forceEmitUnchangedChunks).toBe(reason !== 'metadata')
    await hook.emitDirtyEntries.call(createPluginContext())
    expect(ctx.runtimeState.build.hmr.forceEmitUnchangedChunks).toBe(false)
  })

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

  it('keeps direct dirty reason when a metadata update arrives before emit', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {})
    const id = '/project/src/app.vue'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'app',
      path: id,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)

    hook.markEntryDirty(id, 'direct')
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(loadEntryMock).not.toHaveBeenCalled()
    expectEmittedEntry(pluginCtx, id)
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

  it('only emits dirty entries from the current hmr event', async () => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {})
    const previousId = '/project/src/pages/previous.js'
    const currentId = '/project/src/pages/current.js'
    seedResolvedEntries(hook.resolvedEntryMap, [previousId, currentId])

    ctx.runtimeState.build.hmr.profile.eventId = 'event-1'
    hook.markEntryDirty(previousId, 'direct')
    ctx.runtimeState.build.hmr.profile.eventId = 'event-2'
    hook.markEntryDirty(currentId, 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expectEmittedEntry(pluginCtx, currentId)
    expect(hook.dirtyEntrySet.has(previousId)).toBe(true)
    expect(hook.dirtyEntrySet.has(currentId)).toBe(false)
  })

  it('marks shared chunk refresh as skipped when no dirty entries exist', async () => {
    const ctx = createContext()
    const setDidEmitAllEntries = vi.fn()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    const setSkipSharedChunkRefresh = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        setDidEmitAllEntries,
        setLastEmittedEntries,
        setLastHmrEntries,
        setSkipSharedChunkRefresh,
      },
    })

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set())
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set())
    expect(setSkipSharedChunkRefresh).toHaveBeenLastCalledWith(true)
  })

  it('falls back to full when shared chunk is only partially updated', async () => {
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

  it('keeps auto-mode direct rebuilds scoped even when stable vendor chunks have many importers', async () => {
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

    const ids = Array.from({ length: 75 }, (_, index) => `/project/src/pages/retail-${index}/index.vue`)
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('weapp-vendors/wevu-ref.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['weapp-vendors/wevu-ref.js']))
    sourceSharedChunks.add('weapp-vendors/wevu-ref.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
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
    const setLastHmrEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        setDidEmitAllEntries,
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    hook.markEntryDirty('/project/src/components/HotCard/index.vue')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set())
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set())
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

  it('keeps direct entry updates scoped across stable vendor shared chunk importers', async () => {
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
    sharedChunkImporters.set('weapp-vendors/wevu-src.js', new Set([ids[0], ids[1], ids[2]]))
    sharedChunksByEntry.set(ids[0], new Set(['weapp-vendors/wevu-src.js']))
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps direct entry updates incremental across stable root shared chunk importers', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const setDidEmitAllEntries = vi.fn()
    const setLastEmittedEntries = vi.fn()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        setDidEmitAllEntries,
        setLastEmittedEntries,
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

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set([ids[0]]))
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('records only actual chunk emits when root inputs participate in stable shared chunks', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const setDidEmitAllEntries = vi.fn()
    const setLastEmittedEntries = vi.fn()
    const sourceSharedChunks = new Set<string>()
    const rootInputIds = new Set(['/project/src/app.ts'])
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        rootInputIds,
        setDidEmitAllEntries,
        setLastEmittedEntries,
      },
    })

    const ids = ['/project/src/app.ts', '/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[1], new Set(['common.js']))
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(ids[1], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set([ids[1]]))
  })

  it('keeps stable root shared chunk direct updates scoped to the dirty entry', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const setDidEmitAllEntries = vi.fn()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        setDidEmitAllEntries,
      },
    })

    const ids = ['/project/src/app.ts', '/project/src/pages/hmr/index.ts', '/project/src/pages/layouts/index.ts']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[1], new Set(['common.js']))
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(ids[1], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps direct page template edits scoped across stable vendor chunks even when they contain source modules', async () => {
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

    const ids = ['/project/src/pages/a.vue', '/project/src/layouts/default.vue', '/project/src/components/nav.vue']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('weapp-vendors/wevu-ref.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['weapp-vendors/wevu-ref.js']))
    sourceSharedChunks.add('weapp-vendors/wevu-ref.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps large direct importer sets incremental for source-only nested chunks', async () => {
    const ctx = createContext()
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const setDidEmitAllEntries = vi.fn()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        setDidEmitAllEntries,
      },
    })

    const ids = Array.from({ length: 130 }, (_, index) => `/project/src/page-${index}.js`)
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('src/shared/common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['src/shared/common.js']))
    sourceSharedChunks.add('src/shared/common.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
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

  it('keeps direct entry updates scoped across stable vendor chunks even when source chunk ownership is incomplete', async () => {
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

    const ids = Array.from({ length: 20 }, (_, index) => `/project/src/page-${index}.js`)
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('weapp-vendors/wevu-ref.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['weapp-vendors/wevu-ref.js']))
    sourceSharedChunks.add('weapp-vendors/wevu-ref.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps metadata entry updates incremental across nested source shared chunk importers', async () => {
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

    const ids = ['/project/src/a.vue', '/project/src/b.vue', '/project/src/c.vue']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('src/shared/common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['src/shared/common.js']))
    sourceSharedChunks.add('src/shared/common.js')
    hook.markEntryDirty(ids[0], 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).toHaveBeenCalledTimes(1)
    expect(loadEntryMock).not.toHaveBeenCalled()
    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps metadata entry updates incremental across stable root shared chunks', async () => {
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

    const ids = ['/project/src/a.vue', '/project/src/b.vue', '/project/src/c.vue']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(ids[0], 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).toHaveBeenCalledTimes(1)
    expect(loadEntryMock).not.toHaveBeenCalled()
    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps metadata entry updates incremental across stable vendor chunks', async () => {
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
    sharedChunkImporters.set('weapp-vendors/wevu-src.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['weapp-vendors/wevu-src.js']))
    hook.markEntryDirty(ids[0], 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).toHaveBeenCalledTimes(1)
    expect(loadEntryMock).not.toHaveBeenCalled()
    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('reloads metadata entries through loadEntry so JSON assets refresh without JS chunk emit', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['json-sidecar:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const id = '/project/src/components/x-child/index.ts'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'component',
      path: id,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(loadEntryMock).toHaveBeenCalledWith(id, 'component')
    expect(countEmittedEntries(pluginCtx, id)).toBe(0)
    expect(hook.loadedEntrySet.has(id)).toBe(true)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(1)
  })

  it('reloads json-only Vue metadata through loadEntry without Tailwind side effects', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['entry-json-only:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const id = '/project/src/pages/home/home.vue'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'page',
      path: id,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(loadEntryMock).toHaveBeenCalledWith(id, 'page')
    expect(countEmittedEntries(pluginCtx, id)).toBe(0)
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('reloads entries when chunk emit reveals new auto-import components', async () => {
    const ctx = createContext()
    let autoImportComponents: Record<string, unknown> | undefined
    ctx.wxmlService.getAggregatedAutoImportComponents = vi.fn(() => autoImportComponents)
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const id = '/project/src/pages/home/home.vue'
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.markEntryDirty(id, 'direct')
    const pathExists = vi.spyOn(fs, 'pathExists').mockResolvedValueOnce(true)

    const pluginCtx = createPluginContext()
    pluginCtx.emitFile = vi.fn(() => {
      autoImportComponents = { HotCard: [{ start: 0, end: 0 }] }
    })

    try {
      await hook.emitDirtyEntries.call(pluginCtx)

      expectEmittedEntry(pluginCtx, id)
      expect(ctx.wxmlService.getAggregatedAutoImportComponents).toHaveBeenCalledWith(
        '/project/src/pages/home/home',
      )
      expect(loadEntryMock).toHaveBeenCalledWith(id, 'page')
    }
    finally {
      pathExists.mockRestore()
    }
  })

  it('reloads style sidecar metadata through loadEntry without JS chunk emit', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      file: '/project/src/components/x-child/index.scss',
      dirtyReasonSummary: ['style-sidecar:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const id = '/project/src/components/x-child/index.ts'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'component',
      path: id,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(loadEntryMock).toHaveBeenCalledWith(id, 'component')
    expect(countEmittedEntries(pluginCtx, id)).toBe(0)
    expect(ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('/project/src/components/x-child/index.wxss')).toBe(true)
  })

  it('keeps style sidecar hmr entries scoped to direct metadata entries', async () => {
    const ctx = createContext()
    const setLastHmrEntries = vi.fn()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['style-sidecar:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        setLastHmrEntries,
      },
    })

    const id = '/project/src/pages/hmr/index.ts'
    const childId = '/project/src/components/x-child/index.ts'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'page',
      path: id,
    } as any)
    hook.entriesMap.set(childId, {
      type: 'component',
      path: childId,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.resolvedEntryMap.set(childId, { id: childId } as any)
    loadEntryMock.mockImplementationOnce(async function () {
      await Promise.all(entryLoaderOptionsRef.current.emitEntriesChunks.call(this, [{ id: childId }]))
      return { code: '' }
    })
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(loadEntryMock).toHaveBeenCalledWith(id, 'page')
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([id]))
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(1)
  })

  it('does not expand shared chunk importers for metadata-only sidecar updates', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['style-sidecar:1'],
    }
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
    for (const id of ids) {
      hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
        path: id,
        type: 'page',
      } as any)
    }
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['common.js']))
    hook.markEntryDirty(ids[0], 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(loadEntryMock).toHaveBeenCalledTimes(1)
    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('reloads Vue entry local asset metadata through loadEntry without JS chunk emit', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['entry-local-asset:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    const id = '/project/src/pages/hmr-sfc/index.vue'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'page',
      path: id,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(loadEntryMock).toHaveBeenCalledWith(id, 'page')
    expect(countEmittedEntries(pluginCtx, id)).toBe(0)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set())
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([id]))
  })

  it('reloads wxml import-only metadata through loadEntry without JS chunk emit', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['wxml-importer-import:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
      },
    })

    const id = '/project/src/pages/native/index.ts'
    hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
      type: 'page',
      path: id,
    } as any)
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.markEntryDirty(id, 'metadata')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.load).not.toHaveBeenCalled()
    expect(loadEntryMock).toHaveBeenCalledWith(id, 'page')
    expect(countEmittedEntries(pluginCtx, id)).toBe(0)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(1)
  })

  it('keeps direct updates incremental when a shared chunk spans main package and subpackage entries', async () => {
    const ctx = createContext()
    ctx.scanService.subPackageMap.set('subpackages/account', {})

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

    const ids = [
      '/project/src/app.ts',
      '/project/src/subpackages/account/address/index.ts',
    ]
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('src/shared/common.js', new Set(ids))
    sharedChunksByEntry.set(ids[0], new Set(['src/shared/common.js']))
    sourceSharedChunks.add('src/shared/common.js')
    hook.markEntryDirty(ids[0], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
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

  it('emits one representative entry for source shared chunk only updates', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['shared-chunk-source:3'],
    }
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    for (const id of ids) {
      sharedChunksByEntry.set(id, new Set(['common.js']))
      hook.markEntryDirty(id, 'dependency')
    }
    sourceSharedChunks.add('common.js')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expectEmittedEntry(pluginCtx, ids[0]!)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set([ids[0]]))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(3)
    expect(hook.dirtyEntrySet.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([
      'shared-chunk-representative:1/3',
    ])
  })

  it('keeps tailwind app refresh while using one representative for source shared chunk updates', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['tailwind-content:1', 'shared-chunk-source:4'],
    }
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const sourceSharedChunks = new Set<string>()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    const appEntry = '/project/src/app.ts'
    const ids = [
      appEntry,
      '/project/src/pages/a.js',
      '/project/src/pages/b.js',
      '/project/src/pages/c.js',
      '/project/src/pages/d.js',
    ]
    const sharedImporters = new Set(ids.slice(1))
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', sharedImporters)
    for (const id of sharedImporters) {
      sharedChunksByEntry.set(id, new Set(['common.js']))
    }
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(appEntry, 'dependency')
    for (const id of sharedImporters) {
      hook.markEntryDirty(id, 'dependency')
    }

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expectEmittedEntry(pluginCtx, ids[1]!)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set([ids[1]]))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(5)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([
      'shared-chunk-representative:1/5',
    ])
  })

  it('keeps tailwind app metadata refresh from expanding stable shared chunk importers', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['entry-direct:1', 'tailwind-content:2'],
    }
    const sharedChunkImporters = new Map<string, Set<string>>()
    const sharedChunksByEntry = new Map<string, Set<string>>()
    const sourceSharedChunks = new Set<string>()
    const appEntry = '/project/src/app.ts'
    const rootInputIds = new Set([appEntry])
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks,
        rootInputIds,
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    const ids = [
      appEntry,
      '/project/src/pages/a.vue',
      '/project/src/pages/b.vue',
      '/project/src/pages/c.vue',
      '/project/src/pages/d.vue',
    ]
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    sharedChunkImporters.set('common.js', new Set(ids))
    sharedChunksByEntry.set(appEntry, new Set(['common.js']))
    for (const id of ids.slice(1)) {
      sharedChunksByEntry.set(id, new Set(['common.js']))
    }
    sourceSharedChunks.add('common.js')
    hook.markEntryDirty(appEntry, 'metadata')
    hook.markEntryDirty(ids[1], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(loadEntryMock).toHaveBeenCalledWith(appEntry, 'app')
    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expectEmittedEntry(pluginCtx, ids[1]!)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set([ids[1]]))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([appEntry, ids[1]]))
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(2)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(2)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('keeps direct page hmr entry during tailwind local-asset metadata refresh', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    const appEntry = '/project/src/app.ts'
    const pageEntry = '/project/src/pages/home/index.vue'
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['entry-local-asset:1', 'tailwind-content:2'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        rootInputIds: new Set([appEntry]),
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    seedResolvedEntries(hook.resolvedEntryMap, [appEntry, pageEntry])
    hook.markEntryDirty(appEntry, 'metadata')
    hook.markEntryDirty(pageEntry, 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(loadEntryMock).toHaveBeenCalledWith(appEntry, 'app')
    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(1)
    expectEmittedEntry(pluginCtx, pageEntry)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set([pageEntry]))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([appEntry, pageEntry]))
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(2)
  })

  it.each(['css-importer', 'css-importer-fallback'])('compiles every metadata style owner through its logical entry (%s)', async (label) => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    const ids = ['/project/src/app.js', '/project/src/components/native/index.js', '/project/src/components/sfc/index.vue']
    ctx.runtimeState.build.hmr.profile = { dirtyReasonSummary: [`${label}:3`] }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        rootInputIds: new Set([ids[0]!]),
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    for (const id of ids) {
      hook.markEntryDirty(id, 'metadata')
    }

    const pluginCtx = createPluginContext()
    const plan = createHmrStyleUpdatePlan(['/project/src/theme.wxss'], { cssImporterOwners: ids })
    await withHmrStyleUpdatePlan(ctx.configService, plan, () => hook.emitDirtyEntries.call(pluginCtx))

    // app 已有原生 input；其余每个 owner 都必须有真实逻辑 facade，不能仅物理 preload。
    expect(loadEntryMock).toHaveBeenCalledWith(ids[0], 'app')
    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(2)
    for (const id of ids.slice(1)) {
      expectEmittedEntry(pluginCtx, id)
      expect(pluginCtx.load.mock.calls.some(([entry]: [{ id: string }]) => parseLogicalEntryId(entry.id)?.sourceId === id)).toBe(true)
    }
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.forceEmitUnchangedChunks).toBe(false)
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(3)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(3)
    expect(hook.dirtyEntrySet.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
  })

  it('emits one representative entry for wxml import-only updates while keeping all hmr entries', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['wxml-importer-import:3'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js', '/project/src/c.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    for (const id of ids) {
      hook.entriesMap.set(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(id)), {
        type: 'page',
        path: id,
      } as any)
      hook.markEntryDirty(id, 'metadata')
    }

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(loadEntryMock).toHaveBeenCalledTimes(1)
    expect(loadEntryMock).toHaveBeenCalledWith(ids[0], 'page')
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set())
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(3)
    expect(hook.dirtyEntrySet.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.size).toBe(0)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([
      'wxml-importer-import-representative:1/3',
    ])
  })

  it('keeps all CSS owners without expanding unrelated shared script importers', async () => {
    const ctx = createContext()
    const setLastEmittedEntries = vi.fn()
    const setLastHmrEntries = vi.fn()
    const ids = ['/project/src/components/sfc/index.vue', '/project/src/components/native/index.ts']
    const unrelated = '/project/src/pages/unrelated/index.ts'
    const all = [...ids, unrelated]
    const sharedChunkImporters = new Map([['common.js', new Set(all)]])
    const sharedChunksByEntry = new Map(all.map(id => [id, new Set(['common.js'])]))
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'auto',
        sharedChunkImporters,
        sharedChunksByEntry,
        sourceSharedChunks: new Set(['common.js']),
        setLastEmittedEntries,
        setLastHmrEntries,
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, all)
    for (const id of ids) {
      hook.markEntryDirty(id, 'dependency')
    }

    const pluginCtx = createPluginContext()
    const plan = createHmrStyleUpdatePlan(['/project/src/theme.css'], { cssImporterOwners: ids })
    await withHmrStyleUpdatePlan(ctx.configService, plan, () => hook.emitDirtyEntries.call(pluginCtx))

    expect(pluginCtx.emitFile).toHaveBeenCalledTimes(ids.length)
    for (const id of ids) {
      expectEmittedEntry(pluginCtx, id)
    }
    expect(countEmittedEntries(pluginCtx, unrelated)).toBe(0)
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(ids.length)
    expect(ctx.runtimeState.build.hmr.profile.emittedCount).toBe(ids.length)
    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual([])
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

  it('records config restart explanation for config dependency updates', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['config-restart:2'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })

    const ids = ['/project/src/a.js', '/project/src/b.js']
    seedResolvedEntries(hook.resolvedEntryMap, ids)
    hook.markEntryDirty(ids[0], 'direct')
    hook.markEntryDirty(ids[1], 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(ctx.runtimeState.build.hmr.profile.pendingReasonSummary).toEqual(['config-restart'])
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

  it('retains app chunk filenames for inline auto-routes refreshes', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['entry-auto-routes:1'],
    }
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })

    const id = '/project/src/app.vue'
    seedResolvedEntries(hook.resolvedEntryMap, [id])
    hook.markEntryDirty(id, 'direct')

    await hook.emitDirtyEntries.call(createPluginContext())

    expect(ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('/project/src/app.js')).toBe(true)
  })

  it('retains root input chunk filenames for auto-routes topology refreshes', async () => {
    const ctx = createContext()
    ctx.runtimeState.build.hmr.profile = {
      dirtyReasonSummary: ['auto-routes-topology:1'],
    }
    const id = '/project/src/app.vue'
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
        rootInputIds: new Set([id]),
      },
    })

    seedResolvedEntries(hook.resolvedEntryMap, [id])
    hook.markEntryDirty(id, 'direct')

    await hook.emitDirtyEntries.call(createPluginContext())

    expect(ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('/project/src/app.js')).toBe(true)
    expect(ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('app.js')).toBe(true)
  })

  it('retains root input chunk filenames when root chunk emit is skipped', async () => {
    const ctx = createContext()
    const id = '/project/src/app.ts'
    const setLastEmittedEntries = vi.fn()
    const setSkipSharedChunkRefresh = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
        rootInputIds: new Set([id]),
        setLastEmittedEntries,
        setSkipSharedChunkRefresh,
      },
    })

    seedResolvedEntries(hook.resolvedEntryMap, [id])
    hook.markEntryDirty(id, 'direct')

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(setLastEmittedEntries).toHaveBeenCalledWith(new Set([id]))
    expect(setSkipSharedChunkRefresh).toHaveBeenCalledWith(false)
    expect(ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('/project/src/app.js')).toBe(true)
    expect(ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.has('app.js')).toBe(true)
  })

  it('keeps root input dirty while preloading skipped root chunks', async () => {
    const ctx = createContext()
    const id = '/project/src/app.ts'
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
        rootInputIds: new Set([id]),
      },
    })

    seedResolvedEntries(hook.resolvedEntryMap, [id])
    hook.markEntryDirty(id, 'direct')
    loadEntryMock.mockImplementationOnce(async () => {
      expect(hook.dirtyEntrySet.has(id)).toBe(true)
      return { code: '' }
    })

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(loadEntryMock).toHaveBeenCalledWith(id, 'app')
    expect(hook.dirtyEntrySet.has(id)).toBe(false)
  })

  it.each([
    ['page', '/project/src/pages/index/index.ts', 'pages/index/index'],
    ['component', '/project/src/components/card/index.ts', 'components/card/index'],
  ] as const)('preloads %s logical roots with their declared entry type', async (type, id, entryKey) => {
    const ctx = createContext()
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
        rootInputIds: new Set([id]),
      },
    })
    hook.entriesMap.set(entryKey, { type, path: id })
    seedResolvedEntries(hook.resolvedEntryMap, [id])
    hook.markEntryDirty(id, 'direct')

    await hook.emitDirtyEntries.call(createPluginContext())

    expect(loadEntryMock).toHaveBeenCalledWith(id, type)
  })

  it('deduplicates repeated chunk emits in the same hmr pass', async () => {
    const ctx = createContext()
    const id = '/project/src/pages/index/index.ts'
    const hook = useLoadEntry(ctx, {
      hmr: {
        sharedChunks: 'off',
      },
    })
    seedResolvedEntries(hook.resolvedEntryMap, [id])
    hook.markEntryDirty(id, 'direct')
    loadEntryMock.mockImplementationOnce(async function (loadedId: string) {
      hook.loadedEntrySet.delete(loadedId)
      await Promise.all(entryLoaderOptionsRef.current.emitEntriesChunks.call(this, [{ id: loadedId }]))
      return { code: '' }
    })

    const pluginCtx = createPluginContext()
    await hook.emitDirtyEntries.call(pluginCtx)

    expect(countEmittedEntries(pluginCtx, id)).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.chunkEmitCount).toBe(1)
    expect(ctx.runtimeState.build.hmr.profile.entryChunkEmitMs).toBeGreaterThanOrEqual(0)
    expect(ctx.runtimeState.build.hmr.profile.entryChunkLoadMs).toBeGreaterThanOrEqual(0)
    expect(ctx.runtimeState.build.hmr.profile.entryChunkEmitFileMs).toBeGreaterThanOrEqual(0)
  })
})
