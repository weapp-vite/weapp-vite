import type { DevframeDefinition } from 'devframe'
import type { DevframeInstance } from 'devframe/initiate'
import type { Plugin, ViteDevServer } from 'vite'
import type { AnalyzeDashboardDevframeController } from '../../dashboard'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANALYZE_DASHBOARD_DEVFRAME_BASE,
  createAnalyzeDashboardViteBridge,
} from './dashboardViteBridge'

const initDevframeMock = vi.hoisted(() => vi.fn())
const createDashboardMcpMock = vi.hoisted(() => vi.fn())

vi.mock('devframe/initiate', () => ({
  initDevframe: initDevframeMock,
}))

vi.mock('./dashboardMcp', () => ({
  createDashboardMcp: createDashboardMcpMock,
}))

const definition = { id: 'weapp-vite' } as unknown as DevframeDefinition
const controller: AnalyzeDashboardDevframeController = {
  definition,
  update: async () => {},
  emitRuntimeEvents: () => {},
  dispose: vi.fn(),
}
const servers: ViteDevServer[] = []
let root: string

function createInstance(overrides: Partial<DevframeInstance> = {}): DevframeInstance {
  return {
    base: ANALYZE_DASHBOARD_DEVFRAME_BASE,
    close: vi.fn(async () => {}),
    nodeMiddleware: vi.fn(),
    ready: Promise.resolve(),
    ...overrides,
  } as unknown as DevframeInstance
}

async function createHost(plugin: Plugin) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [plugin],
    server: { host: '127.0.0.1', port: 0, watch: null },
  })
  servers.push(server)
  return server
}

describe('analyze Dashboard Vite bridge', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    createDashboardMcpMock.mockResolvedValue({
      route: `${ANALYZE_DASHBOARD_DEVFRAME_BASE}__mcp`,
      register: vi.fn(),
      close: vi.fn(async () => {}),
    })
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-lifecycle-')))
  })

  afterEach(async () => {
    await Promise.allSettled(servers.splice(0).map(server => server.close()))
    await fs.rm(root, { recursive: true, force: true })
  })

  it('closes the owned instance only once through native Vite shutdown', async () => {
    const instance = createInstance()
    initDevframeMock.mockReturnValue(instance)
    const server = await createHost(createAnalyzeDashboardViteBridge(controller))
    await server.listen()
    await server.close()
    await server.close()
    expect(instance.close).toHaveBeenCalledTimes(1)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it('releases controller state even when transport cleanup fails', async () => {
    initDevframeMock.mockReturnValue(createInstance({ close: vi.fn().mockRejectedValue(new Error('transport close failed')) }))
    const server = await createHost(createAnalyzeDashboardViteBridge(controller))
    await server.listen()
    await server.close().catch(() => {})
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it('retains MCP and transport failures after native Vite has settled its environment cleanup', async () => {
    const mcpFailure = new Error('MCP close failed')
    const transportFailure = new Error('transport close failed')
    const mcpClose = vi.fn().mockRejectedValue(mcpFailure)
    const instance = createInstance({ close: vi.fn().mockRejectedValue(transportFailure) })
    initDevframeMock.mockReturnValue(instance)
    createDashboardMcpMock.mockResolvedValueOnce({ register: vi.fn(), close: mcpClose })
    const bridge = createAnalyzeDashboardViteBridge(controller)
    const server = await createHost(bridge)
    await server.listen()
    await server.close()
    const closing = bridge.close()
    expect(bridge.close()).toBe(closing)
    await expect(closing).rejects.toMatchObject({ errors: [mcpFailure, transportFailure] })
    expect(mcpClose).toHaveBeenCalledTimes(1)
    expect(instance.close).toHaveBeenCalledTimes(1)
  })

  it('waits for late MCP acquisition and releases the transport even if MCP cleanup fails', async () => {
    const acquired = Promise.withResolvers<{ register: () => void, close: () => Promise<void> }>()
    const mcpFailure = new Error('late MCP close failed')
    const mcp = { register: vi.fn(), close: vi.fn().mockRejectedValue(mcpFailure) }
    const instance = createInstance()
    initDevframeMock.mockReturnValue(instance)
    createDashboardMcpMock.mockReturnValueOnce(acquired.promise)
    const bridge = createAnalyzeDashboardViteBridge(controller)
    const server = await createHost(bridge)
    const listening = server.listen().then(() => undefined, error => error)
    try {
      await vi.waitFor(() => expect(createDashboardMcpMock).toHaveBeenCalledTimes(1))
      const settled = vi.fn()
      const closing = bridge.close().then(settled, (error) => {
        settled()
        return error
      })
      const nativeClosing = server.close()
      await Promise.resolve()
      await Promise.resolve()
      expect(settled).not.toHaveBeenCalled()
      expect(instance.close).not.toHaveBeenCalled()
      acquired.resolve(mcp)
      expect(await closing).toBe(mcpFailure)
      await Promise.all([nativeClosing, listening])
      expect(mcp.register).not.toHaveBeenCalled()
      expect(mcp.close).toHaveBeenCalledTimes(1)
      expect(instance.close).toHaveBeenCalledTimes(1)
      expect(server.httpServer?.listening).toBe(false)
      expect(await listening).toMatchObject({ message: 'Dashboard host initialization was cancelled by shutdown.' })
    }
    finally {
      acquired.resolve(mcp)
      await listening
    }
  })

  it('waits for pending setup without starting MCP after shutdown', async () => {
    const ready = Promise.withResolvers<void>()
    const instance = createInstance({ ready: ready.promise })
    initDevframeMock.mockReturnValue(instance)
    const bridge = createAnalyzeDashboardViteBridge(controller)
    const server = await createHost(bridge)
    const listening = server.listen().then(() => undefined, error => error)
    try {
      await vi.waitFor(() => expect(initDevframeMock).toHaveBeenCalledTimes(1))
      const closing = bridge.close()
      const nativeClosing = server.close()
      expect(instance.close).not.toHaveBeenCalled()
      ready.resolve()
      await Promise.all([closing, nativeClosing, listening])
      expect(createDashboardMcpMock).not.toHaveBeenCalled()
      expect(instance.close).toHaveBeenCalledTimes(1)
      expect(server.httpServer?.listening).toBe(false)
      expect(await listening).toMatchObject({ message: 'Dashboard host initialization was cancelled by shutdown.' })
    }
    finally {
      ready.resolve()
      await listening
    }
  })

  it('releases the controller when initialization throws before creating an instance', async () => {
    const failure = new Error('invalid bridge configuration')
    initDevframeMock.mockImplementationOnce(() => {
      throw failure
    })
    const server = await createHost(createAnalyzeDashboardViteBridge(controller))
    await expect(server.listen()).rejects.toBe(failure)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('preserves the setup error and releases a failed instance (close failure=%s)', async (closeFails) => {
    const failure = new Error('setup failed')
    const cleanupFailure = new Error('close failed')
    const instance = createInstance({
      close: closeFails ? vi.fn().mockRejectedValue(cleanupFailure) : vi.fn(async () => {}),
    })
    Object.defineProperty(instance, 'ready', { get: () => Promise.reject(failure) })
    initDevframeMock.mockReturnValue(instance)
    const bridge = createAnalyzeDashboardViteBridge(controller)
    const server = await createHost(bridge)
    await expect(server.listen()).rejects.toBe(failure)
    expect(instance.close).toHaveBeenCalledTimes(1)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
    if (closeFails) {
      await expect(bridge.close()).rejects.toBe(cleanupFailure)
    }
    else {
      await bridge.close()
    }
  })
})
