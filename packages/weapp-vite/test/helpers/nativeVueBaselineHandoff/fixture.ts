import type { InlineConfig, Plugin, ViteDevServer } from 'vite'
import type { CompilerContext } from '../../../src/context'
import type { StatefulHmrSnapshot } from '../../../src/runtime/statefulHmr/globalStyles'
import type { StatefulHmrOutputFile } from '../../../src/runtime/statefulHmr/outputWriter'
import type { StatefulHmrDevEngineUpdate } from '../../../src/runtime/statefulHmr/viteAdapter'
import type { WeappCompilerHmrRequest, WeappCompilerPlugin } from '../../../src/types/compilerPlugin'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, vi } from 'vitest'
import { compileVueFile } from 'wevu/compiler'
import { createModuleGraphService } from '../../../src/moduleGraph/service'
import { createCompilerPluginPlugins } from '../../../src/plugins/compilerPlugin'
import { compilerSourceId, getCompilerHmrHost } from '../../../src/plugins/compilerPlugin/hmr'
import { readCompilerInput } from '../../../src/plugins/utils/sourceSnapshot'
import { createDevBuildWatcher } from '../../../src/runtime/buildPlugin/devBuildWatcher'
import { getHmrRuntimeSession } from '../../../src/runtime/hmrRuntimeSession'
import { createRuntimeState } from '../../../src/runtime/runtimeState'
import { runStatefulHmrDev } from '../../../src/runtime/statefulHmr/session'
import { StatefulHmrTransport } from '../../../src/runtime/statefulHmr/transport'
import { createMockViteWatcher } from '../viteWatcher'

interface Callbacks {
  onOutput: (output: StatefulHmrOutputFile[], source: 'full') => Promise<void>
  onPatch: (files: string[], update: StatefulHmrDevEngineUpdate) => boolean
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as Callbacks | undefined,
  createServer: vi.fn(),
  readBeforeOutput: undefined as (() => Promise<void>) | undefined,
  writeOutput: vi.fn<() => Promise<void>>(),
  nativeOutput: [] as StatefulHmrOutputFile[],
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('../../../src/runtime/statefulHmr/outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('../../../src/plugins/asset/prune', () => ({ pruneOwnedAssetFiles: vi.fn(async () => {}) }))
vi.mock('../../../src/runtime/watch/assets', () => ({ watchAssetSources: () => ({ ready: Promise.resolve(), close: async () => {} }) }))
vi.mock('../../../src/runtime/statefulHmr/childSources', () => ({ observeChildSources: () => ({ owns: () => false, adopt() {}, close: async () => {} }) }))
vi.mock('../../../src/runtime/statefulHmr/viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: Callbacks) { harness.callbacks = callbacks }
    install() {}
    async close() {}
    async waitForNativeUpdates() {}
    async whenSettled() {}
    async registerBundleModules() { return 1 }
    async registerPatchModules() {}
    async markPayloadDelivered() {}
  },
}))

const roots: string[] = []
const cleanups: Array<() => Promise<void>> = []

beforeEach(() => {
  vi.useFakeTimers()
  harness.readBeforeOutput = undefined
  harness.writeOutput.mockReset().mockResolvedValue()
  harness.createServer.mockReset().mockImplementation(async (options: InlineConfig) => ({
    config: { root: options.root, inlineConfig: options, publicDir: false, build: { copyPublicDir: false }, server: {}, logger: { info: vi.fn(), error: vi.fn() } },
    moduleGraph: { getModulesByFile: () => undefined },
    watcher: createMockViteWatcher(),
    middlewares: { use: vi.fn() },
    httpServer: { address: () => undefined },
    close: async () => {},
    restart: async () => {},
    async listen() {
      await harness.readBeforeOutput?.()
      await harness.callbacks!.onOutput(harness.nativeOutput, 'full')
      await harness.callbacks!.waitForInitialBundle()
    },
  }))
})

afterEach(async () => {
  try {
    const sessions = await Promise.allSettled(cleanups.splice(0).map(cleanup => cleanup()))
    const directories = await Promise.allSettled(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
    const failures = [...sessions, ...directories].flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (failures.length) {
      throw new AggregateError(failures, 'Baseline handoff fixture cleanup failed')
    }
  }
  finally {
    vi.restoreAllMocks()
    vi.useRealTimers()
  }
})

export async function baselineHandoffFixture(
  readPhase: 'before-output' | 'during-output-write',
  options: { declareCompilerDependency?: boolean } = {},
) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'native-vue-baseline-handoff-')))
  roots.push(root)
  const srcRoot = path.join(root, 'src')
  await mkdir(srcRoot)
  const file = path.join(srcRoot, 'page.vue')
  const original = '<script setup lang="ts">\ndefineOptions({ name: "BaselinePage" })\ndefinePageJson(() => ({ navigationBarTitleText: "baseline" }))\n</script>\n<template><view>before</view></template>\n'
  await writeFile(file, original)
  const prepare = vi.fn(async (_request: WeappCompilerHmrRequest) => ({}))
  const provider: WeappCompilerPlugin = {
    name: 'baseline-source-owner',
    capabilities: { content: true },
    create: context => ({
      buildStart: () => {
        if (options.declareCompilerDependency !== false) {
          context.addWatchFile(file)
        }
      },
      prepareHmr: prepare,
    }),
  }
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: srcRoot,
      outDir: path.join(root, 'dist'),
      isDev: true,
      multiPlatform: { enabled: false },
      inlineConfig: {},
      weappViteConfig: { hmr: {}, compilerPlugins: [provider] },
    },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: createModuleGraphService(),
  } as unknown as CompilerContext
  const host = getCompilerHmrHost(ctx)
  const sourcePlugin = createCompilerPluginPlugins(ctx).find(plugin => plugin.name === 'weapp-vite:compiler:source')!
  const buildStartHook = sourcePlugin.buildStart!
  const buildStart = typeof buildStartHook === 'function' ? buildStartHook : buildStartHook.handler
  const consumeSource = async () => {
    // 源码通过正式读取入口进入 raw 账本；外部依赖声明按场景启用，不直接 seed/capture。
    await readCompilerInput(ctx.configService, file)
    await buildStart.call({ addWatchFile: vi.fn() } as never, {} as never)
  }
  if (readPhase === 'before-output') {
    harness.readBeforeOutput = consumeSource
  }
  else {
    // 模拟独立快照已消费输入，而活动 owner 在首包排队写出时才首次读取同一原始文件。
    harness.writeOutput.mockImplementationOnce(consumeSource)
  }
  const compileSnapshot = async (source: string): Promise<StatefulHmrSnapshot> => {
    const result = await compileVueFile(source, file)
    const signature = result.meta?.templateRegistrationSignature
    if (typeof signature !== 'string' || !signature) {
      throw new Error('The real SFC compiler did not provide a template registration signature')
    }
    return {
      output: [{ type: 'asset', fileName: 'pages/baseline/index.wxml', source: result.template ?? '' }],
      entryIds: [file],
      templateRegistrationSignatures: new Map([[file, signature]]),
      componentPageGlobalStyleRoutes: [],
      glassEaselAnalysisByOwner: new Map(),
    }
  }
  // 初始模板、注册签名来自真实 SFC 编译；不借活动 host 伪造已发布的源码比较基线。
  const initial = await compileSnapshot(await readFile(file, 'utf8'))
  const rebuild = vi.fn(async (_files: string[], sources?: ReadonlyMap<string, string | null>) => {
    const source = sources?.get(compilerSourceId(file)) ?? await readFile(file, 'utf8')
    if (typeof source !== 'string') {
      throw new TypeError('The fixture source disappeared')
    }
    return compileSnapshot(source)
  })
  harness.nativeOutput = [
    { type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} },
    { type: 'chunk', fileName: 'pages/baseline/index.js', code: 'Page({});', modules: { [file]: { code: 'Page({});', renderedLength: 9, renderedExports: [] } } },
  ]
  const runtime = getHmrRuntimeSession(ctx)
  const classicRequested = Promise.withResolvers<void>()
  const classic = vi.fn(async () => {
    runtime.markClassic()
    classicRequested.resolve()
  })
  runtime.bindRequest(classic)
  const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
    await delivered?.()
  })
  const watcher = await runStatefulHmrDev(ctx, { root }, async () => {}, { initial, entryIds: [file], rebuild }, createDevBuildWatcher())
  cleanups.push(() => watcher.close())
  const server = await harness.createServer.mock.results.at(-1)!.value as ViteDevServer
  const plugins = harness.createServer.mock.calls.at(-1)![0].plugins as Plugin[]
  const inputHook = plugins.find(plugin => plugin.name === 'weapp-vite:hmr-input')!.watchChange!
  const watch = typeof inputHook === 'function' ? inputHook : inputHook.handler
  const whenSettled = plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!.api.whenSettled as () => Promise<void>
  const freeze = vi.spyOn(host, 'freeze')
  const save = async (source: string, filename: string, dirtyReasons = ['compiler-content:1'], type: 'Noop' | 'Patch' = 'Patch') => {
    await writeFile(file, source)
    // 使用生产的同步 pre watch hook 捕获此次真实磁盘保存，后续才交给 DevEngine callback。
    await watch.call({} as never, file, { event: 'update' })
    ctx.onStatefulHmrSourceChange!(file, dirtyReasons)
    const accepted = harness.callbacks!.onPatch([file], type === 'Noop' ? { type } : { type, code: 'void 0', filename, changedIds: [file] })
    await vi.advanceTimersByTimeAsync(40)
    return accepted
  }
  return { ctx, host, file, original, initial, prepare, rebuild, freeze, delta, classic, runtime, server, save, whenSettled, classicRequested: classicRequested.promise }
}
