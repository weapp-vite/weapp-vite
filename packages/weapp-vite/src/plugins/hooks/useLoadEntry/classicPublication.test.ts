import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import { relative, resolve } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseLogicalEntryId } from '../../../moduleGraph/protocol'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { useLoadEntry } from './index'

const loadEntryMock = vi.hoisted(() => vi.fn(async () => ({ code: '' })))

vi.mock('./loadEntry', () => ({
  createEntryLoader: vi.fn(() => Object.assign(loadEntryMock, { invalidateResolveCache: vi.fn() })),
}))

const sourceId = (id: string) => resolve('classic-registration-fixture', id)

function createContext() {
  return {
    runtimeState: createRuntimeState(),
    moduleGraphService: { replaceEntryDependencies: vi.fn() },
    configService: {
      isDev: true,
      aliasEntries: [],
      outputExtensions: { wxss: 'wxss' },
      packageJson: { dependencies: {} },
      options: {},
      relativeOutputPath: (id: string) => relative(sourceId(''), id),
      relativeAbsoluteSrcRoot: (id: string) => relative(sourceId(''), id),
    },
    scanService: { subPackageMap: new Map() },
    wxmlService: {
      scan: vi.fn(async () => null),
      setWxmlComponentsMap: vi.fn(),
      wxmlComponentsMap: new Map(),
    },
    autoImportService: { resolve: vi.fn(() => null) },
  } as any
}

function createPluginContext() {
  return { load: vi.fn(async () => null), emitFile: vi.fn() } as any
}

function seedEntries(hook: ReturnType<typeof useLoadEntry>, ids: string[]) {
  for (const id of ids) {
    hook.resolvedEntryMap.set(id, { id } as any)
    hook.entriesMap.set(removeExtensionDeep(relative(sourceId(''), id)), { type: 'page', path: id } as any)
  }
}

function emittedSources(pluginCtx: ReturnType<typeof createPluginContext>) {
  return new Set(pluginCtx.emitFile.mock.calls.map(([asset]: [{ id: string }]) => parseLogicalEntryId(asset.id)?.sourceId ?? asset.id))
}

async function emitWithExistingSources(hook: ReturnType<typeof useLoadEntry>, pluginCtx: ReturnType<typeof createPluginContext>) {
  const pathExists = vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
  try {
    await hook.emitDirtyEntries.call(pluginCtx)
  }
  finally {
    pathExists.mockRestore()
  }
}

describe('classic registration and HMR entry ownership', () => {
  beforeEach(() => loadEntryMock.mockClear())

  it.each([
    ['entry-direct:1', 'direct'],
    ['sidecar-direct:1', 'metadata'],
    ['style-sidecar:1', 'metadata'],
  ] as const)('compiles all registrations while keeping one changed owner (%s)', async (summary, reason) => {
    const ctx = createContext()
    const ids = Array.from({ length: 18 }, (_, index) => sourceId(`pages/page${index}.ts`))
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
    seedEntries(hook, ids)
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = [summary]
    hook.markEntryDirty(ids[0]!, reason)
    const pluginCtx = createPluginContext()

    await hook.emitDirtyEntries.call(pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set(ids))
    expect(setLastEmittedEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([ids[0]]))
    expect(setDidEmitAllEntries).toHaveBeenLastCalledWith(false)
    expect(ctx.runtimeState.build.hmr.forceEmitUnchangedChunks).toBe(false)
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 1,
      pendingCount: 1,
      emittedCount: 1,
      pendingReasonSummary: ['classic-registration:18'],
    })
  })

  it.each([
    ['shared-chunk-source:3', 'shared-chunk-representative:1/3', 'dependency'],
    ['wxml-importer-import:3', 'wxml-importer-import-representative:1/3', 'metadata'],
  ] as const)('retains all affected owners behind a representative (%s)', async (summary, representative, reason) => {
    const ctx = createContext()
    const affected = ['pages/a.ts', 'pages/b.ts', 'pages/c.ts'].map(sourceId)
    const ids = [...affected, sourceId('pages/unrelated.ts')]
    const setLastHmrEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        requiredPublicationEntryIds: new Set(ids),
        sharedChunkImporters: new Map([['shared.js', new Set(affected)]]),
        sharedChunksByEntry: new Map(affected.map(id => [id, new Set(['shared.js'])])),
        sourceSharedChunks: new Set(['shared.js']),
        setLastHmrEntries,
      },
    })
    seedEntries(hook, ids)
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = [summary]
    for (const id of affected) {
      hook.markEntryDirty(id, reason)
    }
    const pluginCtx = createPluginContext()

    await hook.emitDirtyEntries.call(pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set(ids))
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(affected))
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 3,
      pendingCount: 1,
      emittedCount: 3,
      pendingReasonSummary: [representative, 'classic-registration:4'],
    })
  })

  it.each([false, true])('preserves App metadata ownership during asset refresh (registered App=%s)', async (registerApp) => {
    const ctx = createContext()
    const app = sourceId('app.ts')
    const page = sourceId('pages/current.vue')
    const unrelated = sourceId('pages/unrelated.ts')
    const setLastHmrEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        rootInputIds: new Set([app]),
        requiredPublicationEntryIds: new Set(registerApp ? [app, page, unrelated] : [page, unrelated]),
        setLastHmrEntries,
      },
    })
    seedEntries(hook, [page, unrelated])
    hook.resolvedEntryMap.set(app, { id: app } as any)
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['entry-local-asset:1', 'tailwind-content:2']
    hook.markEntryDirty(app, 'metadata')
    hook.markEntryDirty(page, 'direct')
    const pluginCtx = createPluginContext()

    await hook.emitDirtyEntries.call(pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set([page, unrelated]))
    expect(loadEntryMock).toHaveBeenCalledWith(app, 'app')
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([app, page]))
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 2,
      pendingCount: 2,
      emittedCount: 2,
      pendingReasonSummary: ['classic-registration:3'],
    })
  })

  it.each([false, true])('keeps later saves outside the current HMR owners (root input=%s)', async (rootInput) => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const next = sourceId('components/next.ts')
    const ids = [current, next]
    const setLastHmrEntries = vi.fn()
    const hook = useLoadEntry(ctx, {
      hmr: {
        requiredPublicationEntryIds: new Set(ids),
        rootInputIds: rootInput ? new Set([current]) : undefined,
        setLastHmrEntries,
      },
    })
    seedEntries(hook, ids)
    ctx.runtimeState.build.hmr.profile.eventId = 'current'
    hook.markEntryDirty(current, 'metadata')
    ctx.runtimeState.build.hmr.profile.eventId = 'next'
    hook.markEntryDirty(next, 'direct')
    ctx.runtimeState.build.hmr.profile.eventId = 'current'
    const pluginCtx = createPluginContext()
    pluginCtx.load.mockImplementationOnce(async () => {
      ctx.runtimeState.build.hmr.profile.eventId = 'next'
      hook.markEntryDirty(current, 'direct')
      return null
    })

    await hook.emitDirtyEntries.call(pluginCtx)

    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set([current]))
    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({ pendingCount: 1, emittedCount: 1 })
    expect(hook.dirtyEntrySet).toEqual(new Set(ids))
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons).toEqual(new Map(ids.map(id => [id, 'direct'])))
    for (const id of ids) {
      expect(hook.loadedEntrySet.has(id)).toBe(false)
    }
    await hook.emitDirtyEntries.call(createPluginContext())
    expect(setLastHmrEntries).toHaveBeenLastCalledWith(new Set(ids))
    expect(hook.dirtyEntrySet.size).toBe(0)
  })

  it('counts only resolved entries in both the HMR plan and registration work', async () => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const missing = sourceId('pages/removed.ts')
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set([current, missing]) } })
    seedEntries(hook, [current])
    hook.markEntryDirty(current, 'direct')
    hook.markEntryDirty(missing, 'direct')

    await hook.emitDirtyEntries.call(createPluginContext())

    expect(ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 2,
      pendingCount: 1,
      emittedCount: 1,
      pendingReasonSummary: ['classic-registration:1'],
    })
  })

  it('keeps unchanged auto-import registrations emitted without reloading their source metadata', async () => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const retained = sourceId('pages/retained.ts')
    const ids = [current, retained]
    let components = { FirstCard: [{ start: 0, end: 10 }], SecondCard: [{ start: 12, end: 20 }] }
    ctx.wxmlService.getAggregatedAutoImportComponents = vi.fn(() => components)
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set(ids) } })
    seedEntries(hook, ids)
    for (const id of ids) {
      hook.loadedEntrySet.add(id)
    }
    hook.markEntryDirty(current, 'direct')
    const pluginCtx = createPluginContext()
    pluginCtx.emitFile.mockImplementation(() => {
      components = { SecondCard: [{ start: 30, end: 40 }], FirstCard: [{ start: 42, end: 50 }] }
    })

    await emitWithExistingSources(hook, pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set(ids))
    expect(pluginCtx.load).toHaveBeenCalledTimes(1)
    expect(loadEntryMock.mock.calls).toEqual([[current, 'page']])
  })

  it('refreshes each affected auto-import owner behind one registration representative', async () => {
    const ctx = createContext()
    const affected = ['pages/a.ts', 'pages/b.ts', 'pages/c.ts'].map(sourceId)
    const ids = [...affected, sourceId('pages/retained.ts')]
    ctx.wxmlService.getAggregatedAutoImportComponents = vi.fn(() => ({ StableCard: [] }))
    ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = ['wxml-importer-import:3']
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set(ids) } })
    seedEntries(hook, ids)
    for (const id of affected) {
      hook.markEntryDirty(id, 'metadata')
    }

    await emitWithExistingSources(hook, createPluginContext())

    expect(loadEntryMock.mock.calls).toEqual(affected.map(id => [id, 'page']))
    expect(ctx.runtimeState.build.hmr.profile.pendingCount).toBe(1)
  })

  it.each([
    ['added', [], ['NewCard']],
    ['replaced', ['OldCard'], ['NewCard']],
    ['removed', ['OldCard'], []],
  ] as const)('refreshes a registered owner when auto-import names are %s during emit', async (_change, previousNames, nextNames) => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const owner = sourceId('pages/auto-import.ts')
    const ids = [current, owner]
    let names: readonly string[] = previousNames
    ctx.wxmlService.getAggregatedAutoImportComponents = vi.fn((baseName: string) => {
      return baseName === removeExtensionDeep(owner)
        ? Object.fromEntries(names.map(name => [name, []]))
        : undefined
    })
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set(ids) } })
    seedEntries(hook, ids)
    hook.markEntryDirty(current, 'direct')
    const pluginCtx = createPluginContext()
    pluginCtx.emitFile.mockImplementation(() => {
      names = nextNames
    })

    await emitWithExistingSources(hook, pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set(ids))
    expect(loadEntryMock.mock.calls).toEqual([[owner, 'page']])
  })

  it.each(['before', 'during'])('drains explicit pending auto-import metadata %s emit without component names', async (stage) => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const owner = sourceId('pages/auto-import.ts')
    const ids = [current, owner]
    const markPending = () => ctx.runtimeState.autoImport.pendingEntriesByImporter.set(removeExtensionDeep(owner), new Set(['components/new-card']))
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set(ids) } })
    seedEntries(hook, ids)
    hook.markEntryDirty(current, 'direct')
    if (stage === 'before') {
      markPending()
    }
    const pluginCtx = createPluginContext()
    pluginCtx.emitFile.mockImplementation(() => {
      if (stage === 'during') {
        markPending()
      }
    })

    await emitWithExistingSources(hook, pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set(ids))
    expect(loadEntryMock.mock.calls).toEqual([[owner, 'page']])
  })

  it.each([false, true])('refreshes retained auto-import metadata only when the resolver version changes (changed=%s)', async (changed) => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const owner = sourceId('pages/auto-import.ts')
    const ids = [current, owner]
    let version = 1
    ctx.autoImportService.getVersion = vi.fn(() => version)
    ctx.wxmlService.getAggregatedAutoImportComponents = vi.fn((baseName: string) => {
      return baseName === removeExtensionDeep(owner) ? { StableCard: [] } : undefined
    })
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set(ids) } })
    seedEntries(hook, ids)
    hook.markEntryDirty(current, 'direct')
    const pluginCtx = createPluginContext()
    pluginCtx.emitFile.mockImplementation(() => {
      version = changed ? 2 : 1
    })

    await emitWithExistingSources(hook, pluginCtx)

    expect(emittedSources(pluginCtx)).toEqual(new Set(ids))
    expect(loadEntryMock.mock.calls).toEqual(changed ? [[owner, 'page']] : [])
  })

  it('keeps source metadata from a later save outside the current refresh ownership', async () => {
    const ctx = createContext()
    const current = sourceId('pages/current.ts')
    const next = sourceId('pages/next.ts')
    const ids = [current, next]
    ctx.wxmlService.getAggregatedAutoImportComponents = vi.fn(() => ({ StableCard: [] }))
    const hook = useLoadEntry(ctx, { hmr: { requiredPublicationEntryIds: new Set(ids) } })
    seedEntries(hook, ids)
    ctx.runtimeState.build.hmr.profile.eventId = 'current'
    hook.markEntryDirty(current, 'direct')
    ctx.runtimeState.build.hmr.profile.eventId = 'next'
    hook.markEntryDirty(next, 'direct')
    ctx.runtimeState.build.hmr.profile.eventId = 'current'

    await emitWithExistingSources(hook, createPluginContext())

    expect(loadEntryMock.mock.calls).toEqual([[current, 'page']])
    expect(hook.dirtyEntrySet).toEqual(new Set([next]))
  })
})
