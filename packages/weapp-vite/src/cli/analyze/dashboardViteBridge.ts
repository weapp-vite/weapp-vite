import type { DevframeDefinition } from 'devframe'
import type { DevframeInstance } from 'devframe/initiate'
import type { Plugin } from 'vite'
import { Server } from 'node:http'
import { initDevframe } from 'devframe/initiate'

export const ANALYZE_DASHBOARD_DEVFRAME_BASE = '/__weapp-vite/'

export function createAnalyzeDashboardViteBridge(definition: DevframeDefinition): Plugin {
  let instance: DevframeInstance | undefined
  let closing: Promise<void> | undefined

  const closeInstance = async () => {
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
      await closeInstance()
      const httpServer = server.httpServer instanceof Server ? server.httpServer : undefined
      const created = initDevframe(definition, {
        base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
        distDir: false,
        ...(httpServer
          ? { server: httpServer }
          : { host: '127.0.0.1', ws: { sidecar: true } as const }),
        allowedOrigins: [],
        auth: true,
        mcp: false,
      })
      server.middlewares.use(created.nodeMiddleware)
      try {
        await created.ready
        instance = created
      }
      catch (error) {
        await created.close()
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
