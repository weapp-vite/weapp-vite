import type { Plugin, ViteDevServer } from 'vite'
import path from 'node:path'
import { WEAPP_VITE_CLASSIC_SETTLEMENT_KEY } from '@weapp-core/constants'
import { createServer } from 'vite'
import { beforeEach, expect, it, vi } from 'vitest'
import { FrameworkSequenceSession } from './framework'
import { createFrameworkResourceSequence } from './frameworkSequence'

const observed = vi.hoisted(() => ({
  settle: vi.fn<() => Promise<void>>(),
  runtime: vi.fn(async () => ({})),
  engine: vi.fn(async () => {}),
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
    observe = observed.runtime
    async close() {}
  },
}))

let context: object

beforeEach(() => {
  observed.settle.mockReset().mockResolvedValue(undefined)
  observed.runtime.mockClear()
  observed.engine.mockClear()
  context = { [Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)]: { whenSettled: observed.settle } }
  vi.mocked(createServer).mockReset().mockImplementation(async (config) => {
    const engine = { close: async () => {}, ensureCurrentBuildFinish: observed.engine }
    const watcher = { async close() {} }
    const server = {
      [Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)]: Reflect.get(context, Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)),
      watcher,
      environments: { client: { bundledDev: { _devEngine: engine } } },
      async listen() {},
      async close() {
        await watcher.close()
        await engine.close()
      },
    } as unknown as ViteDevServer
    const plugin = config?.plugins?.[1] as Plugin
    if (typeof plugin.configureServer !== 'function') {
      throw new TypeError('Expected framework observation hook')
    }
    plugin.configureServer.call({} as never, server)
    return server
  })
})

function observeClassic() {
  const session = new FrameworkSequenceSession('weapp-classic', path.resolve('mock-framework-settlement'))
  const sequence = createFrameworkResourceSequence(14, 1)
  return { session, observation: session.observe({ files: sequence.files, step: 0, signal: new AbortController().signal }) }
}

it('waits for the classic generation before reading runtime evidence', async () => {
  const publication = Promise.withResolvers<void>()
  const entered = Promise.withResolvers<void>()
  observed.settle.mockImplementation(() => {
    entered.resolve()
    return publication.promise
  })
  const { session, observation } = observeClassic()
  try {
    await Promise.race([entered.promise, observation.then(() => {
      throw new Error('Classic observation bypassed generation settlement')
    })])
    expect(observed.runtime).not.toHaveBeenCalled()
    expect(observed.engine).not.toHaveBeenCalled()
    publication.resolve()
    await observation
    expect(observed.runtime).toHaveBeenCalledOnce()
  }
  finally {
    publication.resolve()
    await observation.catch(() => {})
    await session.close()
  }
})

it('fails explicitly when the rebuilt classic generation binding is missing', async () => {
  context = {}
  const { session, observation } = observeClassic()
  try {
    await expect(observation).rejects.toThrow('classic generation settlement')
    expect(observed.runtime).not.toHaveBeenCalled()
  }
  finally {
    await session.close()
  }
})

it('preserves a classic publication failure without sampling partial output', async () => {
  const failure = new Error('classic style completion failed')
  observed.settle.mockRejectedValue(failure)
  const { session, observation } = observeClassic()
  try {
    await expect(observation).rejects.toBe(failure)
    expect(observed.runtime).not.toHaveBeenCalled()
  }
  finally {
    await session.close()
  }
})
