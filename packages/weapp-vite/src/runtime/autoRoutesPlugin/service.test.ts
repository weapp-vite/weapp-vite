import type { MutableCompilerContext } from '../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createAutoRoutesService } from './service'

const outputFileMock = vi.hoisted(() => vi.fn())
const outputJsonMock = vi.hoisted(() => vi.fn())
const pathExistsMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const readJsonMock = vi.hoisted(() => vi.fn())
const removeMock = vi.hoisted(() => vi.fn())
const statMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const loggerWarnMock = vi.hoisted(() => vi.fn())
const requireConfigServiceMock = vi.hoisted(() => vi.fn((ctx: MutableCompilerContext) => {
  if (!ctx.configService) {
    throw new Error('missing config service')
  }
  return ctx.configService
}))
const collectCandidatesMock = vi.hoisted(() => vi.fn(async () => new Map()))
const cloneCandidateMock = vi.hoisted(() => vi.fn((candidate: Record<string, any>) => ({ ...candidate })))
const createTypedRouterDefinitionMock = vi.hoisted(() => vi.fn(() => 'type TypedRouter = []'))
const scanRoutesMock = vi.hoisted(() => vi.fn(async () => ({
  snapshot: {
    pages: [],
    entries: [],
    subPackages: [],
  },
  serialized: JSON.stringify({
    pages: [],
    entries: [],
    subPackages: [],
  }, null, 2),
  moduleCode: 'export default []',
  typedDefinition: 'type TypedRouter = []',
  watchFiles: new Set<string>(),
  watchDirs: new Set<string>(),
})))
const updateRoutesReferenceMock = vi.hoisted(() => vi.fn((target: any, next: any) => {
  target.pages = [...next.pages]
  target.entries = [...next.entries]
  target.subPackages = [...next.subPackages]
}))
const cloneRoutesMock = vi.hoisted(() => vi.fn((routes: any) => ({
  pages: [...routes.pages],
  entries: [...routes.entries],
  subPackages: routes.subPackages.map((item: Record<string, any>) => ({ ...item })),
})))
const matchesRouteFileMock = vi.hoisted(() => vi.fn(() => true))
const updateCandidateFromFileMock = vi.hoisted(() => vi.fn(async () => true))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

vi.mock('@weapp-core/shared/fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@weapp-core/shared/fs')>()
  return {
    ...actual,
    fs: {
      ...actual.fs,
      outputFile: outputFileMock,
      outputJson: outputJsonMock,
      pathExists: pathExistsMock,
      readFile: readFileMock,
      readJson: readJsonMock,
      remove: removeMock,
      stat: statMock,
    },
  }
})

vi.mock('../../context/shared', () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
  },
}))

vi.mock('../utils/requireConfigService', () => ({
  requireConfigService: requireConfigServiceMock,
}))

vi.mock('./candidates', () => ({
  collectCandidates: collectCandidatesMock,
  cloneCandidate: cloneCandidateMock,
}))

vi.mock('./routes', () => ({
  createTypedRouterDefinition: createTypedRouterDefinitionMock,
  scanRoutes: scanRoutesMock,
  updateRoutesReference: updateRoutesReferenceMock,
  cloneRoutes: cloneRoutesMock,
}))

vi.mock('./watch', () => ({
  matchesRouteFile: matchesRouteFileMock,
  updateCandidateFromFile: updateCandidateFromFileMock,
}))

function createContext(options?: {
  autoRoutes?: boolean | Record<string, any>
  cwd?: string
  configFilePath?: string
  includeConfigService?: boolean
  weappViteConfig?: Record<string, any>
}) {
  const runtimeState = createRuntimeState()
  const {
    autoRoutes = true,
    cwd = '/project',
    configFilePath,
    includeConfigService = true,
    weappViteConfig,
  } = options ?? {}

  const ctx: MutableCompilerContext = {
    runtimeState,
  } as MutableCompilerContext

  if (includeConfigService) {
    ctx.configService = {
      absoluteSrcRoot: '/project/src',
      cwd,
      configFilePath,
      weappViteConfig: weappViteConfig ?? { autoRoutes },
    } as any
  }

  return ctx
}

describe('createAutoRoutesService branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathExistsMock.mockResolvedValue(false)
    readFileMock.mockResolvedValue(undefined)
    readJsonMock.mockResolvedValue(undefined)
    removeMock.mockResolvedValue(undefined)
    outputFileMock.mockResolvedValue(undefined)
    outputJsonMock.mockResolvedValue(undefined)
    statMock.mockResolvedValue({ mtimeMs: 1 })
  })

  it('resets state and skips remove path operations when config service is missing', async () => {
    const ctx = createContext({ includeConfigService: false })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(service.isEnabled()).toBe(false)
    expect(service.isInitialized()).toBe(true)
    expect(pathExistsMock).not.toHaveBeenCalled()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('writes typed definition into srcRoot by default', async () => {
    const ctx = createContext({ autoRoutes: true })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(scanRoutesMock).toHaveBeenCalledTimes(1)
    expect(outputFileMock).toHaveBeenCalledWith('/project/.weapp-vite/typed-router.d.ts', 'type TypedRouter = []', 'utf8')
  })

  it('does not rewrite typed definition when disk content is already current', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('typed-router.d.ts'))
    readFileMock.mockResolvedValue('type TypedRouter = []')
    const ctx = createContext({ autoRoutes: true })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(readFileMock).toHaveBeenCalledWith('/project/.weapp-vite/typed-router.d.ts', 'utf8')
    expect(outputFileMock).not.toHaveBeenCalled()
  })

  it('logs an error when writing typed router definition fails', async () => {
    outputFileMock.mockRejectedValueOnce(new Error('boom'))
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(outputFileMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('写入 .weapp-vite/typed-router.d.ts 失败: boom'))
  })

  it('removes typed definition file when auto routes is disabled', async () => {
    pathExistsMock.mockResolvedValue(true)
    const ctx = createContext({ autoRoutes: false })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(pathExistsMock).toHaveBeenCalledTimes(2)
    expect(removeMock).toHaveBeenCalledTimes(2)
  })

  it('logs an error when removing typed definition fails', async () => {
    pathExistsMock.mockRejectedValueOnce(new Error('remove-fail'))
    const ctx = createContext({ autoRoutes: false })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('移除 .weapp-vite/typed-router.d.ts 失败: remove-fail'))
  })

  it('clears candidates when enable flag flips during registry ensuring', async () => {
    const dynamicConfig: Record<string, any> = {}
    let reads = 0
    Object.defineProperty(dynamicConfig, 'autoRoutes', {
      get() {
        reads += 1
        return reads === 1
      },
    })

    const ctx = createContext({ weappViteConfig: dynamicConfig })
    ctx.runtimeState.autoRoutes.dirty = false
    ctx.runtimeState.autoRoutes.initialized = true
    ctx.runtimeState.autoRoutes.needsFullRescan = false
    ctx.runtimeState.autoRoutes.candidates.set('pages/index/index', { base: 'pages/index/index' } as any)
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(ctx.runtimeState.autoRoutes.candidates.size).toBe(0)
    expect(ctx.runtimeState.autoRoutes.needsFullRescan).toBe(true)
    expect(outputFileMock).not.toHaveBeenCalled()
  })

  it('marks dirty and exposes serialized signature', () => {
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    ctx.runtimeState.autoRoutes.dirty = false
    ctx.runtimeState.autoRoutes.needsFullRescan = false

    expect(service.getSignature()).toBe(ctx.runtimeState.autoRoutes.serialized)
    service.markDirty()

    expect(ctx.runtimeState.autoRoutes.dirty).toBe(true)
    expect(ctx.runtimeState.autoRoutes.needsFullRescan).toBe(true)
  })

  it('returns early for unchanged route files without full rescan request', async () => {
    updateCandidateFromFileMock.mockResolvedValueOnce(false)
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    ctx.runtimeState.autoRoutes.needsFullRescan = false
    const service = createAutoRoutesService(ctx)

    await expect(service.handleFileChange('/project/src/pages/index/index.ts')).resolves.toBe(false)

    expect(updateCandidateFromFileMock).toHaveBeenCalledTimes(1)
    expect(scanRoutesMock).not.toHaveBeenCalled()
  })

  it('reports route topology changes when file change updates candidates', async () => {
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await expect(service.handleFileChange('/project/src/pages/index/index.ts', 'create')).resolves.toBe(true)

    expect(updateCandidateFromFileMock).toHaveBeenCalledTimes(1)
    expect(scanRoutesMock).toHaveBeenCalledTimes(1)
  })

  it('restores routes from persistent cache when watched files are unchanged', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 1,
      snapshot: {
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index"]',
      typedDefinition: 'type TypedRouter = ["pages/index/index"]',
      watchFiles: ['/project/src/pages/index/index.ts'],
      watchDirs: ['/project/src/pages/index'],
      fileMtims: {
        '/project/src/pages/index/index.ts': 1,
      },
    })

    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(scanRoutesMock).not.toHaveBeenCalled()
    expect(outputJsonMock).not.toHaveBeenCalled()
    expect(service.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
    expect([...service.getWatchFiles()]).toEqual(['/project/src/pages/index/index.ts'])
  })

  it('checks persistent cache mtimes concurrently during restore', async () => {
    const firstStat = createDeferred<{ mtimeMs: number }>()
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 1,
      snapshot: {
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index","pages/about/index"]',
      typedDefinition: 'type TypedRouter = ["pages/index/index", "pages/about/index"]',
      watchFiles: [
        '/project/src/pages/index/index.ts',
        '/project/src/pages/about/index.ts',
      ],
      watchDirs: [
        '/project/src/pages/index',
        '/project/src/pages/about',
      ],
      fileMtims: {
        '/project/src/pages/index/index.ts': 1,
        '/project/src/pages/about/index.ts': 2,
      },
    })
    statMock.mockImplementation((filePath: string) => {
      if (filePath.endsWith('/pages/index/index.ts')) {
        return firstStat.promise
      }
      return Promise.resolve({ mtimeMs: 2 })
    })

    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)
    const ensureFreshPromise = service.ensureFresh()

    await expect.poll(() => statMock.mock.calls.length).toBe(2)
    firstStat.resolve({ mtimeMs: 1 })
    await ensureFreshPromise

    expect(scanRoutesMock).not.toHaveBeenCalled()
    expect(outputJsonMock).not.toHaveBeenCalled()
    expect(service.getSnapshot().pages).toEqual(['pages/index/index', 'pages/about/index'])
  })

  it('uses custom persistent cache path when configured as string', async () => {
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: '.cache/custom-auto-routes.json',
      },
      configFilePath: '/project/configs/vite.config.ts',
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(outputJsonMock).toHaveBeenCalledTimes(1)
    expect(outputJsonMock).toHaveBeenCalledWith(
      '/project/configs/.cache/custom-auto-routes.json',
      expect.any(Object),
      { spaces: 2 },
    )
  })

  it('does not rewrite persistent cache when payload is already current', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 1,
      snapshot: {
        pages: [],
        entries: [],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: [],
        entries: [],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default []',
      typedDefinition: 'type TypedRouter = []',
      watchFiles: [],
      watchDirs: [],
      fileMtims: {},
    })
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(outputJsonMock).not.toHaveBeenCalled()
  })

  it('collects persistent cache mtimes concurrently before writing', async () => {
    const firstStat = createDeferred<{ mtimeMs: number }>()
    scanRoutesMock.mockResolvedValueOnce({
      snapshot: {
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index","pages/about/index"]',
      typedDefinition: 'type TypedRouter = ["pages/index/index", "pages/about/index"]',
      watchFiles: new Set([
        '/project/src/pages/index/index.ts',
        '/project/src/pages/about/index.ts',
      ]),
      watchDirs: new Set([
        '/project/src/pages/index',
        '/project/src/pages/about',
      ]),
    })
    statMock.mockImplementation((filePath: string) => {
      if (filePath.endsWith('/pages/index/index.ts')) {
        return firstStat.promise
      }
      return Promise.resolve({ mtimeMs: 2 })
    })

    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)
    const ensureFreshPromise = service.ensureFresh()

    await expect.poll(() => statMock.mock.calls.length).toBe(2)
    expect(outputJsonMock).not.toHaveBeenCalled()
    firstStat.resolve({ mtimeMs: 1 })
    await ensureFreshPromise

    expect(outputJsonMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/auto-routes.cache.json',
      expect.objectContaining({
        fileMtims: {
          '/project/src/pages/index/index.ts': 1,
          '/project/src/pages/about/index.ts': 2,
        },
      }),
      { spaces: 2 },
    )
  })

  it('skips persistent cache writes when collecting mtimes fails', async () => {
    scanRoutesMock.mockResolvedValueOnce({
      snapshot: {
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index"]',
      typedDefinition: 'type TypedRouter = ["pages/index/index"]',
      watchFiles: new Set(['/project/src/pages/index/index.ts']),
      watchDirs: new Set(['/project/src/pages/index']),
    })
    statMock.mockRejectedValueOnce(new Error('gone'))
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(outputJsonMock).not.toHaveBeenCalled()
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('falls back to a full scan when persistent cache mtimes do not match', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 1,
      snapshot: {
        pages: ['stale/page'],
        entries: ['stale/page'],
        subPackages: [],
      },
      serialized: '{"pages":["stale/page"],"entries":["stale/page"],"subPackages":[]}',
      moduleCode: 'export default ["stale/page"]',
      typedDefinition: 'type TypedRouter = ["stale/page"]',
      watchFiles: ['/project/src/pages/index/index.ts'],
      watchDirs: ['/project/src/pages/index'],
      fileMtims: {
        '/project/src/pages/index/index.ts': 2,
      },
    })
    statMock.mockResolvedValue({ mtimeMs: 1 })

    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(scanRoutesMock).toHaveBeenCalledTimes(1)
    expect(outputJsonMock).toHaveBeenCalledTimes(1)
  })

  it('warns when writing persistent cache fails', async () => {
    outputJsonMock.mockRejectedValueOnce(new Error('cache-boom'))
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('写入 auto-routes 缓存失败: cache-boom'))
  })

  it('removes typed router output when autoRoutes.typedRouter is false', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('typed-router.d.ts'))
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        typedRouter: false,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(scanRoutesMock).toHaveBeenCalledTimes(1)
    expect(outputFileMock).not.toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledTimes(1)
  })

  it('removes persistent cache when autoRoutes.persistentCache is false', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: false,
      },
    })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(outputJsonMock).not.toHaveBeenCalled()
    expect(removeMock).toHaveBeenCalledTimes(1)
  })

  it('restores custom persistent cache path when configured as string', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath === '/project/configs/.cache/custom-auto-routes.json')
    readJsonMock.mockResolvedValue({
      version: 1,
      snapshot: {
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      },
      serialized: JSON.stringify({
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index"]',
      typedDefinition: 'type TypedRouter = ["pages/index/index"]',
      watchFiles: ['/project/src/pages/index/index.ts'],
      watchDirs: ['/project/src/pages/index'],
      fileMtims: {
        '/project/src/pages/index/index.ts': 1,
      },
    })

    const enabledCtx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: '.cache/custom-auto-routes.json',
      },
      configFilePath: '/project/configs/vite.config.ts',
    })
    const enabledService = createAutoRoutesService(enabledCtx)

    await enabledService.ensureFresh()

    expect(readJsonMock).toHaveBeenCalledWith('/project/configs/.cache/custom-auto-routes.json')
    expect(scanRoutesMock).not.toHaveBeenCalled()
  })
})
