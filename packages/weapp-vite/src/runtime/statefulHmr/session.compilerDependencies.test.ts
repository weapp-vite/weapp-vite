import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { CompilerContext } from '../../context'
import type { WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrDevEngineBatch } from './viteAdapter'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockViteWatcher } from '../../../test/helpers/viteWatcher'
import { createModuleGraphService } from '../../moduleGraph/service'
import { createCompilerDependencyTracker } from '../../plugins/compilerPlugin/dependencies'
import { compilerSourceId, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { runStatefulHmrDev } from './session'
import { StatefulHmrTransport } from './transport'

interface Callbacks {
  onOutput: (output: StatefulHmrOutputFile[], source: 'full') => Promise<void>
  onBatch: (batch: StatefulHmrDevEngineBatch) => void
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as Callbacks | undefined,
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[]) => Promise<void>>(),
  nativeWait: vi.fn<() => Promise<void>>(),
  fullBuild: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('../../plugins/asset/prune', () => ({ pruneOwnedAssetFiles: vi.fn(async () => {}) }))
// 本套件只注入适配器和系统事件边界，不启动额外 watcher、服务或原生引擎。
vi.mock('../watch/assets', () => ({ watchAssetSources: () => ({ ready: Promise.resolve(), close: async () => {} }) }))
vi.mock('./childSources', () => ({ observeChildSources: () => ({ owns: () => false, adopt() {}, close: async () => {} }) }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: Callbacks) {
      harness.callbacks = callbacks
    }

    install() {}
    async close() {}
    async waitForNativeUpdates() { await harness.nativeWait() }
    async whenSettled() { await this.waitForNativeUpdates() }
    async registerBundleModules() { return 1 }
    async registerPatchModules() {}
    async markPayloadDelivered() {}
    async rebuild(prepare?: () => void | Promise<void>) {
      await prepare?.()
      await harness.fullBuild()
    }
  },
}))

const roots: string[] = []
const sessions: Array<{ close: () => Promise<void> }> = []
const trackers: Array<{ dispose: () => void }> = []
const contentFile = 'provider-content.wxml'

function appOutput(): StatefulHmrOutputFile[] {
  return [{ type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} }]
}

function snapshot(color: string): StatefulHmrSnapshot {
  return {
    output: [{ type: 'asset', fileName: contentFile, source: `<view data-color="${color}"></view>` }],
    componentPageGlobalStyleRoutes: [],
    glassEaselAnalysisByOwner: new Map(),
  }
}

function writtenAssets() {
  return harness.writeOutput.mock.calls.flatMap(([, output]) => output).filter(item => item.type === 'asset')
}

beforeEach(() => {
  vi.useFakeTimers()
  harness.writeOutput.mockReset().mockResolvedValue()
  harness.nativeWait.mockReset().mockResolvedValue()
  harness.fullBuild.mockReset().mockImplementation(async () => {
    await harness.callbacks!.onOutput(appOutput(), 'full')
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
    watcher: createMockViteWatcher(),
    middlewares: { use: vi.fn() },
    httpServer: Object.assign(new EventEmitter(), { address: () => undefined }),
    close: async () => {},
    restart: async () => {},
    async listen() {
      await harness.callbacks!.onOutput(appOutput(), 'full')
      await harness.callbacks!.waitForInitialBundle()
    },
  }))
})

afterEach(async () => {
  trackers.splice(0).forEach(tracker => tracker.dispose())
  await Promise.all(sessions.splice(0).map(session => session.close()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function start(beforePrepare?: () => Promise<void>) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-compiler-delivery-')))
  roots.push(root)
  const srcRoot = path.join(root, 'src')
  await mkdir(srcRoot)
  const token = path.join(srcRoot, 'provider.tokens.json')
  const label = path.join(srcRoot, 'label.ts')
  const before = JSON.stringify({ color: 'red' })
  const after = JSON.stringify({ color: 'blue' })
  const labelSource = 'export const label = "initial"'
  await writeFile(token, before)
  await writeFile(label, labelSource)
  const color = (sources: ReadonlyMap<string, string | null> | undefined) => {
    const source = sources?.get(compilerSourceId(token))
    if (typeof source !== 'string') {
      throw new TypeError('Compiler token is missing from the frozen input')
    }
    return (JSON.parse(source) as { color: string }).color
  }
  const rebuild = vi.fn(async (_files: string[], sources?: ReadonlyMap<string, string | null>) => snapshot(color(sources)))
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: { isDev: true, platform: 'weapp', cwd: root, absoluteSrcRoot: srcRoot, outDir: path.join(root, 'dist'), multiPlatform: { enabled: false }, weappViteConfig: { hmr: {} }, inlineConfig: {} },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: createModuleGraphService(),
  } as unknown as CompilerContext
  const session = await runStatefulHmrDev(ctx, { root }, async () => {}, { initial: snapshot('red'), entryIds: [], rebuild }, createDevBuildWatcher())
  sessions.push(session)
  const host = getCompilerHmrHost(ctx)
  const prepare = vi.fn(async (input: WeappCompilerHmrRequest) => {
    const value = color(input.sources)
    await beforePrepare?.()
    return { assets: [{ fileName: contentFile, code: `<view data-color="${value}"></view>` }] }
  })
  host.register('token-provider', prepare)
  host.captureNative(label, labelSource)
  const tracker = createCompilerDependencyTracker(ctx)
  trackers.push(tracker)
  tracker.remember(token)
  const server = await harness.createServer.mock.results.at(-1)!.value
  tracker.configureServer(server as ViteDevServer)
  const plugins = harness.createServer.mock.calls.at(-1)![0].plugins as Plugin[]
  const hook = plugins.find(plugin => plugin.name === 'weapp-vite:hmr-input')!.watchChange!
  const watch = typeof hook === 'function' ? hook : hook.handler
  const whenSettled = plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!.api.whenSettled as () => Promise<void>
  harness.writeOutput.mockClear()
  return {
    host,
    token,
    label,
    before,
    after,
    prepare,
    rebuild,
    whenSettled,
    sourceWatcher: server.watcher as EventEmitter,
    sourceChange: (file: string, reasons: string[]) => ctx.onStatefulHmrSourceChange!(file, reasons),
    captureNativeToken: () => watch.call({} as never, token, { event: 'update' }),
  }
}

describe('compiler dependency delivery boundary', () => {
  it.each(['token-only', 'label-only', 'mixed'] as const)('retains compiler work from a native Noop batch: %s', async (kind) => {
    const fixture = await start()
    const { host, token, label, after, prepare } = fixture
    expect(host.ownsDependency(token)).toBe(true)
    expect(host.isNativeSource(label)).toBe(true)
    expect(host.ownsDependency(label)).toBe(false)
    if (kind !== 'label-only') {
      await writeFile(token, after)
      // 原生案例只使用真实前置 capture，不注入额外 Vite change 来补救批次。
      await fixture.captureNativeToken()
      expect(host.readSource(token)).toBe(after)
    }
    const changedFiles = kind === 'mixed' ? [token, label] : [kind === 'token-only' ? token : label]
    harness.callbacks!.onBatch({ changedFiles, updates: [{ clientId: 'compiler-dependency-test', update: { type: 'Noop' } }] })
    await fixture.whenSettled()
    if (kind === 'label-only') {
      expect(prepare).not.toHaveBeenCalled()
      expect(harness.writeOutput).not.toHaveBeenCalled()
    }
    else {
      expect(prepare).toHaveBeenCalledOnce()
      const input = prepare.mock.calls[0]![0]
      expect(input.changedFiles).toEqual([token])
      expect(input.sources.get(compilerSourceId(token))).toBe(after)
      expect(input.sources.has(compilerSourceId(label))).toBe(true)
      expect(fixture.rebuild).toHaveBeenCalledExactlyOnceWith([token], input.sources)
      expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
    }
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('consumes discarded native reasons without applying them to compiler work or a later native patch', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const fixture = await start()
    const { token, label, after, prepare, rebuild } = fixture
    fixture.sourceChange(label, ['entry-mixed-asset:1'])
    await writeFile(token, after)
    await fixture.captureNativeToken()
    harness.callbacks!.onBatch({ changedFiles: [token, label], updates: [{ clientId: 'compiler-dependency-test', update: { type: 'Noop' } }] })
    await fixture.whenSettled()

    expect(prepare).toHaveBeenCalledOnce()
    const input = prepare.mock.calls[0]![0]
    expect(input.changedFiles).toEqual([token])
    expect(rebuild).toHaveBeenCalledExactlyOnceWith([token], input.sources)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
    expect(harness.fullBuild).not.toHaveBeenCalled()
    prepare.mockClear()
    rebuild.mockClear()

    // 被 Noop 丢弃的脚本原因已消费，后续非 Noop Patch 仍走原生安全路径。
    harness.callbacks!.onBatch({ changedFiles: [label], updates: [{ clientId: 'compiler-dependency-test', update: { type: 'Patch', code: 'void 0', filename: 'label-update.js', changedIds: [label] } }] })
    await fixture.whenSettled()

    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]![0].changedFiles).toEqual([label])
    expect(delta).toHaveBeenCalledOnce()
    expect(rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('delivers a Vite-captured raw input after native settlement and holds its frozen preparation', async () => {
    const nativeEntered = Promise.withResolvers<void>()
    const nativeRelease = Promise.withResolvers<void>()
    const prepareEntered = Promise.withResolvers<void>()
    const prepareRelease = Promise.withResolvers<void>()
    const fixture = await start(async () => {
      prepareEntered.resolve()
      await prepareRelease.promise
    })
    const { host, token, after, prepare } = fixture
    harness.nativeWait.mockImplementation(async () => {
      nativeEntered.resolve()
      await nativeRelease.promise
    })
    try {
      await writeFile(token, after)
      // EventEmitter 只替代系统事件，捕获与异步交付使用真实源码。
      fixture.sourceWatcher.emit('change', token)
      await nativeEntered.promise
      expect(host.readSource(token)).toBe(after)
      expect(prepare).not.toHaveBeenCalled()
      expect(harness.writeOutput).not.toHaveBeenCalled()
      nativeRelease.resolve()
      await prepareEntered.promise
      expect(prepare).toHaveBeenCalledOnce()
      expect(prepare.mock.calls[0]![0].sources.get(compilerSourceId(token))).toBe(after)
      expect(harness.writeOutput).not.toHaveBeenCalled()
      prepareRelease.resolve()
      await fixture.whenSettled()
      expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: contentFile, source: '<view data-color="blue"></view>' }))
      expect(fixture.rebuild).toHaveBeenCalledExactlyOnceWith([token], prepare.mock.calls[0]![0].sources)
      expect(harness.fullBuild).not.toHaveBeenCalled()
    }
    finally {
      nativeRelease.resolve()
      prepareRelease.resolve()
    }
  })
})
