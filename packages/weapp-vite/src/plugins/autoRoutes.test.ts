import type { HmrContext, Plugin, PluginContext, ResolvedConfig, ViteDevServer } from 'vite'
import chokidar from 'chokidar'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autoRoutes } from './autoRoutes'

const chokidarWatchMock = vi.hoisted(() => vi.fn(() => ({
  add: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
})))

const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock('../context/shared', () => ({
  logger: loggerMock,
}))

vi.mock('chokidar', () => ({
  default: {
    watch: chokidarWatchMock,
  },
}))

function createPlugin(overrides: Record<string, unknown> = {}) {
  const ensureFresh = vi.fn(async () => {})
  const getModuleCode = vi.fn(() => 'export const pages = ["pages/home/index"]')
  const getNamedModuleCode = vi.fn(() => 'export const routes = [{"name":"home","path":"/pages/home/index","meta":{}}]')
  const getWatchFiles = vi.fn(() => [])
  const getWatchDirectories = vi.fn(() => [])
  const isRouteFile = vi.fn(() => false)
  const isPageSource = vi.fn(() => false)
  const isPageDeclarationSource = vi.fn((_filePath: string) => false)
  const getPageDeclarationOwners = vi.fn((_filePath: string) => [] as string[])
  const isEnabled = vi.fn(() => true)
  const handleFileChange = vi.fn(async () => true)
  const setPageDeclarationSourceResolver = vi.fn((
    _resolver?: (source: string, importer?: string) => Promise<string | undefined>,
  ) => {})
  const ctx = {
    autoRoutesService: {
      ensureFresh,
      getModuleCode,
      getNamedModuleCode,
      getWatchFiles,
      getWatchDirectories,
      isRouteFile,
      isPageSource,
      isPageDeclarationSource,
      getPageDeclarationOwners,
      isEnabled,
      handleFileChange,
      setPageDeclarationSourceResolver,
      getSignature: vi.fn(() => 'routes'),
    },
    runtimeState: {
      watcher: {
        sidecarWatcherMap: new Map(),
      },
      build: {
        hmr: {
          profile: {},
          dirtyVueEntryIds: new Set(),
          dirtyEntryReasons: new Map(),
          dirtyEntrySet: new Set(),
          loadedEntrySet: new Set(),
          resolvedEntryMap: new Map(),
        },
      },
    },
    configService: {
      cwd: '/virtual/project',
      absoluteSrcRoot: '/virtual/project/src',
      isDev: true,
      relativeCwd: (id: string) => id.replace('/virtual/project/', ''),
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
  if (ctx.scanService) {
    ctx.scanService = { markDirty: vi.fn(), ...ctx.scanService }
  }

  const [plugin] = autoRoutes(ctx) as Plugin[]
  return {
    plugin,
    ensureFresh,
    getModuleCode,
    getNamedModuleCode,
    getWatchFiles,
    getWatchDirectories,
    isRouteFile,
    isPageSource,
    isPageDeclarationSource,
    getPageDeclarationOwners,
    isEnabled,
    handleFileChange,
    setPageDeclarationSourceResolver,
    packageRoot: ctx.configService.packageInfo.rootPath,
    ctx,
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
    const { plugin, ctx } = createPlugin()

    expect(await plugin.resolveId?.call({}, 'weapp-vite/auto-routes')).toBe('\0weapp-vite:auto-routes')
    expect(await plugin.resolveId?.call({}, 'virtual:weapp-vite-auto-routes')).toBe('\0weapp-vite:auto-routes')
    expect(await plugin.resolveId?.call({}, '\0weapp-vite:auto-routes')).toBe('\0weapp-vite:auto-routes')
    expect(await plugin.resolveId?.call({}, '/virtual/project/src/pages/index.ts')).toBeNull()
    expect(ctx.runtimeState.build.hmr.profile).toEqual(expect.objectContaining({
      pluginResolveMs: expect.any(Number),
      resolveCount: 4,
    }))
  })

  it('resolves and loads the named data-only route module', async () => {
    const { plugin, ensureFresh, getNamedModuleCode } = createPlugin()

    expect(await plugin.resolveId?.call({}, 'wevu/router/auto-routes')).toBe('\0wevu:auto-routes')
    expect(await plugin.resolveId?.call({}, 'virtual:wevu-auto-routes')).toBe('\0wevu:auto-routes')
    expect(await plugin.resolveId?.call({}, '\0wevu:auto-routes')).toBe('\0wevu:auto-routes')

    const pluginContext = { addWatchFile: vi.fn() } as unknown as PluginContext
    const loaded = await plugin.load?.call(pluginContext, 'wevu/router/auto-routes')
    expect(ensureFresh).toHaveBeenCalled()
    expect(getNamedModuleCode).toHaveBeenCalled()
    expect(loaded).toEqual({
      code: 'export const routes = [{"name":"home","path":"/pages/home/index","meta":{}}]',
      map: { mappings: '' },
    })
  })

  it('erases bound page macros from native, external, and Vue script requests', async () => {
    const jsPagePath = '/virtual/project/src/pages/js/index.js'
    const tsPagePath = '/virtual/project/src/pages/ts/index.ts'
    const externalPageScripts = [
      '/virtual/project/node_modules/page-package/profile.mjs',
      '/virtual/project/node_modules/page-package/settings.cjs',
    ]
    const vuePagePath = '/virtual/project/src/pages/vue/index.vue'
    const pageDeclarationPaths = [jsPagePath, tsPagePath, ...externalPageScripts, vuePagePath]
    const { plugin, isPageDeclarationSource } = createPlugin()
    isPageDeclarationSource.mockImplementation((id: string) => pageDeclarationPaths.includes(id))
    const source = 'import { definePage } from "wevu/router"; definePage({ name: "home" }); export const answer = 42'

    for (const id of [jsPagePath, tsPagePath, ...externalPageScripts, `${vuePagePath}?vue&type=script`]) {
      const result = await plugin.transform?.call({}, source, id)
      expect(result).toMatchObject({
        code: expect.stringContaining('export const answer = 42'),
        map: { version: 3 },
      })
      if (!result || typeof result !== 'object') {
        throw new Error('Expected a transformed page script')
      }
      expect(result.code).not.toContain('definePage')
    }
    await expect(plugin.transform?.call({}, source, vuePagePath)).resolves.toBeNull()
    await expect(plugin.transform?.call({}, source, '/virtual/project/src/components/card.ts')).resolves.toBeNull()
  })

  it('does not parse Vue style, template, or custom block requests as page scripts', async () => {
    const vuePagePath = '/virtual/project/src/pages/vue/index.vue'
    const externalScriptPath = '/virtual/project/node_modules/page-package/page.mjs'
    const { plugin, ensureFresh, isPageDeclarationSource } = createPlugin()
    isPageDeclarationSource.mockImplementation((id: string) => id === vuePagePath || id === externalScriptPath)

    const requests = [
      {
        code: String.raw`.icon\:active::before { content: "definePage"; }`,
        id: `${vuePagePath}?vue&type=style&lang.css`,
      },
      {
        code: String.raw`.icon\:active::before { content: "definePage"; }`,
        id: `${externalScriptPath}?vue&type=style&lang.css`,
      },
      {
        code: '<view>definePage is documentation text</view>',
        id: `${vuePagePath}?vue&type=template`,
      },
      {
        code: String.raw`<docs>Use \definePage in page scripts.</docs>`,
        id: `${vuePagePath}?vue&type=custom&index=0`,
      },
    ]

    for (const request of requests) {
      await expect(plugin.transform?.call({}, request.code, request.id)).resolves.toBeNull()
    }
    expect(ensureFresh).not.toHaveBeenCalled()
    expect(isPageDeclarationSource).not.toHaveBeenCalled()
  })

  it('keeps buildStart lazy before auto-routes module is requested', async () => {
    const {
      plugin,
      ensureFresh,
      getWatchFiles,
      getWatchDirectories,
      setPageDeclarationSourceResolver,
    } = createPlugin()
    const addWatchFile = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('watch failed')
      })
    const resolve = vi.fn(async () => ({ id: '/virtual/project/src/pageScripts/profile.ts' }))
    const pluginContext = { addWatchFile, resolve } as unknown as PluginContext
    getWatchFiles.mockReturnValueOnce(['/virtual/project/src/pages/index/index.ts'])
    getWatchDirectories.mockReturnValueOnce(['/virtual/project/src/pages'])

    plugin.configResolved?.({
      command: 'serve',
    } as any)

    expect(plugin.buildStart?.call(pluginContext)).toBeUndefined()
    expect(ensureFresh).not.toHaveBeenCalled()
    expect(addWatchFile).not.toHaveBeenCalled()
    expect(chokidar.watch).toHaveBeenCalledTimes(1)
    const declarationResolver = setPageDeclarationSourceResolver.mock.calls[0]?.[0]
    expect(declarationResolver).toBeTypeOf('function')
    if (!declarationResolver) {
      throw new Error('Expected a page declaration source resolver')
    }
    await expect(declarationResolver('@/pageScripts/profile', '/virtual/project/src/pages/profile/index.vue'))
      .resolves
      .toBe('/virtual/project/src/pageScripts/profile.ts')
    expect(resolve).toHaveBeenCalledWith(
      '@/pageScripts/profile',
      '/virtual/project/src/pages/profile/index.vue',
      { skipSelf: true },
    )
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

  it('marks app entry dirty when sidecar watcher syncs a created route', async () => {
    const appEntry = '/virtual/project/src/app.vue'
    const { plugin, ctx } = createPlugin({
      scanService: {
        appEntry: {
          path: appEntry,
        },
      },
    })
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(appEntry, { id: appEntry })
    ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = 'old-routes'
    const emit = vi.fn()
    chokidarWatchMock.mockClear()

    plugin.configResolved?.({
      command: 'serve',
    } as any)
    plugin.configureServer?.({
      moduleGraph: {
        getModuleById: vi.fn(() => ({
          id: '\0weapp-vite:auto-routes',
          importers: new Set(),
        })),
        invalidateModule: vi.fn(),
      },
      watcher: {
        emit,
      },
    } as any)

    await plugin.load?.call({ addWatchFile: vi.fn() } as any, path.resolve('/virtual/weapp-vite', 'src/auto-routes.ts'))
    const watcher = chokidarWatchMock.mock.results[0]?.value
    const addHandler = watcher.on.mock.calls.find(([event]: [string]) => event === 'add')?.[1]
    expect(addHandler).toBeTypeOf('function')

    addHandler('/virtual/project/src/pages/logs/hmr-added.vue')
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith('change', appEntry)
    })

    emit.mockClear()
    addHandler('/virtual/project/src/pages/logs/native-added.ts')
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith('change', appEntry)
    })

    expect(ctx.runtimeState.build.hmr.dirtyVueEntryIds.has(appEntry)).toBe(true)
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet.has(appEntry)).toBe(true)
    expect(ctx.runtimeState.build.hmr.dirtyEntryReasons.get(appEntry)).toBe('direct')
    expect(ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature).toBeUndefined()
    expect(emit).toHaveBeenCalledWith('change', appEntry)
    expect(plugin.shouldTransformCachedModule?.({ id: appEntry } as any)).toBe(true)
    expect(plugin.shouldTransformCachedModule?.({ id: appEntry } as any)).toBeUndefined()
  })

  it('reports rejected sidecar creates through Vite and recovers on the next event', async () => {
    const appEntry = '/virtual/project/src/app.vue'
    const invalidPage = '/virtual/project/src/pages/duplicate/index.ts'
    const recoveredPage = '/virtual/project/src/pages/recovered/index.ts'
    const { plugin, handleFileChange, ctx } = createPlugin({
      scanService: {
        appEntry: {
          path: appEntry,
        },
      },
    })
    handleFileChange
      .mockRejectedValueOnce(new Error('definePage 名称 "home" 重复'))
      .mockResolvedValueOnce(true)
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(appEntry, { id: appEntry })
    ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = 'old-routes'
    const virtualModule = {
      id: '\0weapp-vite:auto-routes',
      importers: new Set(),
    }
    const invalidateModule = vi.fn()
    const emit = vi.fn()
    const send = vi.fn()
    chokidarWatchMock.mockClear()

    plugin.configResolved?.({
      command: 'serve',
    } as unknown as ResolvedConfig)
    plugin.configureServer?.({
      moduleGraph: {
        getModuleById: vi.fn((id: string) => id === virtualModule.id ? virtualModule : undefined),
        invalidateModule,
      },
      watcher: {
        emit,
      },
      ws: {
        send,
      },
    } as unknown as ViteDevServer)

    const pluginContext = { addWatchFile: vi.fn() } as unknown as PluginContext
    await plugin.load?.call(pluginContext, path.resolve('/virtual/weapp-vite', 'src/auto-routes.ts'))
    const watcher = chokidarWatchMock.mock.results[0]?.value
    const addHandler = watcher.on.mock.calls.find(([event]: [string]) => event === 'add')?.[1]
    expect(addHandler).toBeTypeOf('function')

    addHandler(invalidPage)
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledWith({
        type: 'error',
        err: expect.objectContaining({
          id: invalidPage,
          message: expect.stringContaining('definePage 名称 "home" 重复'),
          plugin: 'weapp-vite:auto-routes',
          stack: expect.any(String),
        }),
      })
    })
    expect(loggerMock.error).not.toHaveBeenCalled()
    expect(invalidateModule).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    expect(ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature).toBe('old-routes')
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet.has(appEntry)).toBe(false)

    addHandler(recoveredPage)
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith('change', appEntry)
    })
    expect(invalidateModule).toHaveBeenCalledWith(virtualModule)
    expect(ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature).toBeUndefined()
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet.has(appEntry)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('logs rejected sidecar deletes when no Vite server is available', async () => {
    const deletedPage = '/virtual/project/src/pages/deleted/index.vue'
    const { plugin, handleFileChange } = createPlugin()
    handleFileChange.mockRejectedValueOnce(new Error('页面声明无效'))
    chokidarWatchMock.mockClear()

    plugin.buildStart?.call({} as unknown as PluginContext)
    const watcher = chokidarWatchMock.mock.results[0]?.value
    const unlinkHandler = watcher.on.mock.calls.find(([event]: [string]) => event === 'unlink')?.[1]
    expect(unlinkHandler).toBeTypeOf('function')

    unlinkHandler(deletedPage)
    await vi.waitFor(() => {
      expect(loggerMock.error).toHaveBeenCalledTimes(1)
    })
    const reported = loggerMock.error.mock.calls[0]?.[0]
    expect(reported).toBeInstanceOf(Error)
    expect((reported as Error).message).toContain(
      '[auto-routes:watch] 删除路由文件 src/pages/deleted/index.vue 处理失败：页面声明无效',
    )
  })

  it('shares one watcher and invalidates external declaration owners across native and Web', async () => {
    const appEntry = '/virtual/project/src/app.vue'
    const externalPageScript = '/virtual/project/node_modules/page-package/shared.mjs'
    const externalDirectory = '/virtual/project/node_modules/page-package'
    const declarationOwners = [
      '/virtual/project/src/pages/account/index.vue',
      '/virtual/project/src/pages/profile/index.vue',
    ]
    const {
      plugin: nativePlugin,
      getPageDeclarationOwners,
      getWatchDirectories,
      handleFileChange,
      isPageDeclarationSource,
      ctx,
    } = createPlugin({
      scanService: {
        appEntry: {
          path: appEntry,
        },
      },
    })
    isPageDeclarationSource.mockImplementation((id: string) => id === externalPageScript)
    getPageDeclarationOwners.mockImplementation((id: string) => (
      id === externalPageScript ? declarationOwners : []
    ))
    const [webPlugin] = autoRoutes(ctx) as Plugin[]
    if (!webPlugin) {
      throw new Error('Expected the Web auto-routes plugin')
    }
    ctx.runtimeState.build.hmr.resolvedEntryMap.set(appEntry, { id: appEntry })
    const nativeModule = {
      id: '\0weapp-vite:auto-routes',
      importers: new Set(),
    }
    const webModule = {
      id: '\0wevu:auto-routes',
      importers: new Set(),
    }
    const nativeInvalidate = vi.fn()
    const webInvalidate = vi.fn()
    const nativeEmit = vi.fn()
    const webEmit = vi.fn()
    chokidarWatchMock.mockClear()

    nativePlugin.configResolved?.({
      command: 'build',
      weappVite: {
        name: 'weapp-vite',
        platform: 'weapp',
        runtime: 'miniprogram',
      },
    } as unknown as ResolvedConfig)
    webPlugin.configResolved?.({
      command: 'serve',
      weappVite: {
        name: 'weapp-vite',
        platform: 'web',
        runtime: 'web',
      },
    } as unknown as ResolvedConfig)
    nativePlugin.configureServer?.({
      moduleGraph: {
        getModuleById: vi.fn((id: string) => id === nativeModule.id ? nativeModule : undefined),
        invalidateModule: nativeInvalidate,
      },
      watcher: {
        emit: nativeEmit,
      },
      ws: {
        send: vi.fn(),
      },
    } as unknown as ViteDevServer)
    webPlugin.configureServer?.({
      moduleGraph: {
        getModuleById: vi.fn((id: string) => id === webModule.id ? webModule : undefined),
        invalidateModule: webInvalidate,
      },
      watcher: {
        emit: webEmit,
      },
      ws: {
        send: vi.fn(),
      },
    } as unknown as ViteDevServer)

    const pluginContext = {} as unknown as PluginContext
    nativePlugin.buildStart?.call(pluginContext)
    getWatchDirectories.mockReturnValue([externalDirectory])
    webPlugin.buildStart?.call(pluginContext)
    expect(chokidarWatchMock).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)

    const watcher = chokidarWatchMock.mock.results[0]?.value
    const addHandler = watcher.on.mock.calls.find(([event]: [string]) => event === 'add')?.[1]
    expect(watcher.add).toHaveBeenCalledWith(expect.arrayContaining([externalDirectory]))
    expect(addHandler).toBeTypeOf('function')
    addHandler(externalPageScript)

    await vi.waitFor(() => {
      expect(handleFileChange).toHaveBeenCalledTimes(1)
      for (const owner of declarationOwners) {
        expect(nativeEmit).toHaveBeenCalledWith('change', owner)
        expect(webEmit).toHaveBeenCalledWith('change', owner)
      }
      expect(nativeEmit).toHaveBeenCalledWith('change', appEntry)
      expect(webEmit).toHaveBeenCalledWith('change', appEntry)
    })
    expect(nativeInvalidate).toHaveBeenCalledWith(nativeModule)
    expect(webInvalidate).toHaveBeenCalledWith(webModule)
    const cachedModule = {
      code: '',
      id: appEntry,
      meta: {},
      moduleSideEffects: false as const,
    }
    expect(nativePlugin.shouldTransformCachedModule?.(cachedModule)).toBe(true)
    expect(webPlugin.shouldTransformCachedModule?.(cachedModule)).toBe(true)

    await webPlugin.closeBundle?.()
    expect(watcher.close).not.toHaveBeenCalled()
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)

    const [registeredWatcher] = ctx.runtimeState.watcher.sidecarWatcherMap.values()
    if (!registeredWatcher) {
      throw new Error('Expected a registered auto-routes watcher')
    }
    await registeredWatcher.close()
    expect(watcher.close).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
  })

  it('closes the shared watcher when the sole Web subscriber exits', async () => {
    const { plugin, ctx } = createPlugin()
    chokidarWatchMock.mockClear()
    plugin.configResolved?.({
      command: 'serve',
      weappVite: {
        name: 'weapp-vite',
        platform: 'web',
        runtime: 'web',
      },
    } as unknown as ResolvedConfig)

    plugin.buildStart?.call({} as unknown as PluginContext)
    const watcher = chokidarWatchMock.mock.results[0]?.value
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)

    await plugin.closeBundle?.()

    expect(watcher.close).toHaveBeenCalledTimes(1)
    expect(ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)
  })

  it('returns every logical Vue owner for an external declaration hot update', async () => {
    const externalPageScript = '/virtual/project/node_modules/page-package/shared.cjs'
    const ownerPaths = [
      '/virtual/project/src/pages/account/index.vue',
      '/virtual/project/src/pages/profile/index.vue',
    ]
    const ownerModules = ownerPaths.map(id => ({ id }))
    const virtualModule = { id: '\0wevu:auto-routes' }
    const {
      plugin,
      getPageDeclarationOwners,
      handleFileChange,
      isRouteFile,
    } = createPlugin()
    isRouteFile.mockImplementation((id: string) => id === externalPageScript)
    getPageDeclarationOwners.mockImplementation((id: string) => (
      id === externalPageScript ? ownerPaths : []
    ))
    plugin.configResolved?.({
      command: 'serve',
    } as unknown as ResolvedConfig)

    const result = await plugin.handleHotUpdate?.({
      file: externalPageScript,
      modules: [],
      server: {
        moduleGraph: {
          getModuleById: vi.fn((id: string) => id === virtualModule.id ? virtualModule : undefined),
          getModulesByFile: vi.fn((id: string) => {
            const index = ownerPaths.indexOf(id)
            return index >= 0 ? new Set([ownerModules[index]!]) : undefined
          }),
        },
      },
    } as unknown as HmrContext)

    expect(handleFileChange).toHaveBeenCalledTimes(1)
    expect(handleFileChange).toHaveBeenCalledWith(externalPageScript, 'update')
    expect(result).toEqual([virtualModule, ...ownerModules])
  })

  it('invalidates app auto-routes signature when sidecar syncs before app entry resolves', async () => {
    const appEntry = '/virtual/project/src/app.vue'
    const { plugin, ctx } = createPlugin({
      scanService: {
        appEntry: {
          path: appEntry,
        },
      },
    })
    ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = 'old-routes'
    const emit = vi.fn()
    chokidarWatchMock.mockClear()

    plugin.configResolved?.({
      command: 'serve',
    } as any)
    plugin.configureServer?.({
      moduleGraph: {
        getModuleById: vi.fn(() => ({
          id: '\0weapp-vite:auto-routes',
          importers: new Set(),
        })),
        invalidateModule: vi.fn(),
      },
      watcher: {
        emit,
      },
    } as any)

    await plugin.load?.call({ addWatchFile: vi.fn() } as any, path.resolve('/virtual/weapp-vite', 'src/auto-routes.ts'))
    const watcher = chokidarWatchMock.mock.results[0]?.value
    const addHandler = watcher.on.mock.calls.find(([event]: [string]) => event === 'add')?.[1]
    expect(addHandler).toBeTypeOf('function')

    addHandler('/virtual/project/src/pages/logs/hmr-added.vue')
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith('change', appEntry)
    })

    expect(ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature).toBeUndefined()
    expect(ctx.runtimeState.build.hmr.dirtyEntrySet.has(appEntry)).toBe(false)
    expect(emit).toHaveBeenCalledWith('change', appEntry)
    expect(plugin.shouldTransformCachedModule?.({ id: appEntry } as any)).toBeUndefined()
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

    plugin.configResolved?.({
      command: 'serve',
    } as any)
    isRouteFile.mockImplementation((id: string) => id.endsWith('app.json'))
    await plugin.watchChange?.('/virtual/project/src/app.json', { event: 'update' } as any)
    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/app.json', 'update')

    isRouteFile.mockReturnValue(false)
    await plugin.watchChange?.('/virtual/project/src/pages/home/index.ts', { event: 'create' } as any)
    await plugin.watchChange?.('/virtual/project/src/pages/home/style.scss', { event: 'update' } as any)
    await plugin.watchChange?.('/virtual/project/src/components/card/index.ts', { event: 'update' } as any)

    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pages/home/index.ts', 'rename')
    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/pages/home/style.scss', 'rename')
    expect(handleFileChange).not.toHaveBeenCalledWith('/virtual/project/src/components/card/index.ts', 'rename')
  })

  it('keeps route file watchChange updates in build mode for non-serve flows', async () => {
    const {
      plugin,
      isRouteFile,
      handleFileChange,
    } = createPlugin()

    plugin.configResolved?.({
      command: 'build',
    } as any)
    isRouteFile.mockImplementation((id: string) => id.endsWith('app.json'))

    await plugin.watchChange?.('/virtual/project/src/app.json', { event: 'update' } as any)

    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/app.json', 'update')
  })

  it('routes pages rename-like delete and create events to full rescan handling', async () => {
    const {
      plugin,
      isRouteFile,
      handleFileChange,
    } = createPlugin()

    isRouteFile.mockReturnValue(false)
    await plugin.watchChange?.('/virtual/project/src/pages/old/index.ts', { event: 'delete' } as any)
    await plugin.watchChange?.('/virtual/project/src/pages/new/index.ts', { event: 'create' } as any)

    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pages/old/index.ts', 'rename')
    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pages/new/index.ts', 'rename')
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

  it('skips virtual auto-routes invalidation when route update does not change topology', async () => {
    const { plugin, isRouteFile, handleFileChange } = createPlugin()
    handleFileChange.mockResolvedValueOnce(false)

    plugin.configResolved?.({
      command: 'serve',
    } as any)
    isRouteFile.mockReturnValue(true)

    const result = await plugin.handleHotUpdate?.({
      file: '/virtual/project/src/pages/home/index.vue',
      server: {
        moduleGraph: {
          getModuleById: vi.fn(() => ({ id: '\0weapp-vite:auto-routes' })),
        },
      },
      modules: [],
    } as any)

    expect(handleFileChange).toHaveBeenCalledWith('/virtual/project/src/pages/home/index.vue', 'update')
    expect(result).toBeUndefined()
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
