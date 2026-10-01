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

vi.mock('devframe/initiate', () => ({
  initDevframe: initDevframeMock,
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
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'dashboard-lifecycle-')))
  })

  afterEach(async () => {
    await Promise.allSettled(servers.splice(0).map(server => server.close()))
    await fs.rm(root, { recursive: true, force: true })
  })

  it('closes the owned instance only once through native Vite shutdown', async () => {
    const instance = createInstance()
    initDevframeMock.mockReturnValue(instance)
    const server = await createHost(createAnalyzeDashboardViteBridge(controller, { mcpAuthToken: '' }))
    await server.listen()
    await server.close()
    await server.close()
    expect(instance.close).toHaveBeenCalledTimes(1)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it('releases controller state even when transport cleanup fails', async () => {
    initDevframeMock.mockReturnValue(createInstance({ close: vi.fn().mockRejectedValue(new Error('transport close failed')) }))
    const server = await createHost(createAnalyzeDashboardViteBridge(controller, { mcpAuthToken: '' }))
    await server.listen()
    await server.close().catch(() => {})
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it('releases the controller when initialization throws before creating an instance', async () => {
    const failure = new Error('invalid bridge configuration')
    initDevframeMock.mockImplementationOnce(() => {
      throw failure
    })
    const server = await createHost(createAnalyzeDashboardViteBridge(controller, { mcpAuthToken: '' }))
    await expect(server.listen()).rejects.toBe(failure)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('preserves the setup error and releases a failed instance (close failure=%s)', async (closeFails) => {
    const failure = new Error('setup failed')
    const instance = createInstance({
      close: closeFails ? vi.fn().mockRejectedValue(new Error('close failed')) : vi.fn(async () => {}),
    })
    Object.defineProperty(instance, 'ready', { get: () => Promise.reject(failure) })
    initDevframeMock.mockReturnValue(instance)
    const server = await createHost(createAnalyzeDashboardViteBridge(controller, { mcpAuthToken: '' }))
    await expect(server.listen()).rejects.toBe(failure)
    expect(instance.close).toHaveBeenCalledTimes(1)
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })
})
