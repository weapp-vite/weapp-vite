import type { PluginContext } from 'rolldown'
import type { Mock } from 'vitest'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../../logger'
import { clearFileCaches, invalidateFileCache } from '../../utils/cache'
import { createExtendedLibManager } from './extendedLib'
import { createEntryLoader } from './loadEntry'

type MockedFinder = (filepath: string) => Promise<{ path?: string, predictions: string[] }>

const {
  magicStringPrependMock,
  magicStringToStringMock,
  MagicStringMock,
  existsMock,
  readFileMock,
  statMock,
  mockFindJsonEntry,
  mockFindTemplateEntry,
  mockFindVueEntry,
  mockFindJsEntry,
  mockExtractConfigFromVue,
} = vi.hoisted(() => {
  const innerMagicStringPrepend = vi.fn()
  const innerMagicStringToString = vi.fn().mockReturnValue('transformed')
  const innerMagicString = vi.fn(function MagicStringMockImpl(this: Record<string, any>) {
    this.prepend = innerMagicStringPrepend
    this.toString = innerMagicStringToString
  })

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

  return {
    magicStringPrependMock: innerMagicStringPrepend,
    magicStringToStringMock: innerMagicStringToString,
    MagicStringMock: innerMagicString,
    existsMock: innerExistsMock,
    readFileMock: innerReadFileMock,
    statMock: innerStatMock,
    mockFindJsonEntry: innerFindJsonEntry,
    mockFindTemplateEntry: innerFindTemplateEntry,
    mockFindVueEntry: innerFindVueEntry,
    mockFindJsEntry: innerFindJsEntry,
    mockExtractConfigFromVue: innerExtractConfigFromVue,
  }
})

vi.mock('magic-string', () => {
  return {
    __esModule: true,
    default: MagicStringMock,
  }
})

vi.mock('fs-extra', () => {
  return {
    __esModule: true,
    default: {
      exists: existsMock,
      pathExists: existsMock,
      readFile: readFileMock,
      stat: statMock,
    },
    exists: existsMock,
    pathExists: existsMock,
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

vi.mock('../../../utils', () => {
  const changeFileExtension = (filePath: string, extension: string) => {
    if (typeof filePath !== 'string') {
      throw new TypeError('filePath must be a string')
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
    changeFileExtension,
    findJsonEntry: mockFindJsonEntry,
    findTemplateEntry: mockFindTemplateEntry,
    findVueEntry: mockFindVueEntry,
    findJsEntry: mockFindJsEntry,
    extractConfigFromVue: mockExtractConfigFromVue,
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
    relativeAbsoluteSrcRoot: vi.fn((id: string) => id.replace('/project/src/', '')),
    relativeOutputPath: vi.fn((id: string) => id.replace('/project/src/', '')),
    absolutePluginRoot: options?.plugin?.absoluteRoot,
  }

  const entriesMap = new Map<string, any>()
  const loadedEntrySet = new Set<string>()

  const emitEntriesChunks = vi.fn((_resolvedIds: any[]) => {
    return _resolvedIds.map(async () => {})
  })

  const registerJsonAsset = vi.fn()
  const scanTemplateEntry = vi.fn()
  const applyAutoImports = vi.fn()
  const normalizeEntry = vi.fn((entry: string) => entry)
  const scanService: { pluginJsonPath?: string, pluginJson?: any } | undefined = options?.plugin
    ? {
        pluginJsonPath: options.plugin.pluginJsonPath,
      }
    : undefined
  const extendedLibManager = createExtendedLibManager()

  if (options?.plugin) {
    configService.relativeAbsoluteSrcRoot = vi.fn((id: string) => {
      if (id.startsWith(`${options.plugin!.absoluteRoot}/`)) {
        return id.replace('/project/', '')
      }
      return id.replace('/project/src/', '')
    })
    configService.relativeOutputPath = vi.fn((id: string) => configService.relativeAbsoluteSrcRoot(id))
  }

  const loader = createEntryLoader({
    ctx: {
      jsonService,
      configService,
      scanService,
    } as any,
    entriesMap,
    loadedEntrySet,
    normalizeEntry,
    registerJsonAsset,
    scanTemplateEntry,
    emitEntriesChunks,
    applyAutoImports,
    extendedLibManager,
  })

  return {
    loader,
    jsonService,
    configService,
    entriesMap,
    loadedEntrySet,
    emitEntriesChunks,
    registerJsonAsset,
    scanTemplateEntry,
    applyAutoImports,
    normalizeEntry,
    scanService,
    extendedLibManager,
  }
}

describe('createEntryLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearFileCaches()
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
  })

  it('skips MagicString when no style imports exist', async () => {
    const { loader } = createLoader()
    const pluginCtx = createPluginContext()

    const result = await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(result.code).toBe('console.log("noop")')
    expect(MagicStringMock).not.toHaveBeenCalled()
    expect(readFileMock).toHaveBeenCalledWith('/project/src/app.js', 'utf8')
  })

  it('prepends style imports once when sidecar styles exist', async () => {
    existsMock.mockImplementation(async (target: string) => {
      if (target === '/project/src/app.wxss') {
        return true
      }
      return false
    })
    readFileMock.mockResolvedValue('console.log("with styles")')

    const { loader } = createLoader()
    const pluginCtx = createPluginContext()

    const result = await loader.call(pluginCtx, '/project/src/app.js', 'app')

    expect(MagicStringMock).toHaveBeenCalledTimes(1)
    expect(magicStringPrependMock).toHaveBeenCalledWith('import \'/project/src/app.wxss\';\n')
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

    expect(existsCalls.get('/project/src/app.json')).toBe(1)
    const addWatchMock = pluginCtx.addWatchFile as unknown as Mock
    const watchedJson = addWatchMock.mock.calls.filter(call => call[0] === '/project/src/app.json')
    expect(watchedJson).toHaveLength(2)
    expect(jsonService.read).toHaveBeenCalledTimes(1)
    expect(MagicStringMock).not.toHaveBeenCalled()
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

    const { loader } = createLoader()
    const pluginCtx = createPluginContext()

    await loader.call(pluginCtx, script, 'app')
    expect(magicStringPrependMock).toHaveBeenCalledWith(`import '${stylesheet}';\n`)

    const addWatchFile = pluginCtx.addWatchFile as Mock
    expect(addWatchFile.mock.calls).toEqual(expect.arrayContaining([[stylesheet]]))

    const initialPrependCount = magicStringPrependMock.mock.calls.length

    mockFsState.stylesheetExists = false
    invalidateFileCache(stylesheet)
    await loader.call(pluginCtx, script, 'app')
    expect(magicStringPrependMock.mock.calls.length).toBe(initialPrependCount)

    mockFsState.stylesheetExists = true
    invalidateFileCache(stylesheet)
    await loader.call(pluginCtx, script, 'app')
    expect(magicStringPrependMock.mock.calls.length).toBe(initialPrependCount + 1)
    expect(magicStringPrependMock).toHaveBeenLastCalledWith(`import '${stylesheet}';\n`)
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

  it('emits plugin entries discovered via plugin.json', async () => {
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
})
