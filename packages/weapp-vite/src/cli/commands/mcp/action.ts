import type { GlobalCLIOptions } from '../../types'
import type { McpCommandOptions } from './types'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import path from 'pathe'
import { runWithSuspendedSharedInput } from 'weapp-ide-cli'
import logger from '../../../logger'
import { resolveWeappMcpConfig, startWeappViteMcpServer } from '../../../mcp'
import {
  buildMcpClientConfigPlan,
  formatMcpQuickStart,
  inspectMcpClientConfig,
  resolveSupportedMcpClient,
  writeMcpClientConfig,
} from '../../mcpClient'

import { resolveConfigFile } from '../../options'

function resolvePort(port: McpCommandOptions['port']) {
  if (typeof port === 'number' && Number.isInteger(port)) {
    return port
  }
  if (typeof port === 'string' && port.trim()) {
    const parsed = Number.parseInt(port, 10)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }
}

async function resolveHttpUrl(options: Pick<McpCommandOptions, 'c' | 'config' | 'url' | 'workspaceRoot'>) {
  if (options.url?.trim()) {
    return options.url.trim()
  }

  const workspaceRoot = options.workspaceRoot ? path.resolve(options.workspaceRoot) : process.cwd()
  const originalCwd = process.cwd()

  try {
    if (workspaceRoot !== originalCwd) {
      process.chdir(workspaceRoot)
    }

    const configFile = resolveConfigFile(options as GlobalCLIOptions)
    const { loadConfig } = await import('../../loadConfig')
    const loaded = await loadConfig(configFile)
    const resolved = resolveWeappMcpConfig(loaded?.config?.weapp?.mcp)
    return `http://${resolved.host}:${resolved.port}${resolved.endpoint}`
  }
  catch {
    const resolved = resolveWeappMcpConfig(undefined)
    return `http://${resolved.host}:${resolved.port}${resolved.endpoint}`
  }
  finally {
    if (process.cwd() !== originalCwd) {
      process.chdir(originalCwd)
    }
  }
}

async function confirmWrite() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false
  }

  return await runWithSuspendedSharedInput(async () => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    try {
      const answer = await rl.question('是否写入配置文件？(Y/n) ')
      const normalized = answer.trim().toLowerCase()
      return normalized === '' || normalized === 'y' || normalized === 'yes'
    }
    finally {
      rl.close()
    }
  })
}

function resolveClientTransport(transport?: McpCommandOptions['transport']) {
  return transport === 'http' ? 'http' : 'command'
}

async function handlePrint(clientName: string, options: McpCommandOptions, write = false) {
  const client = resolveSupportedMcpClient(clientName)
  const workspaceRoot = options.workspaceRoot ?? process.cwd()
  const transport = resolveClientTransport(options.transport)
  const httpUrl = transport === 'http'
    ? await resolveHttpUrl(options)
    : undefined
  const plan = buildMcpClientConfigPlan({
    client,
    transport,
    url: httpUrl,
    workspaceRoot,
  })

  logger.info(`${plan.target.displayName} 配置文件：${plan.target.configPath}`)
  logger.info(`服务器名称：${plan.target.serverName}`)
  process.stdout.write(`${plan.preview}\n`)

  if (!write) {
    return
  }

  if (options.yes || await confirmWrite()) {
    await writeMcpClientConfig(plan)
    logger.success(`已写入 ${plan.target.displayName} MCP 配置。`)
    logger.info(`请重启 ${plan.target.displayName}，然后执行：wv mcp doctor ${client}`)
    return
  }

  logger.info('已取消写入。')
}

async function handleDoctor(clientName: string, options: McpCommandOptions) {
  const client = resolveSupportedMcpClient(clientName)
  const result = await inspectMcpClientConfig({
    client,
    workspaceRoot: options.workspaceRoot ?? process.cwd(),
  })

  logger.info(`${result.displayName} 配置文件：${result.configPath}`)
  logger.info(`服务器名称：${result.serverName}`)

  if (!result.configExists || result.issues.length > 0) {
    for (const issue of result.issues) {
      logger.warn(issue)
    }
    throw new Error('MCP 客户端配置检查未通过。')
  }

  if (result.transport) {
    logger.info(`传输模式：${result.transport}`)
  }
  if (result.httpReachable !== undefined) {
    logger.info(`HTTP 服务可达：${result.httpReachable ? '是' : '否'}`)
  }
  logger.success('MCP 客户端配置检查通过。')
}

async function handleServer(options: McpCommandOptions) {
  const resolvedTransport: 'stdio' | 'streamable-http' | undefined = options.transport === 'http'
    ? 'streamable-http'
    : options.transport === 'command'
      ? undefined
      : options.transport
  const handle = await startWeappViteMcpServer({
    endpoint: options.endpoint,
    host: options.host,
    port: resolvePort(options.port),
    restEndpoint: options.rest === false ? false : options.restEndpoint,
    transport: resolvedTransport,
    unref: options.unref,
    workspaceRoot: options.workspaceRoot,
  })

  const shutdown = async () => {
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    process.stdin.off('end', shutdown)
    await handle.close?.()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  if (resolvedTransport !== 'streamable-http') {
    process.stdin.once('end', shutdown)
  }

  for (const line of formatMcpQuickStart({
    httpUrl: resolvedTransport === 'streamable-http'
      ? `http://${options.host ?? '127.0.0.1'}:${resolvePort(options.port) ?? 3088}${options.endpoint ?? '/mcp'}`
      : undefined,
    transport: resolvedTransport === 'streamable-http' ? 'http' : 'command',
  })) {
    logger.info(line)
  }
}

/** 执行 MCP 子命令，注册与帮助阶段不加载服务依赖。 */
export async function runMcpCommand(args: string[], options: McpCommandOptions) {
  const [subcommand, client] = args

  if (subcommand === 'init') {
    if (!client) {
      throw new Error('缺少客户端名称，请使用：wv mcp init <codex|claude-code|cursor>')
    }
    await handlePrint(client, options, true)
    return
  }

  if (subcommand === 'print') {
    if (!client) {
      throw new Error('缺少客户端名称，请使用：wv mcp print <codex|claude-code|cursor>')
    }
    await handlePrint(client, options, false)
    return
  }

  if (subcommand === 'doctor') {
    if (!client) {
      throw new Error('缺少客户端名称，请使用：wv mcp doctor <codex|claude-code|cursor>')
    }
    await handleDoctor(client, options)
    return
  }

  if (subcommand) {
    throw new Error(`未知的 mcp 子命令：${subcommand}`)
  }

  await handleServer(options)
}
