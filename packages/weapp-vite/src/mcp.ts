import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { CreateServerOptions } from '@weapp-vite/mcp'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WeappMcpConfig } from './types'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import process from 'node:process'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createWeappViteMcpServer, startStdioServer } from '@weapp-vite/mcp'
import logger from './logger'

export { createWeappViteMcpServer }
export type { CreateServerOptions }

export const DEFAULT_MCP_HOST = '127.0.0.1'
export const DEFAULT_MCP_PORT = 3088
export const DEFAULT_MCP_ENDPOINT = '/mcp'

export interface ResolvedWeappMcpConfig {
  enabled: boolean
  autoStart: boolean
  host: string
  port: number
  endpoint: string
}

export interface WeappViteMcpServerOptions extends CreateServerOptions {
  transport?: 'stdio' | 'streamable-http'
  host?: string
  port?: number
  endpoint?: string
  unref?: boolean
  quiet?: boolean
}

export interface WeappViteMcpServerHandle {
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

export function resolveWeappMcpConfig(config?: boolean | WeappMcpConfig): ResolvedWeappMcpConfig {
  if (config === false) {
    return {
      enabled: false,
      autoStart: false,
      host: DEFAULT_MCP_HOST,
      port: DEFAULT_MCP_PORT,
      endpoint: DEFAULT_MCP_ENDPOINT,
    }
  }

  const record = (typeof config === 'object' && config)
    ? config
    : {}

  return {
    enabled: record.enabled !== false,
    autoStart: record.autoStart !== false,
    host: typeof record.host === 'string' && record.host.trim().length > 0
      ? record.host.trim()
      : DEFAULT_MCP_HOST,
    port: normalizePort(record.port),
    endpoint: normalizeEndpoint(record.endpoint),
  }
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

async function startStreamableHttpServer(options: WeappViteMcpServerOptions): Promise<WeappViteMcpServerHandle> {
  const {
    endpoint = DEFAULT_MCP_ENDPOINT,
    host = DEFAULT_MCP_HOST,
    port = DEFAULT_MCP_PORT,
    workspaceRoot,
    unref = false,
    quiet = false,
  } = options
  const normalizedEndpoint = normalizeEndpoint(endpoint)
  const normalizedPort = normalizePort(port)
  const { server: mcpServer } = await createWeappViteMcpServer({ workspaceRoot })
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  await mcpServer.connect(transport)

  const httpServer = http.createServer(async (req, res) => {
    try {
      const hostHeader = req.headers.host ?? `${host}:${normalizedPort}`
      const url = new URL(req.url ?? '/', `http://${hostHeader}`)
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
    logger.info(`[mcp] streamable-http ready at http://${host}:${normalizedPort}${normalizedEndpoint}`)
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

export async function startWeappViteMcpServer(options?: WeappViteMcpServerOptions): Promise<WeappViteMcpServerHandle> {
  const transport = options?.transport ?? 'stdio'
  if (transport === 'streamable-http') {
    return startStreamableHttpServer(options ?? {})
  }

  if (!options?.workspaceRoot) {
    await startStdioServer()
    return {
      transport: 'stdio',
    }
  }

  const previousCwd = process.cwd()
  process.chdir(options.workspaceRoot)
  try {
    await startStdioServer()
    return {
      transport: 'stdio',
    }
  }
  finally {
    process.chdir(previousCwd)
  }
}
