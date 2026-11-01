import type { CompilerContext } from '../../context'
import type { WatcherService } from '../../runtime/watcherPlugin'
import type { WeappCompilerPlugin } from '../../types/compilerPlugin'
import { expect, it, vi } from 'vitest'
import { retainWatcherService } from '../../runtime/watcherPlugin'
import { getCompilerHmrHost } from './hmr'
import { createCompilerPluginPlugins } from './index'

function hook(plugin: any, name: string) {
  const value = plugin[name]
  return typeof value === 'function' ? value : value.handler
}

function fixture(providers: WeappCompilerPlugin[]) {
  const cwd = process.cwd()
  const ctx = {
    configService: {
      cwd,
      absoluteSrcRoot: cwd,
      platform: 'weapp',
      isDev: true,
      outputExtensions: { wxss: 'wxss' },
      weappViteConfig: { compilerPlugins: providers },
    },
  } as unknown as CompilerContext
  const plugins = () => {
    const [source, output] = createCompilerPluginPlugins(ctx)
    if (source) {
      hook(source, 'configResolved').call({}, { command: 'serve', build: {} })
    }
    return { source, output }
  }
  return { ctx, plugins, host: getCompilerHmrHost(ctx) }
}

it.each(['remove', 'rename'] as const)('retires the old provider when a same-context configuration restart does %s', async (change) => {
  const retired = vi.fn(async () => ({}))
  const current = vi.fn(async () => ({}))
  const runtime = fixture([{ name: 'retired', create: () => ({ prepareHmr: retired }) }])
  const original = runtime.plugins()
  await hook(original.source, 'buildStart').call({})
  await hook(original.output, 'closeBundle').call({})

  runtime.ctx.configService.weappViteConfig!.compilerPlugins = change === 'rename'
    ? [{ name: 'current', create: () => ({ prepareHmr: current }) }]
    : []
  const replacement = runtime.plugins()
  if (replacement.source) {
    await hook(replacement.source, 'buildStart').call({})
  }
  await runtime.host.prepare(runtime.host.freeze([]))
  expect(retired).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledTimes(change === 'rename' ? 1 : 0)
  expect(runtime.host.enabled).toBe(change === 'rename')
  if (replacement.output) {
    await hook(replacement.output, 'closeBundle').call({})
  }
})

it('restores HMR support after a legacy content provider is removed', async () => {
  const runtime = fixture([{ name: 'legacy', capabilities: { content: true }, create: () => ({}) }])
  const plugins = runtime.plugins()
  await hook(plugins.source, 'buildStart').call({})
  expect(runtime.host.supported).toBe(false)
  await hook(plugins.output, 'closeBundle').call({})
  expect(runtime.host.enabled).toBe(false)
  expect(runtime.host.supported).toBe(true)
})

it('retires a provider even when terminal disposal fails', async () => {
  const failure = new Error('provider disposal failed')
  const runtime = fixture([{ name: 'content', create: () => ({
    prepareHmr: async () => ({}),
    dispose() { throw failure },
  }) }])
  const plugins = runtime.plugins()
  await hook(plugins.source, 'buildStart').call({})
  await expect(hook(plugins.output, 'closeBundle').call({})).rejects.toBe(failure)
  expect(runtime.host.enabled).toBe(false)
})

it('keeps snapshot providers active until their watcher owner releases resources', async () => {
  const prepare = vi.fn(async () => ({}))
  const runtime = fixture([{ name: 'content', create: () => ({ prepareHmr: prepare }) }])
  const watcherService = { closeAll: vi.fn() } as unknown as WatcherService
  runtime.ctx.watcherService = watcherService
  const release = retainWatcherService(watcherService)
  const plugins = runtime.plugins()
  await hook(plugins.source, 'buildStart').call({})
  await hook(plugins.output, 'closeBundle').call({})
  await runtime.host.prepare(runtime.host.freeze([]))
  expect(prepare).toHaveBeenCalledOnce()
  expect(runtime.host.enabled).toBe(true)
  await release()
  expect(runtime.host.enabled).toBe(false)
})

it('preserves a newer same-name registration when retired disposal finishes later', async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const retired = vi.fn(async () => ({}))
  const current = vi.fn(async () => ({}))
  const runtime = fixture([{ name: 'content', create: () => ({
    prepareHmr: retired,
    async dispose() {
      entered.resolve()
      await release.promise
    },
  }) }])
  const original = runtime.plugins()
  await hook(original.source, 'buildStart').call({})
  const closing = hook(original.output, 'closeBundle').call({})
  await entered.promise
  runtime.ctx.configService.weappViteConfig!.compilerPlugins = [{ name: 'content', create: () => ({ prepareHmr: current }) }]
  const replacement = runtime.plugins()
  try {
    await hook(replacement.source, 'buildStart').call({})
  }
  finally {
    release.resolve()
    await closing
  }
  await runtime.host.prepare(runtime.host.freeze([]))
  expect(retired).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledOnce()
  expect(runtime.host.enabled).toBe(true)
  await hook(replacement.output, 'closeBundle').call({})
})
