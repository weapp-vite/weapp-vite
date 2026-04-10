import type { JsonMcpConfigFile, McpClientConfigEntry, ResolvedMcpClientTarget, SupportedMcpClient } from './types'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'

const CODEX_BLOCK_PREFIX = '# >>> weapp-vite mcp '
const CODEX_BLOCK_SUFFIX = ' >>>'
const CODEX_BLOCK_END_PREFIX = '# <<< weapp-vite mcp '
const CODEX_BLOCK_END_SUFFIX = ' <<<'
export const DEFAULT_HTTP_TIMEOUT_MS = 1500
export const WORKSPACE_FOLDER_TOKEN = '${' + 'workspaceFolder}'
export const REG_CodexUrl = /^\s*url\s*=\s*"([^"]+)"/m
export const REG_CodexCommand = /^\s*command\s*=\s*"([^"]+)"/m
export const REG_CodexArgs = /^\s*args\s*=\s*\[([^\]]*)\]/m
export const REG_FirstTomlString = /"([^"]+)"/

export function resolveTargetWorkspaceRoot(target: ResolvedMcpClientTarget) {
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

export function renderCodexBlock(serverName: string, entry: McpClientConfigEntry) {
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

export function renderJsonPreview(serverName: string, entry: McpClientConfigEntry) {
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

export function resolveConfigEntry(client: SupportedMcpClient, transport: 'command' | 'http', workspaceRoot: string, url?: string) {
  return transport === 'http'
    ? resolveHttpEntry(client, url ?? '')
    : resolveCommandEntry(client, workspaceRoot)
}

export function resolveCodexBlockPattern(serverName: string) {
  const startMarker = `${CODEX_BLOCK_PREFIX}${serverName}${CODEX_BLOCK_SUFFIX}`
  const endMarker = `${CODEX_BLOCK_END_PREFIX}${serverName}${CODEX_BLOCK_END_SUFFIX}`
  return new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, 'g')
}

export function upsertCodexManagedBlock(content: string, serverName: string, block: string) {
  const trimmed = content.trimEnd()
  const withoutExisting = trimmed.replace(resolveCodexBlockPattern(serverName), '').trimEnd()
  if (!withoutExisting) {
    return block
  }
  return `${withoutExisting}\n\n${block}`
}

export function parseJsonConfig(content: string, configPath: string): JsonMcpConfigFile {
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

export function resolveTarget(client: SupportedMcpClient, workspaceRoot: string): ResolvedMcpClientTarget {
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
