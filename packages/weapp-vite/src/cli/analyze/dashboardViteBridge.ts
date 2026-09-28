import type { DevframeInstance } from 'devframe/initiate'
import type { Plugin } from 'vite'
import type { AnalyzeDashboardDevframeController } from '../../dashboard'
import { Server } from 'node:http'
import { DEVFRAME_CONNECTION_META_FILENAME, DEVFRAME_SSE_ROUTE, DEVFRAME_WS_ROUTE } from 'devframe/constants'
import { initDevframe } from 'devframe/initiate'
import { withStandaloneDashboardPolicy } from './dashboardPolicy'

export const ANALYZE_DASHBOARD_DEVFRAME_BASE = '/__weapp-vite/'

const transportPaths = new Set([
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_CONNECTION_META_FILENAME}`,
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_SSE_ROUTE}`,
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_WS_ROUTE}`,
])

export function createAnalyzeDashboardViteBridge(controller: AnalyzeDashboardDevframeController): Plugin {
  let instance: DevframeInstance | undefined
  let closing: Promise<void> | undefined

  const closeInstance = async () => {
    controller.dispose()
    if (closing) {
      return await closing
    }
    const current = instance
    instance = undefined
    if (!current) {
      return
    }
    closing = current.close().finally(() => {
      closing = undefined
    })
    await closing
  }

  return {
    name: 'weapp-vite:dashboard-devframe',
    apply: 'serve',
    async configureServer(server) {
      const httpServer = server.httpServer instanceof Server ? server.httpServer : undefined
      const created = initDevframe(withStandaloneDashboardPolicy(controller.definition), {
        base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
        distDir: false,
        ...(httpServer
          ? { server: httpServer }
          : { host: '127.0.0.1', ws: { sidecar: true } as const }),
        allowedOrigins: [],
        auth: true,
        mcp: false,
      })
      try {
        // SDK 中间件占用整个 base；这里只交给它协议路由，页面、资源与历史回退仍由 Vite 处理。
        server.middlewares.use((request, response, next) => {
          const url = request.url ?? '/'
          const queryIndex = url.indexOf('?')
          const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex)
          if (transportPaths.has(pathname)) {
            created.nodeMiddleware(request, response, next)
          }
          else {
            next()
          }
        })
        await created.ready
        instance = created
      }
      catch (error) {
        controller.dispose()
        await created.close().catch(() => {})
        throw error
      }
      server.httpServer?.once('close', () => {
        void closeInstance()
      })
    },
    async closeBundle() {
      await closeInstance()
    },
  }
}
