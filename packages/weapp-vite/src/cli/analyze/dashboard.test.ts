import type * as NodeFs from 'node:fs'
import type * as NodeModule from 'node:module'
import type { AnalyzeSubpackagesResult } from '../../dashboard'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAnalyzeDashboard } from './dashboard'

const disposeMock = vi.hoisted(() => vi.fn())
const bridgeCloseMock = vi.hoisted(() => vi.fn(async () => {}))

const existsSyncMock = vi.hoisted(() => vi.fn(() => undefined))
const readFileSyncMock = vi.hoisted(() => vi.fn(() => undefined))
const resolveDashboardPackageMock = vi.hoisted(() => vi.fn(() => '/mock/dashboard/package.json'))
const resolveCommandMock = vi.hoisted(() => vi.fn(() => ({
  command: 'pnpm',
  args: ['add', '@weapp-vite/dashboard'],
})))
const createAnalyzeDashboardDevframeMock = vi.hoisted(() => vi.fn(() => ({
  definition: { id: 'weapp-vite' },
  update: vi.fn(async () => {}),
  emitRuntimeEvents: vi.fn(),
  dispose: disposeMock,
})))
const createAnalyzeDashboardViteBridgeMock = vi.hoisted(() => vi.fn(() => ({
  name: 'weapp-vite-dashboard-devframe',
  close: bridgeCloseMock,
})))
const refreshTempAuthCodeMock = vi.hoisted(() => vi.fn(() => '654321'))
const buildOtpAuthUrlMock = vi.hoisted(() => vi.fn((url: string, code: string) => `${url}#devframe_otp=${code}`))
const createServerMock = vi.hoisted(() => vi.fn<(options: MockServerOptions) => Promise<MockServer>>())
const getDevShutdownScopeMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof NodeFs>('node:fs')

  const existsSync = vi.fn((...args: Parameters<typeof actual.existsSync>) => {
    const mocked = existsSyncMock(...args)
    return typeof mocked === 'boolean' ? mocked : actual.existsSync(...args)
  })
  const readFileSync = vi.fn((...args: Parameters<typeof actual.readFileSync>) => {
    const mocked = readFileSyncMock(...args)
    return mocked === undefined ? actual.readFileSync(...args) : mocked
  })

  return {
    ...actual,
    default: {
      ...(('default' in actual && actual.default) ? actual.default : actual),
      existsSync,
      readFileSync,
    },
    existsSync,
    readFileSync,
  }
})

vi.mock('../../devLifecycle/vite', () => ({
  createDevViteServer: createServerMock,
}))

vi.mock('../../devLifecycle/shutdown', () => ({
  getDevShutdownScope: getDevShutdownScopeMock,
}))

vi.mock('./dashboardViteBridge', () => ({
  ANALYZE_DASHBOARD_DEVFRAME_BASE: '/__weapp-vite/',
  createAnalyzeDashboardViteBridge: createAnalyzeDashboardViteBridgeMock,
}))

vi.mock('devframe/node/auth', () => ({
  buildOtpAuthUrl: buildOtpAuthUrlMock,
  refreshTempAuthCode: refreshTempAuthCodeMock,
}))

vi.mock('../../dashboard', () => ({
  createAnalyzeDashboardDevframe: createAnalyzeDashboardDevframeMock,
}))

vi.mock('node:module', async () => {
  const actual = await vi.importActual<typeof NodeModule>('node:module')

  return {
    ...actual,
    createRequire: vi.fn((filename: string | URL) => {
      const require = actual.createRequire(filename)
      const resolve = require.resolve.bind(require)
      require.resolve = ((id: string, options?: { paths?: string[] }) => {
        if (id === '@weapp-vite/dashboard/package.json') {
          return resolveDashboardPackageMock(id, options)
        }
        return resolve(id, options)
      }) as typeof require.resolve
      return require
    }),
  }
})

vi.mock('package-manager-detector/commands', () => ({
  resolveCommand: resolveCommandMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
  colors: {
    bold: (value: string) => value,
    cyan: (value: string) => value,
    green: (value: string) => value,
  },
}))

interface MockServer {
  listen: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  httpServer?: EventEmitter
  resolvedUrls?: {
    local?: string[]
    network?: string[]
  }
}

interface MockServerOptions {
  plugins?: {
    configureServer?: (server: MockServer) => unknown
  }[]
}

function createMockServer(overrides: Partial<MockServer> = {}): MockServer {
  return {
    listen: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    httpServer: new EventEmitter(),
    resolvedUrls: {
      local: ['http://127.0.0.1:4173/__weapp-vite/'],
      network: ['http://192.168.0.2:4173/__weapp-vite/'],
    },
    ...overrides,
  }
}

function createAnalyzeResult(label: string): AnalyzeSubpackagesResult {
  return {
    packages: [{ id: label, label, type: 'main', files: [] }],
    modules: [],
    subPackages: [],
    glassEasel: {
      detected: false,
      minimumBaseLibrary: '3.8.12',
      migrationGuide: '',
      diagnostics: [],
      summary: { errors: 0, warnings: 0 },
    },
  }
}

describe('analyze dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDevShutdownScopeMock.mockReturnValue(undefined)
    readFileSyncMock.mockImplementation((value: string) => {
      if (value !== '/mock/dashboard/package.json') {
        return undefined
      }
      return `{
        "weappViteDashboard": {
          "distDir": "dist"
        }
      }`
    })
    existsSyncMock.mockImplementation((value: string) => {
      return value === '/mock/dashboard/dist/index.html'
        || value === '/mock/dashboard/package.json'
        ? true
        : undefined
    })
    resolveDashboardPackageMock.mockReturnValue('/mock/dashboard/package.json')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('downgrades when optional dashboard package is unavailable', async () => {
    resolveDashboardPackageMock.mockImplementation(() => {
      throw new Error('missing')
    })
    existsSyncMock.mockReturnValue(false)

    await expect(startAnalyzeDashboard(createAnalyzeResult('missing'), { artifacts: new Map(), cwd: '/project', packageManagerAgent: 'pnpm' })).resolves.toBeUndefined()
    expect(createServerMock).not.toHaveBeenCalled()
  })

  it('closes the server and core once and removes exit listeners', async () => {
    const server = createMockServer()
    createServerMock.mockResolvedValue(server)
    const initialSignalListeners = process.listenerCount('SIGINT')
    const handle = await startAnalyzeDashboard(createAnalyzeResult('initial'), { artifacts: new Map(), watch: true, cwd: '/project' })

    await handle?.close()
    await handle?.close()
    await handle?.waitForExit()
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(disposeMock).toHaveBeenCalledTimes(1)
    expect(bridgeCloseMock).toHaveBeenCalledTimes(1)
    expect(process.listenerCount('SIGINT')).toBe(initialSignalListeners)
  })

  it('still closes Vite and releases exit listeners when core disposal throws synchronously', async () => {
    const server = createMockServer()
    createServerMock.mockResolvedValueOnce(server)
    const failure = new Error('core disposal failed')
    disposeMock.mockImplementationOnce(() => {
      throw failure
    })
    const initialListeners = process.listenerCount('SIGINT')
    const handle = await startAnalyzeDashboard(createAnalyzeResult('dispose failure'), { artifacts: new Map(), watch: true })
    const closing = handle?.close()
    expect(handle?.close()).toBe(closing)
    await expect(closing).rejects.toBe(failure)
    await handle?.waitForExit()
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(disposeMock).toHaveBeenCalledTimes(1)
    expect(process.listenerCount('SIGINT')).toBe(initialListeners)
    expect(server.httpServer?.listenerCount('close')).toBe(0)
  })

  it('waits for core and bridge disposal after the native host reports that it closed', async () => {
    const disposed = Promise.withResolvers<void>()
    const bridgeDisposed = Promise.withResolvers<void>()
    disposeMock.mockReturnValueOnce(disposed.promise)
    bridgeCloseMock.mockReturnValueOnce(bridgeDisposed.promise)
    const server = createMockServer()
    const nativeClose = server.close
    createServerMock.mockImplementationOnce(async (options) => {
      for (const plugin of options.plugins ?? []) {
        await plugin.configureServer?.(server)
      }
      return server
    })
    const initialListeners = process.listenerCount('SIGINT')
    const handle = await startAnalyzeDashboard(createAnalyzeResult('slow disposal'), { artifacts: new Map(), watch: true })
    const exited = vi.fn()
    void handle?.waitForExit().then(exited)
    const closing = handle?.close()
    try {
      await vi.waitFor(() => expect(nativeClose).toHaveResolved())
      expect(exited).not.toHaveBeenCalled()
      expect(process.listenerCount('SIGINT')).toBe(initialListeners + 1)
      disposed.resolve()
      await disposed.promise
      expect(exited).not.toHaveBeenCalled()
    }
    finally {
      disposed.resolve()
      bridgeDisposed.resolve()
      await closing
    }
    expect(exited).toHaveBeenCalledOnce()
    expect(process.listenerCount('SIGINT')).toBe(initialListeners)
  })

  it('hands managed dashboard cleanup to the caller without adding process listeners', async () => {
    const server = createMockServer()
    createServerMock.mockResolvedValueOnce(server)
    const unregister = vi.fn()
    const own = vi.fn(() => unregister)
    const run = vi.fn((_phase, task: () => unknown) => task())
    getDevShutdownScopeMock.mockReturnValue({ stopping: false, own, run })
    const initialListeners = ['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal))
    const handle = await startAnalyzeDashboard(createAnalyzeResult('managed'), { artifacts: new Map(), watch: true })
    expect(['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal))).toEqual(initialListeners)
    expect(own).toHaveBeenCalledExactlyOnceWith(handle?.close)
    await handle?.close()
    await handle?.waitForExit()
    expect(run).toHaveBeenCalledWith('cleanup', expect.any(Function))
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(disposeMock).toHaveBeenCalledTimes(1)
  })

  it('closes a late dashboard server without starting its listener after shutdown', async () => {
    const server = createMockServer()
    const ready = Promise.withResolvers<MockServer>()
    createServerMock.mockReturnValueOnce(ready.promise)
    const unregister = vi.fn()
    const scope = {
      stopping: false,
      own: vi.fn(() => unregister),
      run: vi.fn((_phase, task: () => unknown) => task()),
    }
    getDevShutdownScopeMock.mockReturnValue(scope)
    const initialListeners = ['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal))
    const pending = startAnalyzeDashboard(createAnalyzeResult('late'), { artifacts: new Map(), watch: true })
    scope.stopping = true
    ready.resolve(server)
    await expect(pending).resolves.toBeUndefined()
    expect(server.listen).not.toHaveBeenCalled()
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(disposeMock).toHaveBeenCalledTimes(1)
    expect(unregister).toHaveBeenCalledTimes(1)
    expect(['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal))).toEqual(initialListeners)
    expect(loggerMock.info).not.toHaveBeenCalled()
  })

  it('releases the core when Vite creation fails without replacing the original error', async () => {
    const failure = new Error('Vite configuration failed')
    createServerMock.mockRejectedValueOnce(failure)
    await expect(startAnalyzeDashboard(createAnalyzeResult('failure'), { artifacts: new Map(), watch: true })).rejects.toBe(failure)
    expect(disposeMock).toHaveBeenCalledTimes(1)
  })

  it('closes a captured server when plugin setup fails before createServer resolves', async () => {
    const failure = new Error('Devframe setup failed')
    const server = createMockServer()
    const nativeClose = server.close
    createServerMock.mockImplementationOnce(async (options) => {
      for (const plugin of options.plugins ?? []) {
        await plugin?.configureServer?.(server)
      }
      throw failure
    })
    await expect(startAnalyzeDashboard(createAnalyzeResult('failure'), { artifacts: new Map(), watch: true })).rejects.toBe(failure)
    expect(nativeClose).toHaveBeenCalledTimes(1)
    expect(disposeMock).toHaveBeenCalledTimes(1)
  })

  it('preserves startup and every cleanup failure while still closing a created server', async () => {
    const failure = new Error('listen failed')
    const disposeFailure = new Error('core disposal failed')
    const bridgeFailure = new Error('bridge disposal failed')
    const closeFailure = new Error('close failed')
    bridgeCloseMock.mockRejectedValueOnce(bridgeFailure)
    disposeMock.mockImplementationOnce(() => {
      throw disposeFailure
    })
    const server = createMockServer({
      listen: vi.fn().mockRejectedValue(failure),
      close: vi.fn().mockRejectedValue(closeFailure),
    })
    createServerMock.mockResolvedValueOnce(server)
    const initialSignalListeners = process.listenerCount('SIGINT')
    await expect(startAnalyzeDashboard(createAnalyzeResult('failure'), { artifacts: new Map(), watch: true })).rejects.toMatchObject({
      cause: failure,
      errors: [failure, disposeFailure, bridgeFailure, closeFailure],
    })
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(disposeMock).toHaveBeenCalledTimes(1)
    expect(process.listenerCount('SIGINT')).toBe(initialSignalListeners)
  })

  it('keeps the static session through a restart and exits only when its host closes', async () => {
    const server = createMockServer({ resolvedUrls: undefined })
    const nativeClose = server.close
    createServerMock.mockImplementationOnce(async (options) => {
      for (const plugin of options.plugins ?? []) {
        await plugin.configureServer?.(server)
      }
      return server
    })
    let finished = false
    const runPromise = startAnalyzeDashboard(createAnalyzeResult('static'), { artifacts: new Map() }).then(() => {
      finished = true
    })
    await vi.waitFor(() => expect(refreshTempAuthCodeMock).toHaveBeenCalled())
    // 原生重启直接释放旧代资源，不经过公共 close 入口。
    await nativeClose()
    expect(finished).toBe(false)
    expect(disposeMock).not.toHaveBeenCalled()
    await server.close()
    await runPromise
    expect(finished).toBe(true)
    expect(nativeClose).toHaveBeenCalledTimes(2)
  })

  it('logs close errors when cleanup fails on process signal', async () => {
    const server = createMockServer({
      close: vi.fn(async () => {
        throw new Error('close failed')
      }),
    })
    const nativeClose = server.close
    const signalHandlers = new Map<Parameters<typeof process.once>[0], Parameters<typeof process.once>[1]>()
    vi.spyOn(process, 'once').mockImplementation((signal, listener) => {
      signalHandlers.set(signal, listener)
      return process
    })
    vi.spyOn(process, 'removeListener').mockImplementation((signal) => {
      signalHandlers.delete(signal)
      return process
    })

    createServerMock.mockImplementation(async (options) => {
      for (const plugin of options.plugins ?? []) {
        await plugin?.configureServer?.(server)
      }
      return server
    })

    const handle = await startAnalyzeDashboard(createAnalyzeResult('signal'), { artifacts: new Map(), watch: true, cwd: '/project' })
    await signalHandlers.get('SIGINT')?.()
    await handle?.waitForExit()

    expect(signalHandlers.size).toBe(0)
    expect(nativeClose).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      message: 'close failed',
    }))
  })
})
