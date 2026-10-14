import type { EmittedAsset, PluginContext } from 'rolldown'
import type { CompilerContext } from '../context'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type PrepareAssets = (service: CompilerContext['configService'], onWatchFile: (file: string) => void) => Promise<EmittedAsset[]>

function mockAssets(prepare = vi.fn<PrepareAssets>(async () => []), loadError?: Error, events: string[] = []) {
  const load = vi.fn(() => {
    events.push('load')
    if (loadError) {
      throw loadError
    }
    return { prepareLibDtsAssets: prepare }
  })
  vi.doMock('../runtime/libDts/assets', load)
  return { load, prepare }
}

function createHost(events: string[] = [], watchMode = true) {
  return {
    meta: { watchMode },
    addWatchFile: vi.fn((file: string) => events.push(`watch:${file}`)),
    emitFile: vi.fn((asset: EmittedAsset) => {
      events.push(`emit:${asset.fileName}`)
      return asset.fileName ?? ''
    }),
  }
}

async function createHook(options: { isDev?: boolean, dtsEnabled?: boolean } = {}) {
  const { createLibDtsPlugin } = await import('./libDts')
  const service = {
    isDev: options.isDev ?? false,
    weappLibConfig: {
      enabled: true,
      root: 'src/library',
      dts: { enabled: options.dtsEnabled ?? true },
    },
  } as CompilerContext['configService']
  const plugin = createLibDtsPlugin({ configService: service } as CompilerContext)
  const hook = plugin.buildStart
  const handler = typeof hook === 'function' ? hook : hook?.handler
  if (!handler) {
    throw new Error('Missing declaration buildStart hook')
  }
  return {
    service,
    run: (host: ReturnType<typeof createHost>) => handler.call(host as unknown as PluginContext, {} as never),
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock('../runtime/libDts/assets')
})

afterEach(() => {
  vi.doUnmock('../runtime/libDts/assets')
  vi.resetModules()
})

describe('library declaration compiler loading', () => {
  it('keeps module imports and plugin factories free of declaration compiler loading', async () => {
    const { load, prepare } = mockAssets()
    const { createLibDtsPlugin } = await import('./libDts')
    expect(load).not.toHaveBeenCalled()

    const nativeContext = { configService: { isDev: false } } as CompilerContext
    createLibDtsPlugin(nativeContext)
    await createHook()
    expect(load).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })

  it.each([
    { isDev: true, dtsEnabled: true, watches: ['src/library'] },
    { isDev: false, dtsEnabled: false, watches: [] },
    { isDev: true, dtsEnabled: false, watches: [] },
  ])('does not load guarded declaration compilers (%j)', async ({ isDev, dtsEnabled, watches }) => {
    const { load, prepare } = mockAssets()
    const { run } = await createHook({ isDev, dtsEnabled })
    const host = createHost()
    await run(host)

    expect(host.addWatchFile.mock.calls.map(([file]) => file)).toEqual(watches)
    expect(load).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
    expect(host.emitFile).not.toHaveBeenCalled()
  })

  it('registers production watch roots before loading and emits only completed declaration assets', async () => {
    const events: string[] = []
    const assets: EmittedAsset[] = [
      { type: 'asset', fileName: 'index.d.ts', source: 'export declare const count: number' },
      { type: 'asset', fileName: 'index.d.ts.map', source: '{}' },
    ]
    const prepare = vi.fn<PrepareAssets>(async (_service, onWatchFile) => {
      events.push('prepare')
      onWatchFile('src/library/types.ts')
      await Promise.resolve()
      events.push('prepared')
      return assets
    })
    const { load } = mockAssets(prepare, undefined, events)
    const { run, service } = await createHook()
    const host = createHost(events)
    await run(host)

    expect(load).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledWith(service, expect.any(Function))
    expect(events).toEqual([
      'watch:src/library',
      'load',
      'prepare',
      'watch:src/library/types.ts',
      'prepared',
      'emit:index.d.ts',
      'emit:index.d.ts.map',
    ])
    expect(host.emitFile.mock.calls.map(([asset]) => asset)).toEqual(assets)
  })

  it('propagates module loading errors after recording production watch roots', async () => {
    const events: string[] = []
    const error = new Error('Declaration compiler unavailable')
    const { load, prepare } = mockAssets(undefined, error, events)
    const { run } = await createHook()
    const host = createHost(events)
    // Vitest 把 mock 工厂加载异常包装到 cause，宿主 hook 必须继续向上抛出。
    await expect(run(host)).rejects.toMatchObject({ cause: error })

    expect(events).toEqual(['watch:src/library', 'load'])
    expect(load).toHaveBeenCalledOnce()
    expect(prepare).not.toHaveBeenCalled()
    expect(host.emitFile).not.toHaveBeenCalled()
  })

  it('propagates preparation errors without caching failed build results', async () => {
    const error = new Error('Declaration preparation failed')
    const assets: EmittedAsset[] = [{ type: 'asset', fileName: 'retry.d.ts', source: 'export {}' }]
    const prepare = vi.fn<PrepareAssets>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(assets)
    const { load } = mockAssets(prepare)
    const { run } = await createHook()
    const firstHost = createHost()
    await expect(run(firstHost)).rejects.toBe(error)
    expect(firstHost.emitFile).not.toHaveBeenCalled()

    const secondHost = createHost()
    await run(secondHost)
    expect(load).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(secondHost.emitFile).toHaveBeenCalledWith(assets[0])
  })

  it('reuses the loaded module while preparing fresh assets for each hook invocation', async () => {
    const firstAssets: EmittedAsset[] = [{ type: 'asset', fileName: 'first.d.ts', source: 'export declare const first: number' }]
    const secondAssets: EmittedAsset[] = [{ type: 'asset', fileName: 'second.d.ts', source: 'export declare const second: number' }]
    const prepare = vi.fn<PrepareAssets>()
      .mockResolvedValueOnce(firstAssets)
      .mockResolvedValueOnce(secondAssets)
    const { load } = mockAssets(prepare)
    const { run } = await createHook()
    const firstHost = createHost()
    const secondHost = createHost([], false)
    await run(firstHost)
    await run(secondHost)

    expect(load).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(firstHost.emitFile.mock.calls.map(([asset]) => asset)).toEqual(firstAssets)
    expect(secondHost.emitFile.mock.calls.map(([asset]) => asset)).toEqual(secondAssets)
    expect(secondHost.addWatchFile).not.toHaveBeenCalled()
  })
})
