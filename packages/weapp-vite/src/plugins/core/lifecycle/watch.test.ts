import { fs } from '@weapp-core/shared/fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatchChangeHook } from './watch'

const invalidateFileCacheMock = vi.hoisted(() => vi.fn())
const invalidateEntryForSidecarMock = vi.hoisted(() => vi.fn(async () => {}))
const findJsEntryMock = vi.hoisted(() => vi.fn(async () => ({ path: null })))
const isTemplateMock = vi.hoisted(() => vi.fn(() => false))
const collectAffectedEntriesMock = vi.hoisted(() => vi.fn(() => new Set<string>()))
const collectAffectedEntriesFromSharedChunksMock = vi.hoisted(() => vi.fn(() => new Set<string>()))
const loggerSuccessMock = vi.hoisted(() => vi.fn())

vi.mock('../../utils/cache', () => ({
  invalidateFileCache: invalidateFileCacheMock,
}))

vi.mock('../../utils/invalidateEntry', () => ({
  ensureSidecarWatcher: vi.fn(),
  invalidateEntryForSidecar: invalidateEntryForSidecarMock,
}))

vi.mock('../../../utils/file', () => ({
  findJsEntry: findJsEntryMock,
  isTemplate: isTemplateMock,
}))

vi.mock('../helpers', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../helpers')
  return {
    ...actual,
    collectAffectedEntries: collectAffectedEntriesMock,
    collectAffectedEntriesFromSharedChunks: collectAffectedEntriesFromSharedChunksMock,
  }
})

vi.mock('../../../logger', () => ({
  default: {
    success: loggerSuccessMock,
  },
}))

function createState(overrides: Record<string, any> = {}) {
  return {
    ctx: {
      scanService: {
        markDirty: vi.fn(),
        independentSubPackageMap: new Map(),
        markIndependentDirty: vi.fn(),
      },
      buildService: {
        invalidateIndependentOutput: vi.fn(),
      },
      configService: {
        platform: 'weapp',
        multiPlatform: {
          enabled: false,
          projectConfigRoot: 'config',
          targets: ['weapp'],
        },
        absoluteSrcRoot: '/project/src',
        outDir: '/project/dist',
        relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
        relativeCwd: (id: string) => id.replace('/project/', ''),
        weappViteConfig: {},
      },
      wxmlService: {
        scan: vi.fn(async () => null),
      },
      autoRoutesService: {
        isRouteFile: vi.fn(() => false),
        handleFileChange: vi.fn(async () => false),
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {},
            vueEntryNonJsonSignatures: new Map(),
          },
        },
      },
    },
    subPackageMeta: null,
    loadEntry: {
      invalidateResolveCache: vi.fn(),
    },
    loadedEntrySet: new Set<string>(),
    entriesMap: new Map<string, { type: string }>(),
    layoutEntryDependents: new Map<string, Set<string>>(),
    markEntryDirty: vi.fn(),
    moduleImporters: new Map(),
    entryModuleIds: new Set(),
    hmrSharedChunksByModule: new Map(),
    hmrSharedChunkImporters: new Map(),
    hmrSharedChunksByEntry: new Map(),
    resolvedEntryMap: new Map(),
    ...overrides,
  } as any
}

describe('core lifecycle watch hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(fs, 'pathExists').mockResolvedValue(false)
    findJsEntryMock.mockResolvedValue({ path: null })
    isTemplateMock.mockReturnValue(false)
    collectAffectedEntriesMock.mockReturnValue(new Set())
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('marks template sidecar updates as direct entry dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr/index.wxml', { event: 'update' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/hmr/index.wxml')
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr/index.ts', 'direct')
  })

  it('marks html template updates as direct entry dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr-html/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr-html/index.html', { event: 'update' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/hmr-html/index.html')
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr-html/index.ts', 'direct')
  })

  it('records watch-to-dirty profile for the latest hmr file event', async () => {
    const entryId = '/project/src/pages/hmr/index.ts'
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.eventId).toBeTypeOf('string')
    expect(state.ctx.runtimeState.build.hmr.profile.file).toBe(entryId)
    expect(state.ctx.runtimeState.build.hmr.profile.watchToDirtyMs).toBeTypeOf('number')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-direct:1'])
  })

  it('ignores generated output changes inside outDir', async () => {
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/dist/pages/hmr/index.wxml', { event: 'update' })

    expect(state.markEntryDirty).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile).toEqual({})
  })

  it('marks loaded script updates as direct entry dirties', async () => {
    const entryId = '/project/src/pages/hmr/index.ts'
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'direct')
  })

  it('marks declared page source updates as direct entry dirties even before they enter loadedEntrySet', async () => {
    const entryId = '/project/src/pages/logs/index.vue'
    const state = createState({
      entriesMap: new Map([
        ['pages/logs/index', { type: 'page' }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'direct')
  })

  it('marks vue entry updates as metadata when only json macro content changed', async () => {
    const entryId = '/project/src/pages/logs/index.vue'
    const previousSource = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const nextSource = previousSource.replace('首页', '新标题')
    const { resolveVueSfcNonJsonSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      entryId,
      resolveVueSfcNonJsonSignature(previousSource, entryId),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-json-only:1'])
  })

  it('normalizes transient delete events on loaded scripts back to updates', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const entryId = '/project/src/pages/hmr/index.ts'
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'delete' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'direct')
    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
    expect(loggerSuccessMock).toHaveBeenCalledWith('[update] src/pages/hmr/index.ts')
  })

  it('does not mark deleted declared page entries as direct dirties after a real delete', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(false)
    const entryId = '/project/src/pages/logs/hmr-added.vue'
    const state = createState({
      entriesMap: new Map([
        ['pages/logs/hmr-added', { type: 'page' }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'delete' })

    expect(state.markEntryDirty).not.toHaveBeenCalledWith(entryId, 'direct')
    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(invalidateEntryForSidecarMock).toHaveBeenCalledWith(state.ctx, entryId, 'delete')
  })

  it('syncs auto-routes state before rebuilding a truly deleted route file', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(false)
    const entryId = '/project/src/pages/logs/hmr-added.vue'
    const baseState = createState()
    const state = {
      ...baseState,
      ctx: {
        ...baseState.ctx,
        autoRoutesService: {
          isRouteFile: vi.fn((id: string) => id === entryId),
          handleFileChange: vi.fn(async () => true),
        },
      },
    }
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'delete' })

    expect(state.ctx.autoRoutesService.handleFileChange).toHaveBeenCalledWith(entryId, 'delete')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['auto-routes-topology:1'])
  })

  it('normalizes transient delete events on template sidecars back to updates', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr/index.wxml', { event: 'delete' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/hmr/index.wxml')
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr/index.ts', 'direct')
    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
    expect(loggerSuccessMock).toHaveBeenCalledWith('[update] src/pages/hmr/index.wxml')
  })

  it('marks layout source updates as full dependency dirties across resolved entries', async () => {
    const entryId = '/project/src/layouts/default.vue'
    const pageEntry = '/project/src/pages/layout-store/index.vue'
    const dataEntry = '/project/src/pages/data/index.vue'
    const state = createState({
      loadedEntrySet: new Set([entryId]),
      resolvedEntryMap: new Map([
        [entryId, { id: entryId }],
        [pageEntry, { id: pageEntry }],
        [dataEntry, { id: dataEntry }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, entryId, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(3, dataEntry, 'dependency')
  })

  it('narrows layout source updates to tracked dependent entries when layout graph is available', async () => {
    const layoutEntry = '/project/src/layouts/default/index.ts'
    const pageEntry = '/project/src/pages/layout-a/index.ts'
    const dataEntry = '/project/src/pages/layout-b/index.ts'
    const unrelatedEntry = '/project/src/pages/plain/index.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [layoutEntry, { id: layoutEntry }],
        [pageEntry, { id: pageEntry }],
        [dataEntry, { id: dataEntry }],
        [unrelatedEntry, { id: unrelatedEntry }],
      ]),
      layoutEntryDependents: new Map([
        [layoutEntry, new Set([pageEntry, dataEntry])],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(layoutEntry, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(3)
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, layoutEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(3, dataEntry, 'dependency')
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(unrelatedEntry, 'dependency')
  })

  it('marks layout template sidecar updates as dependency dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/layouts/default/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/layouts/default/index.wxml', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/layouts/default/index.ts', 'dependency')
  })

  it('narrows layout sidecar updates to tracked dependent entries when layout graph is available', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/layouts/default/index.ts',
    })
    const layoutEntry = '/project/src/layouts/default/index.ts'
    const pageEntry = '/project/src/pages/layout-a/index.ts'
    const unrelatedEntry = '/project/src/pages/plain/index.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [layoutEntry, { id: layoutEntry }],
        [pageEntry, { id: pageEntry }],
        [unrelatedEntry, { id: unrelatedEntry }],
      ]),
      layoutEntryDependents: new Map([
        [layoutEntry, new Set([pageEntry])],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook('/project/src/layouts/default/index.wxml', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(2)
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, layoutEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, pageEntry, 'dependency')
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(unrelatedEntry, 'dependency')
  })

  it('marks html layout template sidecar updates as dependency dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/layouts/default/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/layouts/default/index.html', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/layouts/default/index.ts', 'dependency')
  })

  it('marks native layout dependency updates as dependency dirties', async () => {
    const entryId = '/project/src/pages/layouts/index.ts'
    const layoutId = '/project/src/layouts/default/index.ts'
    const state = createState({
      layoutEntryDependents: new Map([
        [layoutId, new Set([entryId])],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(layoutId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'dependency')
  })

  it('marks importer-driven invalidations as dependency dirties', async () => {
    const dependencyId = '/project/src/shared/store.ts'
    collectAffectedEntriesMock.mockReturnValue(new Set([
      '/project/src/pages/hmr/index.ts',
      '/project/src/pages/store/index.ts',
    ]))
    const state = createState({
      moduleImporters: new Map([
        [dependencyId, new Set(['/project/src/pages/hmr/index.ts'])],
      ]),
      entryModuleIds: new Set([
        '/project/src/pages/hmr/index.ts',
        '/project/src/pages/store/index.ts',
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, '/project/src/pages/hmr/index.ts', 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, '/project/src/pages/store/index.ts', 'dependency')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['importer-graph:2'])
  })

  it('marks shared chunk source updates as dependency dirties', async () => {
    const dependencyId = '/project/src/shared/tokens.ts'
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set([
      '/project/src/pages/native/index.ts',
      '/project/src/components/probe-card/index.ts',
    ]))
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, '/project/src/pages/native/index.ts', 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, '/project/src/components/probe-card/index.ts', 'dependency')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['shared-chunk-source:2'])
  })

  it('does not double count shared chunk entries already covered by importer graph', async () => {
    const dependencyId = '/project/src/shared/tokens.ts'
    const nativeEntry = '/project/src/pages/native/index.ts'
    const componentEntry = '/project/src/components/probe-card/index.ts'
    collectAffectedEntriesMock.mockReturnValue(new Set([nativeEntry, componentEntry]))
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set([nativeEntry, componentEntry]))
    const state = createState({
      moduleImporters: new Map([
        [dependencyId, new Set([nativeEntry])],
      ]),
      entryModuleIds: new Set([nativeEntry, componentEntry]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(2)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['importer-graph:2'])
  })

  it('normalizes transient delete events on shared dependencies back to dependency updates', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const dependencyId = '/project/src/shared/store.ts'
    collectAffectedEntriesMock.mockReturnValue(new Set([
      '/project/src/pages/hmr/index.ts',
      '/project/src/pages/store/index.ts',
    ]))
    const state = createState({
      moduleImporters: new Map([
        [dependencyId, new Set(['/project/src/pages/hmr/index.ts'])],
      ]),
      entryModuleIds: new Set([
        '/project/src/pages/hmr/index.ts',
        '/project/src/pages/store/index.ts',
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'delete' })

    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, '/project/src/pages/hmr/index.ts', 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, '/project/src/pages/store/index.ts', 'dependency')
    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
    expect(loggerSuccessMock).toHaveBeenCalledWith('[update] src/shared/store.ts')
  })

  it('invalidates resolve cache and sidecar entries on create', async () => {
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/components/HotCard/index.vue', { event: 'create' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(invalidateEntryForSidecarMock).toHaveBeenCalledWith(
      state.ctx,
      '/project/src/components/HotCard/index.vue',
      'create',
    )
  })

  it('invalidates resolve cache and sidecar entries on delete', async () => {
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/components/HotCard/index.vue', { event: 'delete' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(invalidateEntryForSidecarMock).toHaveBeenCalledWith(
      state.ctx,
      '/project/src/components/HotCard/index.vue',
      'delete',
    )
  })
})
