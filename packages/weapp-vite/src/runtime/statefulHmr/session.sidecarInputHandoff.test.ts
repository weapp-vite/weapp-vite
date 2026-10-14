import type { InlineConfig, Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrOutputFile } from './outputWriter'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { createModuleGraphService } from '../../moduleGraph/service'
import { getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../plugins/utils/sourceSnapshot'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { runStatefulHmrDev } from './session'

interface Callbacks {
  onOutput: (output: StatefulHmrOutputFile[], source: 'full') => Promise<void>
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as Callbacks | undefined,
  nativeOutput: [] as StatefulHmrOutputFile[],
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[]) => Promise<void>>(),
  fullBuild: vi.fn<() => Promise<void>>(),
  closeAdapter: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('../../plugins/asset/prune', () => ({ pruneOwnedAssetFiles: vi.fn(async () => {}) }))
// 本套件只检验输入与发射事务，所有宿主和 watcher 都由内存 mock 持有。
vi.mock('../watch/assets', () => ({ watchAssetSources: () => ({ ready: Promise.resolve(), close: async () => {} }) }))
vi.mock('./childSources', () => ({ observeChildSources: () => ({ owns: () => false, adopt() {}, close: async () => {} }) }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: Callbacks) {
      harness.callbacks = callbacks
    }

    install() {}
    async close() { await harness.closeAdapter() }
    async waitForNativeUpdates() {}
    async whenSettled() {}
    async registerBundleModules() { return 1 }
    async markPayloadDelivered() {}
    async rebuild(prepare?: () => void | Promise<void>) {
      await prepare?.()
      await harness.fullBuild()
    }
  },
}))

const roots: string[] = []
const sessions: Array<{ close: () => Promise<void> }> = []

function nativeOutput(): StatefulHmrOutputFile[] {
  return [{ type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} }, ...harness.nativeOutput]
}

beforeEach(() => {
  vi.useFakeTimers()
  harness.writeOutput.mockReset().mockResolvedValue()
  harness.closeAdapter.mockReset().mockResolvedValue()
  harness.fullBuild.mockReset().mockImplementation(async () => {
    await harness.callbacks!.onOutput(nativeOutput(), 'full')
  })
  harness.createServer.mockReset().mockImplementation(async (options: InlineConfig) => ({
    config: {
      inlineConfig: options,
      root: options.root,
      publicDir: false,
      build: { copyPublicDir: false },
      server: {},
      logger: { info: vi.fn(), error: vi.fn() },
    },
    moduleGraph: { getModulesByFile: () => undefined },
    watcher: Object.assign(new EventEmitter(), { add: vi.fn() }),
    middlewares: { use: vi.fn() },
    httpServer: { address: () => undefined },
    close: async () => {},
    restart: async () => {},
    async listen() {
      await harness.callbacks!.onOutput(nativeOutput(), 'full')
      await harness.callbacks!.waitForInitialBundle()
    },
  }))
})

afterEach(async () => {
  await Promise.all(sessions.splice(0).map(session => session.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  vi.useRealTimers()
})

async function start() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-sidecar-publication-')))
  roots.push(root)
  const srcRoot = path.join(root, 'src')
  await mkdir(srcRoot)
  const owner = path.join(srcRoot, 'app.vue')
  const file = path.join(srcRoot, 'next-sitemap.json')
  const before = JSON.stringify({ desc: 'relocated', rules: [] })
  const after = JSON.stringify({ desc: 'relocated-updated', rules: [] })
  await writeFile(file, before)
  const asset = (source: string): StatefulHmrSnapshot => ({
    output: [{ type: 'asset', fileName: 'next-sitemap.json', source }],
    componentPageGlobalStyleRoutes: [],
    glassEaselAnalysisByOwner: new Map(),
  })
  harness.nativeOutput = [...asset(before).output]
  const rebuild = vi.fn(async (_files: string[]) => asset(await readFile(file, 'utf8')))
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { platform: 'weapp', cwd: root, absoluteSrcRoot: srcRoot, outDir: path.join(root, 'dist'), weappViteConfig: { hmr: {} }, inlineConfig: {} },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: createModuleGraphService(),
  } as unknown as CompilerContext
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, { initial: asset(before), entryIds: [], rebuild }, createDevBuildWatcher())
  sessions.push(watcher)
  const metadataAsset = await readCompilerInput(ctx.configService, file)
  ctx.moduleGraphService.replaceEntryDependencies(owner, 'json', [file])
  const plugins = harness.createServer.mock.calls.at(-1)![0].plugins as Plugin[]
  const plugin = plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-sidecar')!
  const hook = plugin.load!
  const load = typeof hook === 'function' ? hook : hook.handler
  const id = createSidecarSourceSpecifier(owner, file, 'json')
  const whenSettled = plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!.api.whenSettled as () => Promise<void>
  return { ctx, watcher, file, before, after, rebuild, metadataAsset, whenSettled, load: () => load.call({ addWatchFile: vi.fn() } as never, id) }
}

it('rebuilds and publishes the old metadata asset through the existing full transaction after a first-load handoff drift', async () => {
  const { file, before, after, rebuild, metadataAsset, whenSettled, load } = await start()
  expect(metadataAsset).toBe(before)
  harness.writeOutput.mockClear()
  await writeFile(file, after)
  await load()
  expect(rebuild).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(40)
  await whenSettled()
  expect(rebuild).toHaveBeenCalledExactlyOnceWith([file])
  expect(harness.fullBuild).toHaveBeenCalledOnce()
  expect(harness.writeOutput.mock.calls.at(-1)?.[1]).toContainEqual({ type: 'asset', fileName: 'next-sitemap.json', source: after })
  await load()
  await vi.advanceTimersByTimeAsync(40)
  expect(rebuild).toHaveBeenCalledOnce()
})

it('releases sidecar input ownership synchronously before asynchronous session teardown', async () => {
  const { ctx, watcher, file, before, after, rebuild, load } = await start()
  const closing = Promise.withResolvers<void>()
  harness.closeAdapter.mockImplementationOnce(() => closing.promise)
  const closed = watcher.close()
  await writeFile(file, after)
  await load()
  expect(getCompilerHmrHost(ctx).readSource(file)).toBe(before)
  expect(rebuild).not.toHaveBeenCalled()
  closing.resolve()
  await closed
})
