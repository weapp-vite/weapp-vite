import type { CreateServerOptions, McpServerHandle, StartMcpServerOptions } from '@weapp-vite/mcp'
import type { WeappMcpConfig } from './types'
import {
  createWeappViteMcpServer,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_RUNTIME_REST_ENDPOINT,
  startWeappViteMcpServer as startMcpServer,
} from '@weapp-vite/mcp'
import { connectMiniProgram } from 'weapp-ide-cli'
import logger from './logger'

export {
  createWeappViteMcpServer,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_RUNTIME_REST_ENDPOINT,
}
export type { CreateServerOptions }

export interface ResolvedWeappMcpConfig {
  enabled: boolean
  autoStart: boolean
  host: string
  port: number
  endpoint: string
  restEndpoint: string | false
}

export interface WeappViteMcpServerOptions extends StartMcpServerOptions {}

export interface WeappViteMcpServerHandle extends McpServerHandle {}

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
      restEndpoint: DEFAULT_RUNTIME_REST_ENDPOINT,
    }
  }

  const record = (typeof config === 'object' && config)
    ? config
    : {}

  return {
    enabled: record.enabled !== false,
    autoStart: record.autoStart === true,
    host: typeof record.host === 'string' && record.host.trim().length > 0
      ? record.host.trim()
      : DEFAULT_MCP_HOST,
    port: normalizePort(record.port),
    endpoint: normalizeEndpoint(record.endpoint),
    restEndpoint: record.restEndpoint === false ? false : normalizeEndpoint(record.restEndpoint ?? DEFAULT_RUNTIME_REST_ENDPOINT),
  }
}

export async function startWeappViteMcpServer(options?: WeappViteMcpServerOptions): Promise<WeappViteMcpServerHandle> {
  return startMcpServer({
    runtimeHooks: {
      connectMiniProgram,
    },
    ...options,
    onReady: options?.onReady ?? ((message) => {
      logger.info(message)
    }),
  })
}
