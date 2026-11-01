import type { CompilerContext } from '../../context'
import type { WatcherService } from '../../runtime/watcherPlugin'
import type { WeappCompilerPluginContext, WeappCompilerPluginController } from '../../types/compilerPlugin'
import { expect, it, vi } from 'vitest'
import { retainWatcherService } from '../../runtime/watcherPlugin'
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

function lifecycleFixture(create: (context: WeappCompilerPluginContext) => WeappCompilerPluginController | Promise<WeappCompilerPluginController>) {
  const provider = { name: 'terminal-lifecycle', create: vi.fn(create) }
  const ctx = {
    configService: {
      cwd: '/project',
      absoluteSrcRoot: '/project/src',
      platform: 'weapp',
      isDev: false,
      outputExtensions: { wxss: 'wxss' },
      weappViteConfig: { compilerPlugins: [provider] },
    },
  } as unknown as CompilerContext
  const native = { resolve: vi.fn(async () => ({ id: 'resolved.js' })), addWatchFile: vi.fn() }
  const config = { command: 'build', build: {} }
  const [source, output] = createCompilerPluginPlugins(ctx)
  hook(source, 'configResolved').call(native, config)
  return { provider, native, config, source, output }
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
