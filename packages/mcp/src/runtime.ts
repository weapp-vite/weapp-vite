import type { ServerResponse } from 'node:http'
import type { CreateServerOptions } from './server'
import http from 'node:http'
import process from 'node:process'
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createWeappViteMcpServerFactory } from './server'
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

function writeJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  if (res.headersSent) {
    return
  }
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

export async function startStdioServer(options?: CreateServerOptions): Promise<McpServerHandle> {
  const previousCwd = process.cwd()
  if (options?.workspaceRoot) {
    process.chdir(options.workspaceRoot)
  }

  try {
    const factory = await createWeappViteMcpServerFactory(options)
    const handle = serveStdio(() => factory.createServer())
    return {
      transport: 'stdio',
      close: async () => {
        await handle.close()
      },
    }
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
  const factory = await createWeappViteMcpServerFactory({ runtimeHooks, workspaceRoot })
  const mcpHandler = createMcpHandler(() => factory.createServer(), {
    legacy: 'stateless',
  })
  const nodeHandler = toNodeHandler(mcpHandler)
  const isLoopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)
  const validateHost = isLoopback ? localhostHostValidation() : hostHeaderValidation([host])
  const validateOrigin = isLoopback ? localhostOriginValidation() : originValidation([host])

  const httpServer = http.createServer(async (req, res) => {
    try {
      if (!validateHost(req, res) || !validateOrigin(req, res)) {
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const handledByRest = await handleRuntimeRestRequest(req, res, {
        endpoint: normalizedRestEndpoint,
        manager: factory.runtimeManager,
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

      await nodeHandler(req, res)
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
      await mcpHandler.close()
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

  return await startStdioServer(options)
}
