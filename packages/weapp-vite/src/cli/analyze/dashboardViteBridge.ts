import type { HubInstance } from '@devframes/hub/initiate'
import type { DevframeInstance } from 'devframe/initiate'
import type { Plugin, ResolvedConfig } from 'vite'
import type { AnalyzeDashboardDevframeController } from '../../dashboard'
import type { DashboardUiHost } from '../types'
import type { DashboardMcp } from './dashboardMcp'
import { Server } from 'node:http'
import process from 'node:process'
import { createUi } from '@devframes/hub-ui'
import { initHub } from '@devframes/hub/initiate'
import { DEVFRAME_CONNECTION_META_FILENAME, DEVFRAME_SSE_ROUTE, DEVFRAME_WS_ROUTE } from 'devframe/constants'
import { initDevframe } from 'devframe/initiate'
import { createDashboardMcp } from './dashboardMcp'
import { withStandaloneDashboardPolicy } from './dashboardPolicy'

export const ANALYZE_DASHBOARD_DEVFRAME_BASE = '/__weapp-vite/'
// Hub 必须与 Dashboard 静态挂载前缀互斥，避免被上游 SPA 路由截获。
export const ANALYZE_DASHBOARD_HUB_BASE = '/__devframes/'

const transportPaths = new Set([
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_CONNECTION_META_FILENAME}`,
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_SSE_ROUTE}`,
  `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_WS_ROUTE}`,
])

interface AnalyzeDashboardViteBridgeOptions {
  projectRoot?: string
  uiHost?: DashboardUiHost
}

interface DashboardHost {
  start: () => Promise<void>
  close: () => Promise<void>
}

export function createAnalyzeDashboardViteBridge(
  controller: AnalyzeDashboardDevframeController,
  options: AnalyzeDashboardViteBridgeOptions = {},
): Plugin & { close: () => Promise<void> } {
  const hosts = new WeakMap<ResolvedConfig, DashboardHost>()
  const ownedHosts = new Set<DashboardHost>()
  let activeHost: DashboardHost | undefined
  let closing: Promise<void> | undefined
  let stopped = false

  return {
    name: 'weapp-vite:dashboard-devframe',
    apply: 'serve',
    configureServer(server) {
      if (stopped) {
        throw new Error('Dashboard bridge is already closed.')
      }
      const httpServer = server.httpServer instanceof Server ? server.httpServer : undefined
      let instance: DevframeInstance | HubInstance | undefined
      let mcp: DashboardMcp | undefined
      let starting: Promise<void> | undefined
      let acquiring: Promise<void> | undefined
      let hostClosing: Promise<void> | undefined
      let closed = false
      const onListening = () => mcp?.register()
      const host: DashboardHost & { onClose: () => void } = {
        start() {
          if (closed) {
            throw new Error('Dashboard host is already closed.')
          }
          starting ??= (async () => {
            try {
              // 资源取得与失败收尾分开，close 可等待晚到资源而不反向等待 start 的 catch。
              acquiring = Promise.resolve().then(async () => {
                if (closed) {
                  return
                }
                if (!httpServer) {
                  throw new Error('Dashboard requires the Dashboard Vite HTTP server.')
                }
                if (options.uiHost === 'hub') {
                  instance = initHub({
                    base: ANALYZE_DASHBOARD_HUB_BASE,
                    name: 'weapp-vite DevTools',
                    cwd: options.projectRoot ?? process.cwd(),
                    server: httpServer,
                    allowedOrigins: [],
                    auth: true,
                    mcp: false,
                    register: false,
                    ui: createUi({ branding: { productName: 'weapp-vite DevTools' } }),
                    // declarative devframes 会强制挂在 Hub 子路径；install 保留 Dashboard 的 Vite base。
                    configure: ctx => ctx.install({
                      ...controller.definition,
                      basePath: ANALYZE_DASHBOARD_DEVFRAME_BASE,
                    }),
                  })
                  await instance.ready
                }
                else {
                  instance = initDevframe(withStandaloneDashboardPolicy(controller.definition), {
                    base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
                    distDir: false,
                    server: httpServer,
                    allowedOrigins: [],
                    auth: true,
                    mcp: false,
                    register: false,
                  })
                  await instance.ready
                  if (!closed) {
                    mcp = await createDashboardMcp(instance, httpServer, {
                      projectRoot: options.projectRoot ?? process.cwd(),
                      id: controller.definition.id,
                      name: controller.definition.name,
                      version: controller.definition.version,
                    })
                  }
                }
              })
              await acquiring
              if (closed) {
                // buildStart 成功返回会让 Vite 继续 HTTP listen；关闭中的启动必须明确终止。
                throw new Error('Dashboard host initialization was cancelled by shutdown.')
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
          if (!hostClosing) {
            closed = true
            if (activeHost === host) {
              activeHost = undefined
            }
            httpServer?.off('listening', onListening)
            httpServer?.off('close', host.onClose)
            httpServer?.off('error', host.onClose)
            hostClosing = Promise.resolve().then(async () => {
              await acquiring?.catch(() => {})
              const errors: unknown[] = []
              for (const release of [() => mcp?.close(), () => instance?.close()]) {
                try {
                  await release()
                }
                catch (error) {
                  errors.push(error)
                }
              }
              if (errors.length) {
                throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Dashboard host cleanup failed')
              }
              ownedHosts.delete(host)
            })
          }
          return hostClosing
        },
        onClose() {
          void host.close().catch(error => server.config.logger.error(String(error)))
        },
      }
      hosts.set(server.config, host)
      ownedHosts.add(host)
      // 先占协议路由的位置；初始化留给启动阶段，失败候选不会抢走当前宿主的通知或资源。
      server.middlewares.use((request, response, next) => {
        if (closed || !instance) {
          next()
          return
        }
        const url = request.url ?? '/'
        const queryIndex = url.indexOf('?')
        const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex)
        if (options.uiHost === 'hub') {
          if (pathname === `${ANALYZE_DASHBOARD_DEVFRAME_BASE}${DEVFRAME_CONNECTION_META_FILENAME}`) {
            // Hub 的 Node middleware 只接收自身 base；外部挂载通过公开 metadata API 发现同一传输。
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(instance.connectionMeta()))
          }
          else if (pathname === ANALYZE_DASHBOARD_HUB_BASE.slice(0, -1) || pathname.startsWith(ANALYZE_DASHBOARD_HUB_BASE)) {
            instance.nodeMiddleware(request, response, next)
          }
          else {
            next()
          }
          return
        }
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
    close() {
      if (!closing) {
        stopped = true
        // Vite 会忽略环境 closeBundle 的错误；显式边界保留失败宿主并等待全部资源结算。
        closing = Promise.allSettled([...ownedHosts].map(host => host.close())).then((results) => {
          const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
          if (errors.length) {
            throw errors.length === 1 ? errors[0] : new AggregateError(errors, 'Dashboard bridge cleanup failed')
          }
        })
      }
      return closing
    },
  }
}
