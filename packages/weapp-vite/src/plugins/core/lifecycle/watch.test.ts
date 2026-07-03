import { fs } from '@weapp-core/shared/fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBuildStartHook, createWatchChangeHook } from './watch'

const invalidateFileCacheMock = vi.hoisted(() => vi.fn())
const invalidateEntryForSidecarMock = vi.hoisted(() => vi.fn(async () => {}))
const collectAffectedScriptsAndImportersMock = vi.hoisted(() => vi.fn(async () => ({
  importers: new Set<string>(),
  scripts: new Set<string>(),
})))
const extractCssImportDependenciesMock = vi.hoisted(() => vi.fn(async () => {}))
const findCssEntryMock = vi.hoisted(() => vi.fn(async () => ({ path: null })))
const findJsEntryMock = vi.hoisted(() => vi.fn(async () => ({ path: null })))
const findVueEntryMock = vi.hoisted(() => vi.fn(async () => undefined))
const invalidateSharedStyleCacheMock = vi.hoisted(() => vi.fn())
const isTemplateMock = vi.hoisted(() => vi.fn(() => false))
const resolveTouchAppWxssEnabledMock = vi.hoisted(() => vi.fn(() => false))
const collectAffectedEntriesMock = vi.hoisted(() => vi.fn(() => new Set<string>()))
const collectAffectedEntriesFromSharedChunksMock = vi.hoisted(() => vi.fn(() => new Set<string>()))
const collectAffectedSharedChunksMock = vi.hoisted(() => vi.fn(() => new Set<string>()))
const collectAffectedSharedChunkEntriesAndChunksMock = vi.hoisted(() => vi.fn(() => ({
  affectedChunks: new Set<string>(),
  affectedEntries: new Set<string>(),
})))
const loggerSuccessMock = vi.hoisted(() => vi.fn())

vi.mock('../../utils/cache', () => ({
  invalidateFileCache: invalidateFileCacheMock,
}))

vi.mock('../../utils/invalidateEntry', () => ({
  ensureSidecarWatcher: vi.fn(),
  invalidateEntryForSidecar: invalidateEntryForSidecarMock,
}))

vi.mock('../../utils/invalidateEntry/cssGraph', () => ({
  collectAffectedScriptsAndImporters: collectAffectedScriptsAndImportersMock,
  extractCssImportDependencies: extractCssImportDependenciesMock,
}))

vi.mock('../../css/shared/preprocessor', () => ({
  invalidateSharedStyleCache: invalidateSharedStyleCacheMock,
}))

vi.mock('../../../utils/file', () => ({
  findCssEntry: findCssEntryMock,
  findJsEntry: findJsEntryMock,
  findVueEntry: findVueEntryMock,
  isTemplate: isTemplateMock,
}))

vi.mock('../../../runtime/buildPlugin/touchAppWxss', () => ({
  resolveTouchAppWxssEnabled: resolveTouchAppWxssEnabledMock,
}))

vi.mock('../helpers', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../helpers')
  return {
    ...actual,
    collectAffectedEntries: collectAffectedEntriesMock,
    collectAffectedEntriesFromSharedChunks: collectAffectedEntriesFromSharedChunksMock,
    collectAffectedSharedChunkEntriesAndChunks: collectAffectedSharedChunkEntriesAndChunksMock,
    collectAffectedSharedChunks: collectAffectedSharedChunksMock,
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
        appEntry: undefined,
        independentSubPackageMap: new Map(),
        markIndependentDirty: vi.fn(),
      },
      buildService: {
        invalidateIndependentOutput: vi.fn(),
        requestConfigRestart: vi.fn(),
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
        cwd: '/project',
        packageJson: {},
        isDev: true,
        configFileDependencies: [],
      },
      wxmlService: {
        scan: vi.fn(async () => null),
        getImporters: vi.fn(() => new Set<string>()),
        getImporterDependencyKind: vi.fn(() => undefined),
      },
      autoRoutesService: {
        isRouteFile: vi.fn(() => false),
        handleFileChange: vi.fn(async () => false),
      },
      runtimeState: {
        build: {
          hmr: {
            profile: {},
            vueEntryHasTemplate: new Map(),
            vueEntryNonJsonSignatures: new Map(),
            vueEntryScriptSignatures: new Map(),
            vueEntryStyleIndependentSignatures: new Map(),
            vueEntryTailwindContentSignatures: new Map(),
            dirtyVueEntryIds: new Set(),
          },
        },
      },
    },
    subPackageMeta: null,
    loadEntry: {
      invalidateResolveCache: vi.fn(),
    },
    emitDirtyEntries: vi.fn(async () => {}),
    buildTarget: 'app',
    loadedEntrySet: new Set<string>(),
    entriesMap: new Map<string, { type: string }>(),
    jsonEmitFilesMap: new Map(),
    layoutEntryDependents: new Map<string, Set<string>>(),
    markEntryDirty: vi.fn(),
    moduleImporters: new Map(),
    entryModuleIds: new Set(),
    hmrState: {
      didEmitAllEntries: false,
      hasBuiltOnce: true,
      affectedSharedChunkIds: new Set<string>(),
      lastHmrEntryIds: new Set<string>(),
      lastEmittedEntryIds: new Set<string>(),
      skipSharedChunkRefresh: false,
    },
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
    findCssEntryMock.mockResolvedValue({ path: null })
    findJsEntryMock.mockResolvedValue({ path: null })
    findVueEntryMock.mockResolvedValue(undefined)
    resolveTouchAppWxssEnabledMock.mockReturnValue(false)
    collectAffectedScriptsAndImportersMock.mockResolvedValue({
      importers: new Set<string>(),
      scripts: new Set<string>(),
    })
    isTemplateMock.mockReturnValue(false)
    collectAffectedEntriesMock.mockReturnValue(new Set())
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set())
    collectAffectedSharedChunksMock.mockReturnValue(new Set())
    collectAffectedSharedChunkEntriesAndChunksMock.mockImplementation(() => ({
      affectedChunks: collectAffectedSharedChunksMock(),
      affectedEntries: collectAffectedEntriesFromSharedChunksMock(),
    }))
  })

  it('adds loaded config dependencies to dev build watch files', async () => {
    const state = createState()
    state.ctx.configService.configFileDependencies = [
      '/project/vite.config.mts',
      '/project/config/shared.ts',
    ]
    const addWatchFile = vi.fn()
    const buildStart = createBuildStartHook(state)

    await buildStart.call({ addWatchFile })

    expect(addWatchFile).toHaveBeenCalledWith('/project/vite.config.mts')
    expect(addWatchFile).toHaveBeenCalledWith('/project/config/shared.ts')
    expect(state.ctx.runtimeState.build.hmr.profile.buildStartMs).toBeTypeOf('number')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('marks template sidecar updates as metadata entry dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr/index.wxml', { event: 'update' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/hmr/index.wxml')
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr/index.ts', 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['sidecar-direct:1'])
  })

  it('does not expand sidecar updates through stale shared chunk importers', async () => {
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr/index.ts',
    })
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set([
      '/project/src/pages/hmr/index.ts',
      '/project/src/pages/other/index.ts',
    ]))
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr/index.css', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr/index.ts', 'metadata')
    expect(collectAffectedEntriesFromSharedChunksMock).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['style-sidecar:1'])
  })

  it('does not expand style sidecar updates through stale importer graph records', async () => {
    const styleId = '/project/src/pages/hmr/index.scss'
    const entryId = '/project/src/pages/hmr/index.ts'
    const staleImporterId = '/project/src/pages/other/index.ts'
    findJsEntryMock.mockResolvedValue({
      path: entryId,
    })
    collectAffectedEntriesMock.mockReturnValue(new Set([
      entryId,
      staleImporterId,
    ]))
    const state = createState({
      moduleImporters: new Map([
        [styleId, new Set([entryId, staleImporterId])],
      ]),
      entryModuleIds: new Set([entryId, staleImporterId]),
    })
    const hook = createWatchChangeHook(state)

    await hook(styleId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'metadata')
    expect(collectAffectedEntriesMock).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['style-sidecar:1'])
  })

  it('marks style sidecar updates separately for asset-only preloading', async () => {
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/components/x-child/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/components/x-child/index.wxss', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/components/x-child/index.ts', 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['style-sidecar:1'])
  })

  it('maps emitted app side json updates back to the app entry', async () => {
    const appEntry = '/project/src/app.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
      ]),
      jsonEmitFilesMap: new Map([
        [
          'sitemap.json',
          {
            fileName: 'sitemap.json',
            entry: {
              fileName: 'sitemap.json',
              jsonPath: '/project/src/sitemap.json',
              json: {},
              type: 'page',
            },
          },
        ],
      ]),
    })
    state.ctx.scanService.appEntry = {
      path: appEntry,
    }
    const hook = createWatchChangeHook(state)

    await hook('/project/src/sitemap.json', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['json-sidecar:1'])
  })

  it('normalizes transient create events on emitted app side json back to updates', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true)
    const appEntry = '/project/src/app.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
      ]),
      jsonEmitFilesMap: new Map([
        [
          'sitemap.json',
          {
            fileName: 'sitemap.json',
            entry: {
              fileName: 'sitemap.json',
              jsonPath: '/project/src/sitemap.json',
              json: {},
              type: 'page',
            },
          },
        ],
      ]),
    })
    state.ctx.scanService.appEntry = {
      path: appEntry,
    }
    const hook = createWatchChangeHook(state)

    await hook('/project/src/sitemap.json', { event: 'create' })

    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
    expect(state.markEntryDirty).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['json-sidecar:1'])
  })

  it('marks css importer vue entries dirty so style-only transform cache can refresh', async () => {
    const dependencyId = '/project/src/pages/index/hello.css'
    const vueEntry = '/project/src/pages/index/index.vue'
    collectAffectedScriptsAndImportersMock.mockResolvedValue({
      importers: new Set([vueEntry]),
      scripts: new Set<string>(),
    })
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set([
      '/project/src/pages/other/index.vue',
    ]))
    const state = createState({
      loadedEntrySet: new Set([vueEntry]),
      resolvedEntryMap: new Map([
        [vueEntry, { id: vueEntry }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'update' })

    expect(collectAffectedScriptsAndImportersMock).toHaveBeenCalledWith(state.ctx, dependencyId)
    expect(extractCssImportDependenciesMock).toHaveBeenCalledWith(state.ctx, dependencyId)
    expect(extractCssImportDependenciesMock.mock.invocationCallOrder[0])
      .toBeLessThan(collectAffectedScriptsAndImportersMock.mock.invocationCallOrder[0]!)
    expect(state.markEntryDirty).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(vueEntry, 'direct')
    expect(state.ctx.runtimeState.build.hmr.dirtyVueEntryIds).toEqual(new Set([vueEntry]))
    expect(collectAffectedEntriesFromSharedChunksMock).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['css-importer:1'])
  })

  it('does not force vue recompilation for dependency-only shared chunk updates', async () => {
    const sharedModuleId = '/project/src/shared/tokens.ts'
    const vueEntry = '/project/src/pages/index/index.vue'
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set([vueEntry]))
    collectAffectedSharedChunksMock.mockReturnValue(new Set(['common.js']))
    const state = createState({
      resolvedEntryMap: new Map([
        [vueEntry, { id: vueEntry }],
      ]),
      hmrSharedChunksByModule: new Map([
        [sharedModuleId, new Set(['common.js'])],
      ]),
      hmrSharedChunkImporters: new Map([
        ['common.js', new Set([vueEntry])],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(sharedModuleId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(vueEntry, 'dependency')
    expect(state.ctx.runtimeState.build.hmr.dirtyVueEntryIds).toEqual(new Set())
    expect(state.hmrState.affectedSharedChunkIds).toEqual(new Set(['common.js']))
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['shared-chunk-source:1'])
  })

  it('treats created style files as update-like css importers after atomic saves', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false)
    const dependencyId = '/project/src/pages/index/hello.css'
    const vueEntry = '/project/src/pages/index/index.vue'
    collectAffectedScriptsAndImportersMock.mockResolvedValue({
      importers: new Set([vueEntry]),
      scripts: new Set<string>(),
    })
    const state = createState({
      loadedEntrySet: new Set([vueEntry]),
      resolvedEntryMap: new Map([
        [vueEntry, { id: vueEntry }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'create' })

    expect(extractCssImportDependenciesMock).toHaveBeenCalledWith(state.ctx, dependencyId)
    expect(collectAffectedScriptsAndImportersMock).toHaveBeenCalledWith(state.ctx, dependencyId)
    expect(extractCssImportDependenciesMock.mock.invocationCallOrder[0])
      .toBeLessThan(collectAffectedScriptsAndImportersMock.mock.invocationCallOrder[0]!)
    expect(state.markEntryDirty).toHaveBeenCalledWith(vueEntry, 'direct')
    expect(state.ctx.runtimeState.build.hmr.dirtyVueEntryIds).toEqual(new Set([vueEntry]))
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('create')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['css-importer:1'])
  })

  it('marks same-name vue entry dirty for external style sidecars', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false)
    const styleId = '/project/src/pages/index/index.css'
    const vueEntry = '/project/src/pages/index/index.vue'
    findVueEntryMock.mockResolvedValue(vueEntry)
    const state = createState({
      resolvedEntryMap: new Map([
        [vueEntry, { id: vueEntry }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(styleId, { event: 'create' })

    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(findVueEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(collectAffectedScriptsAndImportersMock).not.toHaveBeenCalled()
    expect(state.markEntryDirty).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(vueEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.dirtyVueEntryIds).toEqual(new Set([vueEntry]))
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['style-sidecar:1'])
  })

  it('falls back to resolved entries when created style dependency graph has no importers yet', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false)
    const dependencyId = '/project/src/shared/styles/shared.scss'
    const pageEntry = '/project/src/pages/native/index.ts'
    const componentEntry = '/project/src/components/probe-card/index.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [pageEntry, { id: pageEntry }],
        [componentEntry, { id: componentEntry }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'create' })

    expect(extractCssImportDependenciesMock).toHaveBeenCalledWith(state.ctx, dependencyId)
    expect(collectAffectedScriptsAndImportersMock).toHaveBeenCalledWith(state.ctx, dependencyId)
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(componentEntry, 'dependency')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['css-importer-fallback:2'])
  })

  it('treats created existing shared templates as update-like wxml importers after atomic saves', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true)
    isTemplateMock.mockReturnValue(true)
    const sharedTemplate = '/project/src/shared/templates/card.wxml'
    const importerTemplate = '/project/src/pages/native/index.wxml'
    const importerEntry = '/project/src/pages/native/index.ts'
    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/pages/native/index') {
        return { path: importerEntry }
      }
      return { path: null }
    })
    const state = createState()
    state.ctx.wxmlService.getImporters.mockImplementation((value: string) => {
      return value === sharedTemplate ? new Set([importerTemplate]) : new Set()
    })
    state.ctx.wxmlService.getImporterDependencyKind.mockImplementation((dep: string, importer: string) => {
      return dep === sharedTemplate && importer === importerTemplate ? 'template-import' : undefined
    })
    const hook = createWatchChangeHook(state)

    await hook(sharedTemplate, { event: 'create' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith(sharedTemplate)
    expect(state.ctx.wxmlService.getImporters).toHaveBeenCalledWith(sharedTemplate)
    expect(state.markEntryDirty).toHaveBeenCalledWith(importerEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['wxml-importer-import:1'])
  })

  it('walks recursively queued wxml importers without missing later entries', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true)
    isTemplateMock.mockReturnValue(true)
    const sharedTemplate = '/project/src/shared/templates/root.wxml'
    const intermediateTemplate = '/project/src/shared/templates/intermediate.wxml'
    const importerTemplate = '/project/src/pages/native/index.wxml'
    const importerEntry = '/project/src/pages/native/index.ts'
    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/pages/native/index') {
        return { path: importerEntry }
      }
      return { path: null }
    })
    const state = createState()
    state.ctx.wxmlService.getImporters.mockImplementation((value: string) => {
      if (value === sharedTemplate) {
        return new Set([intermediateTemplate])
      }
      if (value === intermediateTemplate) {
        return new Set([importerTemplate])
      }
      return new Set()
    })
    state.ctx.wxmlService.getImporterDependencyKind.mockImplementation((dep: string, importer: string) => {
      if (dep === sharedTemplate && importer === intermediateTemplate) {
        return 'template-import'
      }
      if (dep === intermediateTemplate && importer === importerTemplate) {
        return 'template-import'
      }
      return undefined
    })
    const hook = createWatchChangeHook(state)

    await hook(sharedTemplate, { event: 'create' })

    expect(state.ctx.wxmlService.getImporters).toHaveBeenCalledWith(sharedTemplate)
    expect(state.ctx.wxmlService.getImporters).toHaveBeenCalledWith(intermediateTemplate)
    expect(state.markEntryDirty).toHaveBeenCalledWith(importerEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['wxml-importer-import:1'])
  })

  it('keeps include-driven wxml importer updates on the conservative path', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true)
    isTemplateMock.mockReturnValue(true)
    const sharedTemplate = '/project/src/shared/templates/partial.wxml'
    const importerTemplate = '/project/src/pages/native/index.wxml'
    const importerEntry = '/project/src/pages/native/index.ts'
    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/pages/native/index') {
        return { path: importerEntry }
      }
      return { path: null }
    })
    const state = createState()
    state.ctx.wxmlService.getImporters.mockImplementation((value: string) => {
      return value === sharedTemplate ? new Set([importerTemplate]) : new Set()
    })
    state.ctx.wxmlService.getImporterDependencyKind.mockImplementation((dep: string, importer: string) => {
      return dep === sharedTemplate && importer === importerTemplate ? 'template-include' : undefined
    })
    const hook = createWatchChangeHook(state)

    await hook(sharedTemplate, { event: 'create' })

    expect(state.ctx.wxmlService.getImporters).toHaveBeenCalledWith(sharedTemplate)
    expect(state.markEntryDirty).toHaveBeenCalledWith(importerEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['wxml-importer:1'])
  })

  it('treats created existing shared wxs files as update-like wxml importers after atomic saves', async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(true)
    const sharedWxs = '/project/src/shared/wxs/format.wxs'
    const importerTemplate = '/project/src/pages/native/index.wxml'
    const importerEntry = '/project/src/pages/native/index.ts'
    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/pages/native/index') {
        return { path: importerEntry }
      }
      return { path: null }
    })
    const state = createState()
    state.ctx.wxmlService.getImporters.mockImplementation((value: string) => {
      return value === sharedWxs ? new Set([importerTemplate]) : new Set()
    })
    const hook = createWatchChangeHook(state)

    await hook(sharedWxs, { event: 'create' })

    expect(state.ctx.wxmlService.getImporters).toHaveBeenCalledWith(sharedWxs)
    expect(state.markEntryDirty).toHaveBeenCalledWith(importerEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['wxml-importer:1'])
  })

  it('marks html template updates as metadata entry dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr-html/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr-html/index.html', { event: 'update' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/hmr-html/index.html')
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr-html/index.ts', 'metadata')
  })

  it('marks json sidecar updates separately for asset-only preloading', async () => {
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/components/x-child/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/components/x-child/index.json', { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/components/x-child/index.ts', 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['json-sidecar:1'])
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

  it('marks app entry dirty for Tailwind content hmr when app style exists', async () => {
    const appEntryId = '/project/src/app.ts'
    const pageEntryId = '/project/src/pages/hmr/index.vue'
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    findCssEntryMock.mockResolvedValue({ path: '/project/src/app.css' })
    const state = createState({
      loadedEntrySet: new Set([pageEntryId]),
      resolvedEntryMap: new Map([
        [appEntryId, { id: appEntryId }],
        [pageEntryId, { id: pageEntryId }],
      ]),
    })
    state.ctx.scanService.appEntry = { path: appEntryId }
    const hook = createWatchChangeHook(state)

    await hook(pageEntryId, { event: 'update' })

    expect(resolveTouchAppWxssEnabledMock).toHaveBeenCalled()
    expect(findCssEntryMock).toHaveBeenCalledWith(appEntryId)
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntryId, 'direct')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntryId, 'metadata')
    expect(invalidateSharedStyleCacheMock).toHaveBeenCalledTimes(1)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual([
      'entry-direct:1',
      'tailwind-content:2',
    ])
  })

  it('skips Tailwind content hmr for vue script updates without content signature changes', async () => {
    const appEntryId = '/project/src/app.ts'
    const pageEntryId = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
const count = 1
const klass = 'text-red-500'
</script>

<template><view :class="klass">{{ count }}</view></template>`
    const nextSource = previousSource.replace('const count = 1', 'const count = 2')
    const { resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature, resolveVueSfcTailwindContentSignature } = await import('../../../utils/file/vueSfcSignature')
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    findCssEntryMock.mockResolvedValue({ path: '/project/src/app.css' })
    const state = createState({
      loadedEntrySet: new Set([pageEntryId]),
      resolvedEntryMap: new Map([
        [appEntryId, { id: appEntryId }],
        [pageEntryId, { id: pageEntryId }],
      ]),
    })
    state.ctx.scanService.appEntry = { path: appEntryId }
    state.ctx.runtimeState.build.hmr.vueEntryTailwindContentSignatures.set(
      pageEntryId,
      resolveVueSfcTailwindContentSignature(previousSource, pageEntryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      pageEntryId,
      resolveVueSfcScriptSignature(previousSource, pageEntryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.set(
      pageEntryId,
      resolveVueSfcStyleIndependentSignature(previousSource, pageEntryId),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(pageEntryId, { event: 'update' })

    expect(findCssEntryMock).not.toHaveBeenCalled()
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntryId, 'direct')
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(appEntryId, 'metadata')
    expect(invalidateSharedStyleCacheMock).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-direct:1'])
  })

  it('keeps Tailwind content hmr for vue template class changes', async () => {
    const appEntryId = '/project/src/app.ts'
    const pageEntryId = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
const count = 1
</script>

<template><view class="text-red-500">{{ count }}</view></template>`
    const nextSource = previousSource.replace('text-red-500', 'text-blue-500')
    const { resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature, resolveVueSfcTailwindContentSignature } = await import('../../../utils/file/vueSfcSignature')
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    findCssEntryMock.mockResolvedValue({ path: '/project/src/app.css' })
    const state = createState({
      loadedEntrySet: new Set([pageEntryId]),
      resolvedEntryMap: new Map([
        [appEntryId, { id: appEntryId }],
        [pageEntryId, { id: pageEntryId }],
      ]),
    })
    state.ctx.scanService.appEntry = { path: appEntryId }
    state.ctx.runtimeState.build.hmr.vueEntryTailwindContentSignatures.set(
      pageEntryId,
      resolveVueSfcTailwindContentSignature(previousSource, pageEntryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      pageEntryId,
      resolveVueSfcScriptSignature(previousSource, pageEntryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.set(
      pageEntryId,
      resolveVueSfcStyleIndependentSignature(previousSource, pageEntryId),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(pageEntryId, { event: 'update' })

    expect(findCssEntryMock).toHaveBeenCalledWith(appEntryId)
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntryId, 'direct')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntryId, 'metadata')
    expect(invalidateSharedStyleCacheMock).toHaveBeenCalledTimes(1)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual([
      'entry-local-asset:1',
      'tailwind-content:2',
    ])
  })

  it('does not mark app entry dirty for Tailwind content hmr without app style', async () => {
    const appEntryId = '/project/src/app.ts'
    const pageEntryId = '/project/src/pages/hmr/index.vue'
    resolveTouchAppWxssEnabledMock.mockReturnValue(true)
    findCssEntryMock.mockResolvedValue({ path: null })
    const state = createState({
      loadedEntrySet: new Set([pageEntryId]),
      resolvedEntryMap: new Map([
        [appEntryId, { id: appEntryId }],
        [pageEntryId, { id: pageEntryId }],
      ]),
    })
    state.ctx.scanService.appEntry = { path: appEntryId }
    const hook = createWatchChangeHook(state)

    await hook(pageEntryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntryId, 'direct')
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(appEntryId, 'metadata')
    expect(invalidateSharedStyleCacheMock).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-direct:1'])
  })

  it('skips emitted json path collection for update events', async () => {
    const entryId = '/project/src/pages/hmr/index.ts'
    const state = createState({
      loadedEntrySet: new Set([entryId]),
      jsonEmitFilesMap: new Map([
        ['app.json', {
          entry: {
            get jsonPath() {
              throw new Error('should not read emitted json paths on update')
            },
          },
        }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await expect(hook(entryId, { event: 'update' })).resolves.toBeUndefined()

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'direct')
  })

  it('treats config dependency updates as full dev rebuild triggers', async () => {
    const entryA = '/project/src/pages/a/index.ts'
    const entryB = '/project/src/components/card/index.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [entryA, { id: entryA }],
        [entryB, { id: entryB }],
      ]),
    })
    state.ctx.configService.configFileDependencies = [
      '/project/vite.config.mts',
      '/project/config/shared.ts',
    ]
    const hook = createWatchChangeHook(state)

    await hook('/project/vite.config.mts', { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(state.ctx.scanService.markDirty).toHaveBeenCalledTimes(1)
    expect(state.ctx.buildService.requestConfigRestart).toHaveBeenCalledWith('app')
    expect(state.markEntryDirty).toHaveBeenCalledWith(entryA, 'direct')
    expect(state.markEntryDirty).toHaveBeenCalledWith(entryB, 'direct')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['config-restart:2'])
  })

  it('ignores generated output changes inside outDir', async () => {
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/dist/pages/hmr/index.wxml', { event: 'update' })

    expect(state.markEntryDirty).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile).toEqual({})
  })

  it('ignores auto-routes generated file changes under src roots', async () => {
    const state = createState()
    state.ctx.configService.weappViteConfig = {
      autoRoutes: {
        persistentCache: 'src/pages/hmr/auto-routes.cache.json',
      },
    }
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr/.app.json.auto-routes-inline.ts', { event: 'create' })
    await hook('/project/src/pages/hmr/auto-routes.cache.json', { event: 'update' })

    expect(invalidateFileCacheMock).not.toHaveBeenCalled()
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

  it('ignores main package entry changes in independent subpackage builds', async () => {
    const mainEntry = '/project/src/pages/index/index.vue'
    const state = createState({
      subPackageMeta: {
        subPackage: {
          root: 'subpackages/independent-a',
        },
      },
      loadedEntrySet: new Set([mainEntry]),
    })
    const hook = createWatchChangeHook(state)

    await hook(mainEntry, { event: 'update' })

    expect(state.markEntryDirty).not.toHaveBeenCalled()
    expect(loggerSuccessMock).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual([])
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

  it('marks vue entry updates as metadata when only template content changed', async () => {
    const entryId = '/project/src/pages/logs/index.vue'
    const previousSource = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const nextSource = previousSource.replace('<view>{{ count }}</view>', '<view class="next">{{ count }}</view>')
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      entryId,
      resolveVueSfcNonJsonSignature(previousSource, entryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      entryId,
      resolveVueSfcScriptSignature(previousSource, entryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.set(
      entryId,
      resolveVueSfcStyleIndependentSignature(previousSource, entryId),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-local-asset:1'])
  })

  it('keeps vue entry updates direct when runtime script content changed', async () => {
    const entryId = '/project/src/pages/logs/index.vue'
    const previousSource = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const nextSource = previousSource.replace('const count = 1', 'const count = 2')
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      entryId,
      resolveVueSfcNonJsonSignature(previousSource, entryId),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      entryId,
      resolveVueSfcScriptSignature(previousSource, entryId),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'direct')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-direct:1'])
  })

  it('normalizes transient create events on loaded vue entries back to metadata updates', async () => {
    const entryId = '/project/src/pages/logs/index.vue'
    const previousSource = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const nextSource = previousSource.replace('首页', '新标题')
    const { resolveVueSfcNonJsonSignature } = await import('../../../utils/file/vueSfcSignature')
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const state = createState({
      loadedEntrySet: new Set([entryId]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      entryId,
      resolveVueSfcNonJsonSignature(previousSource, entryId),
    )
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'create' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'metadata')
    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-json-only:1'])
  })

  it('normalizes transient create events on resolved vue entries back to metadata updates', async () => {
    const entryId = '/project/src/pages/logs/index.vue'
    const previousSource = `<script setup lang="ts">
definePageJson({ navigationBarTitleText: '首页' })
const count = 1
</script>

<template><view>{{ count }}</view></template>`
    const nextSource = previousSource.replace('首页', '新标题')
    const { resolveVueSfcNonJsonSignature } = await import('../../../utils/file/vueSfcSignature')
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const state = createState({
      resolvedEntryMap: new Map([
        [entryId, { id: entryId }],
      ]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      entryId,
      resolveVueSfcNonJsonSignature(previousSource, entryId),
    )
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'create' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'metadata')
    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-json-only:1'])
  })

  it('normalizes transient create events on resolved sidecars back to updates', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/hmr/index.ts',
    })
    const entryId = '/project/src/pages/hmr/index.ts'
    const state = createState({
      resolvedEntryMap: new Map([
        [entryId, { id: entryId }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook('/project/src/pages/hmr/index.wxml', { event: 'create' })

    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
    expect(state.markEntryDirty).toHaveBeenCalledWith(entryId, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['sidecar-direct:1'])
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

  it('marks page entries dirty when app.vue shell template changes', async () => {
    const appEntry = '/project/src/app.vue'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const componentEntry = '/project/src/components/card.vue'
    const state = createState({
      loadedEntrySet: new Set([appEntry]),
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
        [pageEntry, { id: pageEntry }],
        [componentEntry, { id: componentEntry }],
      ]),
    })
    const hook = createWatchChangeHook(state)

    await hook(appEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(componentEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'direct')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual([
      'app-shell-dependent:2',
      'entry-direct:1',
    ])
  })

  it('keeps app.vue json-only updates scoped to the app entry', async () => {
    const appEntry = '/project/src/app.vue'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
defineAppJson({ window: { navigationBarTitleText: '首页' } })
</script>`
    const nextSource = previousSource.replace('首页', '新标题')
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([appEntry]),
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      appEntry,
      resolveVueSfcNonJsonSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      appEntry,
      resolveVueSfcScriptSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.set(
      appEntry,
      resolveVueSfcStyleIndependentSignature(previousSource, appEntry),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(appEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-json-only:1'])
  })

  it('upgrades app.vue json-only updates when inline auto-routes changed', async () => {
    const appEntry = '/project/src/app.vue'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineAppJson({ pages: routes.pages, window: { navigationBarTitleText: '首页' } })
</script>`
    const nextSource = previousSource.replace('首页', '新标题')
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([appEntry]),
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
      ctx: {
        ...createState().ctx,
        autoRoutesService: {
          isRouteFile: vi.fn(() => false),
          handleFileChange: vi.fn(async () => false),
          getSignature: vi.fn(() => 'new-routes'),
        },
      },
    })
    state.ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = 'old-routes'
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      appEntry,
      resolveVueSfcNonJsonSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      appEntry,
      resolveVueSfcScriptSignature(previousSource, appEntry),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(appEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'direct')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-auto-routes:1'])
  })

  it('upgrades app.vue json-only updates when auto-routes signature needs confirmation', async () => {
    const appEntry = '/project/src/app.vue'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
import routes from 'weapp-vite/auto-routes'

defineAppJson({ pages: routes.pages, window: { navigationBarTitleText: '首页' } })
</script>`
    const nextSource = previousSource.replace('首页', '新标题')
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([appEntry]),
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
      ctx: {
        ...createState().ctx,
        autoRoutesService: {
          isRouteFile: vi.fn(() => false),
          handleFileChange: vi.fn(async () => false),
          getSignature: vi.fn(() => 'new-routes'),
        },
      },
    })
    state.ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = undefined
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      appEntry,
      resolveVueSfcNonJsonSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      appEntry,
      resolveVueSfcScriptSignature(previousSource, appEntry),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(appEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'direct')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-auto-routes:1'])
  })

  it('keeps app.vue style-only updates scoped to the app entry', async () => {
    const appEntry = '/project/src/app.vue'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
defineAppJson({ window: { navigationBarTitleText: '首页' } })
</script>

<style>
page { color: red; }
</style>`
    const nextSource = previousSource.replace('color: red;', 'color: blue;')
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature, resolveVueSfcStyleIndependentSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([appEntry]),
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      appEntry,
      resolveVueSfcNonJsonSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      appEntry,
      resolveVueSfcScriptSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.set(
      appEntry,
      resolveVueSfcStyleIndependentSignature(previousSource, appEntry),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(appEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).not.toHaveBeenCalled()
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'metadata')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['entry-style-only:1'])
  })

  it('invalidates app shell dependents when app.vue gains a template', async () => {
    const appEntry = '/project/src/app.vue'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
defineAppJson({ window: { navigationBarTitleText: '首页' } })
</script>

<style>
page { color: red; }
</style>`
    const nextSource = `${previousSource}

<template>
  <view class="happy"><slot /></view>
</template>`
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } = await import('../../../utils/file/vueSfcSignature')
    const state = createState({
      loadedEntrySet: new Set([appEntry]),
      resolvedEntryMap: new Map([
        [appEntry, { id: appEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
    })
    state.ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appEntry, false)
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      appEntry,
      resolveVueSfcNonJsonSignature(previousSource, appEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      appEntry,
      resolveVueSfcScriptSignature(previousSource, appEntry),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(appEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'direct')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual([
      'app-shell-dependent:1',
      'entry-direct:1',
    ])
  })

  it('maps app.vue shell topology changes to the concrete app script entry', async () => {
    const appVueEntry = '/project/src/app.vue'
    const appScriptEntry = '/project/src/app.ts'
    const pageEntry = '/project/src/pages/hmr/index.vue'
    const previousSource = `<script setup lang="ts">
defineAppJson({ window: { navigationBarTitleText: '首页' } })
</script>`
    const nextSource = `${previousSource}

<template>
  <view class="happy"><slot /></view>
</template>

<style>.happy { min-height: 100vh; }</style>`
    const { resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } = await import('../../../utils/file/vueSfcSignature')
    const baseState = createState({
      loadedEntrySet: new Set([appScriptEntry]),
      resolvedEntryMap: new Map([
        [appScriptEntry, { id: appScriptEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
    })
    const state = {
      ...baseState,
      ctx: {
        ...baseState.ctx,
        scanService: {
          ...baseState.ctx.scanService,
          appEntry: {
            path: appScriptEntry,
          },
        },
      },
    }
    state.ctx.runtimeState.build.hmr.vueEntryHasTemplate.set(appVueEntry, false)
    state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.set(
      appVueEntry,
      resolveVueSfcNonJsonSignature(previousSource, appVueEntry),
    )
    state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.set(
      appVueEntry,
      resolveVueSfcScriptSignature(previousSource, appVueEntry),
    )
    vi.spyOn(fs, 'readFile').mockResolvedValue(nextSource)
    const hook = createWatchChangeHook(state)

    await hook(appVueEntry, { event: 'update' })

    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalledTimes(1)
    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appScriptEntry, 'direct')
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(appVueEntry, 'direct')
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
    const appEntry = '/project/src/app.vue'
    const baseState = createState()
    const state = {
      ...baseState,
      resolvedEntryMap: new Map([[appEntry, { id: appEntry }]]),
      ctx: {
        ...baseState.ctx,
        scanService: {
          ...baseState.ctx.scanService,
          appEntry: {
            path: appEntry,
          },
        },
        autoRoutesService: {
          isRouteFile: vi.fn((id: string) => id === entryId),
          handleFileChange: vi.fn(async () => true),
        },
      },
    }
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'delete' })

    expect(state.ctx.autoRoutesService.handleFileChange).toHaveBeenCalledWith(entryId, 'delete')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'direct')
    expect(invalidateFileCacheMock).toHaveBeenCalledWith(appEntry)
    expect(invalidateFileCacheMock).toHaveBeenCalledWith('weapp-vite/auto-routes')
    expect(invalidateFileCacheMock).toHaveBeenCalledWith('virtual:weapp-vite-auto-routes')
    expect(invalidateFileCacheMock).toHaveBeenCalledWith('\0weapp-vite:auto-routes')
    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.dirtyVueEntryIds.has(appEntry)).toBe(true)
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['auto-routes-topology:1'])
  })

  it('marks app entry dirty when a created auto-routes page was already synced by sidecar watcher', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const entryId = '/project/src/pages/logs/hmr-added.vue'
    const appEntry = '/project/src/app.vue'
    const baseState = createState()
    const state = {
      ...baseState,
      resolvedEntryMap: new Map([[appEntry, { id: appEntry }]]),
      ctx: {
        ...baseState.ctx,
        scanService: {
          ...baseState.ctx.scanService,
          appEntry: {
            path: appEntry,
          },
        },
        autoRoutesService: {
          isRouteFile: vi.fn(() => false),
          handleFileChange: vi.fn(async () => false),
          getSignature: vi.fn(() => 'synced-routes'),
        },
      },
    }
    state.ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = 'old-routes'
    const hook = createWatchChangeHook(state)

    await hook(entryId, { event: 'create' })

    expect(state.ctx.autoRoutesService.handleFileChange).toHaveBeenCalledWith(entryId, 'create')
    expect(state.markEntryDirty).toHaveBeenCalledWith(appEntry, 'direct')
    expect(invalidateFileCacheMock).toHaveBeenCalledWith(appEntry)
    expect(invalidateFileCacheMock).toHaveBeenCalledWith('weapp-vite/auto-routes')
    expect(state.loadEntry.invalidateResolveCache).toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.dirtyVueEntryIds.has(appEntry)).toBe(true)
    expect(state.ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature).toBeUndefined()
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
    expect(state.markEntryDirty).toHaveBeenCalledWith('/project/src/pages/hmr/index.ts', 'metadata')
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

  it('marks shared layout template importers and dependent entries as dependency dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    const sharedTemplate = '/project/src/shared-layout-hmr/layout-template.wxml'
    const layoutTemplate = '/project/src/layouts/default/index.wxml'
    const layoutEntry = '/project/src/layouts/default/index.ts'
    const pageEntry = '/project/src/pages/layout-a/index.ts'
    const unrelatedEntry = '/project/src/pages/plain/index.ts'
    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/layouts/default/index') {
        return { path: layoutEntry }
      }
      return { path: null }
    })
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
    state.ctx.wxmlService.getImporters.mockReturnValue(new Set([layoutTemplate]))
    const hook = createWatchChangeHook(state)

    await hook(sharedTemplate, { event: 'update' })

    expect(state.ctx.wxmlService.scan).toHaveBeenCalledWith(sharedTemplate)
    expect(state.markEntryDirty).toHaveBeenCalledTimes(2)
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, layoutEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, pageEntry, 'dependency')
    expect(state.markEntryDirty).not.toHaveBeenCalledWith(unrelatedEntry, 'dependency')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['layout-self:1', 'layout-dependent:1'])
  })

  it('marks shared layout wxs importers and dependent entries as dependency dirties', async () => {
    const sharedWxs = '/project/src/shared-layout-hmr/layout-helper.wxs'
    const layoutTemplate = '/project/src/layouts/default/index.wxml'
    const layoutEntry = '/project/src/layouts/default/index.ts'
    const pageEntry = '/project/src/pages/layout-a/index.ts'
    findJsEntryMock.mockImplementation(async (basePath: string) => {
      if (basePath === '/project/src/layouts/default/index') {
        return { path: layoutEntry }
      }
      return { path: null }
    })
    const state = createState({
      resolvedEntryMap: new Map([
        [layoutEntry, { id: layoutEntry }],
        [pageEntry, { id: pageEntry }],
      ]),
      layoutEntryDependents: new Map([
        [layoutEntry, new Set([pageEntry])],
      ]),
    })
    state.ctx.wxmlService.getImporters.mockReturnValue(new Set([layoutTemplate]))
    const hook = createWatchChangeHook(state)

    await hook(sharedWxs, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenCalledTimes(2)
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, layoutEntry, 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, pageEntry, 'dependency')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['layout-self:1', 'layout-dependent:1'])
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
    collectAffectedSharedChunksMock.mockReturnValue(new Set([
      'common.js',
    ]))
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'update' })

    expect(state.markEntryDirty).toHaveBeenNthCalledWith(1, '/project/src/pages/native/index.ts', 'dependency')
    expect(state.markEntryDirty).toHaveBeenNthCalledWith(2, '/project/src/components/probe-card/index.ts', 'dependency')
    expect(state.hmrState.affectedSharedChunkIds).toEqual(new Set(['common.js']))
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

  it('normalizes atomic-save create events on importer graph dependencies back to dependency updates', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const dependencyId = '/project/src/shared/root-import-hmr.ts'
    const pageEntry = '/project/src/pages/root-import-hmr/index.vue'
    collectAffectedEntriesMock.mockReturnValue(new Set([pageEntry]))
    const state = createState({
      moduleImporters: new Map([
        [dependencyId, new Set([pageEntry])],
      ]),
      entryModuleIds: new Set([pageEntry]),
    })
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'create' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['importer-graph:1'])
    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
  })

  it('normalizes atomic-save create events on shared chunk source dependencies back to dependency updates', async () => {
    vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const dependencyId = '/project/src/shared/tokens.ts'
    const pageEntry = '/project/src/pages/root-import-hmr/index.vue'
    collectAffectedEntriesFromSharedChunksMock.mockReturnValue(new Set([pageEntry]))
    collectAffectedSharedChunksMock.mockReturnValue(new Set(['common.js']))
    const state = createState()
    state.ctx.runtimeState.build.hmr.sharedChunkSourceModuleIds = new Set([dependencyId])
    const hook = createWatchChangeHook(state)

    await hook(dependencyId, { event: 'create' })

    expect(state.markEntryDirty).toHaveBeenCalledWith(pageEntry, 'dependency')
    expect(state.hmrState.affectedSharedChunkIds).toEqual(new Set(['common.js']))
    expect(state.ctx.runtimeState.build.hmr.profile.event).toBe('update')
    expect(state.ctx.runtimeState.build.hmr.profile.dirtyReasonSummary).toEqual(['shared-chunk-source:1'])
    expect(invalidateEntryForSidecarMock).not.toHaveBeenCalled()
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
