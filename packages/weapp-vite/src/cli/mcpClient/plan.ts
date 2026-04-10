import type { McpClientConfigPlan, McpClientTransport, SupportedMcpClient } from './types'
import path from 'pathe'
import { renderCodexBlock, renderJsonPreview, resolveConfigEntry, resolveTarget } from './shared'

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
  const entry = resolveConfigEntry(options.client, options.transport, workspaceRoot, options.url)

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
