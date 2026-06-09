import type { WeappMcpConfig } from '../types'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import logger, { colors } from '../logger'
import { resolveWeappMcpConfig } from '../mcp'
import { formatMcpQuickStart } from './mcpClient'

interface StartDetachedMcpServerOptions {
  agentName?: string
  cwd: string
  isAgent?: boolean
  mcpConfig?: boolean | WeappMcpConfig
}

interface McpRuntimeManifest {
  agentName?: string
  endpoint: string
  pid: number
  projectRoot: string
  restUrl?: string
  startedAt: string
  startedBy: 'weapp-vite open'
  transport: 'streamable-http'
  url: string
}

function resolveCliEntrypoint() {
  return process.argv[1]
}

function resolveManifestPath(cwd: string) {
  return path.join(cwd, '.weapp-vite', 'mcp-runtime.json')
}

async function isTcpPortOpen(host: string, port: number) {
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port })
    const cleanup = () => {
      socket.removeAllListeners()
      socket.destroy()
    }
    socket.once('connect', () => {
      cleanup()
      resolve(true)
    })
    socket.once('error', () => {
      cleanup()
      resolve(false)
    })
    socket.setTimeout(500, () => {
      cleanup()
      resolve(false)
    })
  })
}

async function writeRuntimeManifest(cwd: string, manifest: McpRuntimeManifest) {
  const manifestPath = resolveManifestPath(cwd)
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

export async function maybeStartDetachedMcpServer(options: StartDetachedMcpServerOptions) {
  const resolvedMcp = resolveWeappMcpConfig(options.mcpConfig, {
    agentName: options.agentName,
    cwd: options.cwd,
    isAgent: options.isAgent,
  })
  if (!resolvedMcp.enabled || !resolvedMcp.autoStart) {
    return
  }

  const entrypoint = resolveCliEntrypoint()
  if (!entrypoint) {
    logger.warn('[mcp] 找不到当前 CLI 入口，跳过 MCP 后台自动启动。')
    return
  }

  const url = `http://${resolvedMcp.host}:${resolvedMcp.port}${resolvedMcp.endpoint}`
  const restUrl = resolvedMcp.restEndpoint === false
    ? undefined
    : `http://${resolvedMcp.host}:${resolvedMcp.port}${resolvedMcp.restEndpoint}`

  if (await isTcpPortOpen(resolvedMcp.host, resolvedMcp.port)) {
    logger.info(`[mcp] MCP 服务已存在，继续复用：${colors.cyan(url)}`)
    return
  }

  const args = [
    entrypoint,
    'mcp',
    '--transport',
    'streamable-http',
    '--host',
    resolvedMcp.host,
    '--port',
    String(resolvedMcp.port),
    '--endpoint',
    resolvedMcp.endpoint,
    '--workspace-root',
    options.cwd,
  ]
  if (resolvedMcp.restEndpoint === false) {
    args.push('--no-rest')
  }
  else {
    args.push('--rest-endpoint', resolvedMcp.restEndpoint)
  }

  const child = spawn(process.execPath, args, {
    cwd: options.cwd,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  if (child.pid) {
    await writeRuntimeManifest(options.cwd, {
      agentName: resolvedMcp.agentName,
      endpoint: resolvedMcp.endpoint,
      pid: child.pid,
      projectRoot: options.cwd,
      restUrl,
      startedAt: new Date().toISOString(),
      startedBy: 'weapp-vite open',
      transport: 'streamable-http',
      url,
    })
  }

  const suffix = resolvedMcp.agentName ? `（AI 终端：${resolvedMcp.agentName}）` : ''
  logger.success(`MCP 服务已在后台自动启动：${suffix}`)
  logger.info(`  ➜  ${colors.cyan(url)}`)
  if (restUrl) {
    logger.info(`  REST ➜  ${colors.cyan(restUrl)}`)
  }
  for (const line of formatMcpQuickStart({
    httpUrl: url,
    transport: 'http',
  })) {
    logger.info(line)
  }
}
