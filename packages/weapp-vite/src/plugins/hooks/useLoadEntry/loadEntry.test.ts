import type { PluginContext } from 'rolldown'
import type { Mock } from 'vitest'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
} = vi.hoisted(() => {
  const innerMagicStringPrepend = vi.fn()
  const innerMagicStringToString = vi.fn().mockReturnValue('transformed')
  const innerMagicString = vi.fn(() => {
    return {
      prepend: innerMagicStringPrepend,
      toString: innerMagicStringToString,
    }
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

  return {
    magicStringPrependMock: innerMagicStringPrepend,
    magicStringToStringMock: innerMagicStringToString,
    MagicStringMock: innerMagicString,
    existsMock: innerExistsMock,
    readFileMock: innerReadFileMock,
    statMock: innerStatMock,
    mockFindJsonEntry: innerFindJsonEntry,
    mockFindTemplateEntry: innerFindTemplateEntry,
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
      readFile: readFileMock,
      stat: statMock,
    },
    exists: existsMock,
    readFile: readFileMock,
    stat: statMock,
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

  if (options?.plugin) {
    configService.relativeAbsoluteSrcRoot = vi.fn((id: string) => {
      if (id.startsWith(`${options.plugin!.absoluteRoot}/`)) {
        return id.replace('/project/', '')
      }
      return id.replace('/project/src/', '')
    })
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
  }
}

describe('createEntryLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
