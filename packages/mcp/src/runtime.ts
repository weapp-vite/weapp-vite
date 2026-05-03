import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CreateServerOptions } from './server'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import process from 'node:process'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createWeappViteMcpServer } from './server'
import { DEFAULT_RUNTIME_REST_ENDPOINT, handleRuntimeRestRequest, normalizeRuntimeRestEndpoint } from './server/runtime/rest'

export { DEFAULT_RUNTIME_REST_ENDPOINT }

export const DEFAULT_MCP_HOST = '127.0.0.1'
export const DEFAULT_MCP_PORT = 3088
export const DEFAULT_MCP_ENDPOINT = '/mcp'

export interface StartMcpServerOptions extends CreateServerOptions {
  transport?: 'stdio' | 'streamable-http'
  host?: string
  port?: number
  endpoint?: string
  restEndpoint?: string | false
  unref?: boolean
  quiet?: boolean
  onReady?: (message: string) => void
}

export interface McpServerHandle {
  transport: 'stdio' | 'streamable-http'
  close?: () => Promise<void>
}

function normalizeEndpoint(input: unknown) {
  const value = typeof input === 'string' ? input.trim() : ''
  if (!value) {
    return DEFAULT_MCP_ENDPOINT
  }
  return value.startsWith('/') ? value : `/${value}`
}

function normalizePort(input: unknown) {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0 && input <= 65535) {
    return input
  }
  return DEFAULT_MCP_PORT
}

async function parseJsonBody(req: IncomingMessage) {
  if (req.method !== 'POST') {
    return undefined
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) {
    return undefined
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return undefined
  }
  return JSON.parse(raw) as JSONRPCMessage | JSONRPCMessage[]
}

function writeJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  if (res.headersSent) {
    return
  }
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

export async function startStdioServer(options?: CreateServerOptions) {
  const previousCwd = process.cwd()
  if (options?.workspaceRoot) {
    process.chdir(options.workspaceRoot)
  }

  try {
    const { server } = await createWeappViteMcpServer(options)
    const transport = new StdioServerTransport()
    await server.connect(transport)
  }
  finally {
    if (options?.workspaceRoot) {
      process.chdir(previousCwd)
    }
  }
}

async function startStreamableHttpServer(options: StartMcpServerOptions): Promise<McpServerHandle> {
  const {
    endpoint = DEFAULT_MCP_ENDPOINT,
    host = DEFAULT_MCP_HOST,
    port = DEFAULT_MCP_PORT,
    restEndpoint = DEFAULT_RUNTIME_REST_ENDPOINT,
    workspaceRoot,
    runtimeHooks,
    unref = false,
    quiet = false,
    onReady,
  } = options
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  const normalizedPort = normalizePort(port)
  const normalizedRestEndpoint = normalizeRuntimeRestEndpoint(restEndpoint)
  const { runtimeManager, server: mcpServer } = await createWeappViteMcpServer({ runtimeHooks, workspaceRoot })
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  await mcpServer.connect(transport)

  const httpServer = http.createServer(async (req, res) => {
    try {
      const hostHeader = req.headers.host ?? `${host}:${normalizedPort}`
      const url = new URL(req.url ?? '/', `http://${hostHeader}`)
      const handledByRest = await handleRuntimeRestRequest(req, res, {
        endpoint: normalizedRestEndpoint,
        manager: runtimeManager,
      })
      if (handledByRest) {
        return
      }

      if (url.pathname !== normalizedEndpoint) {
        writeJson(res, 404, {
          jsonrpc: '2.0',
          error: {
            code: -32004,
            message: `Not Found: ${url.pathname}`,
          },
          id: null,
        })
        return
      }

      const method = req.method ?? 'GET'
      if (!['GET', 'POST', 'DELETE'].includes(method)) {
        writeJson(res, 405, {
          jsonrpc: '2.0',
          error: {
            code: -32005,
            message: `Method Not Allowed: ${method}`,
          },
          id: null,
        })
        return
      }

      const body = await parseJsonBody(req)
      await transport.handleRequest(req, res, body)
    }
    catch (error) {
      writeJson(res, 500, {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
        id: null,
      })
    }
  })

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(normalizedPort, host, () => {
      resolve()
    })
  })

  if (unref) {
    httpServer.unref()
  }

  if (!quiet) {
    onReady?.(`[mcp] streamable-http ready at http://${host}:${normalizedPort}${normalizedEndpoint}`)
    if (normalizedRestEndpoint !== false) {
      onReady?.(`[mcp] REST runtime ready at http://${host}:${normalizedPort}${normalizedRestEndpoint}`)
    }
  }

  return {
    transport: 'streamable-http',
    close: async () => {
      await transport.close()
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  }
}

export async function startWeappViteMcpServer(options?: StartMcpServerOptions): Promise<McpServerHandle> {
  const transport = options?.transport ?? 'stdio'
  if (transport === 'streamable-http') {
    return startStreamableHttpServer(options ?? {})
  }

  await startStdioServer(options)
  return {
    transport: 'stdio',
  }
}
