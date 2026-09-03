import type * as NodeFs from 'node:fs'
import type * as NodeModule from 'node:module'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAnalyzeDashboard } from './dashboard'

interface MockDashboardDevframeOptions {
  getAnalyzeSnapshot: () => unknown
  getRuntimeEvents: () => unknown[]
  roots: {
    artifactRoot?: string
    pluginRoot?: string
    projectRoot?: string
    srcRoot?: string
  }
}

const existsSyncMock = vi.hoisted(() => vi.fn(() => undefined))
const readFileSyncMock = vi.hoisted(() => vi.fn(() => undefined))
const resolveDashboardPackageMock = vi.hoisted(() => vi.fn(() => '/mock/dashboard/package.json'))
const resolveCommandMock = vi.hoisted(() => vi.fn(() => ({
  command: 'pnpm',
  args: ['add', '@weapp-vite/dashboard'],
})))
const notifyAnalyzeUpdateMock = vi.hoisted(() => vi.fn())
const syncRuntimeEventsMock = vi.hoisted(() => vi.fn())
const createAnalyzeDashboardDevframeMock = vi.hoisted(() => vi.fn((_options: MockDashboardDevframeOptions) => ({
  definition: { id: 'weapp-vite' },
  notifyAnalyzeUpdate: notifyAnalyzeUpdateMock,
  syncRuntimeEvents: syncRuntimeEventsMock,
})))
const devframeViteBridgeMock = vi.hoisted(() => vi.fn(() => ({
  name: 'weapp-vite-dashboard-devframe',
})))
const refreshTempAuthCodeMock = vi.hoisted(() => vi.fn(() => '654321'))
const buildOtpAuthUrlMock = vi.hoisted(() => vi.fn((url: string, code: string) => `${url}#devframe_otp=${code}`))
const createServerMock = vi.hoisted(() => vi.fn())
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

vi.mock('vite', () => ({
  createServer: createServerMock,
}))

vi.mock('@devframes/vite/single', () => ({
  devframeViteBridge: devframeViteBridgeMock,
}))

vi.mock('devframe/node/auth', () => ({
  buildOtpAuthUrl: buildOtpAuthUrlMock,
  refreshTempAuthCode: refreshTempAuthCodeMock,
}))

vi.mock('./dashboardDevframe', () => ({
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
  printUrls: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  middlewares: {
    use: ReturnType<typeof vi.fn>
  }
  ws?: {
    send: ReturnType<typeof vi.fn>
  }
  httpServer?: EventEmitter
  resolvedUrls?: {
    local?: string[]
    network?: string[]
  }
}

function createMockServer(overrides: Partial<MockServer> = {}): MockServer {
  return {
    listen: vi.fn(async () => {}),
    printUrls: vi.fn(),
    close: vi.fn(async () => {}),
    middlewares: {
      use: vi.fn(),
    },
    ws: {
      send: vi.fn(),
    },
    httpServer: new EventEmitter(),
    resolvedUrls: {
      local: ['http://127.0.0.1:4173/'],
      network: ['http://192.168.0.2:4173/'],
    },
    ...overrides,
  }
}

function createAnalyzeResult(label: string) {
  return {
    packages: [{ id: label, label, files: [] }],
    modules: [],
    subPackages: [],
  } as any
}

describe('analyze dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readFileSyncMock.mockImplementation((value: string) => {
      if (value !== '/mock/dashboard/package.json') {
        return undefined
      }
      return `{
        // dashboard dev/runtime manifest
        "weappViteDashboard": {
          "distDir": "dist"
        }
      }`
    })
    existsSyncMock.mockImplementation((value: string) => {
      return value === '/mock/dashboard/dist'
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

    await expect(startAnalyzeDashboard(createAnalyzeResult('missing'), {
      cwd: '/project',
      packageManagerAgent: 'pnpm',
    })).resolves.toBeUndefined()
    expect(createServerMock).not.toHaveBeenCalled()
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('[weapp-vite ui]'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('pnpm add @weapp-vite/dashboard'))
  })

  it('starts in watch mode from dist assets and supports update/close/waitForExit', async () => {
    const server = createMockServer()

    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    const initial = createAnalyzeResult('initial')
    const handle = await startAnalyzeDashboard(initial, { watch: true, cwd: '/project' })

    expect(handle).toBeDefined()
    expect(handle?.urls).toEqual([
      'http://127.0.0.1:4173/#devframe_otp=654321',
      'http://192.168.0.2:4173/#devframe_otp=654321',
    ])
    expect(server.listen).toHaveBeenCalledTimes(1)
    expect(server.printUrls).not.toHaveBeenCalled()
    expect(buildOtpAuthUrlMock).toHaveBeenCalledTimes(2)
    expect(refreshTempAuthCodeMock).toHaveBeenCalledTimes(1)
    expect(buildOtpAuthUrlMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:4173/', '654321')
    expect(buildOtpAuthUrlMock).toHaveBeenNthCalledWith(2, 'http://192.168.0.2:4173/', '654321')
    expect(server.listen.mock.invocationCallOrder[0]).toBeLessThan(refreshTempAuthCodeMock.mock.invocationCallOrder[0]!)
    expect(createAnalyzeDashboardDevframeMock).toHaveBeenCalledTimes(1)
    const devframeOptions = createAnalyzeDashboardDevframeMock.mock.calls[0]?.[0]
    expect(devframeOptions?.getAnalyzeSnapshot()).toEqual({
      current: initial,
      previous: null,
    })
    expect(devframeOptions?.getRuntimeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'command',
        level: 'success',
      }),
    ]))
    expect(devframeOptions?.roots).toEqual({
      artifactRoot: '/project/dist',
      pluginRoot: undefined,
      projectRoot: '/project',
      srcRoot: '/project/src',
    })
    expect(devframeViteBridgeMock).toHaveBeenCalledWith(
      { id: 'weapp-vite' },
      {
        base: '/__weapp-vite/',
        mcp: false,
      },
    )
    expect(server.ws?.send).not.toHaveBeenCalled()

    const updatePayload = createAnalyzeResult('next')
    await handle?.update(updatePayload)
    expect(devframeOptions?.getAnalyzeSnapshot()).toEqual({
      current: updatePayload,
      previous: initial,
    })
    expect(devframeOptions?.getRuntimeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'build',
        level: 'info',
        detail: expect.stringContaining('1 个包'),
      }),
    ]))
    expect(syncRuntimeEventsMock).toHaveBeenCalledTimes(1)
    expect(notifyAnalyzeUpdateMock).toHaveBeenCalledTimes(1)

    const createServerArg = createServerMock.mock.calls[0]?.[0]
    expect(createServerArg).toMatchObject({
      root: '/mock/dashboard/dist',
      configFile: false,
      plugins: [
        {
          name: 'weapp-vite-dashboard-devframe',
        },
      ],
    })
    handle?.emitRuntimeEvents([
      {
        kind: 'system',
        level: 'warning',
        title: 'custom runtime warning',
        detail: 'custom event',
        tags: ['custom'],
      },
    ])
    expect(devframeOptions?.getRuntimeEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'system',
        level: 'warning',
        title: 'custom runtime warning',
      }),
    ]))
    expect(syncRuntimeEventsMock).toHaveBeenCalledTimes(2)

    await handle?.close()
    expect(server.close).toHaveBeenCalledTimes(1)

    server.httpServer?.emit('close')
    await handle?.waitForExit()
    expect(server.close).toHaveBeenCalledTimes(2)
    expect(loggerMock.info).toHaveBeenCalledWith('weapp-vite UI 已启动（分析视图，实时模式），按 Ctrl+C 退出。')
    expect(loggerMock.info).toHaveBeenCalledWith('  ➜  http://127.0.0.1:4173/#devframe_otp=654321')
  })

  it('prefers dashboard source root in watch mode when the local package exposes a dev config', async () => {
    const server = createMockServer()

    readFileSyncMock.mockImplementation((value: string) => {
      if (value !== '/mock/dashboard/package.json') {
        return undefined
      }
      return `{
        "weappViteDashboard": {
          "devRoot": ".",
          "devConfigFile": "vite.config.ts",
          "distDir": "dist"
        }
      }`
    })
    existsSyncMock.mockImplementation((value: string) => {
      return value === '/mock/dashboard'
        || value === '/mock/dashboard/vite.config.ts'
        || value === '/mock/dashboard/dist'
        || value === '/mock/dashboard/package.json'
        ? true
        : undefined
    })
    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    const handle = await startAnalyzeDashboard(createAnalyzeResult('source'), { watch: true, cwd: '/project' })
    const createServerArg = createServerMock.mock.calls[0]?.[0] as any

    expect(handle).toBeDefined()
    expect(createServerArg.root).toBe('/mock/dashboard')
    expect(createServerArg.configFile).toBe('/mock/dashboard/vite.config.ts')

    await handle?.close()
    server.httpServer?.emit('close')
    await handle?.waitForExit()
  })

  it('prefers built dashboard assets in static mode when a local dev root is also available', async () => {
    const server = createMockServer()

    readFileSyncMock.mockImplementation((value: string) => {
      if (value !== '/mock/dashboard/package.json') {
        return undefined
      }
      return `{
        "weappViteDashboard": {
          "devRoot": ".",
          "devConfigFile": "vite.config.ts",
          "distDir": "dist"
        }
      }`
    })
    existsSyncMock.mockImplementation((value: string) => {
      return value === '/mock/dashboard'
        || value === '/mock/dashboard/vite.config.ts'
        || value === '/mock/dashboard/dist'
        || value === '/mock/dashboard/package.json'
        ? true
        : undefined
    })
    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    vi.useFakeTimers()
    const runPromise = startAnalyzeDashboard(createAnalyzeResult('static-dist'), { cwd: '/project' })
    setTimeout(() => {
      server.httpServer?.emit('close')
    }, 0)
    await vi.runAllTimersAsync()
    await expect(runPromise).resolves.toBeUndefined()
    vi.useRealTimers()

    const createServerArg = createServerMock.mock.calls[0]?.[0] as any
    expect(createServerArg.root).toBe('/mock/dashboard/dist')
    expect(createServerArg.configFile).toBe(false)
  })

  it('starts in static mode and resolves with empty urls when vite does not expose resolvedUrls', async () => {
    const server = createMockServer({
      ws: undefined,
      resolvedUrls: undefined,
    })

    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    const runPromise = startAnalyzeDashboard(createAnalyzeResult('static'), { cwd: '/project' })
    setTimeout(() => {
      server.httpServer?.emit('close')
    }, 0)
    await expect(runPromise).resolves.toBeUndefined()

    expect(server.ws?.send).toBeUndefined()
    const createServerArg = createServerMock.mock.calls[0]?.[0] as any
    expect(createServerArg.root).toBe('/mock/dashboard/dist')
    expect(createServerArg.configFile).toBe(false)
    expect(loggerMock.info).toHaveBeenCalledWith('weapp-vite UI 已启动（分析视图，静态模式），按 Ctrl+C 退出。')
  })

  it('logs close errors when cleanup fails on process signal', async () => {
    const server = createMockServer({
      close: vi.fn(async () => {
        throw new Error('close failed')
      }),
    })
    const signalHandlers = new Map<string, (...args: any[]) => any>()
    const onceSpy = vi.spyOn(process, 'once').mockImplementation(((signal: string, listener: (...args: any[]) => any) => {
      signalHandlers.set(signal, listener)
      return process
    }) as any)
    const removeSpy = vi.spyOn(process, 'removeListener').mockImplementation(((signal: string) => {
      signalHandlers.delete(signal)
      return process
    }) as any)

    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    const handle = await startAnalyzeDashboard(createAnalyzeResult('signal'), { watch: true, cwd: '/project' })
    await signalHandlers.get('SIGINT')?.()
    await handle?.waitForExit()

    expect(onceSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
    expect(server.close).toHaveBeenCalledTimes(1)
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      message: 'close failed',
    }))
  })
})
