import type { WeappMcpConfig } from '../types'
import type { GlobalCLIOptions } from './types'
import process from 'node:process'
import logger from '../logger'
import { resolveWeappMcpConfig, startWeappViteMcpServer } from '../mcp'
import { loadConfig } from './loadConfig'
import { resolveConfigFile } from './options'

const SKIP_COMMANDS = new Set([
  '--help',
  '--version',
  '-h',
  '-v',
  'help',
  'ide',
  'mcp',
])

let started = false

export function shouldAutoStartMcp(argv: string[]) {
  const command = argv[0]
  if (!command || command.startsWith('-')) {
    return true
  }
  return !SKIP_COMMANDS.has(command)
}

export function __resetAutoStartMcpStateForTest() {
  started = false
}

export async function maybeAutoStartMcpServer(argv: string[], cliOptions: GlobalCLIOptions) {
  if (started || !shouldAutoStartMcp(argv)) {
    return
  }

  const configFile = resolveConfigFile(cliOptions)
  let rawMcpConfig: unknown

  try {
    const loaded = await loadConfig(configFile)
    rawMcpConfig = loaded?.config?.weapp?.mcp
  }
  catch (error) {
    logger.warn(`[mcp] 读取配置失败，使用默认 MCP 配置自动启动：${error instanceof Error ? error.message : String(error)}`)
  }

  const maybeMcpConfig = rawMcpConfig as (boolean | WeappMcpConfig | undefined)
  const resolvedMcp = resolveWeappMcpConfig(maybeMcpConfig)
  if (!resolvedMcp.enabled || !resolvedMcp.autoStart) {
    return
  }

  try {
    await startWeappViteMcpServer({
      endpoint: resolvedMcp.endpoint,
      host: resolvedMcp.host,
      port: resolvedMcp.port,
      quiet: true,
      transport: 'streamable-http',
      unref: true,
      workspaceRoot: process.cwd(),
    })
    started = true
    logger.info(`[mcp] 已自动启动：http://${resolvedMcp.host}:${resolvedMcp.port}${resolvedMcp.endpoint}`)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/EADDRINUSE/.test(message)) {
      logger.info(`[mcp] 端口 ${resolvedMcp.port} 已被占用，跳过自动启动。`)
      started = true
      return
    }
    logger.warn(`[mcp] 自动启动失败：${message}`)
  }
}
