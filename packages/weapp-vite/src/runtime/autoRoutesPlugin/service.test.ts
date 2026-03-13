import type { MutableCompilerContext } from '../../context'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../runtimeState'
import { createAutoRoutesService } from './service'

const outputFileMock = vi.hoisted(() => vi.fn())
const outputJsonMock = vi.hoisted(() => vi.fn())
const pathExistsMock = vi.hoisted(() => vi.fn())
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

vi.mock('fs-extra', () => ({
  default: {
    outputFile: outputFileMock,
    outputJson: outputJsonMock,
    pathExists: pathExistsMock,
    readJson: readJsonMock,
    remove: removeMock,
    stat: statMock,
  },
}))

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

  it('skips writing typed definition when output path cannot be resolved', async () => {
    const ctx = createContext({ autoRoutes: true, cwd: '' })
    const service = createAutoRoutesService(ctx)

    await service.ensureFresh()

    expect(scanRoutesMock).toHaveBeenCalledTimes(1)
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
    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('写入 typed-router.d.ts 失败: boom'))
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

    expect(loggerErrorMock).toHaveBeenCalledWith(expect.stringContaining('移除 typed-router.d.ts 失败: remove-fail'))
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

    await service.handleFileChange('/project/src/pages/index/index.ts')

    expect(updateCandidateFromFileMock).toHaveBeenCalledTimes(1)
    expect(scanRoutesMock).not.toHaveBeenCalled()
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
})
