import { describe, expect, it, vi } from 'vitest'
import { StatefulHmrViteAdapter } from './viteAdapter'

function fixture(waitForInitialBundle = async () => {}) {
  const engine = {
    close: vi.fn(async () => {}),
    ensureCurrentBuildFinish: vi.fn(async () => {}),
    getBundleState: async () => ({ lastBuildErrored: false }),
    registerClient: vi.fn(async () => {}),
    run: vi.fn(async () => {}),
  }
  const createEngine = vi.fn(async () => engine)
  const bundledDev = {
    _devEngine: undefined as unknown,
    getRolldownOptions: async () => ({}),
    listen: vi.fn(async () => {}),
    storeOutputFiles: vi.fn(),
  }
  const client = { bundledDev, pluginContainer: { watchChange: vi.fn() } }
  const ssr = { pluginContainer: { watchChange: vi.fn() } }
  const original = { ...bundledDev, watchChange: client.pluginContainer.watchChange }
  const adapter = new StatefulHmrViteAdapter(
    { root: '/project', build: { rolldownOptions: {} } } as any,
    { environments: { client, ssr } } as any,
    { onError: vi.fn(), onOutput: vi.fn(), onPatch: () => true, waitForInitialBundle },
    {},
    createEngine as any,
  )
  return { adapter, engine, createEngine, bundledDev, client, ssr, original }
}

describe('borrowed stateful host lifecycle', () => {
  it('starts once across host listen and explicit startup, then restores only the client', async () => {
    const f = fixture()
    const ssrWatchChange = f.ssr.pluginContainer.watchChange
    f.adapter.install()
    await Promise.all([f.adapter.start(), f.bundledDev.listen(), f.adapter.start()])
    expect(f.createEngine).toHaveBeenCalledOnce()
    expect(f.engine.run).toHaveBeenCalledOnce()
    expect(f.original.listen).not.toHaveBeenCalled()
    expect(f.ssr.pluginContainer.watchChange).toBe(ssrWatchChange)
    await Promise.all([f.adapter.close(), f.adapter.close()])
    expect(f.engine.close).toHaveBeenCalledOnce()
    expect(f.bundledDev._devEngine).toBeUndefined()
    expect(f.bundledDev.listen).toBe(f.original.listen)
    expect(f.bundledDev.getRolldownOptions).toBe(f.original.getRolldownOptions)
    expect(f.bundledDev.storeOutputFiles).toBe(f.original.storeOutputFiles)
    expect(f.client.pluginContainer.watchChange).toBe(f.original.watchChange)
    await expect(f.adapter.start()).rejects.toThrow('已经关闭')
  })

  it('cancels a pending initial publication without waiting for the startup timeout', async () => {
    const reached = Promise.withResolvers<void>()
    const neverPublished = Promise.withResolvers<void>()
    const f = fixture(async () => {
      reached.resolve()
      await neverPublished.promise
    })
    f.adapter.install()
    const starting = f.adapter.start()
    const rejected = expect(starting).rejects.toThrow('已关闭')
    await reached.promise
    await f.adapter.close()
    await rejected
    expect(f.engine.close).toHaveBeenCalledOnce()
    expect(f.bundledDev.listen).toBe(f.original.listen)
  })

  it('keeps a second host active when the first closes and rejects duplicate installation', async () => {
    const first = fixture()
    const second = fixture()
    first.adapter.install()
    second.adapter.install()
    expect(() => first.adapter.install()).toThrow('不能重复安装')
    await Promise.all([first.adapter.start(), second.adapter.start()])
    await first.adapter.close()
    expect(second.engine.close).not.toHaveBeenCalled()
    expect(second.bundledDev._devEngine).toBe(second.engine)
    await second.adapter.close()
  })

  it('fails capability probing before changing the host', () => {
    const f = fixture()
    Reflect.deleteProperty(f.bundledDev, 'listen')
    expect(() => f.adapter.install()).toThrow('私有 API')
    expect(f.client.pluginContainer.watchChange).toBe(f.original.watchChange)
    expect(f.bundledDev.getRolldownOptions).toBe(f.original.getRolldownOptions)
  })

  it('closes its own engine without undoing a later host replacement', async () => {
    const f = fixture()
    f.adapter.install()
    await f.adapter.start()
    const replacement = { close: vi.fn() }
    const listen = vi.fn(async () => {})
    const watchChange = vi.fn()
    f.bundledDev._devEngine = replacement
    f.bundledDev.listen = listen
    f.client.pluginContainer.watchChange = watchChange
    await f.adapter.close()
    expect(f.engine.close).toHaveBeenCalledOnce()
    expect(replacement.close).not.toHaveBeenCalled()
    expect(f.bundledDev._devEngine).toBe(replacement)
    expect(f.bundledDev.listen).toBe(listen)
    expect(f.client.pluginContainer.watchChange).toBe(watchChange)
  })
})
