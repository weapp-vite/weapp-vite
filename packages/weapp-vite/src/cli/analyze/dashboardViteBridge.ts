import type { DevframeInstance } from 'devframe/initiate'
import type { Plugin, ResolvedConfig } from 'vite'
import type { AnalyzeDashboardDevframeController } from '../../dashboard'
import type { DashboardMcp } from './dashboardMcp'
import { Server } from 'node:http'
import process from 'node:process'
import { DEVFRAME_CONNECTION_META_FILENAME, DEVFRAME_SSE_ROUTE, DEVFRAME_WS_ROUTE } from 'devframe/constants'
import { initDevframe } from 'devframe/initiate'
import { createDashboardMcp } from './dashboardMcp'
import { withStandaloneDashboardPolicy } from './dashboardPolicy'

export const ANALYZE_DASHBOARD_DEVFRAME_BASE = '/__weapp-vite/'

const transportPaths = new Set([
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_CONNECTION_META_FILENAME}`,
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_SSE_ROUTE}`,
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_WS_ROUTE}`,
])

interface AnalyzeDashboardViteBridgeOptions {
  mcpAuthToken?: string
  projectRoot?: string
}

interface DashboardHost {
  start: () => Promise<void>
  close: () => Promise<void>
}

export function createAnalyzeDashboardViteBridge(
  controller: AnalyzeDashboardDevframeController,
  options: AnalyzeDashboardViteBridgeOptions = {},
): Plugin {
  const hosts = new WeakMap<ResolvedConfig, DashboardHost>()
  let activeHost: DashboardHost | undefined

  return {
    name: 'weapp-vite:dashboard-devframe',
    apply: 'serve',
    configureServer(server) {
      const httpServer = server.httpServer instanceof Server ? server.httpServer : undefined
      const authToken = options.mcpAuthToken ?? process.env.DEVFRAME_MCP_AUTH_TOKEN
      const mcpEnabled = !!authToken?.trim()
      let instance: DevframeInstance | undefined
      let mcp: DashboardMcp | undefined
      let starting: Promise<void> | undefined
      let closing: Promise<void> | undefined
      let closed = false
      const onListening = () => mcp?.register()
      const host: DashboardHost & { onClose: () => void } = {
        start() {
          if (closed) {
            throw new Error('Dashboard host is already closed.')
          }
          starting ??= (async () => {
            try {
              if (mcpEnabled && !httpServer) {
                throw new Error('Dashboard MCP requires the Dashboard Vite HTTP server.')
              }
              instance = initDevframe(withStandaloneDashboardPolicy(controller.definition), {
                base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
                distDir: false,
                ...(httpServer
                  ? { server: httpServer }
                  : { host: '127.0.0.1', ws: { sidecar: true } as const }),
                allowedOrigins: [],
                auth: true,
                mcp: false,
                register: false,
              })
              await instance.ready
              if (mcpEnabled) {
                mcp = await createDashboardMcp(instance, httpServer!, {
                  authToken: authToken!,
                  projectRoot: options.projectRoot ?? process.cwd(),
                  id: controller.definition.id,
                  name: controller.definition.name,
                  version: controller.definition.version,
                })
              }
              if (closed) {
                await mcp?.close()
                return
              }
              activeHost = host
              httpServer?.once('listening', onListening)
              httpServer?.once('close', host.onClose)
              httpServer?.once('error', host.onClose)
              onListening()
            }
            catch (error) {
              await host.close().catch(() => {})
              if (!activeHost) {
                controller.dispose()
              }
              throw error
            }
          })()
          return starting
        },
        close() {
          if (!closing) {
            closed = true
            if (activeHost === host) {
              activeHost = undefined
            }
            httpServer?.off('listening', onListening)
            httpServer?.off('close', host.onClose)
            httpServer?.off('error', host.onClose)
            closing = Promise.resolve().then(async () => {
              try {
                await mcp?.close()
              }
              finally {
                await instance?.close()
              }
            })
          }
          return closing
        },
        onClose() {
          void host.close().catch(error => server.config.logger.error(String(error)))
        },
      }
      hosts.set(server.config, host)
      // 先占协议路由的位置；初始化留给启动阶段，失败候选不会抢走当前宿主的通知或资源。
      server.middlewares.use((request, response, next) => {
        if (closed || !instance) {
          next()
          return
        }
        const url = request.url ?? '/'
        const queryIndex = url.indexOf('?')
        const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex)
        if (mcp && pathname === mcp.route) {
          void mcp.nodeMiddleware(request, response).catch(next)
        }
        else if (mcp && pathname === `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_CONNECTION_META_FILENAME}`) {
          void mcp.discoveryMiddleware(request, response).catch(next)
        }
        else if (transportPaths.has(pathname)) {
          instance.nodeMiddleware(request, response, next)
        }
        else {
          next()
        }
      })
    },
    async buildStart() {
      // 原生 Vite 在配置及 post hook 全部成功后、HTTP 监听前执行客户端 buildStart。
      await hosts.get(this.environment.getTopLevelConfig())?.start()
    },
    async closeBundle() {
      await hosts.get(this.environment.getTopLevelConfig())?.close()
    },
    closeServer({ reason }) {
      if (reason === 'close' && !activeHost) {
        controller.dispose()
      }
    },
  }
}
