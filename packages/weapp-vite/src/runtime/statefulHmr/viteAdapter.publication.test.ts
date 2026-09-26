import type { DevOptions } from 'rolldown/experimental'
import type { StatefulHmrOutputFile } from './outputWriter'
import { describe, expect, it, vi } from 'vitest'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { StatefulHmrViteAdapter } from './viteAdapter'

function full() {
  return { output: [
    { type: 'chunk', fileName: 'app.js', code: 'App({})', modules: {} },
    { type: 'chunk', fileName: 'rolldown-runtime.js', code: createStatefulHmrRolldownRuntimeSource(), modules: {} },
  ] as StatefulHmrOutputFile[] }
}
const additional = () => ({ output: [{ type: 'chunk', fileName: 'pages/index.js', code: 'Page({})', modules: {} }] as StatefulHmrOutputFile[] })

async function setup(publish: (output: StatefulHmrOutputFile[], source: string) => void | Promise<void> = () => {}) {
  let callbacks: DevOptions
  const calls: string[] = []
  const engine = {
    ensureCurrentBuildFinish: vi.fn(async () => { calls.push('current-finished') }),
    ensureLatestBuildOutput: vi.fn(async () => { callbacks.onOutput!(full() as any) }),
    getBundleState: async () => ({ lastBuildErrored: false }),
    registerClient: async () => {},
    run: async () => {},
    triggerFullBuild: vi.fn(() => { calls.push('trigger') }),
  }
  const bundled = { getRolldownOptions: async () => ({}), storeOutputFiles: vi.fn(), listen: async () => {} }
  const onError = vi.fn()
  const adapter = new StatefulHmrViteAdapter(
    { root: '/project', build: { rolldownOptions: {} } } as any,
    { environments: { client: { bundledDev: bundled } } } as any,
    { onError, onOutput: publish, onPatch: () => true, waitForInitialBundle: async () => {} },
    {},
    (async (_input, _output, options) => {
      callbacks = options!
      return engine
    }) as any,
    30,
  )
  adapter.install()
  await bundled.listen()
  calls.length = 0
  return { adapter, engine, callbacks: callbacks!, calls, onError }
}

describe('stateful adapter output publication', () => {
  it('preserves the native full/additional distinction and waits for current work before triggering', async () => {
    const received: string[] = []
    const state = await setup((_output, source) => {
      received.push(source)
    })
    state.engine.ensureLatestBuildOutput.mockImplementation(async () => {
      state.callbacks.onAdditionalAssets!(additional() as any)
      state.callbacks.onOutput!(full() as any)
    })
    await state.adapter.rebuild()
    expect(received).toEqual(['additional', 'full'])
    expect(state.calls).toEqual(['current-finished', 'trigger'])
  })

  it('allows native partial output before and after full publication without consuming it', async () => {
    const received: string[] = []
    const state = await setup((_output, source) => {
      received.push(source)
    })
    state.engine.ensureLatestBuildOutput.mockImplementation(async () => {
      state.callbacks.onOutput!(additional() as any)
      state.callbacks.onOutput!(full() as any)
      state.callbacks.onOutput!(additional() as any)
    })
    await state.adapter.rebuild()
    expect(received).toEqual(['partial', 'full', 'partial'])
    expect(state.onError).not.toHaveBeenCalled()
  })

  it('waits for actual full delivery even when the native state read has already completed', async () => {
    const latest = Promise.withResolvers<void>()
    const state = await setup()
    state.engine.ensureLatestBuildOutput.mockImplementation(async () => {
      state.callbacks.onOutput!(additional() as any)
      latest.resolve()
    })
    let settled = false
    const result = state.adapter.rebuild().finally(() => {
      settled = true
    })
    await latest.promise
    await Promise.resolve()
    const early = settled
    state.callbacks.onOutput!(full() as any)
    await result
    expect(early).toBe(false)
  })

  it('drains an old native full callback and its pending write before preparing a new snapshot', async () => {
    const arrived = Promise.withResolvers<void>()
    const written = Promise.withResolvers<void>()
    let prepared = false
    let old = true
    const state = await setup(() => {
      if (old) {
        arrived.resolve()
        return written.promise
      }
    })
    state.engine.ensureCurrentBuildFinish.mockImplementationOnce(async () => {
      state.callbacks.onOutput!(full() as any)
    })
    const rebuild = state.adapter.rebuild(() => {
      prepared = true
      old = false
    })
    await arrived.promise
    const preparedBeforeWrite = prepared
    written.resolve()
    await rebuild
    expect(preparedBeforeWrite).toBe(false)
    expect(prepared).toBe(true)
  })

  it('rejects an additional-only completion instead of acknowledging a full refresh', async () => {
    const state = await setup()
    state.engine.ensureLatestBuildOutput.mockImplementation(async () => {
      state.callbacks.onAdditionalAssets!(additional() as any)
    })
    await expect(state.adapter.rebuild()).rejects.toThrow('完整输出')
  })

  it('waits for full output persistence and propagates its exact failure', async () => {
    const gate = Promise.withResolvers<void>()
    const failure = new Error('write rejected')
    const entered = Promise.withResolvers<void>()
    const state = await setup((_output, source) => {
      if (source === 'full') {
        entered.resolve()
        return gate.promise
      }
    })
    let settled = false
    const result = state.adapter.rebuild().then(() => ({ ok: true }), error => ({ error })).finally(() => {
      settled = true
    })
    await entered.promise
    const settledBeforeWrite = settled
    gate.reject(failure)
    expect(await result).toEqual({ error: failure })
    expect(settledBeforeWrite).toBe(false)
  })

  it('bounds a hung native rebuild', async () => {
    const state = await setup()
    state.engine.ensureLatestBuildOutput.mockImplementation(() => new Promise(() => {}))
    await expect(state.adapter.rebuild()).rejects.toThrow('完整重建超时')
  })
  it('does not trigger a late rebuild after the current native build times out', async () => {
    const state = await setup()
    const current = Promise.withResolvers<void>()
    state.engine.ensureCurrentBuildFinish.mockImplementation(() => current.promise)
    await expect(state.adapter.rebuild()).rejects.toThrow('完整重建超时')
    current.resolve()
    await Promise.resolve()
    expect(state.engine.triggerFullBuild).not.toHaveBeenCalled()
  })
})
