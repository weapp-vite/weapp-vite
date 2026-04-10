import type { WeappViteMcpServerHandle } from '../../mcp'
import logger, { colors } from '../../logger'
import { startWeappViteMcpServer } from '../../mcp'
import { formatMcpQuickStart } from '../mcpClient'

interface ResolvedMcpConfig {
  enabled: boolean
  endpoint: string
  host: string
  port: number
}

function formatMcpUrl(host: string, port: number, endpoint: string) {
  return `http://${host}:${port}${endpoint}`
}

export function createToggleMcpAction(options: {
  cwd: string
  getHandle: () => WeappViteMcpServerHandle | undefined
  setHandle: (handle: WeappViteMcpServerHandle | undefined) => void
  resolvedMcp: ResolvedMcpConfig
}) {
  const { cwd, getHandle, resolvedMcp, setHandle } = options

  return async function toggleMcp() {
    if (!resolvedMcp.enabled) {
      logger.warn('[dev action] MCP 已在配置中禁用，跳过切换。')
      return 'MCP 已禁用'
    }

    const existingHandle = getHandle()
    if (existingHandle?.close) {
      const url = formatMcpUrl(resolvedMcp.host, resolvedMcp.port, resolvedMcp.endpoint)
      logger.info(`[dev action] 正在关闭 MCP 服务：${colors.cyan(url)}`)
      await existingHandle.close()
      setHandle(undefined)
      logger.success(`[dev action] MCP 服务已关闭：${colors.cyan(url)}`)
      return `MCP 已关闭 (${url})`
    }

    const url = formatMcpUrl(resolvedMcp.host, resolvedMcp.port, resolvedMcp.endpoint)
    logger.info(`[dev action] 正在启动 MCP 服务：${colors.cyan(url)}`)
    const handle = await startWeappViteMcpServer({
      endpoint: resolvedMcp.endpoint,
      host: resolvedMcp.host,
      port: resolvedMcp.port,
      transport: 'streamable-http',
      unref: false,
      workspaceRoot: cwd,
    })
    setHandle(handle)
    logger.success(`[dev action] MCP 服务已启动：${colors.cyan(url)}`)
    for (const line of formatMcpQuickStart({
      httpUrl: url,
      transport: 'http',
    })) {
      logger.info(line)
    }
    return `MCP 已启动 (${url})`
  }
}
