import os from 'node:os'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { fs } from '@weapp-core/shared'
import path from 'pathe'

export type SupportedMcpClient = 'codex' | 'claude-code' | 'cursor'
export type McpClientTransport = 'command' | 'http'

interface JsonMcpServerEntry {
  args?: string[]
  command?: string
  env?: Record<string, string>
  headers?: Record<string, string>
  type?: string
  url?: string
}

interface JsonMcpConfigFile {
  mcpServers?: Record<string, JsonMcpServerEntry>
}

interface McpClientConfigEntry {
  args?: string[]
  command?: string
  type?: string
  url?: string
}

export interface ResolvedMcpClientTarget {
  client: SupportedMcpClient
  configPath: string
  displayName: string
  serverName: string
}

export interface McpClientConfigPlan {
  entry: McpClientConfigEntry
  preview: string
  target: ResolvedMcpClientTarget
  transport: McpClientTransport
}

export interface McpClientDoctorResult {
  configExists: boolean
  configPath: string
  displayName: string
  httpReachable?: boolean
  issues: string[]
  serverName: string
  transport?: McpClientTransport
}

const CODEX_BLOCK_PREFIX = '# >>> weapp-vite mcp '
const CODEX_BLOCK_SUFFIX = ' >>>'
const CODEX_BLOCK_END_PREFIX = '# <<< weapp-vite mcp '
const CODEX_BLOCK_END_SUFFIX = ' <<<'
const DEFAULT_HTTP_TIMEOUT_MS = 1500
const WORKSPACE_FOLDER_TOKEN = '${' + 'workspaceFolder}'
const REG_CodexUrl = /^\s*url\s*=\s*"([^"]+)"/m
const REG_CodexCommand = /^\s*command\s*=\s*"([^"]+)"/m
const REG_CodexArgs = /^\s*args\s*=\s*\[([^\]]*)\]/m
const REG_FirstTomlString = /"([^"]+)"/

function resolveTargetWorkspaceRoot(target: ResolvedMcpClientTarget) {
  if (target.client === 'cursor') {
    return path.dirname(path.dirname(target.configPath))
  }
  if (target.client === 'claude-code') {
    return path.dirname(target.configPath)
  }
  return process.cwd()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderTomlString(value: string) {
  return JSON.stringify(value)
}

function sanitizeServerNameSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function resolveServerName(workspaceRoot: string) {
  const baseName = sanitizeServerNameSegment(path.basename(workspaceRoot)) || 'project'
  return `weapp-vite-${baseName}`
}

function resolveNodeBinCommand() {
  return process.execPath || 'node'
}

function resolveProjectCliBin(workspaceRoot: string) {
  return path.join(workspaceRoot, 'node_modules', 'weapp-vite', 'bin', 'weapp-vite.js')
}

function renderCommandArgs(args: string[]) {
  return args.map(renderTomlString).join(', ')
}

function renderCodexBlock(serverName: string, entry: McpClientConfigEntry) {
  const startMarker = `${CODEX_BLOCK_PREFIX}${serverName}${CODEX_BLOCK_SUFFIX}`
  const endMarker = `${CODEX_BLOCK_END_PREFIX}${serverName}${CODEX_BLOCK_END_SUFFIX}`

  if (entry.url) {
    return `${startMarker}
[mcp_servers.${serverName}]
url = ${renderTomlString(entry.url)}
${endMarker}
`
  }

  return `${startMarker}
[mcp_servers.${serverName}]
command = ${renderTomlString(entry.command ?? resolveNodeBinCommand())}
args = [${renderCommandArgs(entry.args ?? [])}]
${endMarker}
`
}

function renderJsonPreview(serverName: string, entry: McpClientConfigEntry) {
  return `${JSON.stringify({
    mcpServers: {
      [serverName]: entry,
    },
  }, null, 2)}
`
}

function resolveCommandEntry(client: SupportedMcpClient, workspaceRoot: string): McpClientConfigEntry {
  const binPath = resolveProjectCliBin(workspaceRoot)

  if (client === 'cursor') {
    return {
      command: 'node',
      args: [
        `${WORKSPACE_FOLDER_TOKEN}/node_modules/weapp-vite/bin/weapp-vite.js`,
        'mcp',
        '--workspace-root',
        WORKSPACE_FOLDER_TOKEN,
      ],
    }
  }

  return {
    command: resolveNodeBinCommand(),
    args: [
      binPath,
      'mcp',
      '--workspace-root',
      workspaceRoot,
    ],
  }
}

function resolveHttpEntry(client: SupportedMcpClient, url: string): McpClientConfigEntry {
  if (client === 'claude-code') {
    return {
      type: 'http',
      url,
    }
  }

  return {
    url,
  }
}

function resolveCodexBlockPattern(serverName: string) {
  const startMarker = `${CODEX_BLOCK_PREFIX}${serverName}${CODEX_BLOCK_SUFFIX}`
  const endMarker = `${CODEX_BLOCK_END_PREFIX}${serverName}${CODEX_BLOCK_END_SUFFIX}`
  return new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, 'g')
}

function upsertCodexManagedBlock(content: string, serverName: string, block: string) {
  const trimmed = content.trimEnd()
  const withoutExisting = trimmed.replace(resolveCodexBlockPattern(serverName), '').trimEnd()
  if (!withoutExisting) {
    return block
  }
  return `${withoutExisting}\n\n${block}`
}

function parseJsonConfig(content: string, configPath: string): JsonMcpConfigFile {
  if (!content.trim()) {
    return {}
  }

  try {
    return JSON.parse(content) as JsonMcpConfigFile
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法解析 MCP 配置文件 ${configPath}：${message}`)
  }
}

function resolveTarget(client: SupportedMcpClient, workspaceRoot: string): ResolvedMcpClientTarget {
  const serverName = resolveServerName(workspaceRoot)

  if (client === 'codex') {
    return {
      client,
      configPath: path.join(os.homedir(), '.codex', 'config.toml'),
      displayName: 'Codex',
      serverName,
    }
  }

  if (client === 'claude-code') {
    return {
      client,
      configPath: path.join(workspaceRoot, '.mcp.json'),
      displayName: 'Claude Code',
      serverName,
    }
  }

  return {
    client,
    configPath: path.join(workspaceRoot, '.cursor', 'mcp.json'),
    displayName: 'Cursor',
    serverName,
  }
}

export function resolveSupportedMcpClient(input: string): SupportedMcpClient {
  if (input === 'codex' || input === 'claude-code' || input === 'cursor') {
    return input
  }
  throw new Error(`不支持的 MCP 客户端：${input}。当前仅支持 codex、claude-code、cursor。`)
}

export function buildMcpClientConfigPlan(options: {
  client: SupportedMcpClient
  transport: McpClientTransport
  url?: string
  workspaceRoot: string
}): McpClientConfigPlan {
  const workspaceRoot = path.resolve(options.workspaceRoot)
  const target = resolveTarget(options.client, workspaceRoot)
  const entry = options.transport === 'http'
    ? resolveHttpEntry(options.client, options.url ?? '')
    : resolveCommandEntry(options.client, workspaceRoot)

  if (options.transport === 'http' && !entry.url) {
    throw new Error('HTTP 模式缺少 MCP 服务地址，请使用 --url 指定或在当前项目中检测到可用地址。')
  }

  return {
    entry,
    preview: target.client === 'codex'
      ? renderCodexBlock(target.serverName, entry)
      : renderJsonPreview(target.serverName, entry),
    target,
    transport: options.transport,
  }
}

export async function writeMcpClientConfig(plan: McpClientConfigPlan) {
  await fs.ensureDir(path.dirname(plan.target.configPath))
  const existing = await fs.readFile(plan.target.configPath, 'utf8').catch(() => '')

  if (plan.target.client === 'codex') {
    const nextContent = upsertCodexManagedBlock(existing, plan.target.serverName, plan.preview)
    await fs.writeFile(plan.target.configPath, nextContent, 'utf8')
    return
  }

  const parsed = parseJsonConfig(existing, plan.target.configPath)
  const nextConfig: JsonMcpConfigFile = {
    ...parsed,
    mcpServers: {
      ...(parsed.mcpServers ?? {}),
      [plan.target.serverName]: plan.entry,
    },
  }
  await fs.writeFile(plan.target.configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
}

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

export function formatMcpQuickStart(options: {
  httpUrl?: string
  transport: McpClientTransport
}) {
  const suffix = options.transport === 'http' && options.httpUrl
    ? ` --transport http --url ${options.httpUrl}`
    : ''

  return [
    '在 AI 工具中接入 weapp-vite MCP：',
    `  - Codex: wv mcp init codex${suffix}`,
    `  - Claude Code: wv mcp init claude-code${suffix}`,
    `  - Cursor: wv mcp init cursor${suffix}`,
  ]
}
