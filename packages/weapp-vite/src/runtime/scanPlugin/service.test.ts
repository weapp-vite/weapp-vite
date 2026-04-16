import { fs } from '@weapp-core/shared/fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findJsonEntryMock = vi.hoisted(() => vi.fn<(id: string) => Promise<{ path?: string }>>())
const findJsEntryMock = vi.hoisted(() => vi.fn<(id: string) => Promise<{ path?: string }>>())
const findVueEntryMock = vi.hoisted(() => vi.fn<(id: string) => Promise<string | undefined>>())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const extractConfigFromVueMock = vi.hoisted(() => vi.fn<(id: string) => Promise<Record<string, any> | undefined>>())
const requireConfigServiceMock = vi.hoisted(() => vi.fn((ctx: any) => ctx.configService))
const normalizeSubPackageStyleEntriesMock = vi.hoisted(() => vi.fn(() => []))
const resolveSubPackageEntriesMock = vi.hoisted(() => vi.fn((subPackage: any) => [`${subPackage.root}/index`]))

vi.mock('../../utils', () => ({
  findJsonEntry: findJsonEntryMock,
  findJsEntry: findJsEntryMock,
  findVueEntry: findVueEntryMock,
}))

vi.mock('../../utils/file', () => ({
  extractConfigFromVue: extractConfigFromVueMock,
}))

vi.mock('../../logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

vi.mock('../utils/requireConfigService', () => ({
  requireConfigService: requireConfigServiceMock,
}))

vi.mock('./styleEntries', () => ({
  normalizeSubPackageStyleEntries: normalizeSubPackageStyleEntriesMock,
}))

vi.mock('./subpackages', () => ({
  resolveSubPackageEntries: resolveSubPackageEntriesMock,
}))

function createCtx(overrides: Record<string, any> = {}) {
  const scan = {
    appEntry: undefined,
    pluginJson: undefined,
    pluginJsonPath: undefined,
    isDirty: true,
    warnedMessages: new Set<string>(),
    subPackageMap: new Map(),
    independentSubPackageMap: new Map(),
    independentDirtyRoots: new Set<string>(),
  }

  return {
    runtimeState: {
      scan,
      autoRoutes: {
        loadingAppConfig: false,
      },
    },
    configService: {
      absoluteSrcRoot: '/project/src',
      absolutePluginRoot: '/project/plugin-root',
      weappViteConfig: {
        npm: {
          subPackages: {
            pkgA: {
              dependencies: ['dep-a-from-npm'],
            },
          },
        },
        subPackages: {
          pkgA: {
            inlineConfig: { mode: 'bundle' },
            autoImportComponents: ['c-a'],
            watchSharedStyles: false,
            styles: [],
          },
        },
      },
    },
    jsonService: {
      read: vi.fn(async () => ({})),
    },
    autoRoutesService: {
      isEnabled: vi.fn(() => false),
      ensureFresh: vi.fn(async () => {}),
      getReference: vi.fn(() => ({
        pages: [],
        entries: [],
        subPackages: [],
      })),
    },
    ...overrides,
  } as any
}

describe('scanPlugin service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(fs, 'pathExists').mockResolvedValue(false)
  })

  it('resolves scan basenames for app, plugin and optional json files', async () => {
    const {
      resolveScanAppBasename,
      resolveScanAppPreludeBasename,
      resolveScanJsonEntryBasename,
      resolveScanPluginBasename,
    } = await import('./service')

    expect(resolveScanAppBasename('/project/src')).toBe('/project/src/app')
    expect(resolveScanAppPreludeBasename('/project/src')).toBe('/project/src/app.prelude')
    expect(resolveScanPluginBasename('/project/plugin-root')).toBe('/project/plugin-root/plugin')
    expect(resolveScanPluginBasename(undefined)).toBeUndefined()

    expect(resolveScanJsonEntryBasename('/project/src', undefined, 'sitemap.json')).toBe('/project/src/sitemap.json')
    expect(resolveScanJsonEntryBasename('/project/src', 'configs/theme.json', 'theme.json')).toBe('/project/src/configs/theme.json')
    expect(resolveScanJsonEntryBasename('/project/src', '', 'theme.json')).toBeUndefined()
  })

  it('throws when loadAppEntry is called before config/json services are ready', async () => {
    const { createScanService } = await import('./service')
    const service = createScanService(createCtx({
      configService: undefined,
      jsonService: undefined,
    }))

    await expect(service.loadAppEntry()).rejects.toThrow('扫描入口前必须初始化 configService/jsonService。')
  })

  it('loads app entry, plugin config, sitemap and theme, then reuses cache', async () => {
    findJsonEntryMock.mockImplementation(async (id: string) => {
      if (id.endsWith('/project/src/app')) {
        return { path: '/project/src/app.json' }
      }
      if (id.endsWith('/project/plugin-root/plugin')) {
        return { path: '/project/plugin-root/plugin.json' }
      }
      if (id.endsWith('/project/src/sitemap.json')) {
        return { path: '/project/src/sitemap.json' }
      }
      if (id.endsWith('/project/src/theme.json')) {
        return { path: '/project/src/theme.json' }
      }
      return { path: undefined }
    })
    vi.spyOn(fs, 'pathExists').mockImplementation(async (id: string) => id === '/project/src/app.prelude.ts')
    findJsEntryMock.mockResolvedValue({ path: '/project/src/app.ts' })
    findVueEntryMock.mockResolvedValue(undefined)

    const readMock = vi.fn(async (file: string) => {
      if (file.endsWith('app.json')) {
        return {
          pages: ['pages/index/index'],
          subPackages: [{ root: 'pkgA', pages: ['pages/a'], independent: true }],
          sitemapLocation: 'sitemap.json',
          themeLocation: 'theme.json',
          workers: { path: 'workers' },
        }
      }
      if (file.endsWith('plugin.json')) {
        return { publicComponents: { x: 'components/x' } }
      }
      if (file.endsWith('sitemap.json')) {
        return { rules: [] }
      }
      if (file.endsWith('theme.json')) {
        return { light: true }
      }
      return {}
    })
    const ctx = createCtx({
      jsonService: {
        read: readMock,
      },
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    const first = await service.loadAppEntry()
    ctx.runtimeState.scan.isDirty = false
    const second = await service.loadAppEntry()

    expect(first.path).toBe('/project/src/app.ts')
    expect(first.preludePath).toBe('/project/src/app.prelude.ts')
    expect(first.jsonPath).toBe('/project/src/app.json')
    expect(first.sitemapJsonPath).toBe('/project/src/sitemap.json')
    expect(first.themeJsonPath).toBe('/project/src/theme.json')
    expect(service.pluginJsonPath).toBe('/project/plugin-root/plugin.json')
    expect(service.workersDir).toBe('workers')
    expect(second).toStrictEqual(first)
    expect(findJsEntryMock).toHaveBeenCalledTimes(1)
  })

  it('warns when app.ts and app.vue both exist but app.ts wins', async () => {
    findJsonEntryMock.mockResolvedValue({ path: '/project/src/app.json' })
    findJsEntryMock.mockResolvedValue({ path: '/project/src/app.ts' })
    findVueEntryMock.mockResolvedValue('/project/src/app.vue')

    const ctx = createCtx({
      jsonService: {
        read: vi.fn(async () => ({
          pages: ['pages/index/index'],
        })),
      },
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: undefined,
        weappViteConfig: {},
      },
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)
    const entry = await service.loadAppEntry()

    expect(entry.path).toBe('/project/src/app.ts')
    expect(entry.jsonPath).toBe('/project/src/app.json')
    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[app] 检测到 app.ts 与 app.vue 同时存在，当前将优先使用 app.ts 作为应用入口，app.vue 将被忽略。',
    )
    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[app] 检测到 app.json 与 app.vue 同时存在，当前将优先使用 app.json 作为应用配置来源，app.vue 中的 app 配置不会生效。',
    )
  })

  it('warns app/app config conflicts only once within the same scan context', async () => {
    findJsonEntryMock.mockResolvedValue({ path: '/project/src/app.json' })
    findJsEntryMock.mockResolvedValue({ path: '/project/src/app.ts' })
    findVueEntryMock.mockResolvedValue('/project/src/app.vue')

    const ctx = createCtx({
      jsonService: {
        read: vi.fn(async () => ({
          pages: ['pages/index/index'],
        })),
      },
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: undefined,
        weappViteConfig: {},
      },
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    await service.loadAppEntry()
    ctx.runtimeState.scan.appEntry = undefined
    await service.loadAppEntry()

    expect(loggerWarnMock).toHaveBeenCalledTimes(2)
  })

  it('uses app.vue fallback when app.json/app.ts are missing', async () => {
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findVueEntryMock.mockResolvedValue('/project/src/app.vue')
    extractConfigFromVueMock.mockResolvedValue({
      pages: ['pages/home/index'],
      subpackages: [{ root: 'pkgA', pages: ['pages/a'] }],
    })

    const ctx = createCtx({
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: undefined,
        weappViteConfig: {
          subPackages: {},
        },
      },
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)
    const entry = await service.loadAppEntry()

    expect(entry.path).toBe('/project/src/app.vue')
    expect(entry.jsonPath).toBe('/project/src/app.vue')
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('hydrates app.vue config with auto-routes pages when static extraction is incomplete', async () => {
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findVueEntryMock.mockResolvedValue('/project/src/app.vue')
    extractConfigFromVueMock.mockResolvedValue({})

    const autoRoutesService = {
      isEnabled: vi.fn(() => true),
      ensureFresh: vi.fn(async () => {}),
      getReference: vi.fn(() => ({
        pages: ['pages/home/index'],
        entries: ['pages/home/index'],
        subPackages: [{ root: 'pkgA', pages: ['pages/a'] }],
      })),
    }

    const ctx = createCtx({
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: undefined,
        weappViteConfig: {
          autoRoutes: true,
          subPackages: {},
        },
      },
      autoRoutesService,
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)
    const entry = await service.loadAppEntry()

    expect(autoRoutesService.ensureFresh).toHaveBeenCalledTimes(1)
    expect(entry.json.pages).toEqual(['pages/home/index'])
    expect(entry.json.subPackages).toEqual([{ root: 'pkgA', pages: ['pages/a'] }])
  })

  it('merges auto-routes pages and subPackages into partially extracted app.vue config', async () => {
    findJsonEntryMock.mockResolvedValue({ path: undefined })
    findJsEntryMock.mockResolvedValue({ path: undefined })
    findVueEntryMock.mockResolvedValue('/project/src/app.vue')
    extractConfigFromVueMock.mockResolvedValue({
      pages: ['components/router-origin-probe/target/index'],
      subPackages: [{ root: 'pkgB', pages: ['pages/custom'] }],
    })

    const autoRoutesService = {
      isEnabled: vi.fn(() => true),
      ensureFresh: vi.fn(async () => {}),
      getReference: vi.fn(() => ({
        pages: ['pages/home/index', 'pages/use-attrs/index'],
        entries: ['pages/home/index', 'pages/use-attrs/index'],
        subPackages: [
          { root: 'pkgA', pages: ['pages/a'] },
          { root: 'pkgB', pages: ['pages/b'] },
        ],
      })),
    }

    const ctx = createCtx({
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: undefined,
        weappViteConfig: {
          autoRoutes: true,
          subPackages: {},
        },
      },
      autoRoutesService,
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)
    const entry = await service.loadAppEntry()

    expect(entry.json.pages).toEqual([
      'pages/home/index',
      'pages/use-attrs/index',
      'components/router-origin-probe/target/index',
    ])
    expect(entry.json.subPackages).toEqual([
      { root: 'pkgB', pages: ['pages/b', 'pages/custom'] },
      { root: 'pkgA', pages: ['pages/a'] },
    ])
  })

  it('throws when app config resolves but is not an object', async () => {
    findJsonEntryMock.mockResolvedValue({ path: '/project/src/app.json' })
    findJsEntryMock.mockResolvedValue({ path: '/project/src/app.ts' })
    findVueEntryMock.mockResolvedValue(undefined)

    const ctx = createCtx({
      jsonService: {
        read: vi.fn(async () => 123),
      },
    })
    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    await expect(service.loadAppEntry()).rejects.toThrow('`app.json` 解析失败')
  })

  it('builds subpackage metadata, tracks independent roots and refreshes entries', async () => {
    const ctx = createCtx()
    ctx.runtimeState.scan.appEntry = {
      path: '/project/src/app.ts',
      jsonPath: '/project/src/app.json',
      type: 'app',
      json: {
        subPackages: [{ root: 'pkgA', pages: ['pages/a'], independent: true }],
        subpackages: [{ root: 'pkgB', pages: ['pages/b'] }],
      },
    }

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    const metas = service.loadSubPackages()
    expect(metas).toHaveLength(2)
    expect(service.subPackageMap.has('pkgA')).toBe(true)
    expect(service.independentSubPackageMap.has('pkgA')).toBe(true)
    expect(service.subPackageMap.get('pkgA')?.subPackage.dependencies).toEqual(['dep-a-from-npm'])
    expect(ctx.runtimeState.scan.appEntry.json.subPackages[0]).not.toHaveProperty('dependencies')
    expect(ctx.runtimeState.scan.appEntry.json.subPackages[0]).not.toHaveProperty('inlineConfig')
    expect(service.drainIndependentDirtyRoots()).toEqual(['pkgA'])
    expect(service.drainIndependentDirtyRoots()).toEqual([])
    expect(service.isMainPackageFileName('pages/home/index')).toBe(true)
    expect(service.isMainPackageFileName('pkgA/pages/a')).toBe(false)

    service.markIndependentDirty('pkgA')
    expect(service.drainIndependentDirtyRoots()).toEqual(['pkgA'])

    ctx.runtimeState.scan.isDirty = false
    service.loadSubPackages()
    expect(resolveSubPackageEntriesMock).toHaveBeenCalled()
  })

  it('normalizes windows-style subpackage roots before config lookup and tracking', async () => {
    const ctx = createCtx({
      runtimeState: {
        scan: {
          appEntry: {
            path: '/project/src/app.ts',
            jsonPath: '/project/src/app.json',
            type: 'app',
            json: {
              subPackages: [{ root: 'pkgA\\nested', pages: ['pages/a'], independent: true }],
            },
          },
          pluginJson: undefined,
          pluginJsonPath: undefined,
          isDirty: true,
          warnedMessages: new Set<string>(),
          subPackageMap: new Map(),
          independentSubPackageMap: new Map(),
          independentDirtyRoots: new Set<string>(),
        },
        autoRoutes: {
          loadingAppConfig: false,
        },
      },
      configService: {
        absoluteSrcRoot: '/project/src',
        absolutePluginRoot: '/project/plugin-root',
        weappViteConfig: {
          npm: {
            subPackages: {
              'pkgA/nested': {
                dependencies: ['dep-a-from-npm'],
              },
            },
          },
          subPackages: {
            'pkgA/nested': {
              inlineConfig: { mode: 'bundle' },
              autoImportComponents: ['c-a'],
              watchSharedStyles: false,
              styles: [],
            },
          },
        },
      },
    })

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    service.loadSubPackages()

    expect(service.subPackageMap.has('pkgA/nested')).toBe(true)
    expect(service.independentSubPackageMap.has('pkgA/nested')).toBe(true)
    expect(service.subPackageMap.get('pkgA/nested')?.subPackage.root).toBe('pkgA/nested')
    expect(service.subPackageMap.get('pkgA/nested')?.subPackage.dependencies).toEqual(['dep-a-from-npm'])
    expect(service.isMainPackageFileName('pkgA\\nested/pages/a')).toBe(false)

    service.markIndependentDirty('pkgA\\nested')
    expect(service.drainIndependentDirtyRoots()).toEqual(['pkgA/nested'])
  })

  it('throws when loading subpackages without appEntry', async () => {
    const ctx = createCtx()
    ctx.runtimeState.scan.isDirty = false
    ctx.runtimeState.scan.appEntry = undefined
    ctx.runtimeState.scan.subPackageMap.clear()

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    expect(() => service.loadSubPackages()).toThrow('没有找到 `app.json`')
  })

  it('markDirty resets cached app/plugin states and ignores empty independent roots', async () => {
    const ctx = createCtx()
    ctx.runtimeState.scan.appEntry = { path: '/project/src/app.ts', json: {}, type: 'app' }
    ctx.runtimeState.scan.pluginJson = { pages: [] }
    ctx.runtimeState.scan.pluginJsonPath = '/project/plugin-root/plugin.json'

    const { createScanService } = await import('./service')
    const service = createScanService(ctx)

    service.markDirty()
    expect(service.appEntry).toBeUndefined()
    expect(service.pluginJson).toBeUndefined()
    expect(service.pluginJsonPath).toBeUndefined()

    service.markIndependentDirty('')
    expect(service.drainIndependentDirtyRoots()).toEqual([])
  })
})
