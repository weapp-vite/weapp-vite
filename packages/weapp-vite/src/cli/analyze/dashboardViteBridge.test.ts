import type { DevframeDefinition } from 'devframe'
import type { DevframeInstance } from 'devframe/initiate'
import type { Plugin, ViteDevServer } from 'vite'
import { Server } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANALYZE_DASHBOARD_DEVFRAME_BASE,
  createAnalyzeDashboardViteBridge,
} from './dashboardViteBridge'

const initDevframeMock = vi.hoisted(() => vi.fn())

vi.mock('devframe/initiate', () => ({
  initDevframe: initDevframeMock,
}))

interface MockViteServer {
  httpServer: Server
  middlewares: {
    use: (handler: unknown) => unknown
  }
}

const definition = { id: 'weapp-vite' } as unknown as DevframeDefinition

function createInstance(overrides: Partial<DevframeInstance> = {}): DevframeInstance {
  return {
    attach: vi.fn(),
    base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
    close: vi.fn(async () => {}),
    connectionMeta: Promise.resolve({ backend: 'websocket', websocket: { path: '__ws' } }),
    context: Promise.resolve({} as never),
    handleUpgrade: vi.fn(),
    handler: vi.fn(),
    nodeMiddleware: vi.fn(),
    ready: Promise.resolve(),
    ...overrides,
  } as unknown as DevframeInstance
}

function createViteServer(): MockViteServer {
  return {
    httpServer: new Server(),
    middlewares: {
      use: vi.fn(),
    },
  }
}

async function configurePlugin(plugin: Plugin, server: MockViteServer) {
  if (typeof plugin.configureServer !== 'function') {
    throw new TypeError('configureServer hook is unavailable')
  }
  await plugin.configureServer(server as unknown as ViteDevServer)
}

describe('analyze Dashboard Vite bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pins OTP authentication and loopback-only Origin policy', async () => {
    const instance = createInstance()
    const server = createViteServer()
    initDevframeMock.mockReturnValue(instance)
    const plugin = createAnalyzeDashboardViteBridge(definition)

    await configurePlugin(plugin, server)

    expect(initDevframeMock).toHaveBeenCalledWith(
      { id: 'weapp-vite' },
      {
        allowedOrigins: [],
        auth: true,
        base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
        distDir: false,
        mcp: false,
        server: server.httpServer,
      },
    )
    expect(server.middlewares.use).toHaveBeenCalledWith(instance.nodeMiddleware)

    await (plugin.closeBundle as () => Promise<void>)()
    expect(instance.close).toHaveBeenCalledTimes(1)
  })

  it('closes a failed Devframe instance and surfaces startup errors', async () => {
    const instance = createInstance({
      ready: Promise.reject(new Error('bridge failed')),
    })
    initDevframeMock.mockReturnValue(instance)
    const plugin = createAnalyzeDashboardViteBridge(definition)

    await expect(configurePlugin(plugin, createViteServer())).rejects.toThrow('bridge failed')
    expect(instance.close).toHaveBeenCalledTimes(1)
  })
})
