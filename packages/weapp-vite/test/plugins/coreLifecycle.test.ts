import path from 'pathe'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '@/runtime/runtimeState'

const invalidateEntryForSidecarSpy = vi.fn()
const ensureSidecarWatcherSpy = vi.fn()
const useLoadEntryMock = vi.fn()

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

let weappVite: typeof import('@/plugins/core').weappVite

beforeAll(async () => {
  ; ({ weappVite } = await import('@/plugins/core'))
})

describe('core plugin watchChange', () => {
  beforeEach(() => {
    invalidateEntryForSidecarSpy.mockClear()
    ensureSidecarWatcherSpy.mockClear()
    useLoadEntryMock.mockReset()
  })

  function createPlugin(options: {
    loadedEntrySet?: Set<string>
    wxmlService?: { scan: ReturnType<typeof vi.fn> }
  } = {}) {
    const loadedEntrySet = options.loadedEntrySet ?? new Set<string>()
    const markEntryDirty = vi.fn()
    const wxmlService = options.wxmlService ?? { scan: vi.fn() }
    let topologyRescan: { files: Set<string>, reasons: Set<string> } | undefined
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
      runtimeState: createRuntimeState(),
      configService: {
        isDev: true,
        platform: 'weapp',
        multiPlatform: {
          enabled: false,
          projectConfigRoot: 'config',
          targets: ['weapp'],
        },
        absoluteSrcRoot: '/project/src',
        configFileDependencies: [],
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
      moduleGraphService: {
        bindBuildContext: vi.fn(),
        bindPluginContext: vi.fn(),
        consumeTopologyRescan: vi.fn(() => {
          const request = topologyRescan
          topologyRescan = undefined
          return request
        }),
        hasModule: vi.fn(() => false),
        invalidate: vi.fn((file: string) => new Set(
          /\.(?:json(?:\.ts)?|s?css|wxml|wxss)$/.test(file)
            ? ['/project/src/pages/index/index.ts']
            : [],
        )),
        requestTopologyRescan: vi.fn((reason: string, file: string) => {
          topologyRescan = {
            files: new Set([file]),
            reasons: new Set([reason]),
          }
        }),
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
    const { corePlugin, markEntryDirty, wxmlService } = createPlugin()

    await corePlugin
      // @ts-ignore
      .watchChange?.
      ('/project/src/pages/index/index.wxml',
        { event: 'update' } as any,
      )

    expect(wxmlService.scan).toHaveBeenCalledWith('/project/src/pages/index/index.wxml')
    expect(markEntryDirty).toHaveBeenCalledWith('/project/src/pages/index/index.ts', 'metadata')
  })

  it.each([
    { label: 'wxss', filePath: '/project/src/pages/index/index.wxss' },
    { label: 'scss', filePath: '/project/src/pages/index/index.scss' },
    { label: 'json', filePath: '/project/src/pages/index/index.json' },
    { label: 'json-ts', filePath: '/project/src/pages/index/index.json.ts' },
  ])('invalidates entry on %s updates', async ({ filePath }) => {
    const { corePlugin, markEntryDirty } = createPlugin()

    await corePlugin
      // @ts-ignore
      .watchChange?.
      (filePath,
        { event: 'update' } as any,
      )

    expect(markEntryDirty).toHaveBeenCalledWith('/project/src/pages/index/index.ts', 'metadata')
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

    expect(markEntryDirty).toHaveBeenCalledWith(filePath, 'direct')
  })
})
