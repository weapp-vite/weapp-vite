import type { createWeappViteMcpServer as createMcpServer, CreateServerOptions, McpServerHandle, StartMcpServerOptions } from '@weapp-vite/mcp'
import type { WeappMcpConfig } from './types'
import process from 'node:process'
import {
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_RUNTIME_REST_ENDPOINT,
} from '@weapp-core/constants'
import { resolveAiDevelopmentEnvironmentFromEnv, resolveBooleanLikeEnv } from './aiEnvironment'
import logger from './logger'

export {
  DEFAULT_MCP_ENDPOINT,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
  DEFAULT_RUNTIME_REST_ENDPOINT,
}
export type { CreateServerOptions }

/** 创建服务时才加载 MCP 运行时；配置解析与公开常量保持同步。 */
export async function createWeappViteMcpServer(options?: CreateServerOptions): ReturnType<typeof createMcpServer> {
  const { createWeappViteMcpServer } = await import('@weapp-vite/mcp')
  return createWeappViteMcpServer(options)
}

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
  const [{ startWeappViteMcpServer: startMcpServer }, { connectMiniProgram, prepareAcceptanceProject, resolveAutomatorSessionOptions }] = await Promise.all([
    import('@weapp-vite/mcp'),
    import('weapp-ide-cli'),
  ])
  return startMcpServer({
    runtimeHooks: {
      connectMiniProgram,
      resolveSessionOptions: resolveAutomatorSessionOptions,
      prepareProject: prepareAcceptanceProject,
    },
    ...options,
    onReady: options?.onReady ?? ((message) => {
      logger.info(message)
    }),
  })
}
