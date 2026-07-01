import type { PluginContext } from 'rolldown'
import type { Mock } from 'vitest'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../../logger'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createWxmlServicePlugin } from '../../../runtime/wxmlPlugin'
import { toPosixPath } from '../../../utils/path'
import { clearFileCaches, invalidateFileCache } from '../../utils/cache'
import { SLOT_HOST_SCRIPTLESS_COMPONENT_STUB } from '../../utils/scriptlessComponent'
import { createExtendedLibManager } from './extendedLib'
import { createEntryLoader } from './loadEntry'

type MockedFinder = (filepath: string) => Promise<{ path?: string, predictions: string[] }>
const normalizeWatchCall = (value: string) => toPosixPath(value)

const {
  magicStringPrependMock,
  magicStringUpdateMock,
  magicStringToStringMock,
  MagicStringMock,
  compilerClearFileCachesMock,
  compilerInvalidateFileCacheMock,
  existsMock,
  readFileMock,
  statMock,
  mockFindJsonEntry,
  mockFindTemplateEntry,
  mockFindVueEntry,
  mockFindJsEntry,
  mockExtractConfigFromVue,
  mockResolvePageLayoutPlan,
  mockApplyPageLayoutPlanToNativePage,
  mockInjectNativePageLayoutRuntime,
  mockCollectNativeLayoutAssets,
  mockCompileVueFile,
} = vi.hoisted(() => {
  const innerMagicStringPrepend = vi.fn()
  const innerMagicStringUpdate = vi.fn()
  const innerMagicStringToString = vi.fn().mockReturnValue('transformed')
  const innerMagicString = vi.fn(function MagicStringMockImpl(this: Record<string, any>) {
    this.prepend = innerMagicStringPrepend
    this.update = innerMagicStringUpdate
    this.toString = innerMagicStringToString
  })

  const innerCompilerClearFileCachesMock = vi.fn()
  const innerCompilerInvalidateFileCacheMock = vi.fn()
  const innerExistsMock = vi.fn()
  const innerReadFileMock = vi.fn()
  const innerStatMock = vi.fn()

  const innerFindJsonEntry = vi.fn<MockedFinder>(async (_filepath: string) => {
    return {
      path: undefined,
      predictions: [] as string[],
    }
  }) as unknown as Mock<MockedFinder>

  const innerFindTemplateEntry = vi.fn<MockedFinder>(async (_filepath: string) => {
    return {
      path: undefined,
      predictions: [] as string[],
    }
  }) as unknown as Mock<MockedFinder>

  const innerFindVueEntry = vi.fn(async () => undefined) as unknown as Mock<(filepath: string) => Promise<string | undefined>>
  const innerFindJsEntry = vi.fn(async () => ({ path: undefined, predictions: [] as string[] })) as unknown as Mock<(filepath: string) => Promise<{ path?: string, predictions: string[] }>>
  const innerExtractConfigFromVue = vi.fn(async () => undefined) as unknown as Mock<(vueFilePath: string) => Promise<Record<string, any> | undefined>>
  const innerResolvePageLayoutPlan = vi.fn(async () => undefined)
  const innerApplyPageLayoutPlanToNativePage = vi.fn((result: any) => result)
  const innerInjectNativePageLayoutRuntime = vi.fn((script: string | undefined) => script)
  const innerCollectNativeLayoutAssets = vi.fn(async () => ({
    json: undefined,
    template: undefined,
    style: undefined,
    script: undefined,
  }))
  const innerCompileVueFile = vi.fn(async () => ({
    script: undefined,
  }))

  return {
    magicStringPrependMock: innerMagicStringPrepend,
    magicStringUpdateMock: innerMagicStringUpdate,
    magicStringToStringMock: innerMagicStringToString,
    MagicStringMock: innerMagicString,
    compilerClearFileCachesMock: innerCompilerClearFileCachesMock,
    compilerInvalidateFileCacheMock: innerCompilerInvalidateFileCacheMock,
    existsMock: innerExistsMock,
    readFileMock: innerReadFileMock,
    statMock: innerStatMock,
    mockFindJsonEntry: innerFindJsonEntry,
    mockFindTemplateEntry: innerFindTemplateEntry,
    mockFindVueEntry: innerFindVueEntry,
    mockFindJsEntry: innerFindJsEntry,
    mockExtractConfigFromVue: innerExtractConfigFromVue,
    mockResolvePageLayoutPlan: innerResolvePageLayoutPlan,
    mockApplyPageLayoutPlanToNativePage: innerApplyPageLayoutPlanToNativePage,
    mockInjectNativePageLayoutRuntime: innerInjectNativePageLayoutRuntime,
    mockCollectNativeLayoutAssets: innerCollectNativeLayoutAssets,
    mockCompileVueFile: innerCompileVueFile,
  }
})

vi.mock('magic-string', () => {
  return {
    __esModule: true,
    default: MagicStringMock,
  }
})

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      exists: existsMock,
      pathExists: existsMock,
      readFile: readFileMock,
      stat: statMock,
    },
  }
})

vi.mock('node:fs/promises', () => {
  return {
    __esModule: true,
    default: {
      readFile: readFileMock,
      stat: statMock,
    },
    readFile: readFileMock,
    stat: statMock,
  }
})

vi.mock('../../../logger', () => {
  return {
    __esModule: true,
    default: {
      warn: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

vi.mock('../../../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils')>()
  const changeFileExtension = (filePath: string, extension: string) => {
    if (typeof filePath !== 'string') {
      throw new TypeError('filePath 必须是字符串')
    }
    if (filePath === '') {
      return ''
    }
    const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`
    const basename = path.basename(filePath, path.extname(filePath))
    return path.join(path.dirname(filePath), `${basename}${normalizedExt}`)
  }

  return {
    __esModule: true,
    ...actual,
    changeFileExtension,
    findJsonEntry: mockFindJsonEntry,
    findTemplateEntry: mockFindTemplateEntry,
    findVueEntry: mockFindVueEntry,
    findJsEntry: mockFindJsEntry,
    extractConfigFromVue: mockExtractConfigFromVue,
  }
})

vi.mock('../../vue/transform/pageLayout', () => {
  return {
    __esModule: true,
    resolvePageLayoutPlan: mockResolvePageLayoutPlan,
    applyPageLayoutPlanToNativePage: mockApplyPageLayoutPlanToNativePage,
    injectNativePageLayoutRuntime: mockInjectNativePageLayoutRuntime,
    collectNativeLayoutAssets: mockCollectNativeLayoutAssets,
  }
})

vi.mock('wevu/compiler', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wevu/compiler')>()
  const { parse } = await import('vue/compiler-sfc')
  return {
    __esModule: true,
    ...actual,
    clearFileCaches: compilerClearFileCachesMock,
    compileVueFile: mockCompileVueFile,
    getSfcCheckMtime: vi.fn(() => false),
    invalidateFileCache: compilerInvalidateFileCacheMock,
    pathExists: existsMock,
    readAndParseSfc: vi.fn(async (filename: string) => {
      const source = await readFileMock(filename, 'utf-8')
      const parsed = parse(source, { filename })
      return {
        descriptor: parsed.descriptor,
        errors: parsed.errors,
      }
    }),
    readFile: readFileMock,
  }
})

function createPluginContext(): PluginContext {
  return {
    addWatchFile: vi.fn(),
    async resolve(id: string) {
      return {
        id,
      }
    },
    emitFile: vi.fn(),
  } as unknown as PluginContext
}

interface CreateLoaderOptions {
  plugin?: {
    absoluteRoot: string
    pluginJsonPath: string
  }
  buildTarget?: 'app' | 'plugin'
  isDev?: boolean
  pluginOnly?: boolean
  normalizeEntry?: (entry: string, jsonPath: string) => string
  withWxmlService?: boolean
}

function createLoader(options?: CreateLoaderOptions) {
  const jsonService = {
    read: vi.fn(),
  }
  const configService: any = {
    relativeCwd: vi.fn((id: string) => id),
    absoluteSrcRoot: '/project/src',
    options: { cwd: '/project' },
    weappViteConfig: {},
    isDev: options?.isDev,
    pluginOnly: options?.pluginOnly === true,
    relativeAbsoluteSrcRoot: vi.fn((id: string) => id.replace('/project/src/', '')),
    relativeOutputPath: vi.fn((id: string) => id.replace('/project/src/', '')),
    absolutePluginRoot: options?.plugin?.absoluteRoot,
  }

  const entriesMap = new Map<string, any>()
  const loadedEntrySet = new Set<string>()
  const dirtyEntrySet = new Set<string>()
  const resolvedEntryMap = new Map<string, any>()
  const replaceLayoutDependencies = vi.fn()

  const emitEntriesChunks = vi.fn((_resolvedIds: any[]) => {
    return _resolvedIds.map(async () => {})
  })

  const registerJsonAsset = vi.fn()
  const scanTemplateEntry = vi.fn()
  const applyAutoImports = vi.fn(() => [])
  const normalizeEntry = vi.fn(options?.normalizeEntry ?? ((entry: string) => entry))
  const runtimeState = createRuntimeState()
  const scanService: { pluginJsonPath?: string, pluginJson?: any } | undefined = options?.plugin
    ? {
        pluginJsonPath: options.plugin.pluginJsonPath,
      }
    : undefined
  const extendedLibManager = createExtendedLibManager()

  if (options?.plugin) {
    configService.relativeAbsoluteSrcRoot = vi.fn((id: string) => {
      if (id.startsWith(`${options.plugin!.absoluteRoot}/`)) {
        if (options.pluginOnly) {
          return id.replace(`${options.plugin!.absoluteRoot}/`, '')
        }
        return id.replace('/project/', '')
      }
      return id.replace('/project/src/', '')
    })
    configService.relativeOutputPath = vi.fn((id: string) => configService.relativeAbsoluteSrcRoot(id))
  }

  const compilerCtx = {
    jsonService,
    configService,
    scanService,
    runtimeState,
  } as any

  if (options?.withWxmlService) {
    createWxmlServicePlugin(compilerCtx)
  }

  const loader = createEntryLoader({
    ctx: compilerCtx,
    entriesMap,
    loadedEntrySet,
    dirtyEntrySet,
    resolvedEntryMap,
    replaceLayoutDependencies,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
    buildTarget: options?.buildTarget,
  })

  return {
    loader,
    jsonService,
    configService,
    entriesMap,
    loadedEntrySet,
    resolvedEntryMap,
    replaceLayoutDependencies,
    emitEntriesChunks,
    registerJsonAsset,
    scanTemplateEntry,
    applyAutoImports,
    normalizeEntry,
    scanService,
    extendedLibManager,
    runtimeState,
    wxmlService: compilerCtx.wxmlService,
  }
}

describe('createEntryLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof clearFileCaches === 'function') {
      clearFileCaches()
    }
    magicStringToStringMock.mockReturnValue('transformed')
    existsMock.mockResolvedValue(false)
    readFileMock.mockResolvedValue('console.log("noop")')
    mockFindJsonEntry.mockResolvedValue({
      path: undefined,
      predictions: [],
    })
    mockFindTemplateEntry.mockResolvedValue({
      path: undefined,
      predictions: [],
    })
    mockFindVueEntry.mockResolvedValue(undefined)
    mockFindJsEntry.mockResolvedValue({ path: undefined, predictions: [] })
    mockExtractConfigFromVue.mockResolvedValue(undefined)
    mockResolvePageLayoutPlan.mockResolvedValue(undefined)
    mockApplyPageLayoutPlanToNativePage.mockImplementation((result: any) => result)
    mockInjectNativePageLayoutRuntime.mockImplementation((script: string | undefined) => script)
    mockCollectNativeLayoutAssets.mockResolvedValue({
      json: undefined,
      template: undefined,
      style: undefined,
      script: undefined,
    })
    mockCompileVueFile.mockResolvedValue({
      script: undefined,
    })
  })

  it('skips MagicString when no style imports exist', async () => {
    const { loader } = createLoader()
    const pluginCtx = createPluginContext()

    const result = await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(result.code).toBe('console.log("noop")')
    expect(MagicStringMock).not.toHaveBeenCalled()
    expect(readFileMock).toHaveBeenCalledWith('/project/src/app.js', { checkMtime: undefined })
  })

  it('registers normalized app json from app entry', async () => {
    const { loader, registerJsonAsset } = createLoader()
    const pluginCtx = createPluginContext()

    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
      subpackages: [{ root: 'pages/goods', pages: ['details/index'] }],
    })

    await loader.call(pluginCtx, '/project/src/app.vue', 'app')

    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/app.vue',
      type: 'app',
      json: {
        pages: ['pages/home/home'],
        subPackages: [{ root: 'pages/goods', pages: ['details/index'] }],
      },
    })
  })

  it('registers app side json files without app config normalization', async () => {
    const { loader, jsonService, registerJsonAsset } = createLoader()
    const pluginCtx = createPluginContext()

    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
      sitemapLocation: 'sitemap.json',
      themeLocation: 'theme.json',
    })
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/sitemap.json') {
        return {
          path: '/project/src/sitemap.json',
          predictions: [],
        }
      }
      if (filepath === '/project/src/theme.json') {
        return {
          path: '/project/src/theme.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/sitemap.json') {
        return { rules: [{ action: 'allow', page: '*' }] }
      }
      if (filepath === '/project/src/theme.json') {
        return { light: {}, dark: {} }
      }
      return {}
    })

    await loader.call(pluginCtx, '/project/src/app.vue', 'app')

    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/sitemap.json',
      type: 'page',
      json: {
        rules: [{ action: 'allow', page: '*' }],
      },
    })
    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/theme.json',
      type: 'page',
      json: {
        light: {},
        dark: {},
      },
    })
  })

  it('resolves app side sitemap and theme json concurrently', async () => {
    const { loader, jsonService, registerJsonAsset } = createLoader()
    const pluginCtx = createPluginContext()
    const startedBeforeRelease: string[] = []
    let releaseSitemap: (() => void) | undefined
    let sitemapReleased = false

    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
      sitemapLocation: 'sitemap.json',
      themeLocation: 'theme.json',
    })
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (!sitemapReleased) {
        startedBeforeRelease.push(filepath)
      }
      if (filepath === '/project/src/sitemap.json') {
        await new Promise<void>((resolve) => {
          releaseSitemap = () => {
            sitemapReleased = true
            resolve()
          }
        })
        return {
          path: '/project/src/sitemap.json',
          predictions: [],
        }
      }
      if (filepath === '/project/src/theme.json') {
        return {
          path: '/project/src/theme.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/sitemap.json') {
        return { rules: [{ action: 'allow', page: '*' }] }
      }
      if (filepath === '/project/src/theme.json') {
        return { light: {}, dark: {} }
      }
      return {}
    })

    const pending = loader.call(pluginCtx, '/project/src/app.vue', 'app')

    await vi.waitFor(() => {
      expect(releaseSitemap).toBeDefined()
      expect(startedBeforeRelease.filter(filepath => filepath.endsWith('sitemap.json') || filepath.endsWith('theme.json'))).toEqual([
        '/project/src/sitemap.json',
        '/project/src/theme.json',
      ])
    })
    releaseSitemap?.()
    await pending

    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/sitemap.json',
      type: 'page',
      json: {
        rules: [{ action: 'allow', page: '*' }],
      },
    })
    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/theme.json',
      type: 'page',
      json: {
        light: {},
        dark: {},
      },
    })
  })

  it('prefers source app.miniapp.json over project.miniapp.json for runtime sidecar config', async () => {
    const { loader, jsonService, registerJsonAsset, configService } = createLoader()
    const pluginCtx = createPluginContext()

    configService.platform = 'weapp'
    configService.cwd = '/project'
    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
    })
    existsMock.mockImplementation(async (target: string) => {
      return target === '/project/src/app.miniapp.json'
        || target === '/project/project.miniapp.json'
    })
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.miniapp.json') {
        return {
          identityServiceConfig: {
            authorizeMiniprogramType: 1,
          },
        }
      }
      if (filepath === '/project/project.miniapp.json') {
        return {
          miniVersion: 'v2',
        }
      }
      return {}
    })

    await loader.call(pluginCtx, '/project/src/app.vue', 'app')

    expect(registerJsonAsset).toHaveBeenCalledWith({
      fileName: 'app.miniapp.json',
      jsonPath: '/project/src/app.miniapp.json',
      type: 'page',
      json: {
        identityServiceConfig: {
          authorizeMiniprogramType: 1,
        },
      },
    })
    expect(registerJsonAsset).not.toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPath: '/project/project.miniapp.json',
      }),
    )
  })

  it('checks runtime and project miniapp configs concurrently while keeping source priority', async () => {
    const { loader, jsonService, registerJsonAsset, configService } = createLoader()
    const pluginCtx = createPluginContext()
    const startedBeforeRelease: string[] = []
    let releaseRuntimeConfig: (() => void) | undefined
    let runtimeConfigReleased = false

    configService.platform = 'weapp'
    configService.cwd = '/project'
    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
    })
    existsMock.mockImplementation(async (target: string) => {
      if (!runtimeConfigReleased) {
        startedBeforeRelease.push(target)
      }
      if (target === '/project/src/app.miniapp.json') {
        await new Promise<void>((resolve) => {
          releaseRuntimeConfig = () => {
            runtimeConfigReleased = true
            resolve()
          }
        })
        return true
      }
      return target === '/project/project.miniapp.json'
    })
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.miniapp.json') {
        return {
          identityServiceConfig: {
            authorizeMiniprogramType: 1,
          },
        }
      }
      if (filepath === '/project/project.miniapp.json') {
        return {
          miniVersion: 'v2',
        }
      }
      return {}
    })

    const pending = loader.call(pluginCtx, '/project/src/app.vue', 'app')

    await vi.waitFor(() => {
      expect(releaseRuntimeConfig).toBeDefined()
      expect(startedBeforeRelease).toEqual(expect.arrayContaining([
        '/project/src/app.miniapp.json',
        '/project/project.miniapp.json',
      ]))
    })
    releaseRuntimeConfig?.()
    await pending

    expect(registerJsonAsset).toHaveBeenCalledWith({
      fileName: 'app.miniapp.json',
      jsonPath: '/project/src/app.miniapp.json',
      type: 'page',
      json: {
        identityServiceConfig: {
          authorizeMiniprogramType: 1,
        },
      },
    })
    expect(registerJsonAsset).not.toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPath: '/project/project.miniapp.json',
      }),
    )
  })

  it('falls back to project.miniapp.json when source runtime sidecar is missing', async () => {
    const { loader, jsonService, registerJsonAsset, configService } = createLoader()
    const pluginCtx = createPluginContext()

    configService.platform = 'weapp'
    configService.cwd = '/project'
    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
    })
    existsMock.mockImplementation(async (target: string) => {
      return target === '/project/project.miniapp.json'
    })
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/project.miniapp.json') {
        return {
          miniVersion: 'v2',
          name: '多端应用',
        }
      }
      return {}
    })

    await loader.call(pluginCtx, '/project/src/app.vue', 'app')

    expect(registerJsonAsset).toHaveBeenCalledWith({
      fileName: 'app.miniapp.json',
      jsonPath: '/project/project.miniapp.json',
      type: 'page',
      json: {
        miniVersion: 'v2',
        name: '多端应用',
      },
    })
  })

  it('prepends style imports once when sidecar styles exist', async () => {
    existsMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/app.wxss') {
        return true
      }
      return false
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/app.wxss') {
        return '@import "./shared/styles/shared.scss";\n.app{}'
      }
      return 'console.log("with styles")'
    })

    const { loader, runtimeState } = createLoader()
    const pluginCtx = createPluginContext()

    const result = await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(MagicStringMock).toHaveBeenCalledTimes(1)
    expect(magicStringPrependMock).toHaveBeenCalledWith('import \'/project/src/app.wxss\';\n')
    expect(runtimeState.css.dependencyToImporters.get('/project/src/shared/styles/shared.scss')).toEqual(new Set(['/project/src/app.wxss']))
    expect(result.code).toBe('transformed')
  })

  it('memoises filesystem lookups for repeated watch targets', async () => {
    const existsCalls = new Map<string, number>()
    existsMock.mockImplementation(async (target: string) => {
      existsCalls.set(target, (existsCalls.get(target) ?? 0) + 1)
      return target === '/project/src/app.json'
    })

    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.js') {
        return {
          path: '/project/src/app.json',
          predictions: ['/project/src/app.json', '/project/src/app.json'],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })
    readFileMock.mockResolvedValue('console.log("cache")')

    const { loader, jsonService } = createLoader()
    jsonService.read.mockResolvedValue({})

    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(existsCalls.get('/project/src/app.json')).toBeUndefined()
    const addWatchMock = pluginCtx.addWatchFile as unknown as Mock
    const watchedJson = addWatchMock.mock.calls.filter(call => normalizeWatchCall(call[0]) === '/project/src/app.json')
    expect(watchedJson).toHaveLength(1)
    expect(jsonService.read).toHaveBeenCalledTimes(1)
    expect(MagicStringMock).not.toHaveBeenCalled()
  })

  it('skips duplicate exists checks for resolved app side json predictions', async () => {
    const existsCalls = new Map<string, number>()
    existsMock.mockImplementation(async (target: string) => {
      existsCalls.set(target, (existsCalls.get(target) ?? 0) + 1)
      return false
    })

    mockExtractConfigFromVue.mockResolvedValue({
      pages: ['pages/home/home'],
      sitemapLocation: 'sitemap.json',
      themeLocation: 'theme.json',
    })
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/sitemap.json') {
        return {
          path: '/project/src/sitemap.json',
          predictions: ['/project/src/sitemap.json', '/project/src/sitemap.json.ts'],
        }
      }
      if (filepath === '/project/src/theme.json') {
        return {
          path: '/project/src/theme.json',
          predictions: ['/project/src/theme.json'],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService } = createLoader()
    jsonService.read.mockResolvedValue({})

    await loader.call(createPluginContext(), '/project/src/app.vue', 'app')

    expect(existsCalls.get('/project/src/sitemap.json')).toBeUndefined()
    expect(existsCalls.get('/project/src/theme.json')).toBeUndefined()
    expect(existsCalls.get('/project/src/sitemap.json.ts')).toBe(1)
  })

  it('reuses the resolved app vue entry instead of probing twice', async () => {
    const { loader, jsonService } = createLoader()
    const pluginCtx = createPluginContext()

    mockFindVueEntry.mockResolvedValue('/project/src/app.vue')
    jsonService.read.mockResolvedValue({
      pages: ['pages/home/home'],
    })

    await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(mockFindVueEntry).toHaveBeenCalledTimes(1)
    expect(mockFindVueEntry).toHaveBeenCalledWith('/project/src/app')
  })

  it('starts json and vue entry discovery concurrently while keeping json config priority', async () => {
    const { loader, jsonService } = createLoader()
    const pluginCtx = createPluginContext()
    const started: string[] = []
    let releaseJsonEntry!: () => void
    const jsonEntryBlocked = new Promise<void>((resolve) => {
      releaseJsonEntry = resolve
    })

    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      started.push(`json:${filepath}`)
      if (filepath === '/project/src/pages/home/index.ts') {
        await jsonEntryBlocked
        return {
          path: '/project/src/pages/home/index.json',
          predictions: ['/project/src/pages/home/index.json'],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })
    mockFindVueEntry.mockImplementation(async (filepath: string) => {
      started.push(`vue:${filepath}`)
      return '/project/src/pages/home/index.vue'
    })
    jsonService.read.mockResolvedValue({
      usingComponents: {
        card: '/components/card/index',
      },
    })

    const loading = loader.call(pluginCtx, '/project/src/pages/home/index.ts', 'page')
    await vi.waitFor(() => {
      expect(started).toEqual([
        'json:/project/src/pages/home/index.ts',
        'vue:/project/src/pages/home/index',
      ])
    })

    releaseJsonEntry()
    await loading

    expect(jsonService.read).toHaveBeenCalledWith('/project/src/pages/home/index.json')
    expect(mockExtractConfigFromVue).not.toHaveBeenCalled()
    expect(pluginCtx.addWatchFile).toHaveBeenCalledWith('/project/src/pages/home/index.vue')
  })

  it('reads resolved json while predicted watch targets are still being checked', async () => {
    const { loader, jsonService } = createLoader()
    const pluginCtx = createPluginContext()
    const events: string[] = []
    let releaseWatchCheck!: () => void
    const watchCheckBlocked = new Promise<void>((resolve) => {
      releaseWatchCheck = resolve
    })

    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home/index.json',
      predictions: [
        '/project/src/pages/home/index.json',
        '/project/src/pages/home/index.json.ts',
      ],
    })
    existsMock.mockImplementation(async (target: string) => {
      events.push(`exists:${target}`)
      if (target === '/project/src/pages/home/index.json.ts') {
        await watchCheckBlocked
      }
      return false
    })
    jsonService.read.mockImplementation(async (filepath: string) => {
      events.push(`read:${filepath}`)
      return {}
    })

    const loading = loader.call(pluginCtx, '/project/src/pages/home/index.ts', 'page')

    await vi.waitFor(() => {
      expect(events).toEqual([
        'exists:/project/src/pages/home/index.json.ts',
        'read:/project/src/pages/home/index.json',
      ])
    })

    releaseWatchCheck()
    await loading
  })

  it('reuses filesystem lookup cache across entries during build', async () => {
    const sharedPrediction = '/project/src/shared/index.json'
    const existsCalls = new Map<string, number>()
    existsMock.mockImplementation(async (target: string) => {
      existsCalls.set(target, (existsCalls.get(target) ?? 0) + 1)
      return false
    })
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath.endsWith('/a.js') || filepath.endsWith('/b.js')) {
        return {
          path: undefined,
          predictions: [sharedPrediction],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/a.js', 'page')
    await loader.call(pluginCtx, '/project/src/pages/b.js', 'page')

    expect(existsCalls.get(sharedPrediction)).toBe(1)
  })

  it('refreshes filesystem lookup cache per entry during dev', async () => {
    const sharedPrediction = '/project/src/shared/index.json'
    const existsCalls = new Map<string, number>()
    existsMock.mockImplementation(async (target: string) => {
      existsCalls.set(target, (existsCalls.get(target) ?? 0) + 1)
      return false
    })
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath.endsWith('/a.js') || filepath.endsWith('/b.js')) {
        return {
          path: undefined,
          predictions: [sharedPrediction],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader } = createLoader({ isDev: true })
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/a.js', 'page')
    await loader.call(pluginCtx, '/project/src/pages/b.js', 'page')

    expect(existsCalls.get(sharedPrediction)).toBe(2)
  })

  it('keeps observing style sidecars across add and delete cycles', async () => {
    const stylesheet = '/project/src/app.wxss'
    const script = '/project/src/app.ts'

    const mockFsState = { stylesheetExists: true }

    existsMock.mockImplementation(async (target: string) => {
      if (target === stylesheet) {
        return mockFsState.stylesheetExists
      }
      return false
    })

    readFileMock.mockResolvedValue('console.log("noop")')

    const { loader } = createLoader({ isDev: true })
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, script, 'app')
    expect(magicStringPrependMock).toHaveBeenCalledWith(`import '${stylesheet}';\n`)

    const addWatchFile = pluginCtx.addWatchFile as Mock
    const watched = addWatchFile.mock.calls.map(call => normalizeWatchCall(call[0]))
    expect(watched).toContain(stylesheet)

    const initialPrependCount = magicStringPrependMock.mock.calls.length

    mockFsState.stylesheetExists = false
    if (typeof invalidateFileCache === 'function') {
      invalidateFileCache(stylesheet)
    }
    await loader.call(pluginCtx, script, 'app')
    expect(magicStringPrependMock.mock.calls.length).toBe(initialPrependCount)

    mockFsState.stylesheetExists = true
    if (typeof invalidateFileCache === 'function') {
      invalidateFileCache(stylesheet)
    }
    await loader.call(pluginCtx, script, 'app')
    expect(magicStringPrependMock.mock.calls.length).toBe(initialPrependCount + 1)
    expect(magicStringPrependMock).toHaveBeenLastCalledWith(`import '${stylesheet}';\n`)
  })

  it('adds watch targets for resolved component entries', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home.json',
      predictions: [],
    })
    const { loader, jsonService } = createLoader()
    jsonService.read.mockResolvedValue({
      usingComponents: {
        hello: 'components/hello/index.vue',
      },
    })

    const pluginCtx = createPluginContext()
    await loader.call(pluginCtx, pageScript, 'page')

    const addWatchFile = pluginCtx.addWatchFile as Mock
    const watched = addWatchFile.mock.calls.map(call => normalizeWatchCall(call[0]))
    expect(watched).toContain('/project/src/components/hello/index.vue')
  })

  it('merges pending auto-import entries for the current importer once', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home.json',
      predictions: [],
    })

    const { loader, jsonService, emitEntriesChunks, runtimeState } = createLoader({
      normalizeEntry: entry => entry.replace(/^\//, ''),
    })

    runtimeState.autoImport.pendingEntriesByImporter.set(
      '/project/src/pages/home',
      new Set(['/components/HotCard/index']),
    )
    jsonService.read.mockResolvedValue({
      usingComponents: {
        hello: 'components/hello/index.vue',
      },
    })

    await loader.call(createPluginContext(), pageScript, 'page')

    const emittedResolvedIds = emitEntriesChunks.mock.calls.flatMap(
      ([resolvedIds]) => resolvedIds.map((resolvedId: any) => resolvedId?.id),
    )

    expect(emittedResolvedIds).toContain('/project/src/components/HotCard/index')
    expect(runtimeState.autoImport.pendingEntriesByImporter.has('/project/src/pages/home')).toBe(false)
  })

  it('dedupes normalized component entries before chunk emission', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home.json',
      predictions: [],
    })

    const { loader, jsonService, emitEntriesChunks, runtimeState } = createLoader({
      normalizeEntry: entry => entry.replace(/^\//, ''),
    })

    runtimeState.autoImport.pendingEntriesByImporter.set(
      '/project/src/pages/home',
      new Set(['/components/HotCard/index']),
    )
    jsonService.read.mockResolvedValue({
      usingComponents: {
        hot: '/components/HotCard/index',
      },
    })

    await loader.call(createPluginContext(), pageScript, 'page')

    const emittedResolvedIds = emitEntriesChunks.mock.calls.flatMap(
      ([resolvedIds]) => resolvedIds.map((resolvedId: any) => resolvedId?.id),
    )

    expect(emittedResolvedIds.filter(id => id === '/project/src/components/HotCard/index')).toHaveLength(1)
  })

  it('force emits auto-import entries injected during the current load', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home.json',
      predictions: [],
    })

    const { loader, jsonService, emitEntriesChunks, loadedEntrySet, applyAutoImports } = createLoader({
      normalizeEntry: entry => entry.replace(/^\//, ''),
    })

    jsonService.read.mockResolvedValue({})
    applyAutoImports.mockImplementation((_baseName, json) => {
      json.usingComponents = {
        HotCard: '/components/HotCard/index',
      }
      return ['/components/HotCard/index']
    })
    loadedEntrySet.add('/project/src/components/HotCard/index')

    await loader.call(createPluginContext(), pageScript, 'page')

    const emittedResolvedIds = emitEntriesChunks.mock.calls.flatMap(
      ([resolvedIds]) => resolvedIds.map((resolvedId: any) => resolvedId?.id),
    )

    expect(emittedResolvedIds).toContain('/project/src/components/HotCard/index')
  })

  it('force emits auto-import entries through resolvedId mappings for newly registered Vue SFCs', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home.json',
      predictions: [],
    })

    const { loader, jsonService, emitEntriesChunks, applyAutoImports, runtimeState } = createLoader({
      normalizeEntry: entry => entry.replace(/^\//, ''),
    })

    jsonService.read.mockResolvedValue({})
    applyAutoImports.mockImplementation((_baseName, json) => {
      json.usingComponents = {
        HotCard: '/components/HotCard/index',
      }
      runtimeState.build.hmr.externalComponentEntryMap.set(
        'components/HotCard/index',
        '/project/src/components/HotCard/index.vue',
      )
      return ['/components/HotCard/index']
    })

    await loader.call(createPluginContext(), pageScript, 'page')

    const emittedResolvedIds = emitEntriesChunks.mock.calls.flatMap(
      ([resolvedIds]) => resolvedIds.map((resolvedId: any) => resolvedId?.id),
    )

    expect(emittedResolvedIds).toContain('/project/src/components/HotCard/index.vue')
  })

  it('reloads pending auto-import entries so generated template assets refresh', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/home.json',
      predictions: [],
    })

    const { loader, jsonService, emitEntriesChunks, loadedEntrySet, runtimeState } = createLoader({
      normalizeEntry: entry => entry.replace(/^\//, ''),
    })

    runtimeState.autoImport.pendingEntriesByImporter.set(
      '/project/src/pages/home',
      new Set(['/components/HotCard/index']),
    )
    jsonService.read.mockResolvedValue({
      usingComponents: {
        HotCard: '/components/HotCard/index',
      },
    })
    loadedEntrySet.add('/project/src/components/HotCard/index')

    await loader.call(createPluginContext(), pageScript, 'page')

    const hotCardEmitCall = emitEntriesChunks.mock.calls.find(([resolvedIds]) => {
      return resolvedIds.some((resolvedId: any) => resolvedId?.id === '/project/src/components/HotCard/index')
    })
    expect(hotCardEmitCall).toBeTruthy()
    expect(loadedEntrySet.has('/project/src/components/HotCard/index')).toBe(false)
  })

  it('marks custom tab bar and app bar app entries as components', async () => {
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/app.json',
      predictions: [],
    })

    const { loader, entriesMap, jsonService } = createLoader()
    jsonService.read.mockResolvedValue({
      tabBar: {
        custom: true,
        list: [
          {
            pagePath: 'pages/home/index',
            text: 'home',
          },
        ],
      },
      appBar: {
        iconPath: 'assets/appbar.png',
      },
      pages: [
        'pages/home/index',
      ],
    })

    const pluginCtx = createPluginContext()
    await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(entriesMap.get('custom-tab-bar/index')?.type).toBe('component')
    expect(entriesMap.get('app-bar/index')?.type).toBe('component')
    expect(entriesMap.get('pages/home/index')?.type).toBe('page')
  })

  it('marks usingComponents entries as components so native component loaders skip page layout injection', async () => {
    const pageScript = '/project/src/pages/home.js'
    const componentScript = '/project/src/components/HelloWorld/HelloWorld.js'
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === pageScript) {
        return {
          path: '/project/src/pages/home.json',
          predictions: [],
        }
      }
      if (filepath === componentScript) {
        return {
          path: '/project/src/components/HelloWorld/HelloWorld.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })
    mockFindTemplateEntry.mockImplementation(async (filepath: string) => {
      if (filepath === componentScript) {
        return {
          path: '/project/src/components/HelloWorld/HelloWorld.wxml',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, entriesMap, jsonService } = createLoader()
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/pages/home.json') {
        return {
          usingComponents: {
            HelloWorld: '/components/HelloWorld/HelloWorld',
          },
        }
      }
      if (filepath === '/project/src/components/HelloWorld/HelloWorld.json') {
        return {
          component: true,
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()
    await loader.call(pluginCtx, pageScript, 'page')

    expect(entriesMap.get('/components/HelloWorld/HelloWorld')?.type).toBe('component')

    await loader.call(pluginCtx, componentScript, 'component')

    expect(mockResolvePageLayoutPlan).not.toHaveBeenCalledWith(
      expect.anything(),
      componentScript,
      expect.anything(),
    )
    expect(mockApplyPageLayoutPlanToNativePage).not.toHaveBeenCalled()
    expect(mockInjectNativePageLayoutRuntime).not.toHaveBeenCalledWith(
      expect.anything(),
      componentScript,
      expect.anything(),
    )
  })

  it('skips warnings for weui components when useExtendedLib is enabled', async () => {
    const appScript = '/project/src/app.js'
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === appScript) {
        return {
          path: '/project/src/app.json',
          predictions: [],
        }
      }
      if (filepath === pageScript) {
        return {
          path: '/project/src/pages/home.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService } = createLoader()
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.json') {
        return {
          useExtendedLib: {
            weui: true,
          },
        }
      }
      if (filepath === '/project/src/pages/home.json') {
        return {
          usingComponents: {
            'mp-badge': 'weui-miniprogram/badge/badge',
            'mp-gallery': 'weui-miniprogram/gallery/gallery',
          },
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()
    const resolveSpy = vi.spyOn(pluginCtx, 'resolve')

    await loader.call(pluginCtx, appScript, 'app')
    await loader.call(pluginCtx, pageScript, 'page')

    expect(logger.warn).not.toHaveBeenCalled()
    expect(resolveSpy).not.toHaveBeenCalledWith(expect.stringContaining('weui-miniprogram'))
  })

  it('ignores plugin entries during app build', async () => {
    const pluginJsonPath = '/project/plugin/plugin.json'
    const pluginRoot = '/project/plugin'
    const {
      loader,
      jsonService,
      emitEntriesChunks,
      registerJsonAsset,
      scanService,
    } = createLoader({
      plugin: {
        absoluteRoot: pluginRoot,
        pluginJsonPath,
      },
      buildTarget: 'app',
    })

    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === pluginJsonPath) {
        return {
          main: 'plugin/index',
          pages: {
            guide: 'pages/guide/index',
          },
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(jsonService.read).not.toHaveBeenCalledWith(pluginJsonPath)
    expect(scanService?.pluginJson).toBeUndefined()
    expect(emitEntriesChunks).not.toHaveBeenCalled()
    expect(registerJsonAsset.mock.calls.find(([entry]) => entry.type === 'plugin')).toBeUndefined()
  })

  it('emits plugin entries discovered via plugin.json during plugin build', async () => {
    const pluginJsonPath = '/project/plugin/plugin.json'
    const pluginRoot = '/project/plugin'
    const {
      loader,
      jsonService,
      emitEntriesChunks,
      registerJsonAsset,
      scanService,
    } = createLoader({
      plugin: {
        absoluteRoot: pluginRoot,
        pluginJsonPath,
      },
      buildTarget: 'plugin',
    })

    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === pluginJsonPath) {
        return {
          main: 'plugin/index',
          pages: {
            guide: 'pages/guide/index',
          },
          publicComponents: {
            card: 'components/card/index',
          },
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()
    const resolveSpy = vi.spyOn(pluginCtx, 'resolve')

    await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(jsonService.read).toHaveBeenCalledWith(pluginJsonPath)
    expect(scanService?.pluginJson).toEqual({
      main: 'plugin/index',
      pages: {
        guide: 'pages/guide/index',
      },
      publicComponents: {
        card: 'components/card/index',
      },
    })

    const emittedIdPaths = emitEntriesChunks.mock.calls.flatMap((call) => {
      const [records] = call
      return (records ?? []).map((record: { id: string }) => record.id)
    })
    const expectedPaths = [
      `${pluginRoot}/plugin/index`,
      `${pluginRoot}/pages/guide/index`,
      `${pluginRoot}/components/card/index`,
    ]
    expect(emittedIdPaths.slice().sort()).toEqual(expectedPaths.slice().sort())

    expect(resolveSpy).toHaveBeenCalledWith(`${pluginRoot}/plugin/index`)
    expect(resolveSpy).toHaveBeenCalledWith(`${pluginRoot}/pages/guide/index`)
    expect(resolveSpy).toHaveBeenCalledWith(`${pluginRoot}/components/card/index`)

    const pluginJsonRegistration = registerJsonAsset.mock.calls.find(([entry]) => entry.type === 'plugin')
    expect(pluginJsonRegistration?.[0].jsonPath).toBe(pluginJsonPath)
  })

  it('skips preloading plugin main when current root entry already is plugin main', async () => {
    const pluginJsonPath = '/project/plugin/plugin.json'
    const pluginRoot = '/project/plugin'
    const {
      loader,
      jsonService,
      emitEntriesChunks,
    } = createLoader({
      plugin: {
        absoluteRoot: pluginRoot,
        pluginJsonPath,
      },
      buildTarget: 'plugin',
      pluginOnly: true,
    })

    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === pluginJsonPath) {
        return {
          main: 'index.js',
          pages: {
            guide: 'pages/guide/index',
          },
          publicComponents: {
            card: 'components/card/index',
          },
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/plugin/index.ts', 'app')

    const emittedIdPaths = emitEntriesChunks.mock.calls.flatMap((call) => {
      const [records] = call
      return (records ?? []).map((record: { id: string }) => record.id)
    })

    expect(emittedIdPaths).not.toContain(`${pluginRoot}/index.js`)
    expect(emittedIdPaths.slice().sort()).toEqual([
      `${pluginRoot}/components/card/index`,
      `${pluginRoot}/pages/guide/index`,
    ])
  })

  it('registers plugin page and component json assets during plugin build', async () => {
    const pluginRoot = '/project/plugin'
    const pageScript = `${pluginRoot}/pages/guide/index.js`
    const componentScript = `${pluginRoot}/components/card/index.js`

    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === pageScript) {
        return {
          path: `${pluginRoot}/pages/guide/index.json`,
          predictions: [],
        }
      }
      if (filepath === componentScript) {
        return {
          path: `${pluginRoot}/components/card/index.json`,
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService, registerJsonAsset } = createLoader({
      plugin: {
        absoluteRoot: pluginRoot,
        pluginJsonPath: `${pluginRoot}/plugin.json`,
      },
      buildTarget: 'plugin',
    })

    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === `${pluginRoot}/pages/guide/index.json`) {
        return {
          navigationBarTitleText: 'Guide',
        }
      }
      if (filepath === `${pluginRoot}/components/card/index.json`) {
        return {
          component: true,
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, pageScript, 'page')
    await loader.call(pluginCtx, componentScript, 'component')

    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: `${pluginRoot}/pages/guide/index.json`,
      json: {
        navigationBarTitleText: 'Guide',
      },
      type: 'page',
    })
    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: `${pluginRoot}/components/card/index.json`,
      json: {
        component: true,
      },
      type: 'component',
    })
  })

  it('resolves plugin-local usingComponents from plugin root during plugin build', async () => {
    const pluginRoot = '/project/plugin'
    const pageScript = `${pluginRoot}/pages/guide/index.js`

    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === pageScript) {
        return {
          path: `${pluginRoot}/pages/guide/index.json`,
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService, emitEntriesChunks } = createLoader({
      plugin: {
        absoluteRoot: pluginRoot,
        pluginJsonPath: `${pluginRoot}/plugin.json`,
      },
      buildTarget: 'plugin',
      normalizeEntry: (entry: string) => entry.replace(/^\//, ''),
    })

    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === `${pluginRoot}/pages/guide/index.json`) {
        return {
          usingComponents: {
            'demo-card': '/components/card/index',
          },
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, pageScript, 'page')

    const emittedIdPaths = emitEntriesChunks.mock.calls.flatMap((call) => {
      const [records] = call
      return (records ?? []).map((record: { id: string }) => record.id)
    })

    expect(emittedIdPaths).toContain(`${pluginRoot}/components/card/index`)
    expect(logger.warn).not.toHaveBeenCalledWith('没有找到 `components/card/index` 的入口文件，请检查路径是否正确!')
  })

  it('suppresses transient missing-entry warnings during dev hmr when the target file is already deleted', async () => {
    const pageScript = '/project/src/pages/home.js'
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === pageScript) {
        return {
          path: '/project/src/pages/home.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService, configService, emitEntriesChunks } = createLoader()
    configService.isDev = true
    jsonService.read.mockResolvedValue({
      usingComponents: {
        MissingCard: '/components/missing/index',
      },
    })

    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (id: string) => {
      if (id === '/project/src/components/missing/index') {
        return null
      }
      return { id } as any
    })

    await loader.call(pluginCtx, pageScript, 'page')

    expect(logger.warn).not.toHaveBeenCalledWith('没有找到 `/components/missing/index` 的入口文件，请检查路径是否正确!')
    expect(emitEntriesChunks).not.toHaveBeenCalledWith([
      expect.objectContaining({ id: '/project/src/components/missing/index' }),
    ])
  })

  it('skips deleted current vue entries during dev hmr instead of throwing build errors', async () => {
    const pageScript = '/project/src/pages/logs/hmr-added.vue'
    mockFindJsonEntry.mockResolvedValue({
      path: undefined,
      predictions: [],
    })
    mockFindVueEntry.mockResolvedValue(pageScript)
    readFileMock.mockImplementation(async (target: string) => {
      if (target === pageScript) {
        const error = new Error('transient missing page entry') as Error & { code: string }
        error.code = 'ENOENT'
        throw error
      }
      return 'console.log("noop")'
    })
    existsMock.mockImplementation(async (target: string) => {
      return target !== pageScript
    })

    const { loader, configService } = createLoader()
    configService.isDev = true
    const pluginCtx = createPluginContext()

    await expect(loader.call(pluginCtx, pageScript, 'page')).resolves.toBeUndefined()
  })

  it('caches resolved entry ids across invocations', async () => {
    const appScript = '/project/src/app.js'
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === appScript) {
        return {
          path: '/project/src/app.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService } = createLoader()
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.json') {
        return {
          pages: ['pages/a/index', 'pages/b/index'],
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (id: string) => ({ id } as any))

    await (loader as any).call(pluginCtx, appScript, 'app')
    const firstResolveCalls = (pluginCtx.resolve as unknown as Mock).mock.calls.length

    await (loader as any).call(pluginCtx, appScript, 'app')
    expect((pluginCtx.resolve as unknown as Mock).mock.calls.length).toBe(firstResolveCalls)

    ;(loader as any).invalidateResolveCache?.()
    await (loader as any).call(pluginCtx, appScript, 'app')
    expect((pluginCtx.resolve as unknown as Mock).mock.calls.length).toBeGreaterThan(firstResolveCalls)
  })

  it('short-circuits app entry resolution on cached app json', async () => {
    const appScript = '/project/src/app.js'
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === appScript) {
        return {
          path: '/project/src/app.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService, configService, normalizeEntry, emitEntriesChunks } = createLoader()
    configService.isDev = true
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.json') {
        return {
          pages: ['pages/a/index', 'pages/b/index'],
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (id: string) => ({ id } as any))

    await (loader as any).call(pluginCtx, appScript, 'app')
    const normalizeCalls = (normalizeEntry as unknown as Mock).mock.calls.length
    const emitCalls = (emitEntriesChunks as unknown as Mock).mock.calls.length

    await (loader as any).call(pluginCtx, appScript, 'app')
    expect((normalizeEntry as unknown as Mock).mock.calls.length).toBe(normalizeCalls)
    expect((emitEntriesChunks as unknown as Mock).mock.calls.length).toBe(emitCalls)
  })

  it('does not short-circuit cached app output when the app entry is dirty', async () => {
    const appScript = '/project/src/app.js'
    mockFindJsonEntry.mockImplementation(async (filepath: string) => {
      if (filepath === appScript) {
        return {
          path: '/project/src/app.json',
          predictions: [],
        }
      }
      return {
        path: undefined,
        predictions: [],
      }
    })

    const { loader, jsonService, configService, runtimeState } = createLoader()
    configService.isDev = true
    jsonService.read.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/app.json') {
        return {
          pages: ['pages/a/index'],
        }
      }
      return {}
    })

    const pluginCtx = createPluginContext()
    await (loader as any).call(pluginCtx, appScript, 'app')
    const readCalls = readFileMock.mock.calls.length

    runtimeState.build.hmr.dirtyEntrySet.add(appScript)
    await (loader as any).call(pluginCtx, appScript, 'app')

    expect(readFileMock.mock.calls.length).toBeGreaterThan(readCalls)
  })

  it('augments json usingComponents from <script setup> imports used in template', async () => {
    mockFindVueEntry.mockResolvedValue('/project/src/pages/auto/index.vue')
    mockExtractConfigFromVue.mockResolvedValue({
      navigationBarTitleText: 'Auto',
    })

    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/auto/index.vue') {
        return `
<template>
  <FooBar />
</template>
<script setup lang="ts">
import FooBar from '../../components/foo-bar/index.vue'
</script>
        `.trim()
      }
      return 'console.log("noop")'
    })

    const { loader, registerJsonAsset } = createLoader()
    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (source: string, importer?: string) => {
      if (!importer) {
        return { id: source } as any
      }
      if (source.startsWith('.')) {
        return { id: path.resolve(path.dirname(importer), source) } as any
      }
      return { id: source } as any
    })

    await loader.call(pluginCtx, '/project/src/pages/auto/index.js', 'page')

    expect(registerJsonAsset).toHaveBeenCalled()
    const payload = registerJsonAsset.mock.calls[0][0]
    expect(payload.jsonPath).toBe('/project/src/pages/auto/index.json')
    expect(payload.json).toEqual({
      navigationBarTitleText: 'Auto',
      usingComponents: {
        FooBar: '/components/foo-bar/index',
      },
    })
  })

  it('tracks external <script setup> component output mapping for compile flow', async () => {
    const pageScript = '/project/src/pages/external/index.js'
    const vueEntryPath = '/project/src/pages/external/index.vue'
    const externalComponent = '/workspace/packages/ui/card/index.vue'

    mockFindVueEntry.mockResolvedValue(vueEntryPath)
    mockExtractConfigFromVue.mockResolvedValue({
      navigationBarTitleText: 'External',
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === vueEntryPath) {
        return `
<template>
  <UiCard />
</template>
<script setup lang="ts">
import UiCard from '@workspace/ui/card'
</script>
        `.trim()
      }
      return 'console.log("noop")'
    })

    const { loader, registerJsonAsset, runtimeState, configService, emitEntriesChunks } = createLoader()
    configService.relativeOutputPath = vi.fn((id: string) => {
      if (id.startsWith('/workspace/packages/ui/card')) {
        return '__weapp_vite_external__/card/index'
      }
      return id.replace('/project/src/', '')
    })
    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (source: string, importer?: string) => {
      if (source === '@workspace/ui/card') {
        return { id: externalComponent } as any
      }
      if (!importer) {
        return { id: source } as any
      }
      if (source.startsWith('.')) {
        return { id: path.resolve(path.dirname(importer), source) } as any
      }
      return { id: source } as any
    })
    existsMock.mockImplementation(async (target: string) => {
      return target === externalComponent
    })

    await loader.call(pluginCtx, pageScript, 'page')

    expect(registerJsonAsset).toHaveBeenCalled()
    const payload = registerJsonAsset.mock.calls[0][0]
    expect(payload.json.usingComponents.UiCard).toBe('/__weapp_vite_external__/card/index')
    expect(runtimeState.build.hmr.externalComponentEntryMap.get('__weapp_vite_external__/card/index')).toBe(externalComponent)
    const emittedResolvedIds = emitEntriesChunks.mock.calls.flatMap(
      ([resolvedIds]) => resolvedIds.map((resolvedId: any) => resolvedId?.id),
    )
    expect(emittedResolvedIds).toContain(externalComponent)
  })

  it('suppresses transient ENOENT warnings while deleted vue entries are being removed during dev hmr', async () => {
    const pageScript = '/project/src/pages/auto-delete/index.js'
    const vueEntryPath = '/project/src/pages/auto-delete/index.vue'
    mockFindVueEntry.mockResolvedValue(vueEntryPath)
    mockExtractConfigFromVue.mockResolvedValue({
      navigationBarTitleText: 'AutoDelete',
    })

    const enoent = new Error('transient missing vue entry during delete') as Error & { code: string }
    enoent.code = 'ENOENT'
    readFileMock.mockImplementation(async (target: string) => {
      if (target === vueEntryPath) {
        throw enoent
      }
      return 'console.log("noop")'
    })
    existsMock.mockImplementation(async (target: string) => {
      return target !== vueEntryPath
    })

    const { loader, configService, registerJsonAsset } = createLoader()
    configService.isDev = true
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, pageScript, 'page')

    expect(registerJsonAsset).toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(`[自动 usingComponents] 解析失败：${vueEntryPath}`),
    )
  })

  it('augments json usingComponents from <script setup> imports that use the default @ alias', async () => {
    mockFindVueEntry.mockResolvedValue('/project/src/pages/auto-alias/index.vue')
    mockExtractConfigFromVue.mockResolvedValue({
      navigationBarTitleText: 'AutoAlias',
    })

    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/auto-alias/index.vue') {
        return `
<template>
  <HelloWorld />
</template>
<script setup lang="ts">
import HelloWorld from '@/components/HelloWorld/index.vue'
</script>
        `.trim()
      }
      return 'console.log("noop")'
    })

    const { loader, registerJsonAsset } = createLoader()
    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (source: string, importer?: string) => {
      if (source === '@/components/HelloWorld/index.vue') {
        return { id: '/project/src/components/HelloWorld/index.vue' } as any
      }
      if (!importer) {
        return { id: source } as any
      }
      if (source.startsWith('.')) {
        return { id: path.resolve(path.dirname(importer), source) } as any
      }
      return { id: source } as any
    })

    await loader.call(pluginCtx, '/project/src/pages/auto-alias/index.js', 'page')

    expect(registerJsonAsset).toHaveBeenCalled()
    const payload = registerJsonAsset.mock.calls[0][0]
    expect(payload.json).toEqual({
      navigationBarTitleText: 'AutoAlias',
      usingComponents: {
        HelloWorld: '/components/HelloWorld/index',
      },
    })
  })

  it('augments json usingComponents when importing from a barrel file', async () => {
    mockFindVueEntry.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/pages/auto-barrel/index') {
        return '/project/src/pages/auto-barrel/index.vue'
      }
      return undefined
    })
    mockExtractConfigFromVue.mockResolvedValue({
      navigationBarTitleText: 'AutoBarrel',
    })

    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/auto-barrel/index.vue') {
        return `
<template>
  <VueCard />
</template>
<script setup lang="ts">
import { VueCard } from '../../components'
</script>
        `.trim()
      }
      if (target === '/project/src/components/index.ts') {
        return `export { default as VueCard } from './vue-card/index.vue'\n`
      }
      return 'console.log("noop")'
    })

    // 组件目录 resolve：模拟 Vite 返回目录路径，再通过目录入口补全命中 index.ts
    statMock.mockImplementation(async (filepath: string) => {
      if (filepath === '/project/src/components') {
        return { isDirectory: () => true } as any
      }
      return { isDirectory: () => false } as any
    })
    existsMock.mockImplementation(async (filepath: string) => {
      return filepath === '/project/src/components/index.ts'
    })

    const { loader, registerJsonAsset } = createLoader()
    const pluginCtx = createPluginContext()
    pluginCtx.resolve = vi.fn(async (source: string, importer?: string) => {
      if (!importer) {
        return { id: source } as any
      }
      if (source === '../../components') {
        return { id: '/project/src/components' } as any
      }
      if (source.startsWith('.')) {
        return { id: path.resolve(path.dirname(importer), source) } as any
      }
      return { id: source } as any
    })

    await loader.call(pluginCtx, '/project/src/pages/auto-barrel/index.js', 'page')

    expect(registerJsonAsset).toHaveBeenCalled()
    const payload = registerJsonAsset.mock.calls[0][0]
    expect(payload.json).toEqual({
      navigationBarTitleText: 'AutoBarrel',
      usingComponents: {
        VueCard: '/components/vue-card/index',
      },
    })
  })

  it('emits native layout sidecar assets and bundles native layout scripts for native pages using layouts', async () => {
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.json',
      predictions: ['/project/src/pages/index/index.json'],
    })
    mockFindTemplateEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.wxml',
      predictions: ['/project/src/pages/index/index.wxml'],
    })
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'native',
        file: '/project/src/layouts/default/index',
        importPath: '/layouts/default/index',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'native',
          file: '/project/src/layouts/default/index',
          importPath: '/layouts/default/index',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    mockApplyPageLayoutPlanToNativePage.mockImplementation((result: any) => {
      const parsed = JSON.parse(result.config)
      return {
        ...result,
        config: JSON.stringify({
          ...parsed,
          usingComponents: {
            ...parsed.usingComponents,
            'weapp-layout-default': '/layouts/default/index',
          },
        }),
      }
    })
    mockCollectNativeLayoutAssets.mockResolvedValue({
      json: '/project/src/layouts/default/index.json',
      template: '/project/src/layouts/default/index.wxml',
      style: '/project/src/layouts/default/index.wxss',
      script: '/project/src/layouts/default/index.ts',
    })

    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index.ts') {
        return 'Page({})'
      }
      if (target === '/project/src/pages/index/index.wxml') {
        return '<view>home</view>'
      }
      if (target === '/project/src/layouts/default/index.json') {
        return '{"component":true}'
      }
      if (target === '/project/src/layouts/default/index.wxml') {
        return '<view><slot /></view>'
      }
      if (target === '/project/src/layouts/default/index.wxss') {
        return '.layout {}'
      }
      if (target === '/project/src/layouts/default/index.ts') {
        return 'Component({})'
      }
      return 'console.log("noop")'
    })

    const { loader, jsonService, registerJsonAsset, replaceLayoutDependencies } = createLoader()
    jsonService.read.mockResolvedValue({ navigationBarTitleText: 'Home' })
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')

    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/pages/index/index.json',
      json: {
        navigationBarTitleText: 'Home',
        usingComponents: {
          'weapp-layout-default': '/layouts/default/index',
        },
      },
      type: 'page',
    })
    expect(registerJsonAsset).toHaveBeenCalledWith({
      jsonPath: '/project/src/layouts/default/index.json',
      json: {
        component: true,
      },
      type: 'component',
    })
    expect(replaceLayoutDependencies).toHaveBeenNthCalledWith(1, '/project/src/pages/index/index.ts', [])
    expect(replaceLayoutDependencies).toHaveBeenNthCalledWith(
      2,
      '/project/src/pages/index/index.ts',
      new Set([
        '/project/src/layouts/default/index',
        '/project/src/layouts/default/index.json',
        '/project/src/layouts/default/index.wxml',
        '/project/src/layouts/default/index.wxss',
        '/project/src/layouts/default/index.ts',
      ]),
    )

    const emitFile = pluginCtx.emitFile as unknown as Mock
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default/index.wxml',
      source: '<view><slot /></view>',
    })
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default/index.wxss',
      source: '.layout {}',
    })
    expect(emitFile).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'asset',
      fileName: 'layouts/default/index.js',
    }))

    expect(emitFile).toHaveBeenCalledWith(expect.objectContaining({
      type: 'chunk',
      id: '/project/src/layouts/default/index.ts',
      fileName: 'layouts/default/index.js',
    }))
  })

  it('registers native layout shared template and wxs deps through the wxml pipeline', async () => {
    mockFindJsonEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.json',
      predictions: ['/project/src/pages/index/index.json'],
    })
    mockFindTemplateEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.wxml',
      predictions: ['/project/src/pages/index/index.wxml'],
    })
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'native',
        file: '/project/src/layouts/default/index',
        importPath: '/layouts/default/index',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'native',
          file: '/project/src/layouts/default/index',
          importPath: '/layouts/default/index',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    mockApplyPageLayoutPlanToNativePage.mockImplementation((result: any) => result)
    mockCollectNativeLayoutAssets.mockResolvedValue({
      json: undefined,
      template: '/project/src/layouts/default/index.wxml',
      style: undefined,
      script: undefined,
    })

    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index.ts') {
        return 'Page({})'
      }
      if (target === '/project/src/pages/index/index.wxml') {
        return '<view>home</view>'
      }
      if (target === '/project/src/layouts/default/index.wxml') {
        return [
          '<import src="../../shared/layout-card.wxml" />',
          '<wxs module="helper" src="../../shared/layout-helper.wxs" />',
          '<template is="demo" />',
          '',
        ].join('\n')
      }
      return 'console.log("noop")'
    })

    const { loader, jsonService, wxmlService } = createLoader({ withWxmlService: true })
    jsonService.read.mockResolvedValue({ navigationBarTitleText: 'Home' })
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')

    expect(wxmlService?.depsMap.get('/project/src/layouts/default/index.wxml')).toEqual(new Set([
      '/project/src/shared/layout-card.wxml',
      '/project/src/shared/layout-helper.wxs',
    ]))
    expect(wxmlService?.getImporters('/project/src/shared/layout-card.wxml')).toEqual(new Set([
      '/project/src/layouts/default/index.wxml',
    ]))
    expect(wxmlService?.getImporters('/project/src/shared/layout-helper.wxs')).toEqual(new Set([
      '/project/src/layouts/default/index.wxml',
    ]))

    const emitFile = pluginCtx.emitFile as unknown as Mock
    expect(magicStringUpdateMock).toHaveBeenCalled()
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default/index.wxml',
      source: 'transformed',
    })
  })

  it('includes vue layout components in page dependency entries', async () => {
    mockFindVueEntry.mockResolvedValue('/project/src/pages/index/index.vue')
    mockFindTemplateEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.wxml',
      predictions: ['/project/src/pages/index/index.wxml'],
    })
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'vue',
        file: '/project/src/layouts/default.vue',
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'vue',
          file: '/project/src/layouts/default.vue',
          importPath: '/layouts/default',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index.vue') {
        return '<template><view>home</view></template>'
      }
      return 'console.log("page-entry")'
    })

    const { loader, emitEntriesChunks, normalizeEntry } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')

    const addWatchFile = pluginCtx.addWatchFile as Mock
    const watched = addWatchFile.mock.calls.map(call => normalizeWatchCall(call[0]))
    expect(watched).toContain('/project/src/layouts/default.vue')
    expect(normalizeEntry).toHaveBeenCalledWith('/layouts/default', '/project/src/pages/index/index.json')
    expect(pluginCtx.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default.js',
      source: SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
    })

    const emittedResolvedIds = emitEntriesChunks.mock.calls[0]?.[0] ?? []
    expect(emittedResolvedIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/project/src/layouts/default',
        }),
      ]),
    )
  })

  it('includes vue layout components for native page entries', async () => {
    mockFindTemplateEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.wxml',
      predictions: ['/project/src/pages/index/index.wxml'],
    })
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'vue',
        file: '/project/src/layouts/default.vue',
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'vue',
          file: '/project/src/layouts/default.vue',
          importPath: '/layouts/default',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/layouts/default.vue') {
        return '<template><slot /></template>'
      }
      if (target === '/project/src/pages/index/index.wxml') {
        return '<view>home</view>'
      }
      return 'Page({})'
    })

    const { loader, emitEntriesChunks, normalizeEntry } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')

    const addWatchFile = pluginCtx.addWatchFile as Mock
    const watched = addWatchFile.mock.calls.map(call => normalizeWatchCall(call[0]))
    expect(watched).toContain('/project/src/layouts/default.vue')
    expect(normalizeEntry).toHaveBeenCalledWith('/layouts/default', '/project/src/pages/index/index.json')
    expect(pluginCtx.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: 'layouts/default.js',
      source: SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
    })

    const emittedResolvedIds = emitEntriesChunks.mock.calls[0]?.[0] ?? []
    expect(emittedResolvedIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/project/src/layouts/default',
        }),
      ]),
    )
  })

  it('bundles vue layout scripts with imports through chunk emission', async () => {
    mockFindVueEntry.mockResolvedValue('/project/src/pages/index/index.vue')
    mockFindTemplateEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.wxml',
      predictions: ['/project/src/pages/index/index.wxml'],
    })
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'vue',
        file: '/project/src/layouts/default.vue',
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'vue',
          file: '/project/src/layouts/default.vue',
          importPath: '/layouts/default',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index.vue') {
        return '<template><view>home</view></template>'
      }
      if (target === '/project/src/layouts/default.vue') {
        return '<script setup lang="ts">import { shared } from \"../shared/layout\"\nconst title: string = shared</script><template><slot /></template>'
      }
      return 'console.log("page-entry")'
    })
    mockCompileVueFile.mockResolvedValue({
      script: 'const title = shared',
    })

    const { loader, emitEntriesChunks } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')

    expect(pluginCtx.emitFile).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'asset',
      fileName: 'layouts/default.js',
      source: SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
    }))

    const emittedResolvedIds = emitEntriesChunks.mock.calls[0]?.[0] ?? []
    expect(emittedResolvedIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/project/src/layouts/default',
        }),
      ]),
    )
  })

  it('does not emit scriptless layout stub when vue layout declares runtime host bindings', async () => {
    mockFindVueEntry.mockResolvedValue('/project/src/pages/index/index.vue')
    mockFindTemplateEntry.mockResolvedValue({
      path: '/project/src/pages/index/index.wxml',
      predictions: ['/project/src/pages/index/index.wxml'],
    })
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'vue',
        file: '/project/src/layouts/default.vue',
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'vue',
          file: '/project/src/layouts/default.vue',
          importPath: '/layouts/default',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index.vue') {
        return '<template><view>home</view></template>'
      }
      if (target === '/project/src/layouts/default.vue') {
        return [
          '<script setup lang="ts">',
          'defineComponentJson({ component: true })',
          '</script>',
          '<template><view><t-toast layout-host="layout-toast" /></view></template>',
        ].join('\n')
      }
      return 'console.log("page-entry")'
    })

    const { loader, emitEntriesChunks } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')

    expect(pluginCtx.emitFile).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'asset',
      fileName: 'layouts/default.js',
      source: SLOT_HOST_SCRIPTLESS_COMPONENT_STUB,
    }))

    const emittedResolvedIds = emitEntriesChunks.mock.calls[0]?.[0] ?? []
    expect(emittedResolvedIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/project/src/layouts/default',
        }),
      ]),
    )
  })

  it('reuses scriptless vue layout decision across page entries', async () => {
    mockFindVueEntry.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index') {
        return '/project/src/pages/index/index.vue'
      }
      if (target === '/project/src/pages/detail/index') {
        return '/project/src/pages/detail/index.vue'
      }
      return undefined
    })
    mockFindTemplateEntry.mockImplementation(async (target: string) => ({
      path: `${target}.wxml`,
      predictions: [`${target}.wxml`],
    }))
    mockResolvePageLayoutPlan.mockResolvedValue({
      currentLayout: {
        kind: 'vue',
        file: '/project/src/layouts/default.vue',
        importPath: '/layouts/default',
        layoutName: 'default',
        tagName: 'weapp-layout-default',
      },
      layouts: [
        {
          kind: 'vue',
          file: '/project/src/layouts/default.vue',
          importPath: '/layouts/default',
          layoutName: 'default',
          tagName: 'weapp-layout-default',
        },
      ],
      dynamicSwitch: false,
      dynamicPropKeys: [],
    })
    readFileMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/pages/index/index.vue') {
        return '<template><view>index</view></template>'
      }
      if (target === '/project/src/pages/detail/index.vue') {
        return '<template><view>detail</view></template>'
      }
      if (target === '/project/src/layouts/default.vue') {
        return '<template><slot /></template>'
      }
      return 'console.log("page-entry")'
    })

    const { loader } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, '/project/src/pages/index/index.ts', 'page')
    await loader.call(pluginCtx, '/project/src/pages/detail/index.ts', 'page')

    const layoutReads = readFileMock.mock.calls.filter(call => call[0] === '/project/src/layouts/default.vue')
    expect(layoutReads).toHaveLength(1)
  })
})
