import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const invalidateEntryForSidecarSpy = vi.fn()
const ensureSidecarWatcherSpy = vi.fn()

vi.mock('@/plugins/utils/invalidateEntry', () => {
  return {
    invalidateEntryForSidecar: invalidateEntryForSidecarSpy,
    ensureSidecarWatcher: ensureSidecarWatcherSpy,
  }
})

vi.mock('@/plugins/hooks/useLoadEntry', () => {
  return {
    useLoadEntry: vi.fn(() => {
      return {
        loadEntry: vi.fn(),
        loadedEntrySet: new Set<string>(),
        jsonEmitFilesMap: new Map(),
      }
    }),
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
  })

  function createPlugin() {
    const ctx = {
      configService: {
        isDev: true,
        absoluteSrcRoot: '/project/src',
        relativeAbsoluteSrcRoot: vi.fn().mockReturnValue('pages/index/index.json'),
        relativeCwd: vi.fn().mockReturnValue('src/pages/index/index.json'),
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
    }

    const plugins = weappVite(ctx as any)
    const corePlugin = plugins.find(plugin => plugin.name === 'weapp-vite:pre')
    expect(corePlugin).toBeDefined()
    return { corePlugin: corePlugin!, ctx }
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
})
