import type { MutableCompilerContext } from '../../context'
import type { AutoRoutesPersistentCache } from './service/shared'
import { setImmediate } from 'node:timers/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createAutoRoutesService } from './service'
import { createAutoRoutesSourceFingerprint } from './service/shared'

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
const createAutoRoutesTopologyKeyMock = vi.hoisted(() => vi.fn(() => 'topology'))
const scanRoutesMock = vi.hoisted(() => vi.fn(async () => ({
  snapshot: {
    pages: [],
    entries: [],
    subPackages: [],
  },
  namedRoutes: [],
  serialized: JSON.stringify({
    pages: [],
    entries: [],
    subPackages: [],
  }, null, 2),
  moduleCode: 'export default []',
  namedModuleCode: 'export const routes = []',
  signature: 'routes-signature',
  typedDefinition: 'type TypedRouter = []',
  topologyKey: 'topology',
  pageSourceFiles: new Set<string>(),
  namedRouteSourceFiles: new Set<string>(),
  pageDeclarationDependencies: new Map<string, Set<string>>(),
  pageDeclarationFingerprints: new Map<string, string>(),
  usesOpaquePageDeclarationResolver: false,
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
  createAutoRoutesTopologyKey: createAutoRoutesTopologyKeyMock,
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
    readFileMock.mockResolvedValue('declaration-source')
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

  it('restores ordinary routes from persistent cache with a plugin resolver registered', async () => {
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 3,
      snapshot: {
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      },
      namedRoutes: [],
      serialized: JSON.stringify({
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index"]',
      namedModuleCode: 'export const routes = []',
      signature: 'cached-signature',
      typedDefinition: 'type TypedRouter = ["pages/index/index"]',
      topologyKey: 'topology',
      pageDeclarationDependencies: {},
      pageDeclarationFingerprints: {
        '/project/src/pages/index/index.ts': createAutoRoutesSourceFingerprint('declaration-source'),
      },
      usesOpaquePageDeclarationResolver: false,
      pageSourceFiles: ['/project/src/pages/index/index.ts'],
      namedRouteSourceFiles: [],
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
    service.setPageDeclarationSourceResolver(async () => undefined)

    await service.ensureFresh()

    expect(scanRoutesMock).not.toHaveBeenCalled()
    expect(outputJsonMock).not.toHaveBeenCalled()
    expect(service.getSnapshot()).toEqual({
      pages: ['pages/index/index'],
      entries: ['pages/index/index'],
      subPackages: [],
    })
    expect([...service.getWatchFiles()]).toEqual(['/project/src/pages/index/index.ts'])
    expect(service.getModuleCode()).not.toBe('export default ["pages/index/index"]')
    expect(service.getNamedModuleCode()).not.toBe('export const routes = []')
    expect(outputFileMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/typed-router.d.ts',
      'type TypedRouter = []',
      'utf8',
    )
  })

  it('checks persistent cache mtimes concurrently during restore', async () => {
    const firstStat = createDeferred<{ mtimeMs: number }>()
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 3,
      snapshot: {
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      },
      namedRoutes: [],
      serialized: JSON.stringify({
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index","pages/about/index"]',
      namedModuleCode: 'export const routes = []',
      signature: 'cached-signature',
      typedDefinition: 'type TypedRouter = ["pages/index/index", "pages/about/index"]',
      topologyKey: 'topology',
      pageDeclarationDependencies: {},
      pageDeclarationFingerprints: {
        '/project/src/pages/index/index.ts': createAutoRoutesSourceFingerprint('declaration-source'),
        '/project/src/pages/about/index.ts': createAutoRoutesSourceFingerprint('declaration-source'),
      },
      usesOpaquePageDeclarationResolver: false,
      pageSourceFiles: [
        '/project/src/pages/index/index.ts',
        '/project/src/pages/about/index.ts',
      ],
      namedRouteSourceFiles: [],
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

  it('rejects a cold cache restore when a mutation arrives during validation', async () => {
    const pendingStat = createDeferred<{ mtimeMs: number }>()
    pathExistsMock.mockImplementation(async (filePath: string) => filePath.endsWith('auto-routes.cache.json'))
    readJsonMock.mockResolvedValue({
      version: 3,
      snapshot: {
        pages: ['pages/cached/index'],
        entries: ['pages/cached/index'],
        subPackages: [],
      },
      namedRoutes: [],
      topologyKey: 'topology',
      pageDeclarationDependencies: {},
      pageDeclarationFingerprints: {
        '/project/src/pages/index/index.ts': createAutoRoutesSourceFingerprint('declaration-source'),
      },
      usesOpaquePageDeclarationResolver: false,
      pageSourceFiles: ['/project/src/pages/index/index.ts'],
      namedRouteSourceFiles: [],
      watchFiles: ['/project/src/pages/index/index.ts'],
      watchDirs: ['/project/src/pages/index'],
      fileMtims: {
        '/project/src/pages/index/index.ts': 1,
      },
    })
    statMock.mockReturnValue(pendingStat.promise)
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)
    const refresh = service.ensureFresh()

    await expect.poll(() => statMock.mock.calls.length).toBe(1)
    service.markDirty()
    pendingStat.resolve({ mtimeMs: 1 })
    await refresh

    expect(scanRoutesMock).toHaveBeenCalledTimes(1)
    expect(service.getSnapshot().pages).toEqual([])
    expect(service.isInitialized()).toBe(true)
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
      version: 3,
      snapshot: {
        pages: [],
        entries: [],
        subPackages: [],
      },
      namedRoutes: [],
      topologyKey: 'topology',
      pageDeclarationDependencies: {},
      pageDeclarationFingerprints: {},
      usesOpaquePageDeclarationResolver: false,
      pageSourceFiles: [],
      namedRouteSourceFiles: [],
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
      namedRoutes: [],
      serialized: JSON.stringify({
        pages: ['pages/index/index', 'pages/about/index'],
        entries: ['pages/index/index', 'pages/about/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index","pages/about/index"]',
      namedModuleCode: 'export const routes = []',
      signature: 'routes-signature',
      typedDefinition: 'type TypedRouter = ["pages/index/index", "pages/about/index"]',
      topologyKey: 'topology',
      pageSourceFiles: new Set<string>(),
      namedRouteSourceFiles: new Set<string>(),
      pageDeclarationDependencies: new Map<string, Set<string>>(),
      pageDeclarationFingerprints: new Map<string, string>(),
      usesOpaquePageDeclarationResolver: false,
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
      namedRoutes: [],
      serialized: JSON.stringify({
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index"]',
      namedModuleCode: 'export const routes = []',
      signature: 'routes-signature',
      typedDefinition: 'type TypedRouter = ["pages/index/index"]',
      topologyKey: 'topology',
      pageSourceFiles: new Set<string>(),
      namedRouteSourceFiles: new Set<string>(),
      pageDeclarationDependencies: new Map<string, Set<string>>(),
      pageDeclarationFingerprints: new Map<string, string>(),
      usesOpaquePageDeclarationResolver: false,
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
      version: 3,
      snapshot: {
        pages: ['stale/page'],
        entries: ['stale/page'],
        subPackages: [],
      },
      namedRoutes: [],
      serialized: '{"pages":["stale/page"],"entries":["stale/page"],"subPackages":[]}',
      moduleCode: 'export default ["stale/page"]',
      namedModuleCode: 'export const routes = []',
      signature: 'stale-signature',
      typedDefinition: 'type TypedRouter = ["stale/page"]',
      topologyKey: 'topology',
      pageDeclarationDependencies: {},
      pageDeclarationFingerprints: {
        '/project/src/pages/index/index.ts': createAutoRoutesSourceFingerprint('declaration-source'),
      },
      usesOpaquePageDeclarationResolver: false,
      pageSourceFiles: ['/project/src/pages/index/index.ts'],
      namedRouteSourceFiles: [],
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
      version: 3,
      snapshot: {
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      },
      namedRoutes: [],
      serialized: JSON.stringify({
        pages: ['pages/index/index'],
        entries: ['pages/index/index'],
        subPackages: [],
      }, null, 2),
      moduleCode: 'export default ["pages/index/index"]',
      namedModuleCode: 'export const routes = []',
      signature: 'cached-signature',
      typedDefinition: 'type TypedRouter = ["pages/index/index"]',
      topologyKey: 'topology',
      pageDeclarationDependencies: {},
      pageDeclarationFingerprints: {
        '/project/src/pages/index/index.ts': createAutoRoutesSourceFingerprint('declaration-source'),
      },
      usesOpaquePageDeclarationResolver: false,
      pageSourceFiles: ['/project/src/pages/index/index.ts'],
      namedRouteSourceFiles: [],
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

  it.each(['success', 'failure'])('discards superseded scan %s before publishing the latest route', async (staleOutcome) => {
    const currentResult = {
      snapshot: {
        pages: ['pages/current/index'],
        entries: ['pages/current/index'],
        subPackages: [],
      },
      namedRoutes: [],
      serialized: 'current-routes',
      moduleCode: 'current-module',
      namedModuleCode: 'current-named-module',
      signature: 'current-signature',
      typedDefinition: 'current-types',
      topologyKey: 'current-topology',
      pageSourceFiles: new Set<string>(),
      namedRouteSourceFiles: new Set<string>(),
      pageDeclarationDependencies: new Map<string, Set<string>>(),
      pageDeclarationFingerprints: new Map<string, string>(),
      usesOpaquePageDeclarationResolver: false,
      watchFiles: new Set<string>(),
      watchDirs: new Set<string>(),
    }
    const staleResult = {
      ...currentResult,
      snapshot: {
        pages: ['pages/stale/index'],
        entries: ['pages/stale/index'],
        subPackages: [],
      },
      serialized: 'stale-routes',
      moduleCode: 'stale-module',
      signature: 'stale-signature',
      typedDefinition: 'stale-types',
      topologyKey: 'stale-topology',
    }
    const firstScan = createDeferred<typeof currentResult>()
    scanRoutesMock
      .mockImplementationOnce(() => firstScan.promise)
      .mockResolvedValueOnce(currentResult)
    const ctx = createContext({
      autoRoutes: {
        enabled: true,
        persistentCache: true,
      },
    })
    const service = createAutoRoutesService(ctx)
    const refresh = service.ensureFresh()

    await expect.poll(() => scanRoutesMock.mock.calls.length).toBe(1)
    service.markDirty()
    const nextRefresh = service.ensureFresh()
    if (staleOutcome === 'failure') {
      firstScan.reject(new Error('superseded invalid source'))
    }
    else {
      firstScan.resolve(staleResult)
    }
    await Promise.all([refresh, nextRefresh])

    expect(scanRoutesMock).toHaveBeenCalledTimes(2)
    expect(service.getSnapshot().entries).toEqual(['pages/current/index'])
    expect(outputFileMock).toHaveBeenCalledTimes(1)
    expect(outputFileMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/typed-router.d.ts',
      'current-types',
      'utf8',
    )
    expect(outputJsonMock).toHaveBeenCalledTimes(1)
    expect(outputJsonMock).toHaveBeenCalledWith(
      '/project/.weapp-vite/auto-routes.cache.json',
      expect.objectContaining({
        topologyKey: 'current-topology',
      }),
      { spaces: 2 },
    )
  })

  it.each(['types', 'cache'])('keeps the latest %s when an earlier publication finishes late', async (blockedArtifact) => {
    const firstWrite = createDeferred<void>()
    const releaseWrite = createDeferred<void>()
    const watchFiles = new Set(['/project/src/pages/index/index.json'])
    const staleResult = {
      snapshot: { pages: ['pages/index/index'], entries: ['pages/index/index'], subPackages: [] },
      namedRoutes: [],
      serialized: 'old-routes',
      moduleCode: 'old-module',
      namedModuleCode: 'export const routes = []',
      signature: 'old-signature',
      typedDefinition: 'export type PagePath = "pages/index/index"',
      topologyKey: 'topology',
      pageSourceFiles: new Set<string>(),
      namedRouteSourceFiles: new Set<string>(),
      pageDeclarationDependencies: new Map<string, Set<string>>(),
      pageDeclarationFingerprints: new Map<string, string>(),
      usesOpaquePageDeclarationResolver: false,
      watchFiles,
      watchDirs: new Set<string>(),
    }
    // JSON 中的 component 标记变化不改变候选文件集合或脚本指纹。
    const currentResult = {
      ...staleResult,
      snapshot: { pages: [], entries: [], subPackages: [] },
      serialized: 'current-routes',
      moduleCode: 'current-module',
      signature: 'current-signature',
      typedDefinition: 'export type PagePath = never',
    }
    let diskDefinition = ''
    let diskCache: AutoRoutesPersistentCache | undefined
    outputFileMock.mockImplementation(async (_path: string, content: string) => {
      if (blockedArtifact === 'types' && content === staleResult.typedDefinition) {
        firstWrite.resolve()
        await releaseWrite.promise
      }
      diskDefinition = content
    })
    outputJsonMock.mockImplementation(async (_path: string, payload: AutoRoutesPersistentCache) => {
      if (blockedArtifact === 'cache' && payload.snapshot.pages.length > 0) {
        firstWrite.resolve()
        await releaseWrite.promise
      }
      diskCache = payload
    })
    scanRoutesMock.mockResolvedValueOnce(staleResult).mockResolvedValueOnce(currentResult)
    const service = createAutoRoutesService(createContext({
      autoRoutes: { enabled: true, persistentCache: true },
    }))
    const initialRefresh = service.ensureFresh()
    await firstWrite.promise
    statMock.mockResolvedValue({ mtimeMs: 2 })
    service.markDirty()
    const latestRefresh = service.ensureFresh()
    // 让已就绪的异步工作完成；旧写入仍由显式屏障阻塞，不依赖计时延迟。
    await setImmediate()
    releaseWrite.resolve()
    await Promise.all([initialRefresh, latestRefresh])

    expect(service.getSnapshot().pages).toEqual([])
    expect(diskDefinition).toBe('export type PagePath = never')
    expect(diskCache?.snapshot.pages).toEqual([])
    expect(diskCache?.fileMtims).toEqual({ '/project/src/pages/index/index.json': 2 })
  })
})
