import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node'
import type { DevframeInstance } from 'devframe/initiate'
import type { DevframeInstanceRegistration } from 'devframe/internal'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import process from 'node:process'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpFetchHandler } from 'devframe/adapters/mcp'
import { registerDevframeInstance } from 'devframe/internal'
import { isLoopbackAddress, validateOriginCandidate } from 'devframe/utils/origin'
import path from 'pathe'

const MCP_ROUTE = '__mcp'

export interface DashboardMcp {
  route: string
  nodeMiddleware: (request: IncomingMessage, response: ServerResponse) => Promise<void>
  discoveryMiddleware: NodeMcpRequestHandler
  register: () => void
  close: () => Promise<void>
}

/** MCP 复用独立宿主的上下文，但不继承浏览器 OTP 或开放共享状态。 */
export async function createDashboardMcp(
  instance: DevframeInstance,
  httpServer: Server,
  options: { projectRoot: string, id: string, name?: string, version?: string },
): Promise<DashboardMcp> {
  const handler = createMcpFetchHandler(await instance.context, {
    serverName: `${options.id} (devframe)`,
    serverVersion: options.version ?? '0.0.0',
    exposeSharedState: false,
    allowedOrigins: [],
  })
  const route = `${instance.base}${MCP_ROUTE}`
  let registration: DevframeInstanceRegistration | undefined
  let closing: Promise<void> | undefined
  let closed = false

  const nodeHandler = toNodeHandler({
    async fetch(request) {
      // Origin 必须是完整、规范的 HTTP(S) loopback origin，不能是空串或带路径的 URL。
      const origin = request.headers.get('origin')
      if (!origin || validateOriginCandidate(origin, []) !== origin) {
        return new Response('Forbidden', { status: 403 })
      }
      return handler.fetch(request)
    },
  })

  return {
    route,
    async nodeMiddleware(request, response) {
      // 官方 Node 适配器不转发 socket 对端信息；必须在转换前验证，且不信任转发头。
      const remoteAddress = request.socket.remoteAddress
      if (!remoteAddress || !isLoopbackAddress(remoteAddress)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }
      await nodeHandler(request, response)
    },
    discoveryMiddleware: toNodeHandler({
      async fetch() {
        return Response.json({ ...instance.connectionMeta(), mcp: { path: MCP_ROUTE } })
      },
    }),
    register() {
      if (closed || registration || !httpServer.listening) {
        return
      }
      const address = httpServer.address()
      if (!address || typeof address === 'string') {
        return
      }
      const hostname = address.address === '::' || address.address === '0.0.0.0'
        ? 'localhost'
        : address.address.includes(':') ? `[${address.address}]` : address.address
      registration = registerDevframeInstance({
        pid: process.pid,
        port: address.port,
        origin: `http://${hostname}:${address.port}`,
        basePath: instance.base,
        id: options.id,
        name: options.name,
        rootDir: path.resolve(options.projectRoot),
        mcp: { path: route },
        startedAt: Date.now(),
      })
    },
    close() {
      if (!closing) {
        closed = true
        registration?.unregister()
        closing = handler.dispose()
      }
      return closing
    },
  }
}
