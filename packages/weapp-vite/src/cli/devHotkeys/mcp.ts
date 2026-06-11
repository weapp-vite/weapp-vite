import type { WeappViteMcpServerHandle } from '../../mcp'
import logger, { colors } from '../../logger'
import { startWeappViteMcpServer } from '../../mcp'

const REG_EADDRINUSE = /EADDRINUSE/

interface ResolvedMcpConfig {
  agentName?: string
  enabled: boolean
  endpoint: string
  host: string
  port: number
  restEndpoint: string | false
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

  return async function toggleMcp(actionOptions: { silent?: boolean } = {}) {
    const silent = actionOptions.silent === true
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
    if (!silent) {
      logger.info(`[dev action] 正在启动 MCP 服务：${colors.cyan(url)}`)
    }
    let handle: WeappViteMcpServerHandle
    try {
      handle = await startWeappViteMcpServer({
        endpoint: resolvedMcp.endpoint,
        host: resolvedMcp.host,
        port: resolvedMcp.port,
        restEndpoint: resolvedMcp.restEndpoint,
        transport: 'streamable-http',
        unref: false,
        onReady: () => {},
        workspaceRoot: cwd,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (REG_EADDRINUSE.test(message)) {
        if (!silent) {
          logger.info(`[dev action] MCP 服务已存在，继续复用：${colors.cyan(url)}`)
        }
        return `MCP 已复用 (${url})`
      }
      throw error
    }
    setHandle(handle)
    const suffix = resolvedMcp.agentName ? `（AI 终端：${resolvedMcp.agentName}）` : ''
    if (!silent) {
      logger.success(`[dev action] MCP 服务已启动：${colors.cyan(url)}${suffix}`)
    }
    return `MCP 已启动 (${url})`
  }
}
