import type { ChokidarOptions } from 'chokidar'
import type { DevEnvironment, InlineConfig, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import process from 'node:process'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { adapterRegistrationReady, getViteWatcherAcquisition } from '../runtime/watch/viteAdapter'
import { createDevShutdownScope } from './shutdown'
import { createDevViteServer } from './vite'

const mocks = vi.hoisted(() => ({ resolveConfig: vi.fn(), createServer: vi.fn(), watch: vi.fn() }))
vi.mock('vite', () => ({
  resolveConfig: mocks.resolveConfig,
  createServer: mocks.createServer,
  mergeConfig: (left: object, right: object) => ({ ...left, ...right }),
}))
vi.mock('chokidar', () => ({ default: { watch: mocks.watch } }))
vi.mock('../runtime/watch/viteAdapter/physical', () => ({
  planPhysicalViteWatchTargets: async (targets: string[], options: ChokidarOptions, accepts: (file: string) => boolean, active: () => boolean) => active()
    ? targets.filter(accepts).map(target => ({ root: target.slice(0, target.lastIndexOf('/')) || '/', targets: [target], options, identity: { dev: 1, ino: 1 }, reachable: (file: string) => file === target || file.startsWith(`${target}/`) }))
    : [],
  isPhysicalViteWatchPlanCurrent: async () => true,
}))

class Backend extends EventEmitter {
  options?: ChokidarOptions
  unwatch = vi.fn()
  close = vi.fn(async () => { this.removeAllListeners() })
  getWatched = vi.fn((): Record<string, string[]> => ({ '/project': ['a.ts'] }))
}

let watchers: Backend[]
let createdEnvironments: DevEnvironment[]
let nativeWatchSelections: unknown[]
const previousInstance = {} as DevEnvironment
const initialExitCode = process.exitCode

function hook(plugin: Plugin) {
  const configure = plugin.configureServer
  return typeof configure === 'function' ? configure : configure?.handler
}

beforeEach(() => {
  process.exitCode = undefined
  if (process.disconnect) {
    vi.spyOn(process, 'disconnect').mockImplementation(() => {})
  }
  vi.useFakeTimers()
  vi.clearAllMocks()
  watchers = []
  createdEnvironments = []
  nativeWatchSelections = []
  mocks.watch.mockImplementation((_targets: string[], options: ChokidarOptions) => {
    const backend = new Backend()
    backend.options = options
    watchers.push(backend)
    return backend
  })
  mocks.resolveConfig.mockImplementation(async (inline: InlineConfig, ...args: unknown[]) => {
    const plugins = (inline.plugins ?? []) as Plugin[]
    const resolved = {
      ...inline,
      root: '/project',
      mode: 'development',
      configFileDependencies: [],
      envDir: false,
      publicDir: '',
      experimental: {},
      server: { ...inline.server },
      plugins: [...plugins],
      environments: inline.environments,
      inlineConfig: inline,
    } as unknown as ResolvedConfig
    const patchPlugins = args[5] as ((plugins: Plugin[]) => void)
    patchPlugins(resolved.plugins)
    for (const plugin of plugins) {
      const handler = typeof plugin.configResolved === 'function' ? plugin.configResolved : plugin.configResolved?.handler
      await handler?.call({} as never, resolved)
    }
    return resolved
  })
  mocks.createServer.mockImplementation(async (config: ResolvedConfig) => {
    nativeWatchSelections.push(config.server.watch)
    const facade = new EventEmitter() as ViteDevServer['watcher']
    facade.options = { ignoreInitial: true, disableGlobbing: true, ignored: ['**/node_modules/**'] }
    facade.close = vi.fn(async () => {})
    facade.on('error', () => {})
    const environments = await Promise.all(Object.entries(config.environments).map(async ([name, options]) => {
      const environment = await options.dev.createEnvironment(name, config, { ws: {} as never })
      createdEnvironments.push(environment)
      await environment.init({ watcher: facade, previousInstance })
      return environment
    }))
    const server = {
      config,
      watcher: facade,
      environments,
      async close() { await Promise.allSettled([facade.close()]) },
      async restart() {},
    } as unknown as ViteDevServer
    for (const plugin of config.plugins) {
      await hook(plugin)?.call({} as never, server)
    }
    return server
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  process.exitCode = initialExitCode
  vi.restoreAllMocks()
})

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) {
      return
    }
    await Promise.resolve()
  }
  throw new Error('Mock Vite startup did not reach the expected phase')
}

function configuration(init?: (options: Parameters<DevEnvironment['init']>[0]) => Promise<void>) {
  const requested = { usePolling: true, interval: 17 }
  let environment: DevEnvironment
  let dev: { createEnvironment: ReturnType<typeof vi.fn> }
  const originalInit = vi.fn(async function (this: DevEnvironment, options: Parameters<DevEnvironment['init']>[0]) {
    expect(this).toBe(environment)
    await init?.(options)
  })
  environment = { init: originalInit } as unknown as DevEnvironment
  const factory = vi.fn(function (this: unknown, _name: string, config: ResolvedConfig) {
    expect(this).toBe(dev)
    expect(config.server.watch).toBe(requested)
    return environment
  })
  dev = { createEnvironment: factory }
  const config = { server: { watch: requested }, environments: { client: { dev } } } as unknown as InlineConfig
  return { config, environment, originalInit, requested }
}

it('adapts product-owned hosts without a shutdown scope after complete configuration resolution', async () => {
  const fixture = configuration(async (options) => {
    options!.watcher!.add('/external/dependency.ts')
  })
  const resolved = vi.fn((config: ResolvedConfig) => expect(config.server.watch).toBe(fixture.requested))
  fixture.config.plugins = [{ name: 'observe-original-config', configResolved: resolved }]
  let returned = false
  const creating = createDevViteServer(fixture.config).then((server) => {
    returned = true
    return server
  })
  await until(() => watchers.length === 2)
  expect(nativeWatchSelections).toEqual([null])
  expect(returned).toBe(false)
  expect(createdEnvironments).toEqual([fixture.environment])
  expect(fixture.originalInit.mock.calls[0]![0]!.previousInstance).toBe(previousInstance)
  expect(watchers[0]!.options).toMatchObject({ usePolling: true, interval: 17, persistent: false })
  watchers.forEach(watcher => watcher.emit('ready'))
  const server = await creating
  expect(resolved).toHaveBeenCalledTimes(1)
  expect(server.config.server.watch).toBe(fixture.requested)
  await expect(adapterRegistrationReady(server)).resolves.toBe('ready')
  await server.close()
  expect(watchers.every(watcher => watcher.close.mock.calls.length === 1)).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('shares one facade owner between concurrent environments', async () => {
  const fixture = configuration()
  fixture.config.environments!.ssr = {
    dev: { createEnvironment: vi.fn(() => ({ init: vi.fn(async () => {}) }) as unknown as DevEnvironment) },
  }
  const creating = createDevViteServer(fixture.config)
  await until(() => watchers.length === 1)
  watchers[0]!.emit('ready')
  const server = await creating
  expect(createdEnvironments).toHaveLength(2)
  expect(watchers).toHaveLength(1)
  await server.close()
})

it('preserves an explicit user watch:null', async () => {
  const environment = { init: vi.fn(async () => {}) } as unknown as DevEnvironment
  const server = await createDevViteServer({
    server: { watch: null },
    environments: { client: { dev: { createEnvironment: () => environment } } },
  })
  expect(nativeWatchSelections).toEqual([null])
  expect(watchers).toHaveLength(0)
  expect(server.config.server.watch).toBeNull()
  await expect(adapterRegistrationReady(server)).resolves.toBe('disabled')
  await server.close()
})

it.each([{ disableGlobbing: false }, { useFsEvents: true, usePolling: false }, { followSymlinks: false }])('keeps native watcher ownership for explicit %j', async (requested) => {
  vi.stubEnv('CHOKIDAR_USEPOLLING', undefined)
  const originalInit = vi.fn(async () => {})
  const environment = { init: originalInit } as unknown as DevEnvironment
  const factory = vi.fn((_name: string, config: ResolvedConfig) => {
    expect(config.server.watch).toBe(requested)
    return environment
  })
  const server = await createDevViteServer({
    server: { watch: requested },
    environments: { client: { dev: { createEnvironment: factory } } },
  })
  expect(server.config.environments.client!.dev.createEnvironment).toBe(factory)
  expect(environment.init).toBe(originalInit)
  expect(nativeWatchSelections).toEqual([requested])
  expect(watchers).toHaveLength(0)
  expect(getViteWatcherAcquisition(server.config)?.mode).toBe('native')
  await expect(adapterRegistrationReady(server)).resolves.toBe('native')
  await server.close()
})

it('drains an acquired watcher when environment initialization fails before configureServer', async () => {
  const original = new Error('environment initialization failed')
  const fixture = configuration(async () => {
    await until(() => watchers.length === 1)
    throw original
  })
  await expect(createDevViteServer(fixture.config)).rejects.toBe(original)
  expect(watchers).toHaveLength(1)
  expect(watchers[0]!.close).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

it('retains registration failures and closes the owner before rejecting startup', async () => {
  const original = new Error('native registration failed')
  const creating = createDevViteServer(configuration().config)
  await until(() => watchers.length === 1)
  watchers[0]!.emit('error', original)
  await expect(creating).rejects.toBe(original)
  expect(watchers[0]!.close).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})

it('exposes backing close failures even when native Vite close swallows them', async () => {
  const creating = createDevViteServer(configuration().config)
  await until(() => watchers.length === 1)
  watchers[0]!.emit('ready')
  const server = await creating
  const original = new Error('watcher close failed')
  watchers[0]!.close.mockRejectedValue(original)
  await expect(server.close()).rejects.toBe(original)
  expect(vi.getTimerCount()).toBe(0)
})

it('releases an explicitly closed generation before the command stopping signal', async () => {
  const scope = createDevShutdownScope()
  const creating = scope.run('startup', () => createDevViteServer(configuration().config))
  try {
    await until(() => watchers.length === 1)
    watchers[0]!.emit('ready')
    const server = await creating
    const adapter = getViteWatcherAcquisition(server.config)!
    const closed = vi.spyOn(adapter, 'close')
    await server.close()
    const callsAfterClose = closed.mock.calls.length
    await scope.close()
    expect(closed).toHaveBeenCalledTimes(callsAfterClose)
  }
  finally {
    await creating.catch(() => {})
    await scope.close().catch(() => {})
  }
})

it('keeps the Noop selection when startup is cancelled before Vite acquires its watcher', async () => {
  const scope = createDevShutdownScope()
  const entered = Promise.withResolvers<void>()
  const resolved = Promise.withResolvers<void>()
  const fixture = configuration()
  fixture.config.plugins = [{
    name: 'pause-config-before-watcher-acquisition',
    async configResolved() {
      entered.resolve()
      await resolved.promise
    },
  }]
  const creating = scope.run('startup', () => createDevViteServer(fixture.config))
  try {
    await entered.promise
    scope.request()
    resolved.resolve()
    await creating
    await scope.close()
    expect(nativeWatchSelections).toEqual([null])
    expect(watchers).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  }
  finally {
    resolved.resolve()
    await creating.catch(() => {})
    await scope.close().catch(() => {})
  }
})

function originalErrors(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(originalErrors) : [error]
}

it('waits for concurrent factories and retains every original failure plus watcher cleanup errors', async () => {
  const first = new Error('first environment failed')
  const second = new Error('second factory failed')
  const cleanup = new Error('watcher close failed')
  const delayed = Promise.withResolvers<DevEnvironment>()
  const failInitialization = Promise.withResolvers<void>()
  const fixture = configuration(async () => {
    await failInitialization.promise
    throw first
  })
  fixture.config.environments!.ssr = { dev: { createEnvironment: () => delayed.promise } }
  let settled = false
  const creating = createDevViteServer(fixture.config).catch((error: unknown) => {
    settled = true
    return error
  })
  await until(() => watchers.length === 1)
  watchers[0]!.close.mockRejectedValue(cleanup)
  failInitialization.resolve()
  await until(() => watchers[0]!.close.mock.calls.length === 1)
  for (let turn = 0; turn < 30; turn++) {
    await Promise.resolve()
  }
  const settledBeforeSecondFactory = settled
  delayed.reject(second)
  const error = await creating
  expect(settledBeforeSecondFactory).toBe(false)
  expect(originalErrors(error)).toEqual(expect.arrayContaining([first, second, cleanup]))
  expect(vi.getTimerCount()).toBe(0)
})

it('closes every acquired environment after startup fails even if another environment close throws synchronously', async () => {
  const original = new Error('first initialization failed')
  const closeError = new Error('environment close failed')
  const delayed = Promise.withResolvers<DevEnvironment>()
  const fixture = configuration(async () => {
    await until(() => watchers.length === 1)
    throw original
  })
  fixture.environment.close = vi.fn(() => {
    throw closeError
  })
  const sibling = { init: vi.fn(async () => {}), close: vi.fn(async () => {}) } as unknown as DevEnvironment
  fixture.config.environments!.ssr = { dev: { createEnvironment: () => delayed.promise } }
  const creating = createDevViteServer(fixture.config).catch((error: unknown) => error)
  await until(() => watchers.length === 1 && watchers[0]!.close.mock.calls.length === 1)
  delayed.resolve(sibling)
  const error = await creating
  expect(fixture.environment.close).toHaveBeenCalledTimes(1)
  expect(sibling.close).toHaveBeenCalledTimes(1)
  expect(originalErrors(error)).toEqual(expect.arrayContaining([original, closeError]))
  const resolvedConfig = mocks.createServer.mock.calls[0]![0] as ResolvedConfig
  expect(getViteWatcherAcquisition(resolvedConfig)!.closeFailures().environments).toEqual([
    expect.objectContaining({ error: closeError }),
  ])
  expect(fixture.environment.init).toBe(fixture.originalInit)
  expect(vi.getTimerCount()).toBe(0)
})
