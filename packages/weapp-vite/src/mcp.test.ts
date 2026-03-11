import { mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import logger from './logger'
import {
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_PORT,
  resolveWeappMcpConfig,
  startWeappViteMcpServer,
} from './mcp'

const mocks = vi.hoisted(() => {
  const transportInstances: any[] = []
  const mockStartStdioServer = vi.fn(async () => {})
  const mockConnect = vi.fn(async () => {})
  const mockHandleRequestImpl = vi.fn<[
    http.IncomingMessage,
    http.ServerResponse,
    unknown,
  ], Promise<void>>()
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

function requestHttp(options: {
  port: number
  path: string
  method: string
  body?: string
}) {
  return new Promise<{ statusCode: number, text: string }>((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: options.port,
      path: options.path,
      method: options.method,
      headers: options.body
        ? { 'content-type': 'application/json' }
        : undefined,
    }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => text += chunk)
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          text,
        })
      })
    })
    req.on('error', reject)
    if (options.body !== undefined) {
      req.write(options.body)
    }
    req.end()
  })
}

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve free port'))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

beforeEach(() => {
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
  it('disables mcp when config is false', () => {
    const resolved = resolveWeappMcpConfig(false)

    expect(resolved.enabled).toBe(false)
    expect(resolved.autoStart).toBe(false)
  })

  it('uses defaults when config is omitted', () => {
    const resolved = resolveWeappMcpConfig(undefined)

    expect(resolved.enabled).toBe(true)
    expect(resolved.autoStart).toBe(false)
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
    expect(resolved.endpoint).toBe(DEFAULT_MCP_ENDPOINT)
  })

  it('normalizes endpoint, host, and port', () => {
    const resolved = resolveWeappMcpConfig({
      endpoint: ' my-mcp ',
      host: ' 0.0.0.0 ',
      port: -1,
    })

    expect(resolved.endpoint).toBe('/my-mcp')
    expect(resolved.host).toBe('0.0.0.0')
    expect(resolved.port).toBe(DEFAULT_MCP_PORT)
  })

  it('falls back to defaults for empty host and invalid endpoint/port values', () => {
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
    const handle = await startWeappViteMcpServer()

    expect(handle).toEqual({
      transport: 'stdio',
    })
    expect(mocks.mockStartStdioServer).toHaveBeenCalledTimes(1)
    expect(mocks.mockCreateWeappViteMcpServer).not.toHaveBeenCalled()
  })

  it('switches cwd for stdio transport when workspaceRoot is provided', async () => {
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
    const port = await getFreePort()
    const unrefSpy = vi.spyOn(http.Server.prototype, 'unref')

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
    expect(unrefSpy).toHaveBeenCalled()

    const notFound = await requestHttp({
      method: 'GET',
      path: '/missing',
      port,
    })
    expect(notFound.statusCode).toBe(404)
    expect(JSON.parse(notFound.text).error.code).toBe(-32004)

    const methodNotAllowed = await requestHttp({
      method: 'PUT',
      path: '/my-mcp',
      port,
    })
    expect(methodNotAllowed.statusCode).toBe(405)
    expect(JSON.parse(methodNotAllowed.text).error.code).toBe(-32005)

    const invalidJson = await requestHttp({
      method: 'POST',
      path: '/my-mcp',
      port,
      body: '{',
    })
    expect(invalidJson.statusCode).toBe(500)
    expect(JSON.parse(invalidJson.text).error.code).toBe(-32603)

    const ok = await requestHttp({
      method: 'POST',
      path: '/my-mcp',
      port,
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
    unrefSpy.mockRestore()
  })

  it('handles GET and empty-body POST requests on the mcp endpoint and logs by default', async () => {
    const port = await getFreePort()
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {})

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: '/mcp',
    })

    const getResponse = await requestHttp({
      method: 'GET',
      path: '/mcp',
      port,
    })
    expect(getResponse.statusCode).toBe(204)

    const emptyPost = await requestHttp({
      method: 'POST',
      path: '/mcp',
      port,
    })
    expect(emptyPost.statusCode).toBe(204)

    const blankJson = await requestHttp({
      method: 'POST',
      path: '/mcp',
      port,
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
    const port = await getFreePort()
    mocks.mockHandleRequestImpl.mockImplementationOnce(async (_req, res) => {
      res.statusCode = 204
      res.end()
      throw new Error('late boom')
    })

    const handle = await startWeappViteMcpServer({
      transport: 'streamable-http',
      host: '127.0.0.1',
      port,
      endpoint: '/mcp',
      quiet: true,
    })

    const response = await requestHttp({
      method: 'GET',
      path: '/mcp',
      port,
    })
    expect(response.statusCode).toBe(204)
    expect(response.text).toBe('')

    await handle.close?.()
  })

  it('rejects close when the underlying http server close callback returns an error', async () => {
    const port = await getFreePort()
    const originalClose = http.Server.prototype.close
    const closeSpy = vi.spyOn(http.Server.prototype, 'close').mockImplementation(function (this: http.Server, callback?: (err?: Error) => void) {
      originalClose.call(this, () => {})
      callback?.(new Error('close boom'))
      return this
    })

    try {
      const handle = await startWeappViteMcpServer({
        transport: 'streamable-http',
        host: '127.0.0.1',
        port,
        endpoint: '/mcp',
        quiet: true,
      })

      await expect(handle.close?.()).rejects.toThrow('close boom')
    }
    finally {
      closeSpy.mockRestore()
    }
  })
})
