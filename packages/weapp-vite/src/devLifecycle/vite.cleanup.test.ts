import type { InlineConfig, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import type { ViteWatcherAcquisition } from '../runtime/watch/viteAdapter'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDevShutdownScope } from './shutdown'
import { createDevViteServer } from './vite'

const mocks = vi.hoisted(() => ({
  resolveConfig: vi.fn(),
  createServer: vi.fn(),
  prepare: vi.fn(),
  acquisition: vi.fn(),
}))
vi.mock('vite', () => ({
  resolveConfig: mocks.resolveConfig,
  createServer: mocks.createServer,
  mergeConfig: (left: object, right: object) => ({ ...left, ...right }),
}))
vi.mock('../runtime/watch/viteAdapter', () => ({
  prepareViteWatcherAdapter: mocks.prepare,
  getViteWatcherAcquisition: mocks.acquisition,
  adapterRegistrationReady: async () => 'ready',
}))

const initialExitCode = process.exitCode
let nativeClose: ReturnType<typeof vi.fn>
let adapter: ViteWatcherAcquisition

beforeEach(() => {
  vi.clearAllMocks()
  process.exitCode = undefined
  if (process.disconnect) {
    vi.spyOn(process, 'disconnect').mockImplementation(() => {})
  }
  nativeClose = vi.fn(async () => {})
  adapter = { mode: 'adapter', activate: async () => 'ready', close: vi.fn(async () => {}), closeFailures: () => ({ watchers: [], environments: [] }) }
  mocks.prepare.mockReturnValue(adapter)
  mocks.acquisition.mockReturnValue(adapter)
  mocks.resolveConfig.mockImplementation(async (inline: InlineConfig, ...args: unknown[]) => {
    const plugins = [...(inline.plugins ?? [])] as Plugin[]
    ;(args[5] as (plugins: Plugin[]) => void)(plugins)
    return { ...inline, plugins, inlineConfig: inline } as ResolvedConfig
  })
  mocks.createServer.mockImplementation(async (config: ResolvedConfig) => {
    const server = { config, close: nativeClose, restart: async () => {} } as unknown as ViteDevServer
    for (const plugin of config.plugins) {
      const hook = typeof plugin.configureServer === 'function' ? plugin.configureServer : plugin.configureServer?.handler
      await hook?.call({} as never, server)
    }
    return server
  })
})

afterEach(() => {
  process.exitCode = initialExitCode
  vi.restoreAllMocks()
})

it.each(['native', 'adapter'] as const)('retains a failed %s close owner for final command shutdown', async (owner) => {
  const original = new Error(`${owner} close failed`)
  if (owner === 'native') {
    nativeClose.mockRejectedValue(original)
  }
  else {
    vi.mocked(adapter.close).mockRejectedValue(original)
  }
  const scope = createDevShutdownScope()
  try {
    const server = await scope.run('startup', () => createDevViteServer({}))
    await expect(server.close()).rejects.toBe(original)
    await expect(scope.close()).rejects.toBe(original)
  }
  finally {
    await scope.close().catch(() => {})
  }
})

it('retains an acquisition cleanup failure when startup never hands over a server', async () => {
  const initialization = new Error('server initialization failed')
  const cleanup = new Error('acquisition cleanup failed')
  mocks.createServer.mockRejectedValue(initialization)
  vi.mocked(adapter.close).mockRejectedValue(cleanup)
  const scope = createDevShutdownScope()
  try {
    await expect(scope.run('startup', () => createDevViteServer({}))).rejects.toMatchObject({ errors: [initialization, cleanup] })
    await expect(scope.close()).rejects.toBe(cleanup)
  }
  finally {
    await scope.close().catch(() => {})
  }
})

it('unregisters a successfully closed acquisition before final command shutdown', async () => {
  const scope = createDevShutdownScope()
  try {
    const server = await scope.run('startup', () => createDevViteServer({}))
    await server.close()
    const closed = vi.mocked(adapter.close).mock.calls.length
    await scope.close()
    expect(adapter.close).toHaveBeenCalledTimes(closed)
    expect(nativeClose).toHaveBeenCalledTimes(1)
  }
  finally {
    await scope.close().catch(() => {})
  }
})

it('retains a user close wrapper failure after the underlying generation retired successfully', async () => {
  const original = new Error('user close wrapper failed after host cleanup')
  const scope = createDevShutdownScope()
  try {
    const server = await scope.run('startup', () => createDevViteServer({}))
    const previous = server.close
    server.close = async () => {
      await previous()
      throw original
    }
    await expect(server.close()).rejects.toBe(original)
    const closed = vi.mocked(adapter.close).mock.calls.length
    await expect(scope.close()).rejects.toBe(original)
    expect(adapter.close).toHaveBeenCalledTimes(closed)
  }
  finally {
    await scope.close().catch(() => {})
  }
})
