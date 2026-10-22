import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { createHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from '../../../runtime/hmrStyleUpdate'
import { createBuildEndHook } from './end'

function createState(file: string, entryId: string) {
  const moduleGraphService = createModuleGraphService()
  const logicalId = createLogicalEntryId(entryId, 'page')
  const sidecarId = createSidecarModuleId(entryId, file, 'json')
  const sourceId = createSidecarSourceSpecifier(entryId, file, 'json')
  const infos = new Map<string, any>([
    [sourceId, { importers: [sidecarId] }],
    [sidecarId, { importers: [logicalId] }],
    [logicalId, { importers: [], isEntry: true }],
  ])
  const loadEntry = vi.fn()
  const state = {
    ctx: {
      configService: {
        relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
      },
      moduleGraphService,
      runtimeState: {
        build: {
          hmr: {
            profile: {},
          },
        },
      },
    },
    entriesMap: new Map([['pages/home/index', { type: 'page' }]]),
    hmrRootInputIds: new Set<string>(),
    hmrState: {
      didEmitAllEntries: false,
      lastHmrEntryIds: new Set<string>(),
      lastEmittedEntryIds: new Set<string>(),
      skipSharedChunkRefresh: false,
    },
    loadedEntrySet: new Set([entryId]),
    loadEntry,
    resolvedEntryMap: new Map([[entryId, { id: entryId }]]),
  } as any
  const pluginContext = {
    getModuleIds: () => infos.keys(),
    getModuleInfo: (id: string) => infos.get(id),
  }
  return { loadEntry, moduleGraphService, pluginContext, state }
}

describe('core lifecycle buildEnd hook', () => {
  it.each([false, true])('records publication lifecycle independently of profile fields (rebuilt=%s)', async (hasBuiltOnce) => {
    const { moduleGraphService, pluginContext, state } = createState('/project/src/pages/home/index.json', '/project/src/pages/home/index.ts')
    state.hmrState.hasBuiltOnce = hasBuiltOnce
    moduleGraphService.recordChangedFile('/project/src/pages/home/index.json', 'update')
    moduleGraphService.recordChangedFile('/project/src/pages/home/index.wxss', 'update')
    await createBuildEndHook(state).call(pluginContext)
    expect(state.ctx.runtimeState.build.hmr.isRebuild).toBe(hasBuiltOnce)
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBeUndefined()
    expect(state.ctx.runtimeState.build.hmr.profile.file).toBeUndefined()
  })

  it.each([
    { isDev: false, watch: undefined, full: true },
    { isDev: false, watch: {}, full: true },
    { isDev: true, watch: {}, full: false },
  ])('preserves production snapshots and classic incremental semantics ($isDev/$watch)', async ({ isDev, watch, full }) => {
    const file = '/project/src/pages/home/index.json'
    const entryId = '/project/src/pages/home/index.ts'
    const { moduleGraphService, pluginContext, state } = createState(file, entryId)
    state.ctx.configService.isDev = isDev
    state.resolvedConfig = { build: { emptyOutDir: true, watch } }
    moduleGraphService.recordChangedFile(file, 'update')

    await createBuildEndHook(state).call(pluginContext)

    expect(state.hmrState.didEmitAllEntries).toBe(full)
    expect(state.hmrState.skipSharedChunkRefresh).toBe(!full)
    expect(state.ctx.runtimeState.build.hmr.didEmitAllEntries).toBe(full)
  })

  it('resolves a pending sidecar through the active graph and refreshes metadata only', async () => {
    const file = '/project/src/pages/home/index.json'
    const entryId = '/project/src/pages/home/index.ts'
    const { loadEntry, moduleGraphService, pluginContext, state } = createState(file, entryId)
    moduleGraphService.recordChangedFile(file, 'update')

    await createBuildEndHook(state).call(pluginContext)

    expect(loadEntry).toHaveBeenCalledWith(entryId, 'page', { metadataOnly: true })
    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([entryId]))
    expect(state.hmrState.skipSharedChunkRefresh).toBe(true)
    expect(state.ctx.runtimeState.build.hmr.profile).toMatchObject({
      dirtyCount: 1,
      emittedCount: 1,
      pendingCount: 1,
      dirtyReasonSummary: ['json-sidecar:1'],
    })
  })

  it('leaves script dependencies to Rolldown chunk emission', async () => {
    const file = '/project/src/shared/value.ts'
    const entryId = '/project/src/pages/home/index.ts'
    const { loadEntry, moduleGraphService, pluginContext, state } = createState(file, entryId)
    const logicalId = createLogicalEntryId(entryId, 'page')
    const infos = new Map<string, any>([
      [file, { importers: [entryId] }],
      [entryId, { importers: [logicalId] }],
      [logicalId, { importers: [], isEntry: true }],
    ])
    moduleGraphService.recordChangedFile(file, 'update')

    await createBuildEndHook(state).call({
      getModuleIds: () => infos.keys(),
      getModuleInfo: (id: string) => infos.get(id),
    })

    expect(loadEntry).not.toHaveBeenCalled()
    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([entryId]))
    expect(state.hmrState.skipSharedChunkRefresh).toBe(false)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['importer-graph:1'])
    expect(pluginContext).toBeDefined()
  })

  it('keeps direct entry diagnostics when graph traversal resolves the changed entry itself', async () => {
    const entryId = '/project/src/pages/home/index.ts'
    const { loadEntry, moduleGraphService, state } = createState(entryId, entryId)
    const logicalId = createLogicalEntryId(entryId, 'page')
    const infos = new Map<string, any>([
      [entryId, { importers: [logicalId] }],
      [logicalId, { importers: [], isEntry: true }],
    ])
    moduleGraphService.recordChangedFile(entryId, 'update')

    await createBuildEndHook(state).call({
      getModuleIds: () => infos.keys(),
      getModuleInfo: (id: string) => infos.get(id),
    })

    expect(loadEntry).not.toHaveBeenCalled()
    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([entryId]))
    expect(state.hmrState.skipSharedChunkRefresh).toBe(false)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-direct:1'])
  })

  it('preserves compiler-owned App metadata when the physical graph only resolves the changed page', async () => {
    const page = '/project/src/pages/home/index.vue'
    const app = '/project/src/app.vue'
    const { loadEntry, moduleGraphService, state } = createState(page, page)
    const logicalId = createLogicalEntryId(page, 'page')
    const infos = new Map<string, any>([
      [page, { importers: [logicalId] }],
      [logicalId, { importers: [], isEntry: true }],
    ])
    state.resolvedEntryMap.set(app, { id: app })
    state.hmrState.lastHmrEntryIds = new Set([page, app])
    state.hmrState.lastEmittedEntryIds = new Set([page])
    moduleGraphService.recordChangedFile(page, 'update')
    const plan = createHmrStyleUpdatePlan([page], { compilerContentOwners: [[app, 'tailwind-content']] })

    await withHmrStyleUpdatePlan(state.ctx.configService, plan, async () => {
      await createBuildEndHook(state).call({
        getModuleIds: () => infos.keys(),
        getModuleInfo: (id: string) => infos.get(id),
      })
      expect(plan.compilerContentOwners.get(app)).toBe('tailwind-content')
    })

    expect(loadEntry).not.toHaveBeenCalled()
    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([page, app]))
    expect(state.ctx.runtimeState.build.hmr.lastHmrEntryIds).toEqual(new Set([page, app]))
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-direct:1'])
  })

  it.each([
    { fullEntryScan: false, fullSnapshotOutput: false, fullStyle: false, full: false },
    { fullEntryScan: true, fullSnapshotOutput: false, fullStyle: false, full: true },
    { fullEntryScan: false, fullSnapshotOutput: true, fullStyle: false, full: true },
    { fullEntryScan: false, fullSnapshotOutput: false, fullStyle: true, full: false },
  ])('uses actual output completeness after every script entry was emitted (entry=$fullEntryScan/snapshot=$fullSnapshotOutput/style=$fullStyle)', async ({ fullEntryScan, fullSnapshotOutput, fullStyle, full }) => {
    const page = '/project/src/pages/home/index.vue'
    const app = '/project/src/app.js'
    const { moduleGraphService, state } = createState(page, page)
    const logicalId = createLogicalEntryId(page, 'page')
    const infos = new Map<string, any>([
      [page, { importers: [logicalId] }],
      [logicalId, { importers: [], isEntry: true }],
    ])
    state.ctx.configService.isDev = true
    state.ctx.runtimeState.build.hmr.fullEntryScan = fullEntryScan
    state.ctx.runtimeState.build.hmr.fullSnapshotOutput = fullSnapshotOutput
    // loader 可以重发全部脚本，而未变化的原生 JSON 仍由增量缓存持有。
    state.hmrState.didEmitAllEntries = true
    state.ctx.runtimeState.build.hmr.didEmitAllEntries = true
    state.hmrState.hasBuiltOnce = true
    state.resolvedEntryMap.set(app, { id: app })
    state.hmrState.lastHmrEntryIds = new Set([page, app])
    state.hmrState.lastEmittedEntryIds = new Set([page, app])
    moduleGraphService.recordChangedFile(page, 'update')
    const plan = createHmrStyleUpdatePlan([page], { full: fullStyle, compilerContentOwners: [[app, 'tailwind-content']] })

    await withHmrStyleUpdatePlan(state.ctx.configService, plan, async () => {
      await createBuildEndHook(state).call({
        getModuleIds: () => infos.keys(),
        getModuleInfo: (id: string) => infos.get(id),
      })
    })

    expect(state.hmrState.didEmitAllEntries).toBe(full)
    expect(state.ctx.runtimeState.build.hmr.didEmitAllEntries).toBe(full)
    expect(state.ctx.runtimeState.build.hmr.lastHmrEntryIds).toEqual(new Set([page, app]))
    expect(state.hmrState.skipSharedChunkRefresh).toBe(false)
  })

  it('keeps logical layout script changes on the chunk emission path', async () => {
    const layoutEntry = '/project/src/layouts/default/index.ts'
    const pageEntry = '/project/src/pages/home/index.ts'
    const { loadEntry, moduleGraphService, state } = createState(layoutEntry, layoutEntry)
    const layoutLogicalId = createLogicalEntryId(layoutEntry, 'layout')
    const pageLogicalId = createLogicalEntryId(pageEntry, 'page')
    const infos = new Map<string, any>([
      [layoutEntry, { importers: [layoutLogicalId] }],
      [layoutLogicalId, { importers: [pageLogicalId], isEntry: true }],
      [pageLogicalId, { importers: [], isEntry: true }],
    ])
    state.resolvedEntryMap.set(pageEntry, { id: pageEntry })
    moduleGraphService.replaceEntryDependencies(pageEntry, 'layout', [layoutEntry])
    moduleGraphService.recordChangedFile(layoutEntry, 'update')

    await createBuildEndHook(state).call({
      getModuleIds: () => infos.keys(),
      getModuleInfo: (id: string) => infos.get(id),
    })

    expect(loadEntry).not.toHaveBeenCalled()
    expect(state.hmrState.lastHmrEntryIds).toEqual(new Set([layoutEntry, pageEntry]))
    expect(state.hmrState.skipSharedChunkRefresh).toBe(false)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['layout-script:2'])
  })

  it('distinguishes direct style sidecars from imported css dependencies', async () => {
    const entryId = '/project/src/pages/home/index.vue'
    const importedStyle = '/project/src/pages/home/theme.css'
    const { moduleGraphService, state } = createState(importedStyle, entryId)
    const logicalId = createLogicalEntryId(entryId, 'page')
    const importedSidecarId = createSidecarModuleId(entryId, importedStyle, 'style')
    const importedSourceId = createSidecarSourceSpecifier(entryId, importedStyle, 'style')
    const importedInfos = new Map<string, any>([
      [importedSourceId, { importers: [importedSidecarId] }],
      [importedSidecarId, { importers: [logicalId] }],
      [logicalId, { importers: [], isEntry: true }],
    ])
    moduleGraphService.recordChangedFile(importedStyle, 'update')

    await createBuildEndHook(state).call({
      getModuleIds: () => importedInfos.keys(),
      getModuleInfo: (id: string) => importedInfos.get(id),
    })

    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['css-importer:1'])
    expect(state.hmrState.styleSidecarFiles).toEqual(new Set())

    const directStyle = '/project/src/pages/home/index.css'
    const direct = createState(directStyle, entryId)
    const directSidecarId = createSidecarModuleId(entryId, directStyle, 'style')
    const directSourceId = createSidecarSourceSpecifier(entryId, directStyle, 'style')
    const directInfos = new Map<string, any>([
      [directSourceId, { importers: [directSidecarId] }],
      [directSidecarId, { importers: [logicalId] }],
      [logicalId, { importers: [], isEntry: true }],
    ])
    direct.moduleGraphService.recordChangedFile(directStyle, 'update')

    await createBuildEndHook(direct.state).call({
      getModuleIds: () => directInfos.keys(),
      getModuleInfo: (id: string) => directInfos.get(id),
    })

    expect(direct.state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['style-sidecar:1'])
    expect(direct.state.hmrState.styleSidecarFiles).toEqual(new Set([directStyle]))

    direct.moduleGraphService.clearPendingChanges()
    await createBuildEndHook(direct.state).call({
      getModuleIds: () => directInfos.keys(),
      getModuleInfo: (id: string) => directInfos.get(id),
    })
    expect(direct.state.hmrState.styleSidecarFiles).toEqual(new Set())
  })
})
