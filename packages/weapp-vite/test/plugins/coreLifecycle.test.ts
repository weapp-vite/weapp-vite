import path from 'pathe'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const invalidateEntryForSidecarSpy = vi.fn()
const ensureSidecarWatcherSpy = vi.fn()
const useLoadEntryMock = vi.fn()
const findJsEntryMock = vi.fn()

vi.mock('@/plugins/utils/invalidateEntry', () => {
  return {
    invalidateEntryForSidecar: invalidateEntryForSidecarSpy,
    ensureSidecarWatcher: ensureSidecarWatcherSpy,
  }
})

vi.mock('@/plugins/hooks/useLoadEntry', () => {
  return {
    useLoadEntry: useLoadEntryMock,
  }
})

vi.mock('@/utils/file', async () => {
  const actual = await vi.importActual<typeof import('@/utils/file')>('@/utils/file')
  return {
    ...actual,
    findJsEntry: findJsEntryMock,
  }
})

let weappVite: typeof import('@/plugins/core').weappVite

beforeAll(async () => {
  ; ({ weappVite } = await import('@/plugins/core'))
})

describe('core plugin watchChange', () => {
  beforeEach(() => {
    invalidateEntryForSidecarSpy.mockClear()
    ensureSidecarWatcherSpy.mockClear()
    useLoadEntryMock.mockReset()
    findJsEntryMock.mockReset()
  })

  function createPlugin(options: {
    loadedEntrySet?: Set<string>
    wxmlService?: { scan: ReturnType<typeof vi.fn> }
  } = {}) {
    const loadedEntrySet = options.loadedEntrySet ?? new Set<string>()
    const markEntryDirty = vi.fn()
    const wxmlService = options.wxmlService ?? { scan: vi.fn() }
    useLoadEntryMock.mockReturnValueOnce({
      loadEntry: vi.fn(),
      loadedEntrySet,
      markEntryDirty,
      emitDirtyEntries: vi.fn(),
      jsonEmitFilesMap: new Map(),
      entriesMap: new Map(),
      resolvedEntryMap: new Map(),
    })
    const ctx = {
      configService: {
        isDev: true,
        absoluteSrcRoot: '/project/src',
        relativeAbsoluteSrcRoot: (p: string) => path.relative('/project/src', p) || '.',
        relativeCwd: (p: string) => path.relative('/project', p) || '.',
      },
      scanService: {
        markDirty: vi.fn(),
        markIndependentDirty: vi.fn(),
        independentSubPackageMap: new Map<string, any>(),
      },
      buildService: {
        queue: {
          start: vi.fn(),
        },
      },
      watcherService: {
        setRollupWatcher: vi.fn(),
      },
      wxmlService,
    }

    const plugins = weappVite(ctx as any)
    const corePlugin = plugins.find(plugin => plugin.name === 'weapp-vite:pre')
    expect(corePlugin).toBeDefined()
    return {
      corePlugin: corePlugin!,
      ctx,
      loadedEntrySet,
      markEntryDirty,
      wxmlService,
    }
  }

  it('invalidates sidecar additions and deletions', async () => {
    const { corePlugin, ctx } = createPlugin()
    const id = '/project/src/pages/index/index.json'

    await Promise.resolve(corePlugin.buildStart?.())
    expect(ensureSidecarWatcherSpy).toHaveBeenCalledWith(expect.anything(), '/project/src')

    await corePlugin
      // @ts-ignore
      .watchChange?.
      (id,
        { event: 'create' } as any,
      )
    expect(invalidateEntryForSidecarSpy).toHaveBeenCalledWith(ctx, id, 'create')

    invalidateEntryForSidecarSpy.mockClear()
    await corePlugin
      // @ts-ignore
      .watchChange?.
      (id,
        { event: 'delete' } as any,
      )
    expect(invalidateEntryForSidecarSpy).toHaveBeenCalledWith(ctx, id, 'delete')
  })

  it('rescans templates and invalidates entries on wxml updates', async () => {
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/index/index.ts',
      predictions: [],
    })
    const { corePlugin, markEntryDirty, wxmlService } = createPlugin()

    await corePlugin
      // @ts-ignore
      .watchChange?.
      ('/project/src/pages/index/index.wxml',
        { event: 'update' } as any,
      )

    expect(wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/index/index.wxml')
    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(markEntryDirty).toHaveBeenCalledWith('/project/src/pages/index/index.ts')
  })

  it.each([
    { label: 'wxss', filePath: '/project/src/pages/index/index.wxss' },
    { label: 'scss', filePath: '/project/src/pages/index/index.scss' },
    { label: 'json', filePath: '/project/src/pages/index/index.json' },
    { label: 'json-ts', filePath: '/project/src/pages/index/index.json.ts' },
  ])('invalidates entry on %s updates', async ({ filePath }) => {
    findJsEntryMock.mockResolvedValue({
      path: '/project/src/pages/index/index.ts',
      predictions: [],
    })
    const { corePlugin, markEntryDirty } = createPlugin()

    await corePlugin
      // @ts-ignore
      .watchChange?.
      (filePath,
        { event: 'update' } as any,
      )

    expect(findJsEntryMock).toHaveBeenCalledWith('/project/src/pages/index/index')
    expect(markEntryDirty).toHaveBeenCalledWith('/project/src/pages/index/index.ts')
  })

  it.each([
    { label: 'js', filePath: '/project/src/pages/index/index.js' },
    { label: 'ts', filePath: '/project/src/pages/index/index.ts' },
  ])('invalidates loaded entry on %s updates', async ({ filePath }) => {
    const loadedEntrySet = new Set<string>([filePath])
    const { corePlugin, markEntryDirty } = createPlugin({ loadedEntrySet })

    await corePlugin
      // @ts-ignore
      .watchChange?.
      (filePath,
        { event: 'update' } as any,
      )

    expect(markEntryDirty).toHaveBeenCalledWith(filePath)
  })
})
