import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
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
})
