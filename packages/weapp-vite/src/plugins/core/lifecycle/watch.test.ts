import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWatchChangeHook } from './watch'

const invalidateFileCacheMock = vi.hoisted(() => vi.fn())
const invalidateEntryForSidecarMock = vi.hoisted(() => vi.fn(async () => {}))
const findJsEntryMock = vi.hoisted(() => vi.fn(async () => ({ path: null })))
const isTemplateMock = vi.hoisted(() => vi.fn(() => false))
const collectAffectedEntriesMock = vi.hoisted(() => vi.fn(() => new Set<string>()))
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
        absoluteSrcRoot: '/project/src',
        relativeAbsoluteSrcRoot: (id: string) => id.replace('/project/src/', ''),
        relativeCwd: (id: string) => id.replace('/project/', ''),
        weappViteConfig: {},
      },
      wxmlService: {
        scan: vi.fn(async () => null),
      },
    },
    subPackageMeta: null,
    loadEntry: {
      invalidateResolveCache: vi.fn(),
    },
    loadedEntrySet: new Set<string>(),
    layoutEntryDependents: new Map<string, Set<string>>(),
    markEntryDirty: vi.fn(),
    moduleImporters: new Map(),
    entryModuleIds: new Set(),
    resolvedEntryMap: new Map(),
    ...overrides,
  } as any
}

describe('core lifecycle watch hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findJsEntryMock.mockResolvedValue({ path: null })
    isTemplateMock.mockReturnValue(false)
    collectAffectedEntriesMock.mockReturnValue(new Set())
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
    expect(state.markEntryDirty).not.toHaveBeenCalled()
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

  it('marks layout template sidecar updates as dependency dirties', async () => {
    isTemplateMock.mockReturnValue(true)
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/layouts/default/index.ts',
    })
    const state = createState()
    const hook = createWatchChangeHook(state)

    await hook('/project/src/layouts/default/index.wxml', { event: 'update' })

    expect(state.markEntryDirty).not.toHaveBeenCalled()
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
