import type { EmittedAsset } from 'rolldown'
import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkerOutputPlugin } from './workerOutput'

type WorkerAsset = EmittedAsset & { fileName: string }
type Phase = 'configResolved' | 'buildStart' | 'generateBundle' | 'writeBundle'

const mocks = vi.hoisted(() => ({
  buildWorkerAssets: vi.fn<(ctx: CompilerContext) => Promise<WorkerAsset[]>>(),
  getWorkerSources: vi.fn<(ctx: CompilerContext) => { files: string[], roots: string[] }>(),
  pruneOwnedAssetFiles: vi.fn<(outDir: string, files: Iterable<string>) => Promise<void>>(),
}))

vi.mock('../runtime/buildPlugin/workerPlan', () => ({
  buildWorkerAssets: mocks.buildWorkerAssets,
  getWorkerSources: mocks.getWorkerSources,
}))
vi.mock('./asset/prune', () => ({ pruneOwnedAssetFiles: mocks.pruneOwnedAssetFiles }))

function asset(fileName: string, source = 'worker source'): WorkerAsset {
  return { type: 'asset', fileName, source }
}

async function fixture(command: 'build' | 'serve' = 'build', bundledDev = false) {
  const root = path.resolve('worker-output-fixture')
  const outDir = path.join(root, 'dist')
  const sources = {
    files: [path.join(root, 'src/workers/index.ts')],
    roots: [path.join(root, 'src/workers')],
  }
  const ctx = {
    configService: { isDev: false, weappViteConfig: { worker: { entry: ['index'] } } },
  } as unknown as CompilerContext
  const context = {
    meta: { watchMode: true },
    addWatchFile: vi.fn<(file: string) => void>(),
    emitFile: vi.fn<(output: WorkerAsset) => string>(() => 'worker-reference'),
  }
  mocks.getWorkerSources.mockReturnValue(sources)
  const plugin = createWorkerOutputPlugin(ctx)
  const run = async (phase: Phase, ...args: unknown[]) => {
    const hook: Plugin[Phase] = plugin[phase]
    const handler = typeof hook === 'function' ? hook : hook?.handler
    if (!handler) {
      throw new Error(`Missing worker output hook: ${phase}`)
    }
    return await (handler as (this: typeof context, ...args: unknown[]) => unknown).apply(context, args)
  }
  await run('configResolved', { command, experimental: { bundledDev }, build: { outDir } })
  return {
    ctx,
    context,
    sources,
    outDir,
    start: () => run('buildStart', {}),
    generate: () => run('generateBundle', {}, {}, true),
    write: () => run('writeBundle', {}, {}),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.buildWorkerAssets.mockResolvedValue([])
  mocks.pruneOwnedAssetFiles.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('worker input preparation and output ownership', () => {
  it.each([
    ['serve', false],
    ['serve', true],
    ['build', true],
  ] as const)('leaves worker compilation to the existing host for command=%s bundledDev=%s', async (command, bundledDev) => {
    const { context, start, generate, write } = await fixture(command, bundledDev)
    await start()
    await generate()
    await write()
    expect(mocks.buildWorkerAssets).not.toHaveBeenCalled()
    expect(mocks.getWorkerSources).not.toHaveBeenCalled()
    expect(context.addWatchFile).not.toHaveBeenCalled()
    expect(context.emitFile).not.toHaveBeenCalled()
    expect(mocks.pruneOwnedAssetFiles).not.toHaveBeenCalled()
  })

  it('waits for child inputs before the main scan and emits the prepared assets without late input registration', async () => {
    const { ctx, context, sources, start, generate } = await fixture()
    const assets = [asset('workers/index.js')]
    const preparing = Promise.withResolvers<WorkerAsset[]>()
    const entered = Promise.withResolvers<void>()
    mocks.buildWorkerAssets.mockImplementationOnce(() => {
      entered.resolve()
      return preparing.promise
    })
    let scanCanStart = false
    const starting = start().then(() => {
      scanCanStart = true
    })
    try {
      await Promise.race([entered.promise, starting])
      expect(scanCanStart).toBe(false)
      expect(context.addWatchFile).not.toHaveBeenCalled()
      expect(context.emitFile).not.toHaveBeenCalled()
      sources.files.push(path.join(sources.roots[0]!, 'new.ts'))
      preparing.resolve(assets)
      await starting
      expect(scanCanStart).toBe(true)
      expect(context.addWatchFile.mock.calls.map(([file]) => file)).toEqual([...sources.files, ...sources.roots])
      expect(context.emitFile).not.toHaveBeenCalled()
      context.addWatchFile.mockClear()

      await generate()
      expect(mocks.buildWorkerAssets).toHaveBeenCalledExactlyOnceWith(ctx)
      expect(context.emitFile.mock.calls.map(([output]) => output)).toEqual(assets)
      expect(context.addWatchFile).not.toHaveBeenCalled()
    }
    finally {
      preparing.resolve(assets)
      await starting
    }
  })

  it.each([
    { name: 'Error', failure: new Error('worker syntax error') },
    { name: 'undefined rejection', failure: undefined },
  ])('retains failed child inputs and reports $name only after the main scan can complete', async ({ failure }) => {
    const { context, sources, start, generate, write } = await fixture()
    const failedInput = path.join(sources.roots[0]!, 'broken.ts')
    mocks.buildWorkerAssets.mockImplementationOnce(async () => {
      sources.files.push(failedInput)
      throw failure
    })

    await expect(start()).resolves.toBeUndefined()
    expect(context.addWatchFile.mock.calls.map(([file]) => file)).toEqual([...sources.files, ...sources.roots])
    expect(context.emitFile).not.toHaveBeenCalled()
    await expect(generate()).rejects.toBe(failure)
    await write()
    expect(context.emitFile).not.toHaveBeenCalled()
    expect(mocks.pruneOwnedAssetFiles).not.toHaveBeenCalled()
  })

  it('replaces prepared assets each round and prunes only files from the last published output', async () => {
    const { context, outDir, start, generate, write } = await fixture()
    const previous = asset('workers/previous.js', 'previous output')
    const next = asset('workers/next.js', 'next output')
    mocks.buildWorkerAssets.mockResolvedValueOnce([previous]).mockResolvedValueOnce([next])
    await start()
    await generate()
    await write()
    context.emitFile.mockClear()
    mocks.pruneOwnedAssetFiles.mockClear()

    await start()
    expect(context.emitFile).not.toHaveBeenCalled()
    await generate()
    expect(context.emitFile.mock.calls.map(([output]) => output)).toEqual([next])
    expect(mocks.pruneOwnedAssetFiles).not.toHaveBeenCalled()
    await write()
    expect(mocks.pruneOwnedAssetFiles).toHaveBeenCalledExactlyOnceWith(outDir, [previous.fileName])
    await write()
    expect(mocks.pruneOwnedAssetFiles).toHaveBeenCalledOnce()
  })

  it('discards an abandoned publication on failure and recovers without emitting stale assets or losing published ownership', async () => {
    const { context, outDir, start, generate, write } = await fixture()
    const published = asset('workers/published.js')
    const abandoned = asset('workers/abandoned.js')
    const failure = new Error('new worker import is invalid')
    mocks.buildWorkerAssets
      .mockResolvedValueOnce([published])
      .mockResolvedValueOnce([abandoned])
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce([])
    await start()
    await generate()
    await write()
    await start()
    await generate()
    context.emitFile.mockClear()
    mocks.pruneOwnedAssetFiles.mockClear()

    await start()
    await expect(generate()).rejects.toBe(failure)
    await write()
    expect(context.emitFile).not.toHaveBeenCalled()
    expect(mocks.pruneOwnedAssetFiles).not.toHaveBeenCalled()

    await start()
    await generate()
    expect(context.emitFile).not.toHaveBeenCalled()
    await write()
    expect(mocks.pruneOwnedAssetFiles).toHaveBeenCalledExactlyOnceWith(outDir, [published.fileName])
  })
})
