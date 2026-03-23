import type { Plugin } from 'vite'
import chokidar from 'chokidar'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autoRoutes } from './autoRoutes'

const chokidarWatchMock = vi.hoisted(() => vi.fn(() => ({
  on: vi.fn(),
  close: vi.fn(),
})))

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarWatchMock,
  },
}))

function createPlugin(overrides: Record<string, unknown> = {}) {
  const ensureFresh = vi.fn(async () => {})
  const getModuleCode = vi.fn(() => 'export const pages = ["pages/home/index"]')
  const getWatchFiles = vi.fn(() => [])
  const getWatchDirectories = vi.fn(() => [])
  const isRouteFile = vi.fn(() => false)
  const isEnabled = vi.fn(() => true)
  const handleFileChange = vi.fn(async () => {})
  const ctx = {
    autoRoutesService: {
      ensureFresh,
      getModuleCode,
      getWatchFiles,
      getWatchDirectories,
      isRouteFile,
      isEnabled,
      handleFileChange,
    },
    runtimeState: {
      watcher: {
        sidecarWatcherMap: new Map(),
      },
    },
    configService: {
      cwd: '/virtual/project',
      absoluteSrcRoot: '/virtual/project/src',
      isDev: true,
      weappViteConfig: {
        autoRoutes: true,
      },
      packageInfo: {
        rootPath: '/virtual/weapp-vite',
      },
    },
  } as any

  if (Object.keys(overrides).length > 0) {
    Object.assign(ctx, overrides)
  }

  const [plugin] = autoRoutes(ctx) as Plugin[]
  return {
    plugin,
    ensureFresh,
    getModuleCode,
    getWatchFiles,
    getWatchDirectories,
    isRouteFile,
    isEnabled,
    handleFileChange,
    packageRoot: ctx.configService.packageInfo.rootPath,
  }
}

describe('auto-routes plugin alias fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps aliased auto-routes source id to virtual module', async () => {
    const { plugin, packageRoot } = createPlugin()
    const aliasedId = path.resolve(packageRoot, 'src/auto-routes.ts')

    plugin.configResolved?.({
      command: 'build',
    } as any)

    const resolved = await plugin.resolveId?.call({}, aliasedId)
    expect(resolved).toBe('\0weapp-vite:auto-routes')
  })

  it('returns virtual auto-routes code when load receives aliased source id', async () => {
    const { plugin, ensureFresh, getModuleCode, packageRoot } = createPlugin()
    const aliasedId = path.resolve(packageRoot, 'src/auto-routes.ts')
    const addWatchFile = vi.fn()

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    const loaded = await plugin.load?.call({ addWatchFile } as any, aliasedId)
    expect(ensureFresh).toHaveBeenCalled()
    expect(getModuleCode).toHaveBeenCalled()
    expect(loaded).toEqual({
      code: 'export const pages = ["pages/home/index"]',
      map: { mappings: '' },
    })
    expect(chokidar.watch).toHaveBeenCalledTimes(1)
  })

  it('does not register watch targets in normal build mode', async () => {
    const { plugin, ensureFresh, getModuleCode, getWatchFiles, getWatchDirectories, packageRoot } = createPlugin({
      configService: {
        cwd: '/virtual/project',
        absoluteSrcRoot: '/virtual/project/src',
        isDev: false,
        inlineConfig: {
          build: {},
        },
        weappViteConfig: {
          autoRoutes: true,
        },
        packageInfo: {
          rootPath: '/virtual/weapp-vite',
        },
      },
    })
    const aliasedId = path.resolve(packageRoot, 'src/auto-routes.ts')
    const addWatchFile = vi.fn()

    getWatchFiles.mockReturnValueOnce(['/virtual/project/src/pages/index/index.ts'])
    getWatchDirectories.mockReturnValueOnce(['/virtual/project/src/pages'])

    plugin.configResolved?.({
      command: 'build',
    } as any)

    const loaded = await plugin.load?.call({ addWatchFile } as any, aliasedId)
    expect(ensureFresh).toHaveBeenCalled()
    expect(getModuleCode).toHaveBeenCalled()
    expect(loaded).toEqual({
      code: 'export const pages = ["pages/home/index"]',
      map: { mappings: '' },
    })
    expect(addWatchFile).not.toHaveBeenCalled()
  })

  it('handles built-in virtual ids and skips unrelated ids', async () => {
    const { plugin } = createPlugin()

    expect(await plugin.resolveId?.call({}, 'weapp-vite/auto-routes')).toBe('\0weapp-vite:auto-routes')
    expect(await plugin.resolveId?.call({}, 'virtual:weapp-vite-auto-routes')).toBe('\0weapp-vite:auto-routes')
    expect(await plugin.resolveId?.call({}, '\0weapp-vite:auto-routes')).toBe('\0weapp-vite:auto-routes')
    expect(await plugin.resolveId?.call({}, '/virtual/project/src/pages/index.ts')).toBeNull()
  })

  it('keeps buildStart lazy before auto-routes module is requested', async () => {
    const {
      plugin,
      ensureFresh,
      getWatchFiles,
      getWatchDirectories,
    } = createPlugin()
    const addWatchFile = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('watch failed')
      })
    getWatchFiles.mockReturnValueOnce(['/virtual/project/src/pages/index/index.ts'])
    getWatchDirectories.mockReturnValueOnce(['/virtual/project/src/pages'])

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    expect(plugin.buildStart?.call({ addWatchFile } as any)).toBeUndefined()
    expect(ensureFresh).not.toHaveBeenCalled()
    expect(addWatchFile).not.toHaveBeenCalled()
    expect(chokidar.watch).toHaveBeenCalledTimes(1)
  })

  it('does not start route watcher when autoRoutes.watch is false', async () => {
    const { plugin } = createPlugin({
      configService: {
        cwd: '/virtual/project',
        absoluteSrcRoot: '/virtual/project/src',
        isDev: true,
        weappViteConfig: {
          autoRoutes: {
            enabled: true,
            watch: false,
          },
        },
        packageInfo: {
          rootPath: '/virtual/weapp-vite',
        },
      },
    })
    chokidarWatchMock.mockClear()

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    const loaded = await plugin.load?.call({ addWatchFile: vi.fn() } as any, path.resolve('/virtual/weapp-vite', 'src/auto-routes.ts'))
    expect(loaded).toEqual({
      code: 'export const pages = ["pages/home/index"]',
      map: { mappings: '' },
    })
    expect(chokidarWatchMock).not.toHaveBeenCalled()
  })

  it('supports custom include roots for watcher startup and change detection', async () => {
    const { plugin, handleFileChange } = createPlugin({
      configService: {
        cwd: '/virtual/project',
        absoluteSrcRoot: '/virtual/project/src',
        isDev: true,
        weappViteConfig: {
          autoRoutes: {
            enabled: true,
            include: ['views/**', 'pkgA/screens/**'],
          },
          subPackages: {
            pkgA: {},
          },
        },
        packageInfo: {
          rootPath: '/virtual/weapp-vite',
        },
      },
    })
    chokidarWatchMock.mockClear()

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    await plugin.load?.call({ addWatchFile: vi.fn() } as any, path.resolve('/virtual/weapp-vite', 'src/auto-routes.ts'))

    expect(chokidarWatchMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        '/virtual/project/src/views',
        '/virtual/project/src/pkgA/screens',
      ]),
      expect.any(Object),
    )

    await plugin.watchChange?.('/virtual/project/src/views/home/index.ts', { event: 'create' } as any)
    await plugin.watchChange?.('/virtual/project/src/pkgA/screens/detail/index.ts', { event: 'create' } as any)
    await plugin.watchChange?.('/virtual/project/src/components/card/index.ts', { event: 'create' } as any)

    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/views/home/index.ts', 'rename')
    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pkgA/screens/detail/index.ts', 'rename')
    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/components/card/index.ts', 'rename')
  })

  it('returns null in load for unrelated ids', async () => {
    const { plugin, ensureFresh } = createPlugin()
    plugin.configResolved?.({
      command: 'build',
    } as any)

    const loaded = await plugin.load?.call({}, '/virtual/project/src/pages/index.ts')
    expect(loaded).toBeNull()
    expect(ensureFresh).not.toHaveBeenCalled()
  })

  it('does not treat nested components pages directory as default watch target', async () => {
    const {
      plugin,
      handleFileChange,
      isRouteFile,
    } = createPlugin()

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    isRouteFile.mockReturnValue(false)
    await plugin.watchChange?.('/virtual/project/src/components/pages/card/index.ts', { event: 'create' } as any)

    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/components/pages/card/index.ts', 'rename')
  })

  it('routes watchChange events to route files and pages paths', async () => {
    const {
      plugin,
      isRouteFile,
      handleFileChange,
    } = createPlugin()

    isRouteFile.mockImplementation((id: string) => id.endsWith('app.json'))
    await plugin.watchChange?.('/virtual/project/src/app.json', { event: 'update' } as any)
    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/app.json', 'update')

    isRouteFile.mockReturnValue(false)
    await plugin.watchChange?.('/virtual/project/src/pages/home/index.ts', { event: 'create' } as any)
    await plugin.watchChange?.('/virtual/project/src/pages/home/style.scss', { event: 'update' } as any)
    await plugin.watchChange?.('/virtual/project/src/components/card/index.ts', { event: 'update' } as any)

    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pages/home/index.ts', 'rename')
    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/pages/home/style.scss', 'rename')
    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/components/card/index.ts', 'rename')
  })

  it('routes Windows-style watchChange paths under src/pages', async () => {
    const {
      plugin,
      isRouteFile,
      handleFileChange,
    } = createPlugin({
      configService: {
        cwd: 'C:/virtual/project',
        absoluteSrcRoot: 'C:/virtual/project/src',
        packageInfo: {
          rootPath: 'C:/virtual/weapp-vite',
        },
      },
    })

    isRouteFile.mockReturnValue(false)
    await plugin.watchChange?.('C:\\virtual\\project\\src\\pages\\home\\index.ts', { event: 'create' } as any)
    await plugin.watchChange?.('C:\\virtual\\project\\src\\components\\card\\index.ts', { event: 'create' } as any)

    expect(handleFileChange).toHaveBeenCalledWith('C:\\virtual\\project\\src\\pages\\home\\index.ts', 'rename')
    expect(handleFileChange).not.toHaveBeenCalledWith('C:\\virtual\\project\\src\\components\\card\\index.ts', 'rename')
  })

  it('handleHotUpdate returns virtual module for route file updates in serve mode and filters fallback in build mode', async () => {
    const virtualModule = { id: '\0weapp-vite:auto-routes' }
    const {
      plugin,
      isRouteFile,
      handleFileChange,
    } = createPlugin()

    plugin.configResolved?.({
      command: 'serve',
    } as any)
    isRouteFile.mockImplementation((id: string) => id.endsWith('/pages/home/index.ts'))

    const served = await plugin.handleHotUpdate?.({
      file: '/virtual/project/src/pages/home/index.ts',
      server: {
        moduleGraph: {
          getModuleById: vi.fn(() => virtualModule),
        },
      },
      modules: [],
    } as any)
    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pages/home/index.ts', 'update')
    expect(served).toEqual([virtualModule])

    handleFileChange.mockClear()
    const ignoredServeUpdate = await plugin.handleHotUpdate?.({
      file: '/virtual/project/src/pages/home/style.scss',
      server: {
        moduleGraph: {
          getModuleById: vi.fn(() => virtualModule),
        },
      },
      modules: [],
    } as any)
    expect(ignoredServeUpdate).toBeUndefined()
    expect(handleFileChange).not.toHaveBeenCalled()

    plugin.configResolved?.({
      command: 'build',
    } as any)
    isRouteFile.mockImplementation((id: string) => id.endsWith('app.json'))

    const buildFiltered = await plugin.handleHotUpdate?.({
      file: '/virtual/project/src/app.json',
      server: {
        moduleGraph: {
          getModuleById: vi.fn(() => undefined),
        },
      },
      modules: [
        { id: '/virtual/project/src/app.json' },
        { id: '\0weapp-vite:auto-routes' },
      ],
    } as any)

    expect(buildFiltered).toEqual([{ id: '\0weapp-vite:auto-routes' }])
  })

  it('returns undefined for unrelated handleHotUpdate files', async () => {
    const { plugin, isRouteFile, handleFileChange } = createPlugin()
    plugin.configResolved?.({
      command: 'serve',
    } as any)
    isRouteFile.mockReturnValue(false)

    const result = await plugin.handleHotUpdate?.({
      file: '/virtual/project/src/components/card/index.ts',
      server: {
        moduleGraph: {
          getModuleById: vi.fn(() => undefined),
        },
      },
      modules: [],
    } as any)

    expect(result).toBeUndefined()
    expect(handleFileChange).not.toHaveBeenCalled()
  })
})
