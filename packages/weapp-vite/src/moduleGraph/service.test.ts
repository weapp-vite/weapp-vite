import { describe, expect, it, vi } from 'vitest'
import {
  createLogicalEntryId,
  createSidecarModuleId,
  createSidecarSourceSpecifier,
  parseLogicalEntryId,
  parseSidecarModuleId,
  parseSidecarSourceRequest,
} from './protocol'
import { createModuleGraphService } from './service'

describe('module graph protocol', () => {
  it('round-trips logical entry and sidecar ids without exposing path separators', () => {
    const entryId = createLogicalEntryId('C:\\project\\src\\pages\\home\\index.ts', 'page')
    const sidecarId = createSidecarModuleId(
      'C:\\project\\src\\pages\\home\\index.ts',
      'C:\\project\\src\\pages\\home\\index.wxml',
      'template',
    )
    const sidecarSourceId = createSidecarSourceSpecifier(
      'C:\\project\\src\\pages\\home\\index.ts',
      'C:\\project\\src\\pages\\home\\index.wxml',
      'template',
    )
    const styleSourceId = createSidecarSourceSpecifier(
      'C:\\project\\src\\app.ts',
      'C:\\project\\src\\app.css',
      'style',
    )

    expect(parseLogicalEntryId(entryId)).toEqual({
      sourceId: 'C:/project/src/pages/home/index.ts',
      type: 'page',
    })
    expect(parseSidecarModuleId(sidecarId)).toEqual({
      kind: 'template',
      ownerId: 'C:/project/src/pages/home/index.ts',
      sourceId: 'C:/project/src/pages/home/index.wxml',
    })
    expect(parseSidecarSourceRequest(sidecarSourceId)).toEqual({
      kind: 'template',
      ownerId: 'C:/project/src/pages/home/index.ts',
      sourceId: 'C:/project/src/pages/home/index.wxml',
    })
    expect(styleSourceId).toBe('C:/project/src/app.css?weapp-vite-sidecar-owner=C%3A%2Fproject%2Fsrc%2Fapp.ts&weapp-vite-sidecar=style&lang.css')
    expect(parseSidecarSourceRequest(styleSourceId)).toEqual({
      kind: 'style',
      ownerId: 'C:/project/src/app.ts',
      sourceId: 'C:/project/src/app.css',
    })
  })
})

describe('ModuleGraphService', () => {
  it('traces static, dynamic, linked and sidecar importers from the build graph', () => {
    const pageId = '/project/src/pages/home/index.ts'
    const logicalId = createLogicalEntryId(pageId, 'page')
    const layoutId = '/project/src/layouts/default.vue'
    const nativeLayoutId = '/project/src/layouts/native/index.ts'
    const logicalLayoutId = createLogicalEntryId(layoutId, 'layout')
    const sidecarId = createSidecarModuleId(pageId, '/project/src/pages/home/index.wxml', 'template')
    const infos = new Map<string, any>([
      ['/project/src/shared/static.ts', { importers: [pageId], dynamicImporters: [] }],
      ['/project/src/shared/dynamic.ts', { importers: [], dynamicImporters: [pageId] }],
      ['/workspace/linked/util.ts', { importers: [pageId], dynamicImporters: [] }],
      [pageId, { importers: [logicalId], dynamicImporters: [] }],
      [layoutId, { importers: [logicalLayoutId], dynamicImporters: [] }],
      [logicalLayoutId, { importers: [logicalId], dynamicImporters: [] }],
      [sidecarId, { importers: [], dynamicImporters: [] }],
      [logicalId, { isEntry: true, importers: [], dynamicImporters: [] }],
    ])
    const service = createModuleGraphService()
    service.bindBuildContext({}, {
      getModuleIds: () => infos.keys(),
      getModuleInfo: id => infos.get(id),
    })
    service.bindPluginContext({ resolve: vi.fn() })

    expect(service.collectAffectedEntries('/project/src/shared/static.ts')).toEqual(new Set([pageId]))
    expect(service.collectAffectedEntries('/project/src/shared/dynamic.ts')).toEqual(new Set([pageId]))
    expect(service.collectAffectedEntries('/workspace/linked/util.ts')).toEqual(new Set([pageId]))
    expect(service.collectAffectedEntries('/project/src/pages/home/index.wxml')).toEqual(new Set([pageId]))
    expect(service.collectAffectedEntries(pageId)).toEqual(new Set([pageId]))
    expect(service.collectAffectedEntries(layoutId)).toEqual(new Set([layoutId, pageId]))
    service.replaceEntryDependencies(pageId, 'layout', [layoutId, nativeLayoutId])
    expect(service.isLogicalLayoutEntry(layoutId)).toBe(true)
    expect(service.isLogicalLayoutEntry(nativeLayoutId)).toBe(true)
  })

  it('keeps build graphs isolated by scope while plugin contexts change', () => {
    const firstEntry = '/project/src/pages/first/index.ts'
    const secondEntry = '/project/src/pages/second/index.ts'
    const firstDependency = '/project/src/shared/first.ts'
    const secondDependency = '/project/src/shared/second.ts'
    const firstLogical = createLogicalEntryId(firstEntry, 'page')
    const secondLogical = createLogicalEntryId(secondEntry, 'page')
    const createContext = (infos: Map<string, any>) => ({
      getModuleIds: () => infos.keys(),
      getModuleInfo: (id: string) => infos.get(id),
    })
    const service = createModuleGraphService()

    service.bindBuildContext({}, createContext(new Map([
      [firstDependency, { importers: [firstEntry] }],
      [firstEntry, { importers: [firstLogical] }],
      [firstLogical, { importers: [], isEntry: true }],
    ])))
    service.bindBuildContext({}, createContext(new Map([
      [secondDependency, { importers: [secondEntry] }],
      [secondEntry, { importers: [secondLogical] }],
      [secondLogical, { importers: [], isEntry: true }],
    ])))
    service.bindPluginContext({ resolve: vi.fn() })

    expect(service.collectAffectedEntries(firstDependency)).toEqual(new Set([firstEntry]))
    expect(service.collectAffectedEntries(secondDependency)).toEqual(new Set([secondEntry]))
  })

  it('uses the dev server module graph for read-only traversal and invalidation', () => {
    const pageId = '/project/src/pages/home/index.ts'
    const logicalId = createLogicalEntryId(pageId, 'page')
    const logicalNode = { id: logicalId, importers: new Set() }
    const pageNode = { id: pageId, file: pageId, importers: new Set([logicalNode]) }
    const dependencyNode = {
      id: '/project/src/shared/value.ts',
      file: '/project/src/shared/value.ts',
      importers: new Set([pageNode]),
    }
    const invalidateModule = vi.fn()
    const service = createModuleGraphService()
    service.bindDevServer({
      moduleGraph: {
        getModulesByFile: file => file === dependencyNode.file ? new Set([dependencyNode]) : undefined,
        getModuleById: id => id === logicalId ? logicalNode : undefined,
        idToModuleMap: new Map([
          [logicalId, logicalNode],
          [pageId, pageNode],
          [dependencyNode.id, dependencyNode],
        ]),
        invalidateModule,
      },
    })

    expect(service.collectAffectedEntries(dependencyNode.file)).toEqual(new Set([pageId]))
    expect(service.invalidate(dependencyNode.file)).toEqual(new Set([pageId]))
    expect(invalidateModule).toHaveBeenCalledWith(dependencyNode)
  })

  it('uses the bound dev graph instead of merging stale build importers', () => {
    const file = '/project/src/shared/value.ts'
    const staleEntry = '/project/src/pages/stale/index.ts'
    const staleLogical = createLogicalEntryId(staleEntry, 'page')
    const currentEntry = '/project/src/pages/current/index.ts'
    const currentLogical = createLogicalEntryId(currentEntry, 'page')
    const currentLogicalNode = { id: currentLogical, importers: new Set() }
    const currentEntryNode = { id: currentEntry, importers: new Set([currentLogicalNode]) }
    const currentFileNode = { id: file, file, importers: new Set([currentEntryNode]) }
    const service = createModuleGraphService()

    service.bindBuildContext({}, {
      getModuleIds: () => [file, staleEntry, staleLogical],
      getModuleInfo: id => new Map<string, any>([
        [file, { importers: [staleEntry] }],
        [staleEntry, { importers: [staleLogical] }],
        [staleLogical, { importers: [] }],
      ]).get(id),
    })
    service.bindDevServer({
      moduleGraph: {
        getModulesByFile: id => id === file ? new Set([currentFileNode]) : undefined,
        getModuleById: id => id === currentLogical ? currentLogicalNode : undefined,
        invalidateModule: vi.fn(),
      },
    })

    expect(service.collectAffectedEntries(file)).toEqual(new Set([currentEntry]))
  })

  it('warms logical roots and their current dev graph dependencies without caching edges', async () => {
    const pageId = '/project/src/pages/home/index.ts'
    const logicalId = createLogicalEntryId(pageId, 'page')
    const dependencyId = '/project/src/shared/value.ts'
    const dependencyNode = { id: dependencyId, url: dependencyId, importedModules: new Set() }
    const logicalNode = {
      id: logicalId,
      url: logicalId,
      importedModules: new Set([dependencyNode]),
    }
    const transformRequest = vi.fn(async () => undefined)
    const service = createModuleGraphService()
    service.bindDevServer({
      moduleGraph: {
        getModulesByFile: () => undefined,
        getModuleById: id => id === logicalId ? logicalNode : id === dependencyId ? dependencyNode : undefined,
        invalidateModule: vi.fn(),
      },
      transformRequest,
    })

    await service.syncDevGraph({
      getModuleIds: () => [logicalId, dependencyId],
    })

    expect(transformRequest).toHaveBeenCalledWith(logicalId)
    expect(transformRequest).toHaveBeenCalledWith(dependencyId)
  })

  it('funnels topology changes through one consumable full-rescan request', () => {
    const service = createModuleGraphService()
    service.requestTopologyRescan('sidecar-create', '/project/src/pages/home/index.json')
    service.requestTopologyRescan('sidecar-delete', '/project/src/pages/home/index.wxml')

    expect(service.consumeTopologyRescan()).toEqual({
      files: new Set([
        '/project/src/pages/home/index.json',
        '/project/src/pages/home/index.wxml',
      ]),
      reasons: new Set(['sidecar-create', 'sidecar-delete']),
    })
    expect(service.consumeTopologyRescan()).toBeUndefined()
  })

  it('records only changed physical ids between graph lifecycles', () => {
    const service = createModuleGraphService()
    service.recordChangedFile('/project/src/pages/home/index.json?raw', 'update')
    service.recordChangedFile('/project/src/pages/home/index.json', 'create')

    expect(service.getPendingChanges()).toEqual([
      { event: 'create', file: '/project/src/pages/home/index.json' },
    ])
    service.clearPendingChanges()
    expect(service.getPendingChanges()).toEqual([])
  })

  it('routes resolution and loading through the active plugin context', async () => {
    const resolve = vi.fn(async (source: string) => ({ id: `/resolved/${source}` }))
    const load = vi.fn(async ({ id }: { id: string }) => ({ code: `export default ${JSON.stringify(id)}` }))
    const service = createModuleGraphService()
    service.bindPluginContext({ resolve, load })

    await expect(service.resolve('pkg', '/project/src/app.ts')).resolves.toEqual({ id: '/resolved/pkg' })
    await expect(service.load({ id: '/resolved/pkg' })).resolves.toEqual({ code: 'export default "/resolved/pkg"' })
  })
})
