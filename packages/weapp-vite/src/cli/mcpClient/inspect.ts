import type { McpClientDoctorResult, McpClientTransport, ResolvedMcpClientTarget, SupportedMcpClient } from './types'
import { clearTimeout, setTimeout } from 'node:timers'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  parseJsonConfig,
  REG_CodexArgs,
  REG_CodexCommand,
  REG_CodexUrl,
  REG_FirstTomlString,
  resolveCodexBlockPattern,
  resolveTarget,
  resolveTargetWorkspaceRoot,
  WORKSPACE_FOLDER_TOKEN,
} from './shared'

export async function probeHttpEndpoint(url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, DEFAULT_HTTP_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })
    return response.status > 0
  }
  catch {
    return false
  }
  finally {
    clearTimeout(timer)
    controller.abort()
  }
}

async function inspectJsonConfig(target: ResolvedMcpClientTarget): Promise<McpClientDoctorResult> {
  const exists = await fs.pathExists(target.configPath)
  if (!exists) {
    return {
      configExists: false,
      configPath: target.configPath,
      displayName: target.displayName,
      issues: [`未找到配置文件：${target.configPath}`],
      serverName: target.serverName,
    }
  }

  const content = await fs.readFile(target.configPath, 'utf8')
  const parsed = parseJsonConfig(content, target.configPath)
  const entry = parsed.mcpServers?.[target.serverName]
  if (!entry) {
    return {
      configExists: true,
      configPath: target.configPath,
      displayName: target.displayName,
      issues: [`配置文件中未找到服务器 ${target.serverName}`],
      serverName: target.serverName,
    }
  }

  const transport: McpClientTransport = entry.url ? 'http' : 'command'
  const issues: string[] = []
  let httpReachable: boolean | undefined

  if (transport === 'command') {
    const binArg = entry.args?.[0]
    const normalizedBin = binArg?.replaceAll(WORKSPACE_FOLDER_TOKEN, resolveTargetWorkspaceRoot(target))
    if (!normalizedBin || !await fs.pathExists(normalizedBin)) {
      issues.push(`未找到本地 CLI 入口：${normalizedBin ?? '缺少 args[0]'}`)
    }
  }
  else if (entry.url) {
    httpReachable = await probeHttpEndpoint(entry.url)
    if (!httpReachable) {
      issues.push(`HTTP MCP 地址不可达：${entry.url}`)
    }
  }

  return {
    configExists: true,
    configPath: target.configPath,
    displayName: target.displayName,
    httpReachable,
    issues,
    serverName: target.serverName,
    transport,
  }
}

async function inspectCodexConfig(target: ResolvedMcpClientTarget): Promise<McpClientDoctorResult> {
  const exists = await fs.pathExists(target.configPath)
  if (!exists) {
    return {
      configExists: false,
      configPath: target.configPath,
      displayName: target.displayName,
      issues: [`未找到配置文件：${target.configPath}`],
      serverName: target.serverName,
    }
  }

  const content = await fs.readFile(target.configPath, 'utf8')
  const blockMatch = content.match(resolveCodexBlockPattern(target.serverName))
  if (!blockMatch?.[0]) {
    return {
      configExists: true,
      configPath: target.configPath,
      displayName: target.displayName,
      issues: [`未找到 weapp-vite 生成的 Codex 配置区块：${target.serverName}`],
      serverName: target.serverName,
    }
  }

  const block = blockMatch[0]
  const issues: string[] = []
  const urlMatch = block.match(REG_CodexUrl)
  const commandMatch = block.match(REG_CodexCommand)
  const argsMatch = block.match(REG_CodexArgs)

  if (urlMatch?.[1]) {
    const reachable = await probeHttpEndpoint(urlMatch[1])
    if (!reachable) {
      issues.push(`HTTP MCP 地址不可达：${urlMatch[1]}`)
    }
    return {
      configExists: true,
      configPath: target.configPath,
      displayName: target.displayName,
      httpReachable: reachable,
      issues,
      serverName: target.serverName,
      transport: 'http',
    }
  }

  const firstArgMatch = argsMatch?.[1]?.match(REG_FirstTomlString)
  const binPath = firstArgMatch?.[1]
  if (!commandMatch?.[1]) {
    issues.push('Codex 配置区块缺少 command 字段')
  }
  if (!binPath || !await fs.pathExists(binPath)) {
    issues.push(`未找到本地 CLI 入口：${binPath ?? '缺少 args[0]'}`)
  }

  return {
    configExists: true,
    configPath: target.configPath,
    displayName: target.displayName,
    issues,
    serverName: target.serverName,
    transport: 'command',
  }
}

export async function inspectMcpClientConfig(options: {
  client: SupportedMcpClient
  workspaceRoot: string
}) {
  const target = resolveTarget(options.client, path.resolve(options.workspaceRoot))
  if (target.client === 'codex') {
    return await inspectCodexConfig(target)
  }
  return await inspectJsonConfig(target)
}
