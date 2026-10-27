import { removeExtensionDeep } from '@weapp-core/shared'
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
})
