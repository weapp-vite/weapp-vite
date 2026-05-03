import { Buffer } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type RuntimeModule = typeof import('@/runtime')
type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>
type CreateServer = typeof http.createServer

interface MockServerResponse {
  statusCode: number
  headersSent: boolean
  setHeader: (name: string, value: string) => void
  end: (chunk?: string | Uint8Array) => MockServerResponse
}

interface MockHttpServer {
  __handler: RequestHandler
  __errorListener?: (error: Error) => void
  listen: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  unref: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => {
  const transportInstances: any[] = []
  const mockConnect = vi.fn(async () => {})
  const mockMiniProgram = {
    callWxMethod: vi.fn(async () => ({ ok: true })),
    currentPage: vi.fn(async () => ({
      path: 'pages/index/index',
      query: { id: '1' },
      size: vi.fn(async () => ({ width: 390, height: 844 })),
      scrollTop: vi.fn(async () => 0),
      data: vi.fn(async () => ({ title: 'home' })),
      waitFor: vi.fn(async () => {}),
    })),
    navigateTo: vi.fn(async () => ({
      path: 'pages/detail/index',
      query: {},
      waitFor: vi.fn(async () => {}),
    })),
    pageStack: vi.fn(async () => [
      {
        path: 'pages/index/index',
        query: { id: '1' },
      },
    ]),
    screenshot: vi.fn(async () => Buffer.from('png').toString('base64')),
    systemInfo: vi.fn(async () => ({ platform: 'devtools' })),
  }
  const mockRuntimeManager = {
    clearLogs: vi.fn(),
    close: vi.fn(async () => {}),
    getLogs: vi.fn(() => [{ level: 'log', message: 'ready', timestamp: 1, raw: 'ready' }]),
    resolveProjectPath: vi.fn((projectPath: string) => path.resolve('/workspace', projectPath)),
    resolveWorkspacePath: vi.fn((filePath: string) => path.resolve('/workspace', filePath)),
    withMiniProgram: vi.fn(async (_connection: unknown, runner: (miniProgram: typeof mockMiniProgram) => Promise<unknown>) => await runner(mockMiniProgram)),
    withPage: vi.fn(async (_connection: unknown, runner: (page: Awaited<ReturnType<typeof mockMiniProgram.currentPage>>, miniProgram: typeof mockMiniProgram) => Promise<unknown>) => {
      const page = await mockMiniProgram.currentPage()
      return await runner(page, mockMiniProgram)
    }),
  }
  const mockCreateWeappViteMcpServer = vi.fn(async (_options?: unknown) => ({
    runtimeManager: mockRuntimeManager,
    server: {
      connect: mockConnect,
    },
  }))
  const httpServers: MockHttpServer[] = []
  const stdioInstances: any[] = []
  const mockHandleRequestImpl = vi.fn()

  class MockStreamableHTTPServerTransport {
    requests: Array<{ method?: string, url?: string, body: unknown }> = []
    close = vi.fn(async () => {})

    constructor(_options: unknown) {
      transportInstances.push(this)
    }

    async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, body: unknown) {
      this.requests.push({
        method: req.method,
        url: req.url,
        body,
      })
      const handleRequestImpl = mocks.mockHandleRequestImpl.getMockImplementation() as ((
        req: http.IncomingMessage,
        res: http.ServerResponse,
        body: unknown,
      ) => Promise<void>) | undefined
      if (handleRequestImpl) {
        await handleRequestImpl(req, res, body)
        return
      }
      res.statusCode = 204
      res.end()
    }
  }

  class MockStdioServerTransport {
    constructor() {
      stdioInstances.push(this)
    }
  }

  return {
    httpServers,
    mockConnect,
    mockCreateWeappViteMcpServer,
    mockHandleRequestImpl,
    mockMiniProgram,
    mockRuntimeManager,
    MockStdioServerTransport,
    MockStreamableHTTPServerTransport,
    stdioInstances,
    transportInstances,
  }
})

vi.mock('@/server', async () => {
  const actual = await vi.importActual<typeof import('@/server')>('@/server')
  return {
    ...actual,
    createWeappViteMcpServer: mocks.mockCreateWeappViteMcpServer,
  }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: mocks.MockStdioServerTransport,
  }
})

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  return {
    StreamableHTTPServerTransport: mocks.MockStreamableHTTPServerTransport,
  }
})

async function loadRuntimeModule(): Promise<RuntimeModule> {
  return import('@/runtime')
}

function createMockHttpServer(handler: RequestHandler): MockHttpServer {
  const server: MockHttpServer = {
    __handler: handler,
    listen: vi.fn((_port: number, _host: string, callback?: () => void) => {
      callback?.()
      return server
    }),
    once: vi.fn((event: string, callback: (error: Error) => void) => {
      if (event === 'error') {
        server.__errorListener = callback
      }
      return server
    }),
    unref: vi.fn(() => server),
    close: vi.fn((callback?: (error?: Error) => void) => {
      callback?.()
      return server
    }),
  }
  return server
}

function mockHttpCreateServer() {
  return vi.spyOn(http, 'createServer').mockImplementation(((handler?: RequestHandler) => {
    const server = createMockHttpServer(handler ?? (() => {}))
    mocks.httpServers.push(server)
    return server as unknown as http.Server
  }) as CreateServer)
}

async function dispatchHttpRequest(
  server: MockHttpServer,
  options: {
    method: string
    path: string
    body?: string
    headers?: Record<string, string>
  },
) {
  const chunks = options.body === undefined ? [] : [options.body]
  const req = Object.assign(
    Readable.from(chunks),
    {
      method: options.method,
      url: options.path,
      headers: options.headers ?? {},
    },
  ) as http.IncomingMessage

  let text = ''
  const responseHeaders = new Map<string, string>()
  const res: MockServerResponse = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string) {
      responseHeaders.set(name, value)
    },
    end(chunk?: string | Uint8Array) {
      if (chunk !== undefined) {
        text += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
      }
      this.headersSent = true
      return this
    },
  }

  await server.__handler(req, res as unknown as http.ServerResponse)

  return {
    statusCode: res.statusCode,
    text,
    headers: Object.fromEntries(responseHeaders),
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  mocks.httpServers.length = 0
  mocks.stdioInstances.length = 0
  mocks.transportInstances.length = 0
  mocks.mockConnect.mockReset()
  mocks.mockHandleRequestImpl.mockReset()
  mocks.mockMiniProgram.callWxMethod.mockClear()
  mocks.mockMiniProgram.currentPage.mockClear()
  mocks.mockMiniProgram.navigateTo.mockClear()
  mocks.mockMiniProgram.pageStack.mockClear()
  mocks.mockMiniProgram.screenshot.mockClear()
  mocks.mockMiniProgram.systemInfo.mockClear()
  mocks.mockRuntimeManager.clearLogs.mockClear()
  mocks.mockRuntimeManager.close.mockClear()
  mocks.mockRuntimeManager.getLogs.mockClear()
  mocks.mockRuntimeManager.resolveProjectPath.mockClear()
  mocks.mockRuntimeManager.resolveWorkspacePath.mockClear()
  mocks.mockRuntimeManager.withMiniProgram.mockClear()
  mocks.mockRuntimeManager.withPage.mockClear()
  mocks.mockCreateWeappViteMcpServer.mockReset()
  mocks.mockCreateWeappViteMcpServer.mockResolvedValue({
    runtimeManager: mocks.mockRuntimeManager,
    server: {
      connect: mocks.mockConnect,
    },
  })
})

describe('startStdioServer', () => {
  it('starts stdio transport directly when workspaceRoot is not provided', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const handle = await startWeappViteMcpServer()

    expect(handle).toEqual({
      transport: 'stdio',
    })
    expect(mocks.mockCreateWeappViteMcpServer).toHaveBeenCalledWith(undefined)
    expect(mocks.mockConnect).toHaveBeenCalledTimes(1)
    expect(mocks.stdioInstances).toHaveLength(1)
  })

  it('switches cwd for stdio transport when workspaceRoot is provided', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-mcp-'))
    const previousCwd = process.cwd()
    try {
      const handle = await startWeappViteMcpServer({
        workspaceRoot,
      })

      expect(handle).toEqual({
        transport: 'stdio',
      })
      expect(mocks.mockCreateWeappViteMcpServer).toHaveBeenCalledWith({
        workspaceRoot,
      })
      expect(process.cwd()).toBe(previousCwd)
    }
    finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('restores cwd when stdio startup fails', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-mcp-error-'))
    const previousCwd = process.cwd()
    mocks.mockCreateWeappViteMcpServer.mockRejectedValueOnce(new Error('stdio boom'))

    try {
      await expect(startWeappViteMcpServer({
        workspaceRoot,
      })).rejects.toThrow('stdio boom')
      expect(process.cwd()).toBe(previousCwd)
    }
    finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
})

describe('startStreamableHttpServer', () => {
  it('starts streamable http transport and handles request paths', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const port = 3188
    const createServerSpy = mockHttpCreateServer()

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: 'my-mcp',
      quiet: true,
      unref: true,
      runtimeHooks: {
        connectMiniProgram: async () => null as never,
      },
    })

    expect(handle.transport).toBe('streamable-http')
    expect(mocks.mockCreateWeappViteMcpServer).toHaveBeenCalledWith({
      runtimeHooks: {
        connectMiniProgram: expect.any(Function),
      },
      workspaceRoot: undefined,
    })
    expect(mocks.mockConnect).toHaveBeenCalledTimes(1)
    expect(createServerSpy).toHaveBeenCalledTimes(1)

    const httpServer = mocks.httpServers[0]!
    expect(httpServer.listen).toHaveBeenCalledWith(port, '127.0.0.1', expect.any(Function))
    expect(httpServer.unref).toHaveBeenCalledTimes(1)

    const notFound = await dispatchHttpRequest(httpServer, {
      method: 'GET',
      path: '/missing',
    })
    expect(notFound.statusCode).toBe(404)
    expect(JSON.parse(notFound.text).error.code).toBe(-32004)

    const methodNotAllowed = await dispatchHttpRequest(httpServer, {
      method: 'PUT',
      path: '/my-mcp',
    })
    expect(methodNotAllowed.statusCode).toBe(405)
    expect(JSON.parse(methodNotAllowed.text).error.code).toBe(-32005)

    const invalidJson = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/my-mcp',
      body: '{',
    })
    expect(invalidJson.statusCode).toBe(500)
    expect(JSON.parse(invalidJson.text).error.code).toBe(-32603)

    const ok = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/my-mcp',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    })
    expect(ok.statusCode).toBe(204)

    const transport = mocks.transportInstances[0]
    expect(transport.requests.length).toBeGreaterThan(0)
    expect(transport.requests.at(-1)?.body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })

    await handle.close?.()
    expect(transport.close).toHaveBeenCalledTimes(1)
    expect(httpServer.close).toHaveBeenCalledTimes(1)
  })

  it('handles GET and empty-body POST requests on the mcp endpoint and logs by default', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const port = 4088
    const onReady = vi.fn()
    mockHttpCreateServer()

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: '/mcp',
      onReady,
    })
    const httpServer = mocks.httpServers.at(-1)!

    const getResponse = await dispatchHttpRequest(httpServer, {
      method: 'GET',
      path: '/mcp',
    })
    expect(getResponse.statusCode).toBe(204)

    const emptyPost = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/mcp',
    })
    expect(emptyPost.statusCode).toBe(204)

    const blankJson = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/mcp',
      body: '   ',
    })
    expect(blankJson.statusCode).toBe(204)

    const transport = mocks.transportInstances.at(-1)
    expect(transport.requests.at(0)?.body).toBeUndefined()
    expect(transport.requests.at(1)?.body).toBeUndefined()
    expect(transport.requests.at(2)?.body).toBeUndefined()
    expect(onReady).toHaveBeenCalledWith(`[mcp] streamable-http ready at http://127.0.0.1:${port}/mcp`)
    expect(onReady).toHaveBeenCalledWith(`[mcp] REST runtime ready at http://127.0.0.1:${port}/api/weapp/devtools`)

    await handle.close?.()
  })

  it('serves DevTools runtime REST routes beside the mcp endpoint', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const port = 7088
    mockHttpCreateServer()

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      quiet: true,
      restEndpoint: '/api/runtime',
    })
    const httpServer = mocks.httpServers.at(-1)!

    const root = await dispatchHttpRequest(httpServer, {
      method: 'GET',
      path: '/api/runtime',
    })
    expect(root.statusCode).toBe(200)
    expect(JSON.parse(root.text).result.routes).toContain('POST /capture')

    const connect = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/api/runtime/connect',
      body: JSON.stringify({
        projectPath: 'apps/demo',
      }),
    })
    expect(connect.statusCode).toBe(200)
    expect(JSON.parse(connect.text).result).toMatchObject({
      connected: true,
      currentPage: {
        path: 'pages/index/index',
      },
    })

    const route = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/api/runtime/route',
      body: JSON.stringify({
        projectPath: 'apps/demo',
        path: 'pages/detail/index',
      }),
    })
    expect(route.statusCode).toBe(200)
    expect(JSON.parse(route.text).result).toMatchObject({
      transition: 'navigateTo',
      url: '/pages/detail/index',
    })
    expect(mocks.mockMiniProgram.navigateTo).toHaveBeenCalledWith('/pages/detail/index')

    const capture = await dispatchHttpRequest(httpServer, {
      method: 'POST',
      path: '/api/runtime/capture',
      body: JSON.stringify({
        projectPath: 'apps/demo',
      }),
    })
    expect(capture.statusCode).toBe(200)
    expect(JSON.parse(capture.text).result).toMatchObject({
      base64: Buffer.from('png').toString('base64'),
      bytes: 3,
    })

    await handle.close?.()
  })

  it('can disable DevTools runtime REST routes', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    mockHttpCreateServer()

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      quiet: true,
      restEndpoint: false,
    })
    const httpServer = mocks.httpServers.at(-1)!

    const response = await dispatchHttpRequest(httpServer, {
      method: 'GET',
      path: '/api/weapp/devtools',
    })
    expect(response.statusCode).toBe(404)

    await handle.close?.()
  })

  it('does not rewrite response when transport throws after headers are sent', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const port = 5088
    mocks.mockHandleRequestImpl.mockImplementationOnce(async (_req: http.IncomingMessage, res: http.ServerResponse) => {
      res.statusCode = 204
      res.end()
      throw new Error('late boom')
    })
    mockHttpCreateServer()

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: '/mcp',
      quiet: true,
    })
    const httpServer = mocks.httpServers.at(-1)!

    const response = await dispatchHttpRequest(httpServer, {
      method: 'GET',
      path: '/mcp',
    })
    expect(response.statusCode).toBe(204)
    expect(response.text).toBe('')

    await handle.close?.()
  })

  it('rejects close when the underlying http server close callback returns an error', async () => {
    const { startWeappViteMcpServer } = await loadRuntimeModule()
    const port = 6088
    vi.spyOn(http, 'createServer').mockImplementation((((handler?: RequestHandler) => {
      const server = createMockHttpServer(handler ?? (() => {}))
      server.close.mockImplementation((callback?: (error?: Error) => void) => {
        callback?.(new Error('close boom'))
        return server
      })
      mocks.httpServers.push(server)
      return server as unknown as http.Server
    }) as CreateServer))

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: '/mcp',
      quiet: true,
    })

    await expect(handle.close?.()).rejects.toThrow('close boom')
  })
})
