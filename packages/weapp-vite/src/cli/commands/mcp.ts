import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import path from 'pathe'
import { runWithSuspendedSharedInput } from 'weapp-ide-cli'
import logger from '../../logger'
import { resolveWeappMcpConfig, startWeappViteMcpServer } from '../../mcp'
import { loadConfig } from '../loadConfig'
import {
  buildMcpClientConfigPlan,
  formatMcpQuickStart,
  inspectMcpClientConfig,
  resolveSupportedMcpClient,
  writeMcpClientConfig,
} from '../mcpClient'
import { resolveConfigFile } from '../options'

interface McpCommandOptions {
  c?: string
  config?: string
  endpoint?: string
  host?: string
  port?: number | string
  rest?: boolean
  restEndpoint?: string
  transport?: 'command' | 'http' | 'stdio' | 'streamable-http'
  unref?: boolean
  url?: string
  workspaceRoot?: string
  yes?: boolean
}

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
  await startWeappViteMcpServer({
    endpoint: options.endpoint,
    host: options.host,
    port: resolvePort(options.port),
    restEndpoint: options.rest === false ? false : options.restEndpoint,
    transport: resolvedTransport,
    unref: options.unref,
    workspaceRoot: options.workspaceRoot,
  })

  for (const line of formatMcpQuickStart({
    httpUrl: resolvedTransport === 'streamable-http'
      ? `http://${options.host ?? '127.0.0.1'}:${resolvePort(options.port) ?? 3088}${options.endpoint ?? '/mcp'}`
      : undefined,
    transport: resolvedTransport === 'streamable-http' ? 'http' : 'command',
  })) {
    logger.info(line)
  }
}

export function registerMcpCommand(cli: CAC) {
  cli
    .command('mcp [...args]', 'start weapp-vite MCP server or manage MCP client onboarding')
    .option('--transport <type>', '[string] stdio | streamable-http | command | http', { default: 'stdio' })
    .option('--host <host>', '[string] streamable-http host')
    .option('--port <port>', '[number] streamable-http port')
    .option('--endpoint <path>', '[string] streamable-http endpoint path')
    .option('--rest-endpoint <path>', '[string] streamable-http REST runtime endpoint path')
    .option('--no-rest', '[boolean] disable streamable-http REST runtime endpoints')
    .option('--unref', '[boolean] unref HTTP server to not block process exit')
    .option('--url <url>', '[string] explicit HTTP MCP url')
    .option('--workspace-root <path>', '[string] workspace root path, defaults to cwd')
    .option('-y, --yes', '[boolean] write config without prompt')
    .action(async (args: string[], options: McpCommandOptions) => {
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
    })
}
