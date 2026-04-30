import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startAnalyzeDashboard } from './dashboard'

const existsSyncMock = vi.hoisted(() => vi.fn(() => undefined))
const readFileSyncMock = vi.hoisted(() => vi.fn(() => undefined))
const readFileMock = vi.hoisted(() => vi.fn(() => undefined))
const statMock = vi.hoisted(() => vi.fn(() => undefined))
const resolveDashboardPackageMock = vi.hoisted(() => vi.fn(() => '/mock/dashboard/package.json'))
const resolveCommandMock = vi.hoisted(() => vi.fn(() => ({
  command: 'pnpm',
  args: ['add', '@weapp-vite/dashboard'],
})))
const createServerMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')

  const existsSync = vi.fn((...args: Parameters<typeof actual.existsSync>) => {
    const mocked = existsSyncMock(...args)
    return typeof mocked === 'boolean' ? mocked : actual.existsSync(...args)
  })

  const readFileSync = vi.fn((...args: Parameters<typeof actual.readFileSync>) => {
    const mocked = readFileSyncMock(...args)
    return mocked === undefined ? actual.readFileSync(...args) : mocked
  })
  const readFile = vi.fn((...args: Parameters<typeof actual.promises.readFile>) => {
    const mocked = readFileMock(...args)
    return mocked === undefined ? actual.promises.readFile(...args) : mocked
  })
  const stat = vi.fn((...args: Parameters<typeof actual.promises.stat>) => {
    const mocked = statMock(...args)
    return mocked === undefined ? actual.promises.stat(...args) : mocked
  })

  return {
    ...actual,
    default: {
      ...(('default' in actual && actual.default) ? actual.default : actual),
      existsSync,
      promises: {
        ...actual.promises,
        readFile,
        stat,
      },
      readFileSync,
    },
    existsSync,
    promises: {
      ...actual.promises,
      readFile,
      stat,
    },
    readFileSync,
  }
})

vi.mock('vite', () => ({
  createServer: createServerMock,
}))

vi.mock('node:module', async () => {
  const actual = await vi.importActual<typeof import('node:module')>('node:module')

  return {
    ...actual,
    createRequire: vi.fn(() => ({
      ...actual.createRequire(import.meta.url),
      resolve: resolveDashboardPackageMock,
    })),
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

function createMockResponse() {
  let resolveDone!: () => void
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  const response: any = {
    done,
    body: '',
    headers: new Map<string, string>(),
    statusCode: 200,
    setHeader: vi.fn((key: string, value: string) => {
      response.headers.set(key, value)
    }),
    end: vi.fn((body?: string) => {
      response.body = body ?? ''
      resolveDone()
    }),
  }
  return response
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
      'http://127.0.0.1:4173/',
      'http://192.168.0.2:4173/',
    ])
    expect(server.listen).toHaveBeenCalledTimes(1)
    expect(server.printUrls).toHaveBeenCalledTimes(1)
    expect(server.ws?.send).toHaveBeenCalledWith({
      type: 'custom',
      event: 'weapp-analyze:update',
      data: {
        current: initial,
        previous: null,
      },
    })
    expect(server.ws?.send).toHaveBeenCalledWith({
      type: 'custom',
      event: 'weapp-dashboard:event',
      data: expect.arrayContaining([
        expect.objectContaining({
          kind: 'command',
          level: 'success',
        }),
      ]),
    })

    const updatePayload = createAnalyzeResult('next')
    await handle?.update(updatePayload)
    const sendCalls = server.ws?.send.mock.calls ?? []
    expect(sendCalls.at(-2)?.[0]).toEqual({
      type: 'custom',
      event: 'weapp-dashboard:event',
      data: [
        expect.objectContaining({
          kind: 'build',
          level: 'info',
          detail: expect.stringContaining('1 个包'),
        }),
      ],
    })
    expect(server.ws?.send).toHaveBeenLastCalledWith({
      type: 'custom',
      event: 'weapp-analyze:update',
      data: {
        current: updatePayload,
        previous: initial,
      },
    })

    const createServerArg = createServerMock.mock.calls[0]?.[0] as any
    expect(createServerArg.root).toBe('/mock/dashboard/dist')
    expect(createServerArg.configFile).toBe(false)
    const plugin = createServerArg.plugins[0]
    const transformed = plugin.transformIndexHtml('<!doctype html>')
    const script = transformed.tags[0]?.children as string
    const previousScript = transformed.tags[1]?.children as string
    const eventScript = transformed.tags[2]?.children as string
    const bridgeScript = transformed.tags.find((tag: any) => tag?.attrs?.type === 'module' && typeof tag?.children === 'string')
    expect(script).toContain('"label":"next"')
    expect(previousScript).toContain('__WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__')
    expect(eventScript).toContain('__WEAPP_VITE_DASHBOARD_EVENTS__')
    expect(bridgeScript).toMatchObject({
      tag: 'script',
      attrs: {
        type: 'module',
      },
    })
    expect(bridgeScript?.children).toContain(`import.meta.hot.on('weapp-analyze:update'`)
    expect(bridgeScript?.children).toContain(`import.meta.hot.on('weapp-dashboard:event'`)

    handle?.emitRuntimeEvents([
      {
        kind: 'system',
        level: 'warning',
        title: 'custom runtime warning',
        detail: 'custom event',
        tags: ['custom'],
      },
    ])
    expect(server.ws?.send).toHaveBeenLastCalledWith({
      type: 'custom',
      event: 'weapp-dashboard:event',
      data: [
        expect.objectContaining({
          kind: 'system',
          level: 'warning',
          title: 'custom runtime warning',
        }),
      ],
    })

    await handle?.close()
    expect(server.close).toHaveBeenCalledTimes(1)

    server.httpServer?.emit('close')
    await handle?.waitForExit()
    expect(server.close).toHaveBeenCalledTimes(2)
    expect(loggerMock.info).toHaveBeenCalledWith('weapp-vite UI 已启动（分析视图，实时模式），按 Ctrl+C 退出。')
    expect(loggerMock.info).toHaveBeenCalledWith('  ➜  http://127.0.0.1:4173/')
  })

  it('prefers dashboard source root when the local package exposes a dev config', async () => {
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

  it('serves source and artifact content through restricted dashboard file endpoint', async () => {
    const server = createMockServer()

    statMock.mockImplementation(async (value: string) => {
      if (
        value === '/project/apps/lab/src/pages/index.ts'
        || value === '/project/apps/lab/dist/pages/index/index.js'
        || value === '/project/packages-runtime/wevu/dist/src.mjs'
      ) {
        return {
          isFile: () => true,
          size: 24,
        }
      }
      return undefined
    })
    readFileMock.mockImplementation(async (value: string) => {
      if (value === '/project/apps/lab/src/pages/index.ts') {
        return 'export const page = true\n'
      }
      if (value === '/project/apps/lab/dist/pages/index/index.js') {
        return 'Page({})\n'
      }
      if (value === '/project/packages-runtime/wevu/dist/src.mjs') {
        return 'export const runtime = true\n'
      }
      return undefined
    })
    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    const handle = await startAnalyzeDashboard({
      packages: [
        {
          id: 'main',
          label: 'main',
          files: [
            {
              file: 'pages/index/index.js',
              type: 'chunk',
              from: 'main',
              modules: [
                {
                  id: 'src/pages/index.ts',
                  source: 'src/pages/index.ts',
                  sourceType: 'src',
                },
                {
                  id: '../../packages-runtime/wevu/dist/src.mjs',
                  source: '../../packages-runtime/wevu/dist/src.mjs',
                  sourceType: 'workspace',
                },
              ],
            },
          ],
        },
      ],
      modules: [],
      subPackages: [],
    } as any, {
      artifactRoot: '/project/apps/lab/dist',
      cwd: '/project/apps/lab',
      watch: true,
    })
    const middleware = server.middlewares.use.mock.calls[0]?.[0]

    const sourceResponse = createMockResponse()
    middleware(
      { url: '/__weapp_vite_file_content?kind=source&path=src/pages/index.ts' },
      sourceResponse,
      vi.fn(),
    )
    await sourceResponse.done
    expect(sourceResponse.statusCode).toBe(200)
    expect(JSON.parse(sourceResponse.body)).toMatchObject({
      kind: 'source',
      language: 'typescript',
      path: 'src/pages/index.ts',
      content: 'export const page = true\n',
    })

    const workspaceResponse = createMockResponse()
    middleware(
      { url: '/__weapp_vite_file_content?kind=source&path=../../packages-runtime/wevu/dist/src.mjs' },
      workspaceResponse,
      vi.fn(),
    )
    await workspaceResponse.done
    expect(workspaceResponse.statusCode).toBe(200)
    expect(JSON.parse(workspaceResponse.body)).toMatchObject({
      kind: 'source',
      language: 'javascript',
      path: '../../packages-runtime/wevu/dist/src.mjs',
      content: 'export const runtime = true\n',
    })

    const artifactResponse = createMockResponse()
    middleware(
      { url: '/__weapp_vite_file_content?kind=artifact&path=pages/index/index.js' },
      artifactResponse,
      vi.fn(),
    )
    await artifactResponse.done
    expect(artifactResponse.statusCode).toBe(200)
    expect(JSON.parse(artifactResponse.body)).toMatchObject({
      kind: 'artifact',
      language: 'javascript',
      path: 'pages/index/index.js',
      content: 'Page({})\n',
    })

    await handle?.close()
    server.httpServer?.emit('close')
    await handle?.waitForExit()
  })

  it('rejects dashboard file endpoint path traversal', async () => {
    const server = createMockServer()

    createServerMock.mockImplementation(async (options: any) => {
      for (const plugin of options.plugins ?? []) {
        plugin?.configureServer?.(server as any)
      }
      return server
    })

    const handle = await startAnalyzeDashboard(createAnalyzeResult('escape'), {
      artifactRoot: '/project/dist',
      cwd: '/project',
      watch: true,
    })
    const middleware = server.middlewares.use.mock.calls[0]?.[0]
    const response = createMockResponse()

    middleware(
      { url: '/__weapp_vite_file_content?kind=source&path=../secret.txt' },
      response,
      vi.fn(),
    )
    await response.done
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toMatchObject({
      error: 'invalid_request',
    })

    await handle?.close()
    server.httpServer?.emit('close')
    await handle?.waitForExit()
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
