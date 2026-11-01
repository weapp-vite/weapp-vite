import type { CompilerContext } from '../../context'
import type { WatcherService } from '../../runtime/watcherPlugin'
import type { WeappCompilerPlugin, WeappCompilerPluginContext, WeappCompilerPluginController } from '../../types/compilerPlugin'
import { expect, it, vi } from 'vitest'
import { retainWatcherService } from '../../runtime/watcherPlugin'
import { getCompilerHmrHost } from './hmr'
import { createCompilerPluginPlugins } from './index'

function hook(plugin: any, name: string) {
  const value = plugin[name]
  return typeof value === 'function' ? value : value.handler
}

it('retains snapshot controllers until development closes and forwards pending changes before rebuilding', async () => {
  const events: string[] = []
  const watcherService = { closeAll: vi.fn() } as unknown as WatcherService
  const pending: Array<{ file: string, event: string }> = []
  const ctx = {
    watcherService,
    moduleGraphService: { getPendingChanges: () => pending },
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      platform: 'weapp',
      isDev: true,
      outputExtensions: { wxss: 'wxss' },
      weappViteConfig: { compilerPlugins: [{ name: 'lifecycle', create: () => ({
        buildStart: () => { events.push('build') },
        watchChange: () => { events.push('watch') },
        closeBundle: () => { events.push('close') },
        dispose: () => { events.push('dispose') },
      }) }] },
    },
  } as unknown as CompilerContext
  const [source, output] = createCompilerPluginPlugins(ctx)
  const release = retainWatcherService(watcherService)
  hook(source, 'configResolved').call({}, { command: 'build', build: {} })
  await hook(source, 'buildStart').call({})
  await hook(output, 'closeBundle').call({})
  expect(events).toEqual(['build'])
  pending.push({ file: '/project/src/tokens.json', event: 'update' })
  await hook(source, 'buildStart').call({})
  await hook(output, 'closeBundle').call({})
  expect(events).toEqual(['build', 'watch', 'build'])
  await release()
  await release()
  await hook(output, 'closeBundle').call({})
  expect(events).toEqual(['build', 'watch', 'build', 'close', 'dispose'])
})

function lifecycleProvidersFixture(providers: WeappCompilerPlugin[]) {
  const ctx = {
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      platform: 'weapp',
      isDev: false,
      outputExtensions: { wxss: 'wxss' },
      weappViteConfig: { compilerPlugins: providers },
    },
  } as unknown as CompilerContext
  const native = { resolve: vi.fn(async () => ({ id: 'resolved.js' })), addWatchFile: vi.fn() }
  const config = { command: 'build', build: {} }
  const [source, output] = createCompilerPluginPlugins(ctx)
  hook(source, 'configResolved').call(native, config)
  return { ctx, native, config, source, output }
}

function lifecycleFixture(create: (context: WeappCompilerPluginContext) => WeappCompilerPluginController | Promise<WeappCompilerPluginController>) {
  const provider = { name: 'terminal-lifecycle', create: vi.fn(create) }
  return { ...lifecycleProvidersFixture([provider]), provider }
}

function failureReasons(error: unknown): unknown[] {
  return error instanceof AggregateError ? error.errors.flatMap(failureReasons) : [error]
}

it.each(['closeBundle', 'closeWatcher'])('keeps compiler context usable during %s disposal and releases its native references afterwards', async (closeMethod) => {
  let retained!: WeappCompilerPluginContext
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const fixture = lifecycleFixture((context) => {
    retained = context
    return { async dispose() {
      entered.resolve()
      await release.promise
      expect(context.resolvedConfig).toBe(fixture.config)
      expect(await context.resolve('during-dispose')).toEqual({ id: 'resolved.js' })
    } }
  })
  await hook(fixture.source, 'buildStart').call(fixture.native)
  const closePlugin = closeMethod === 'closeBundle' ? fixture.output : fixture.source
  const closing = hook(closePlugin, closeMethod).call({})
  await entered.promise
  expect(retained.resolvedConfig).toBe(fixture.config)
  expect(fixture.provider.create.mock.contexts).toEqual([fixture.provider])
  release.resolve()
  await closing
  expect(retained.resolvedConfig).toBeUndefined()
  fixture.native.resolve.mockClear()
  fixture.native.addWatchFile.mockClear()
  expect(await retained.resolve('after-dispose')).toBeNull()
  retained.addWatchFile('/project/src/after-dispose.json')
  expect(fixture.native.resolve).not.toHaveBeenCalled()
  expect(fixture.native.addWatchFile).not.toHaveBeenCalled()
})

it.each([false, true])('shares pending disposal across concurrent and repeated close calls (failure: %s)', async (fails) => {
  let retained!: WeappCompilerPluginContext
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const failure = new Error('controller disposal failed')
  const dispose = vi.fn(async () => {
    entered.resolve()
    await release.promise
    if (fails) {
      throw failure
    }
  })
  const closeBundle = vi.fn()
  const closeWatcher = vi.fn()
  const fixture = lifecycleFixture((context) => {
    retained = context
    return { dispose, closeBundle, closeWatcher }
  })
  await hook(fixture.source, 'buildStart').call(fixture.native)
  const completed: number[] = []
  const calls = [hook(fixture.output, 'closeBundle').call({})]
  await entered.promise
  calls.push(hook(fixture.output, 'closeBundle').call({}), hook(fixture.source, 'closeWatcher').call({}), hook(fixture.source, 'closeWatcher').call({}))
  const outcomes = calls.map((call, index) => Promise.resolve(call).then(() => {
    completed.push(index)
    return undefined
  }, (error: unknown) => {
    completed.push(index)
    return error
  }))
  await new Promise(resolve => setImmediate(resolve))
  expect(completed).toEqual([])
  expect(retained.resolvedConfig).toBe(fixture.config)
  release.resolve()
  expect(await Promise.all(outcomes)).toEqual(Array.from({ length: 4 }).fill(fails ? failure : undefined))
  expect(dispose).toHaveBeenCalledOnce()
  expect(closeBundle).toHaveBeenCalledOnce()
  expect(closeWatcher).toHaveBeenCalledOnce()
  expect(retained.resolvedConfig).toBeUndefined()
  expect(await retained.resolve('after-dispose')).toBeNull()
  const repeated = Promise.resolve(hook(fixture.output, 'closeBundle').call({})).catch((error: unknown) => error)
  expect(await repeated).toBe(fails ? failure : undefined)
})

it('retains native context until an already entered closeWatcher hook finishes after disposal', async () => {
  let retained!: WeappCompilerPluginContext
  const disposing = Promise.withResolvers<void>()
  const releaseDispose = Promise.withResolvers<void>()
  const watching = Promise.withResolvers<void>()
  const releaseWatcher = Promise.withResolvers<void>()
  let observedConfig: unknown
  let observedResolution: unknown
  const fixture = lifecycleFixture((context) => {
    retained = context
    return {
      async dispose() {
        disposing.resolve()
        await releaseDispose.promise
      },
      async closeWatcher() {
        watching.resolve()
        await releaseWatcher.promise
        observedConfig = context.resolvedConfig
        observedResolution = await context.resolve('closing-watcher')
      },
    }
  })
  await hook(fixture.source, 'buildStart').call(fixture.native)
  const bundleClose = hook(fixture.output, 'closeBundle').call({})
  await disposing.promise
  const watcherClose = hook(fixture.source, 'closeWatcher').call({})
  try {
    await watching.promise
    releaseDispose.resolve()
    await bundleClose
    expect(retained.resolvedConfig).toBe(fixture.config)
  }
  finally {
    releaseDispose.resolve()
    releaseWatcher.resolve()
    await Promise.all([bundleClose, watcherClose])
  }
  expect(observedConfig).toBe(fixture.config)
  expect(observedResolution).toEqual({ id: 'resolved.js' })
  expect(retained.resolvedConfig).toBeUndefined()
  expect(await retained.resolve('after-watcher-close')).toBeNull()
})

it('waits for pending controller initialization before disposing and releasing context references', async () => {
  let retained!: WeappCompilerPluginContext
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const dispose = vi.fn()
  const fixture = lifecycleFixture(async (context) => {
    retained = context
    entered.resolve()
    await release.promise
    expect(context.resolvedConfig).toBe(fixture.config)
    return { dispose }
  })
  const building = hook(fixture.source, 'buildStart').call(fixture.native)
  await entered.promise
  let closed = false
  const closing = Promise.resolve(hook(fixture.output, 'closeBundle').call({})).then(() => {
    closed = true
  })
  await new Promise(resolve => setImmediate(resolve))
  expect(closed).toBe(false)
  expect(dispose).not.toHaveBeenCalled()
  expect(retained.resolvedConfig).toBe(fixture.config)
  release.resolve()
  await Promise.all([building, closing])
  expect(dispose).toHaveBeenCalledOnce()
  expect(retained.resolvedConfig).toBeUndefined()
  expect(await retained.resolve('after-dispose')).toBeNull()
})

it.each(['closeBundle', 'closeWatcher'] as const)('waits for every provider and retains close and disposal failures from %s', async (closeMethod) => {
  const closeFailures = [new Error('first close failed'), new Error('second close failed')]
  const disposeFailures = [new Error('first disposal failed'), new Error('second disposal failed')]
  const release = Promise.withResolvers<void>()
  const close = [vi.fn(() => {
    throw closeFailures[0]
  }), vi.fn(async () => {
    await release.promise
    throw closeFailures[1]
  }), vi.fn()]
  const dispose = [vi.fn(() => {
    throw disposeFailures[0]
  }), vi.fn(() => {
    throw disposeFailures[1]
  }), vi.fn()]
  const fixture = lifecycleProvidersFixture(close.map((cleanup, index) => ({
    name: `cleanup-${index}`,
    create: () => ({ [closeMethod]: cleanup, dispose: dispose[index] }),
  })))
  await hook(fixture.source, 'buildStart').call(fixture.native)
  const plugin = closeMethod === 'closeBundle' ? fixture.output : fixture.source
  let completed = false
  const closing = Promise.resolve(hook(plugin, closeMethod).call({})).catch((error: unknown) => error).then((error) => {
    completed = true
    return error
  })
  const repeated = Promise.resolve(hook(plugin, closeMethod).call({})).catch((error: unknown) => error)
  try {
    await new Promise(resolve => setImmediate(resolve))
    expect(close.every(cleanup => cleanup.mock.calls.length === 1)).toBe(true)
    expect(completed).toBe(false)
    release.resolve()
    const failure = await closing
    expect(failureReasons(failure)).toEqual([...closeFailures, ...disposeFailures])
    expect(await repeated).toBe(failure)
    expect(dispose.every(cleanup => cleanup.mock.calls.length === 1)).toBe(true)
  }
  finally {
    release.resolve()
    await Promise.all([closing, repeated])
  }
})

it('shares complete multi-provider disposal across bundle and watcher closure after an earlier disposal fails', async () => {
  const failure = new Error('first disposal failed')
  const release = Promise.withResolvers<void>()
  const first = vi.fn(() => {
    throw failure
  })
  const last = vi.fn(async () => {
    await release.promise
  })
  const fixture = lifecycleProvidersFixture([
    { name: 'first', create: () => ({ dispose: first }) },
    { name: 'last', create: () => ({ dispose: last }) },
  ])
  await hook(fixture.source, 'buildStart').call(fixture.native)
  const completed: number[] = []
  const closing = [
    hook(fixture.output, 'closeBundle').call({}),
    hook(fixture.source, 'closeWatcher').call({}),
  ].map((task, index) => Promise.resolve(task).catch((error: unknown) => error).then((error) => {
    completed.push(index)
    return error
  }))
  try {
    await new Promise(resolve => setImmediate(resolve))
    expect(first).toHaveBeenCalledOnce()
    expect(last).toHaveBeenCalledOnce()
    expect(completed).toEqual([])
    release.resolve()
    expect(await Promise.all(closing)).toEqual([failure, failure])
  }
  finally {
    release.resolve()
    await Promise.all(closing)
  }
})

it('waits for partial initialization, disposes only returned controllers and retains initialization and cleanup failures', async () => {
  const initializationFailures = [new Error('first creation failed'), new Error('second creation failed')]
  const cleanupFailure = new Error('partial controller disposal failed')
  const release = Promise.withResolvers<void>()
  const returned = vi.fn(() => {
    throw cleanupFailure
  })
  const delayed = vi.fn()
  let retained!: WeappCompilerPluginContext
  const fixture = lifecycleProvidersFixture([
    { name: 'returned', create: (context) => {
      retained = context
      return { prepareHmr: async () => ({}), dispose: returned }
    } },
    ...initializationFailures.map((failure, index) => ({ name: `failure-${index}`, create: () => { throw failure } })),
    { name: 'delayed', async create() {
      await release.promise
      return { dispose: delayed }
    } },
  ])
  const building = Promise.resolve(hook(fixture.source, 'buildStart').call(fixture.native)).catch((error: unknown) => error)
  let completed = false
  const closing = Promise.resolve(hook(fixture.output, 'closeBundle').call({})).catch((error: unknown) => error).then((error) => {
    completed = true
    return error
  })
  try {
    await new Promise(resolve => setImmediate(resolve))
    expect(completed).toBe(false)
    expect(retained.resolvedConfig).toBe(fixture.config)
    release.resolve()
    const failure = await building
    expect(await closing).toBe(failure)
    expect(failureReasons(failure)).toEqual([...initializationFailures, cleanupFailure])
    expect(returned).toHaveBeenCalledOnce()
    expect(delayed).toHaveBeenCalledOnce()
    expect(getCompilerHmrHost(fixture.ctx).enabled).toBe(false)
    expect(retained.resolvedConfig).toBeUndefined()
  }
  finally {
    release.resolve()
    await Promise.all([building, closing])
  }
})

it('disposes every created controller when provider names are duplicated without registering HMR callbacks', async () => {
  const dispose = [vi.fn(), vi.fn()]
  const fixture = lifecycleProvidersFixture(dispose.map(cleanup => ({
    name: 'duplicate',
    create: () => ({ prepareHmr: async () => ({}), dispose: cleanup }),
  })))
  await expect(hook(fixture.source, 'buildStart').call(fixture.native)).rejects.toThrow('编译插件名称重复')
  await expect(hook(fixture.output, 'closeBundle').call({})).rejects.toThrow('编译插件名称重复')
  expect(dispose.every(cleanup => cleanup.mock.calls.length === 1)).toBe(true)
  expect(getCompilerHmrHost(fixture.ctx).enabled).toBe(false)
})
