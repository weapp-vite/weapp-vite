import type { CreateServerOptions, McpServerHandle, StartMcpServerOptions } from '@weapp-vite/mcp'
import type { WeappMcpConfig } from './types'
import process from 'node:process'
import {
  createWeappViteMcpServer,
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_RUNTIME_REST_ENDPOINT,
  startWeappViteMcpServer as startMcpServer,
} from '@weapp-vite/mcp'
import { connectMiniProgram } from 'weapp-ide-cli'
import { resolveAiDevelopmentEnvironmentFromEnv, resolveBooleanLikeEnv } from './aiEnvironment'
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
  agentName?: string
  enabled: boolean
  autoStart: boolean
  host: string
  port: number
  endpoint: string
  restEndpoint: string | false
}

export interface WeappViteMcpServerOptions extends StartMcpServerOptions {}

export interface WeappViteMcpServerHandle extends McpServerHandle {}

export interface ResolveWeappMcpConfigOptions {
  agentName?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  isAgent?: boolean
}

function normalizeEndpoint(input: unknown) {
  const value = typeof input === 'string' ? input.trim() : ''
  if (!value) {
    return DEFAULT_MCP_ENDPOINT
  }
  return value.startsWith('/') ? value : `/${value}`
}

export function resolveProjectMcpPort(projectRoot = process.cwd()) {
  let hash = 0
  for (const char of projectRoot) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return DEFAULT_MCP_PORT + (hash % 20_000)
}

function normalizePort(input: unknown, cwd?: string) {
  if (input === undefined || input === 'auto') {
    return resolveProjectMcpPort(cwd)
  }
  if (typeof input === 'number' && Number.isInteger(input) && input > 0 && input <= 65535) {
    return input
  }
  return DEFAULT_MCP_PORT
}

function resolveAutoStart(
  input: unknown,
  options: Pick<ResolveWeappMcpConfigOptions, 'env' | 'isAgent'>,
) {
  const env = options.env ?? process.env
  const envOverride = resolveBooleanLikeEnv(env.WEAPP_VITE_MCP)
  const value = envOverride ?? input ?? 'ai'
  if (value === 'ai') {
    return options.isAgent ?? resolveAiDevelopmentEnvironmentFromEnv(env).isAgent
  }
  return value === true
}

export function resolveWeappMcpConfig(
  config?: boolean | WeappMcpConfig,
  options: ResolveWeappMcpConfigOptions = {},
): ResolvedWeappMcpConfig {
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
    agentName: options.agentName,
    enabled: record.enabled !== false,
    autoStart: resolveAutoStart(record.autoStart, options),
    host: typeof record.host === 'string' && record.host.trim().length > 0
      ? record.host.trim()
      : DEFAULT_MCP_HOST,
    port: normalizePort(record.port, options.cwd),
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
