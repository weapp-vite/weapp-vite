import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { AnalyzeDashboardDevframeController } from '../../../dashboard'
import { Server } from 'node:http'
import path from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'
import { createAnalyzeDashboardViteBridge } from '../dashboardViteBridge'

const loadModule = vi.hoisted(() => vi.fn())
const createMcp = vi.hoisted(() => vi.fn())

vi.mock('./index', () => ({ loadDashboardTransportModule: loadModule }))
vi.mock('../dashboardMcp', () => ({ createDashboardMcp: createMcp }))

beforeEach(() => {
  vi.clearAllMocks()
})

function createHost(uiHost: 'hub' | 'standalone' = 'hub') {
  const controller = {
    definition: { id: 'weapp-vite' },
    dispose: vi.fn(),
  } as unknown as AnalyzeDashboardDevframeController
  const bridge = createAnalyzeDashboardViteBridge(controller, {
    packageJsonPath: path.resolve('package.json'),
    uiHost,
  })
  const config = {} as ResolvedConfig
  // 只构造尚未监听的 HTTP 容器，避免把传输取消契约变成真实 server 集成测试。
  const httpServer = new Server()
  const server = { config, httpServer, middlewares: { use: vi.fn() } } as unknown as ViteDevServer
  const configure = bridge.configureServer as (server: ViteDevServer) => void
  configure(server)
  const start = bridge.buildStart as (this: { environment: { getTopLevelConfig: () => ResolvedConfig } }) => Promise<void>
  return { bridge, controller, httpServer, start: () => start.call({ environment: { getTopLevelConfig: () => config } }) }
}

it.each(['hub', 'standalone'] as const)('waits for pending %s owner imports without creating a host or MCP after cancellation', async (uiHost) => {
  const imported = Promise.withResolvers<{ initHub: ReturnType<typeof vi.fn>, createUi: ReturnType<typeof vi.fn>, initDevframe: ReturnType<typeof vi.fn> }>()
  const modules = { initHub: vi.fn(), createUi: vi.fn(), initDevframe: vi.fn() }
  loadModule.mockReturnValue(imported.promise)
  const host = createHost(uiHost)
  const starting = host.start().catch(error => error)
  await vi.waitFor(() => expect(loadModule).toHaveBeenCalledTimes(uiHost === 'hub' ? 2 : 1))
  const settled = vi.fn()
  const closing = host.bridge.close().then(settled)
  await Promise.resolve()
  expect(settled).not.toHaveBeenCalled()
  imported.resolve(modules)
  await closing
  expect(await starting).toMatchObject({ message: 'Dashboard host initialization was cancelled by shutdown.' })
  expect(modules.initHub).not.toHaveBeenCalled()
  expect(modules.initDevframe).not.toHaveBeenCalled()
  expect(modules.createUi).not.toHaveBeenCalled()
  expect(createMcp).not.toHaveBeenCalled()
  expect(host.httpServer.listening).toBe(false)
  expect(host.controller.dispose).toHaveBeenCalledOnce()
})

it('retains an owner import error without acquiring or registering a transport', async () => {
  const failure = new Error('owned transport rejected')
  loadModule.mockRejectedValue(failure)
  const host = createHost()
  await expect(host.start()).rejects.toBe(failure)
  await host.bridge.close()
  expect(createMcp).not.toHaveBeenCalled()
  expect(host.httpServer.listening).toBe(false)
  expect(host.controller.dispose).toHaveBeenCalledOnce()
})
