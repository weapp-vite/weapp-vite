import { mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type McpModule = typeof import('./mcp')
type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>

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
  const mockStartStdioServer = vi.fn(async () => {})
  const mockConnect = vi.fn(async () => {})
  const mockHandleRequestImpl = vi.fn<[
    http.IncomingMessage,
    http.ServerResponse,
    unknown,
  ], Promise<void>>()
  const httpServers: MockHttpServer[] = []
  const mockCreateWeappViteMcpServer = vi.fn(async () => ({
    server: {
      connect: mockConnect,
    },
  }))

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
      if (mocks.mockHandleRequestImpl.mock.calls.length > 0 || mocks.mockHandleRequestImpl.getMockImplementation()) {
        await mocks.mockHandleRequestImpl(req, res, body)
        return
      }
      res.statusCode = 204
      res.end()
    }
  }

  return {
    httpServers,
    transportInstances,
    mockStartStdioServer,
    mockConnect,
    mockHandleRequestImpl,
    mockCreateWeappViteMcpServer,
    MockStreamableHTTPServerTransport,
  }
})

vi.mock('@weapp-vite/mcp', () => {
  return {
    createWeappViteMcpServer: mocks.mockCreateWeappViteMcpServer,
    startStdioServer: mocks.mockStartStdioServer,
  }
})

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  return {
    StreamableHTTPServerTransport: mocks.MockStreamableHTTPServerTransport,
  }
})

async function loadMcpModule(): Promise<McpModule> {
  return await import('./mcp')
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
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string) {
      responseHeaders.set(name, value)
    },
    end(chunk?: string | Uint8Array) {
      if (chunk !== undefined) {
        text += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      }
      this.headersSent = true
      return this
    },
  } as unknown as http.ServerResponse

  await server.__handler(req, res)

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
  mocks.transportInstances.length = 0
  mocks.mockStartStdioServer.mockReset()
  mocks.mockConnect.mockReset()
  mocks.mockHandleRequestImpl.mockReset()
  mocks.mockCreateWeappViteMcpServer.mockReset()
  mocks.mockCreateWeappViteMcpServer.mockResolvedValue({
    server: {
      connect: mocks.mockConnect,
    },
  })
})

describe('weapp mcp config', () => {
  it('disables mcp when config is false', async () => {
    const { resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig(false)

    expect(resolved.enabled).toBe(false)
    expect(resolved.autoStart).toBe(false)
  })

  it('uses defaults when config is omitted', async () => {
    const { DEFAULT_MCP_ENDPOINT, DEFAULT_MCP_PORT, resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig(undefined)

    expect(resolved.enabled).toBe(true)
    expect(resolved.autoStart).toBe(false)
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
    expect(resolved.endpoint).toBe(DEFAULT_MCP_ENDPOINT)
  })

  it('normalizes endpoint, host, and port', async () => {
    const { DEFAULT_MCP_PORT, resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig({
      endpoint: ' my-mcp ',
      host: ' 0.0.0.0 ',
      port: -1,
    })

    expect(resolved.endpoint).toBe('/my-mcp')
    expect(resolved.host).toBe('0.0.0.0')
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
  })

  it('falls back to defaults for empty host and invalid endpoint/port values', async () => {
    const { DEFAULT_MCP_ENDPOINT, DEFAULT_MCP_PORT, resolveWeappMcpConfig } = await loadMcpModule()
    const resolved = resolveWeappMcpConfig({
      endpoint: '   ',
      host: '   ',
      port: 65536,
    })

    expect(resolved.endpoint).toBe(DEFAULT_MCP_ENDPOINT)
    expect(resolved.host).toBe('127.0.0.1')
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
  })
})

describe('startWeappViteMcpServer', () => {
  it('starts stdio transport directly when workspaceRoot is not provided', async () => {
    const { startWeappViteMcpServer } = await loadMcpModule()
    const handle = await startWeappViteMcpServer()

    expect(handle).toEqual({
      transport: 'stdio',
    })
    expect(mocks.mockStartStdioServer).toHaveBeenCalledTimes(1)
    expect(mocks.mockCreateWeappViteMcpServer).not.toHaveBeenCalled()
  })

  it('switches cwd for stdio transport when workspaceRoot is provided', async () => {
    const { startWeappViteMcpServer } = await loadMcpModule()
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-mcp-'))
    const previousCwd = process.cwd()
    try {
      const handle = await startWeappViteMcpServer({
        workspaceRoot,
      })

      expect(handle).toEqual({
        transport: 'stdio',
      })
      expect(mocks.mockStartStdioServer).toHaveBeenCalledTimes(1)
      expect(process.cwd()).toBe(previousCwd)
    }
    finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('restores cwd when stdio startup fails', async () => {
    const { startWeappViteMcpServer } = await loadMcpModule()
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-mcp-error-'))
    const previousCwd = process.cwd()
    mocks.mockStartStdioServer.mockRejectedValueOnce(new Error('stdio boom'))

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

  it('starts streamable http transport and handles request paths', async () => {
    const { startWeappViteMcpServer } = await loadMcpModule()
    const port = 3188
    const createServerSpy = vi.spyOn(http, 'createServer').mockImplementation((handler) => {
      const server = createMockHttpServer(handler)
      mocks.httpServers.push(server)
      return server as unknown as http.Server
    })

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: 'my-mcp',
      quiet: true,
      unref: true,
    })

    expect(handle.transport).toBe('streamable-http')
    expect(mocks.mockCreateWeappViteMcpServer).toHaveBeenCalledWith({
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
    const { startWeappViteMcpServer } = await loadMcpModule()
    const { default: logger } = await import('./logger')
    const port = 4088
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})
    vi.spyOn(http, 'createServer').mockImplementation((handler) => {
      const server = createMockHttpServer(handler)
      mocks.httpServers.push(server)
      return server as unknown as http.Server
    })

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: '/mcp',
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
    expect(infoSpy).toHaveBeenCalledWith(`[mcp] streamable-http ready at http://127.0.0.1:${port}/mcp`)

    await handle.close?.()
    infoSpy.mockRestore()
  })

  it('does not rewrite response when transport throws after headers are sent', async () => {
    const { startWeappViteMcpServer } = await loadMcpModule()
    const port = 5088
    mocks.mockHandleRequestImpl.mockImplementationOnce(async (_req, res) => {
      res.statusCode = 204
      res.end()
      throw new Error('late boom')
    })
    vi.spyOn(http, 'createServer').mockImplementation((handler) => {
      const server = createMockHttpServer(handler)
      mocks.httpServers.push(server)
      return server as unknown as http.Server
    })

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
    const { startWeappViteMcpServer } = await loadMcpModule()
    const port = 6088
    vi.spyOn(http, 'createServer').mockImplementation((handler) => {
      const server = createMockHttpServer(handler)
      server.close.mockImplementation((callback?: (error?: Error) => void) => {
        callback?.(new Error('close boom'))
        return server
      })
      mocks.httpServers.push(server)
      return server as unknown as http.Server
    })

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
