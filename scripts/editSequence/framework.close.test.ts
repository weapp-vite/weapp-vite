import type { Plugin, ViteDevServer } from 'vite'
import path from 'node:path'
import { WEAPP_VITE_CLASSIC_SETTLEMENT_KEY } from '@weapp-core/constants'
import { createServer } from 'vite'
import { beforeEach, expect, it, vi } from 'vitest'
import { FrameworkSequenceSession } from './framework'
import { createFrameworkResourceSequence } from './frameworkSequence'

const closes = vi.hoisted(() => ({
  runtime: vi.fn<() => Promise<void>>(),
  watcher: vi.fn<() => Promise<void>>(),
  engine: vi.fn<() => Promise<void>>(),
  server: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', () => ({ createServer: vi.fn() }))
vi.mock('weapp-vite/vite', () => ({ weapp: () => ({ name: 'mock-weapp' }) }))
vi.mock('./frameworkSources', () => ({ writeFrameworkSequenceSources: async () => {} }))
vi.mock('./published', () => ({ observePublishedFiles: async () => ({}) }))
vi.mock('../benchmarkTemplatesHmr/outputScope', () => ({
  snapshotBenchmarkOutputs: async () => ({}),
  compareBenchmarkOutputs: () => ({ added: [], changed: [], removed: [], changedBytes: 0 }),
}))
vi.mock('./frameworkRuntime', () => ({
  FrameworkSequenceRuntime: class {
    async start() {}
    async currentMessage() { return 'page-0000-v0000' }
    async observe() { return {} }
    close = closes.runtime
  },
}))

beforeEach(() => {
  for (const close of Object.values(closes)) {
    close.mockReset().mockResolvedValue(undefined)
  }
  vi.mocked(createServer).mockReset().mockImplementation(async (config) => {
    const watcher = { close: closes.watcher }
    const engine = { close: closes.engine, ensureCurrentBuildFinish: async () => {} }
    const server = {
      [Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)]: { whenSettled: async () => {} },
      watcher,
      environments: { client: { bundledDev: { _devEngine: engine } } },
      async listen() {},
      async close() {
        // 复现原生宿主吞掉引擎关闭错误的边界；本测试不创建真实宿主或 watcher。
        await Promise.allSettled([watcher.close(), engine.close()])
        await closes.server()
      },
    } as unknown as ViteDevServer
    const plugin = config?.plugins?.[1] as Plugin
    if (typeof plugin.configureServer !== 'function') {
      throw new TypeError('Expected the framework resource observation hook')
    }
    plugin.configureServer.call({
      error(error) { throw error },
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      meta: { rollupVersion: 'mock', rolldownVersion: 'mock', viteVersion: 'mock', watchMode: true },
    }, server)
    return server
  })
})

async function createObservedSession() {
  const session = new FrameworkSequenceSession('weapp-classic', path.resolve('mock-framework-close'))
  const sequence = createFrameworkResourceSequence(14, 1)
  await session.observe({ files: sequence.files, step: 0, signal: new AbortController().signal })
  expect(session.observeSession()).toEqual({ watchers: 1, engines: 1 })
  return session
}

it('rejects with the original engine close error even when the native host swallows it', async () => {
  const failure = new Error('native engine close failed')
  closes.engine.mockRejectedValue(failure)
  const session = await createObservedSession()
  const closing = session.close()
  await expect(closing).rejects.toBe(failure)
  expect(session.observeSession()).toEqual({ watchers: 0, engines: 1 })
  expect(session.close()).toBe(closing)
  await expect(session.close()).rejects.toBe(failure)
  expect(closes.engine).toHaveBeenCalledTimes(1)
  expect(closes.runtime).toHaveBeenCalledTimes(1)
  expect(closes.server).toHaveBeenCalledTimes(1)
})

it('attempts every cleanup stage and preserves runtime, server and ownership errors in order', async () => {
  const failures = {
    runtime: new Error('runtime close failed'),
    server: new Error('server close failed'),
    watcher: new Error('watcher close failed'),
    engine: new Error('engine close failed'),
  }
  for (const key of ['runtime', 'server', 'watcher', 'engine'] as const) {
    closes[key].mockRejectedValue(failures[key])
  }
  const session = await createObservedSession()
  const failure = await session.close().catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors).toEqual(Object.values(failures))
  expect((failure as AggregateError).cause).toBe(failures.runtime)
  for (const close of Object.values(closes)) {
    expect(close).toHaveBeenCalledTimes(1)
  }
  expect(closes.runtime.mock.invocationCallOrder[0]).toBeLessThan(closes.server.mock.invocationCallOrder[0]!)
  expect(session.observeSession()).toEqual({ watchers: 1, engines: 1 })
})

it('shares one concurrent close and releases owners only after cleanup succeeds', async () => {
  const runtimeClosed = Promise.withResolvers<void>()
  closes.runtime.mockReturnValue(runtimeClosed.promise)
  const session = await createObservedSession()
  const closing = session.close()
  expect(session.close()).toBe(closing)
  expect(session.observeSession()).toEqual({ watchers: 1, engines: 1 })
  expect(closes.server).not.toHaveBeenCalled()
  runtimeClosed.resolve()
  await closing
  expect(session.close()).toBe(closing)
  expect(session.observeSession()).toEqual({ watchers: 0, engines: 0 })
  for (const close of Object.values(closes)) {
    expect(close).toHaveBeenCalledTimes(1)
  }
})

it('preserves one original watcher error already propagated by the host', async () => {
  const failure = new Error('watcher close failed')
  closes.watcher.mockRejectedValue(failure)
  closes.server.mockRejectedValue(failure)
  const session = await createObservedSession()
  await expect(session.close()).rejects.toBe(failure)
  expect(session.observeSession()).toEqual({ watchers: 1, engines: 0 })
})

it.each(['server', 'engine'] as const)('retains the host owner when %s close fails', async (stage) => {
  const failure = new Error(`${stage} close failed`)
  closes[stage].mockRejectedValue(failure)
  const session = await createObservedSession()
  const server = await vi.mocked(createServer).mock.results[0]!.value
  await expect(session.close()).rejects.toBe(failure)
  expect(Reflect.get(session, 'server')).toBe(server)
})

it('starts runtime close before returning the shared framework close promise', async () => {
  const session = await createObservedSession()
  const closing = session.close()
  expect(closes.runtime).toHaveBeenCalledTimes(1)
  await closing
  expect(session.observeSession()).toEqual({ watchers: 0, engines: 0 })
})

it('returns the cached framework promise during synchronous runtime close reentry', async () => {
  const session = await createObservedSession()
  let reentered: Promise<void> | undefined
  closes.runtime.mockImplementation(() => {
    reentered = session.close()
    return Promise.resolve()
  })
  const closing = session.close()
  expect(reentered).toBe(closing)
  await closing
  expect(closes.runtime).toHaveBeenCalledTimes(1)
  expect(closes.server).toHaveBeenCalledTimes(1)
  expect(session.observeSession()).toEqual({ watchers: 0, engines: 0 })
})
