import type { OutputBundle } from 'rolldown'
import type { InlineConfig } from 'vite'
import type { HmrProfileJsonSample } from '../../analyze/hmr'
import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { WeappCompilerHmrPreparation, WeappCompilerHmrRequest } from '../../types/compilerPlugin'
import type { StatefulHmrSnapshot } from './globalStyles'
import type { StatefulHmrInitialPublicAssets, StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrProfileHandoff } from './profile'
import type { StatefulHmrDevEngineBatch, StatefulHmrDevEngineUpdate } from './viteAdapter'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME } from '@weapp-core/constants'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeGlassEaselBundle, createGlassEaselAnalyzeResult } from '../../analyze/glassEasel'
import { refreshGlassEaselNativeScripts } from '../../analyze/glassEasel/nativeScripts'
import { createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { CompilerHmrResyncError, getCompilerHmrHost } from '../../plugins/compilerPlugin/hmr'
import { createDevBuildWatcher } from '../buildPlugin/devBuildWatcher'
import { createRuntimeState } from '../runtimeState'
import { createStatefulHmrHostPlugins } from './hostPlugins'
import { StatefulHmrProfile } from './profile'
import { runStatefulHmrDev } from './session'
import { StatefulHmrTransport } from './transport'

interface AdapterCallbacks {
  onOutput: (output: StatefulHmrOutputFile[], source?: 'full' | 'additional') => Promise<void>
  onBatch: (batch: StatefulHmrDevEngineBatch) => void
  onPatch: (files: string[], output: StatefulHmrDevEngineUpdate) => boolean
  waitForInitialBundle: () => Promise<void>
}

const harness = vi.hoisted(() => ({
  callbacks: undefined as AdapterCallbacks | undefined,
  nativeOutput: [] as StatefulHmrOutputFile[],
  initialOutput: true,
  nativeSettlement: vi.fn<() => Promise<void>>(),
  createServer: vi.fn(),
  writeOutput: vi.fn<(outDir: string, output: StatefulHmrOutputFile[], initialPublicAssets?: StatefulHmrInitialPublicAssets, removedAssets?: string[]) => Promise<void>>(),
  fullBuild: vi.fn<() => Promise<void>>(),
  beforeInitialReady: vi.fn<() => Promise<void>>(),
  beforeFullPrepare: vi.fn<() => Promise<void>>(),
  registerBundleModules: vi.fn<() => Promise<number>>(),
  registerPatchModules: vi.fn<(code: string) => Promise<void>>(),
  markPayloadDelivered: vi.fn<(filename: string) => Promise<void>>(),
  closeAdapter: vi.fn<() => Promise<void>>(),
  closeServer: vi.fn<() => Promise<void>>(),
}))

vi.mock('vite', async importOriginal => ({
  ...await importOriginal<typeof import('vite')>(),
  createServer: harness.createServer,
}))
vi.mock('./outputWriter', () => ({ writeStatefulHmrOutput: harness.writeOutput }))
vi.mock('../../plugins/asset/prune', () => ({ pruneOwnedAssetFiles: vi.fn(async () => {}) }))
vi.mock('./viteAdapter', () => ({
  StatefulHmrViteAdapter: class {
    constructor(_config: unknown, _server: unknown, callbacks: AdapterCallbacks) {
      harness.callbacks = { ...callbacks, onOutput: (output, source = 'full') => callbacks.onOutput(output, source) }
    }

    install() {}
    async close() {
      await harness.closeAdapter()
    }

    async registerBundleModules() {
      return harness.registerBundleModules()
    }

    async registerPatchModules(code: string) {
      await harness.registerPatchModules(code)
    }

    async markPayloadDelivered(filename: string) {
      await harness.markPayloadDelivered(filename)
    }

    async waitForNativeUpdates() {}
    async whenSettled() {
      await harness.nativeSettlement()
    }

    async rebuild(prepare?: () => void | Promise<void>) {
      await harness.beforeFullPrepare()
      await prepare?.()
      await harness.fullBuild()
    }
  },
}))

const route = 'pages/shared/index'
const styleFile = `${WEAPP_VITE_STATEFUL_HMR_GLOBAL_STYLE_BASENAME}.wxss`
const root = path.join(realpathSync(tmpdir()), 'stateful-session-snapshots')
const watchers: Array<{ close: () => Promise<void> }> = []
const temporaryDirectories: string[] = []

function appOutput(): StatefulHmrOutputFile[] {
  return [{ type: 'chunk', fileName: 'app.js', code: 'App({});', modules: {} }, ...harness.nativeOutput]
}

function snapshot(color: string, routes: string[] = [route]): StatefulHmrSnapshot {
  return {
    output: [{ type: 'asset', fileName: 'app.wxss', source: `.probe { color: ${color}; }` }],
    componentPageGlobalStyleRoutes: routes,
    glassEaselAnalysisByOwner: new Map(),
  }
}

function analyzedSnapshot(paired: boolean, selector = '.valid'): StatefulHmrSnapshot {
  // 分析器只读取配置与真实 runtime state；文件系统由现有 session harness 隔离。
  const producer = {
    runtimeState: createRuntimeState(),
    configService: { platform: 'weapp' },
  } as unknown as CompilerContext
  producer.runtimeState.glassEasel.silent = true
  const config = {
    type: 'asset' as const,
    fileName: 'app.json',
    source: JSON.stringify({
      glassEaselWebview: true,
      ...(paired ? { componentFramework: 'glass-easel' } : {}),
    }),
  }
  analyzeGlassEaselBundle(producer, {
    'app.json': config,
    'page.js': {
      type: 'chunk',
      fileName: 'page.js',
      facadeModuleId: path.join(root, 'src/page.js'),
      code: `wx.createSelectorQuery().select(${JSON.stringify(selector)}).exec()`,
    },
  } as unknown as OutputBundle, { mode: 'full', outputScope: 'main' })
  const value = snapshot(paired ? 'blue' : 'red')
  return {
    ...value,
    output: [...value.output, config],
    glassEaselAnalysisByOwner: producer.runtimeState.glassEasel.analysisByOwner,
  }
}

async function start(initial = snapshot('red'), entryIds: string[] = [], inlineConfig: InlineConfig = {}, nativeSources = new Map<string, string>(), profile?: StatefulHmrProfileHandoff, onContext?: (ctx: MutableCompilerContext) => void) {
  const rebuild = vi.fn(async (_files: string[], _sources?: ReadonlyMap<string, string | null>) => snapshot('blue'))
  const changes = new Map<string, string>()
  const ctx = {
    runtimeState: createRuntimeState(),
    configService: {
      platform: 'weapp',
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      weappViteConfig: { hmr: { profileJson: profile ? true : undefined } },
      inlineConfig,
    },
    scanService: { subPackageMap: new Map() },
    moduleGraphService: {
      collectAffectedEntries: () => new Set(),
      recordChangedFile: (file: string, event: string) => changes.set(file, event),
      getPendingChanges: () => Array.from(changes, ([file, event]) => ({ file, event })),
    },
  } as unknown as MutableCompilerContext
  for (const [file, source] of nativeSources) {
    getCompilerHmrHost(ctx).captureNative(file, source)
  }
  onContext?.(ctx)
  const events = createDevBuildWatcher()
  const restart = vi.fn(async () => {})
  const watcher = await runStatefulHmrDev(ctx, { root }, restart, { initial, entryIds, rebuild, profile }, events)
  watchers.push(watcher)
  const plugins = harness.createServer.mock.calls.at(-1)![0].plugins as Array<{ name: string, api?: { whenSettled: () => Promise<void> } }>
  const whenSettled = plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!.api!.whenSettled
  return {
    rebuild,
    restart,
    close: () => watcher.close(),
    ctx,
    watcher,
    events,
    whenSettled,
    changeProfile(reasons: string[]) {
      ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = reasons
    },
    sourceChange(file: string, event = 'update', reasons: string[] = []) {
      changes.set(file, event)
      ctx.onStatefulHmrSourceChange!(file, reasons)
    },
    patch: (reasons: string[]) => {
      ctx.onStatefulHmrSourceChange!(path.join(root, 'src/page.vue'), reasons)
      ctx.runtimeState.build.hmr.profile.dirtyReasonSummary = []
      return harness.callbacks!.onPatch([path.join(root, 'src/page.vue')], { type: 'Patch', code: 'void 0', filename: 'update.js' })
    },
    refresh: () => ctx.onStatefulHmrSourceChange!(path.join(root, 'src/page.wxss'), []),
    full: () => harness.callbacks!.onPatch([path.join(root, 'src/page.vue')], { type: 'FullReload', reason: 'test boundary' }),
  }
}

function writtenAssets() {
  return harness.writeOutput.mock.calls.flatMap(([, output]) => output).filter(item => item.type === 'asset')
}

describe('stateful snapshot output transactions', () => {
  it('keeps settlement pending through a debounced refresh and its final output write', async () => {
    const session = await start()
    const rebuilt = Promise.withResolvers<StatefulHmrSnapshot>()
    const published = Promise.withResolvers<void>()
    session.rebuild.mockImplementationOnce(() => rebuilt.promise)
    harness.writeOutput.mockClear().mockImplementationOnce(() => published.promise)
    session.refresh()
    let settled = false
    const waiting = session.whenSettled().then(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(40)
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(settled).toBe(false)
    rebuilt.resolve(snapshot('blue'))
    await vi.advanceTimersByTimeAsync(0)
    expect(harness.writeOutput).toHaveBeenCalledOnce()
    expect(settled).toBe(false)
    published.resolve()
    await waiting
    expect(settled).toBe(true)
  })

  it('rejects failed publication settlement and accepts a later successful refresh', async () => {
    const session = await start()
    const error = new Error('snapshot output publication failed')
    harness.writeOutput.mockRejectedValueOnce(error)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    session.refresh()
    const recovered = session.whenSettled()
    await vi.advanceTimersByTimeAsync(40)
    await expect(recovered).resolves.toBeUndefined()
  })

  it('rejects a pending settlement on close and releases the host API binding', async () => {
    const session = await start()
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toThrow(/closed|not active/)
    await session.close()
    await rejected
    await expect(session.whenSettled()).rejects.toThrow('not active')
  })

  it('rejects settlement when a topology change requires a host handoff', async () => {
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page])
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toThrow('closed or restarted before settlement')
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    expect(session.restart).not.toHaveBeenCalled()
  })

  it('does not let an old session release a newer host settlement binding', async () => {
    const controller = createStatefulHmrHostPlugins({} as CompilerContext)
    const plugin = controller.plugins.find(plugin => plugin.name === 'weapp-vite:stateful-hmr-session')!
    const settle = plugin.api.whenSettled as () => Promise<void>
    const old = vi.fn(async () => {})
    const replacement = vi.fn(async () => {})
    const releaseOld = controller.bindSettlement(old)
    const releaseReplacement = controller.bindSettlement(replacement)
    releaseOld()
    await settle()
    expect(old).not.toHaveBeenCalled()
    expect(replacement).toHaveBeenCalledOnce()
    releaseReplacement()
    await expect(settle()).rejects.toThrow('not active')
  })

  it('keeps the old host unsettled while its asynchronous restart is in progress', async () => {
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page])
    const restarted = Promise.withResolvers<void>()
    session.restart.mockImplementationOnce(() => restarted.promise)
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    session.refresh()
    await vi.advanceTimersByTimeAsync(140)
    expect(session.restart).toHaveBeenCalledOnce()
    await expect(session.whenSettled()).rejects.toThrow('closed or restarted before settlement')
    restarted.resolve()
    await session.close()
  })

  it.each(['initial', 'native'] as const)('interrupts settlement on close while %s engine work remains pending', async (pending) => {
    harness.initialOutput = pending !== 'initial'
    const session = await start()
    const native = Promise.withResolvers<void>()
    if (pending === 'native') {
      harness.nativeSettlement.mockImplementationOnce(() => native.promise)
    }
    const rejected = expect(session.whenSettled()).rejects.toThrow('closed or restarted before settlement')
    await vi.advanceTimersByTimeAsync(0)
    await session.close()
    await rejected
    native.resolve()
  })

  it('validates edits arriving before topology handoff and keeps the old host after a failed replacement snapshot', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/child.js')
    const session = await start(snapshot('red'), [page])
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
      .mockRejectedValueOnce(new Error('invalid new component'))
      .mockResolvedValue({ ...snapshot('green'), entryIds: [page, child] })
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(session.restart).not.toHaveBeenCalled()
    session.sourceChange(path.join(root, 'src/child.js'))
    await vi.advanceTimersByTimeAsync(200)
    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(session.restart).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    session.sourceChange(path.join(root, 'src/child.js'))
    await vi.advanceTimersByTimeAsync(200)
    expect(session.restart).toHaveBeenCalledOnce()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it('cancels an unconsumed topology handoff when the owning session closes', async () => {
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page])
    session.rebuild.mockResolvedValue({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    await Promise.all([session.close(), session.close()])
    await vi.advanceTimersByTimeAsync(200)
    expect(session.restart).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
  })

  it.each([
    ['app.json', '{"window":{"navigationBarTitleText":"updated"}}'],
    ['pages/shared/index.wxml', '<view>updated</view>'],
    ['pages/shared/index.wxss', '.native-updated { color: blue; }'],
  ])('keeps native %s output when a compiler also scans that source', async (fileName, source) => {
    const session = await start()
    const file = path.join(root, 'src', fileName)
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({}))
    compiler.seed(file, 'before')
    compiler.capture(file, source)
    session.rebuild.mockResolvedValueOnce({
      ...snapshot('blue'),
      output: [...snapshot('blue').output, { type: 'asset', fileName, source }],
    })
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([path.relative(root, file)], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(session.rebuild).toHaveBeenCalledWith([file], expect.any(Map))
    expect(writtenAssets().findLast(asset => asset.fileName === fileName)?.source).toContain(source)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('rejects compiler-owned metadata assets until a changed entry graph replaces the engine', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/child.js')
    const session = await start(snapshot('red'), [page])
    const file = path.join(root, 'src/page.json')
    const compiler = getCompilerHmrHost(session.ctx)
    const dispose = vi.fn()
    compiler.register('scan-only-provider', async () => ({ dispose }))
    compiler.seed(file, '{}')
    compiler.capture(file, '{"usingComponents":{"child":"./child"}}')
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
    harness.writeOutput.mockClear()
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(200)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(session.patch([])).toBe(false)
  })

  it('retires assets removed by a compiler-owned native snapshot batch', async () => {
    const removed = { type: 'asset' as const, fileName: 'resources/deleted.txt', source: 'old' }
    const initial = snapshot('red', [])
    initial.output.push(removed)
    const session = await start(initial)
    const file = path.join(root, 'src/page.wxml')
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({}))
    compiler.seed(file, '<view>before</view>')
    compiler.capture(file, '<view>after</view>')
    session.rebuild.mockResolvedValue(snapshot('blue', []))
    harness.writeOutput.mockClear()
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])).toContain(removed.fileName)
  })

  it('restores unchanged bytes after a compiler batch partially writes and fails', async () => {
    const initial = snapshot('red', [])
    const session = await start(initial)
    const file = path.join(root, 'src/page.wxml')
    const compiler = getCompilerHmrHost(session.ctx)
    compiler.register('scan-only-provider', async () => ({}))
    compiler.seed(file, '<view>before</view>')
    compiler.capture(file, '<view>after</view>')
    const partial = snapshot('blue', [])
    partial.output.push({ type: 'asset', fileName: 'resources/partial.txt', source: 'partial' })
    session.rebuild.mockResolvedValueOnce(partial).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('partial batch write'))
    session.sourceChange(file, 'update', ['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    harness.writeOutput.mockClear()
    // 新源事件以完整重同步恢复；不得用失败前的字节快照省略真实写回。
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: red; }' }))
    expect(harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])).toContain('resources/partial.txt')
  })

  it('issue #1081: commits final compiler styles before publishing a patch and only acknowledges scripts after execution', async () => {
    const applied = Promise.withResolvers<void>()
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await applied.promise
      await delivered?.()
    })
    const session = await start()
    const ended = vi.fn()
    session.events.watcher.on('event', ended)
    ended.mockClear()
    harness.writeOutput.mockClear()
    const commit = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => commit.promise)
    try {
      expect(session.patch(['compiler-content:tailwind'])).toBe(true)
      await vi.advanceTimersByTimeAsync(50)
      expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: blue; }' }))
      expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: `${route}.wxss`, source: expect.stringContaining('color: blue') }))
      expect(delta).not.toHaveBeenCalled()
      expect(harness.registerPatchModules).not.toHaveBeenCalled()
      expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
      expect(ended).not.toHaveBeenCalled()

      commit.resolve()
      await vi.advanceTimersByTimeAsync(1)
      expect(delta).toHaveBeenCalledOnce()
      expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
      expect(ended).not.toHaveBeenCalled()
      const writesBeforeAcknowledgement = harness.writeOutput.mock.calls.length
      applied.resolve()
      await vi.advanceTimersByTimeAsync(1)
      expect(harness.registerPatchModules).toHaveBeenCalledExactlyOnceWith('void 0')
      expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
      expect(harness.writeOutput).toHaveBeenCalledTimes(writesBeforeAcknowledgement)
      expect(ended).toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
    }
    finally {
      commit.resolve()
      applied.resolve()
    }
  })

  it('issue #1081: does not publish or acknowledge a patch when final styles fail and restores the store before a later batch', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const initial = snapshot('red')
    const session = await start(initial)
    const failure = new Error('compiler stylesheet write failed')
    session.rebuild.mockResolvedValueOnce(snapshot('blue')).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(failure)
    expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(delta).not.toHaveBeenCalled()
    expect(harness.registerPatchModules).not.toHaveBeenCalled()
    expect(harness.markPayloadDelivered).not.toHaveBeenCalled()
    await expect(session.whenSettled()).rejects.toBe(failure)

    harness.writeOutput.mockClear()
    expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: red; }' }))

    session.rebuild.mockResolvedValue(snapshot('green'))
    expect(session.patch(['compiler-content:tailwind'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: green; }' }))
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.registerPatchModules).toHaveBeenCalledOnce()
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
  })

  it('issue #1081: shares one final stylesheet across ordered patches and commits the next batch after acknowledgement', async () => {
    const applied = Promise.withResolvers<void>()
    const order: string[] = []
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      order.push('publish')
      if (delta.mock.calls.length === 1) {
        await applied.promise
      }
      await delivered?.()
    })
    const session = await start()
    session.rebuild.mockResolvedValueOnce(snapshot('blue')).mockResolvedValueOnce(snapshot('green'))
    harness.writeOutput.mockClear().mockImplementation(async (_outDir, output) => {
      const style = output.find(item => item.fileName === styleFile)
      if (style?.type === 'asset') {
        order.push(`write:${style.source}`)
      }
    })
    harness.registerPatchModules.mockImplementation(async (code) => {
      order.push(`register:${code}`)
    })
    harness.markPayloadDelivered.mockImplementation(async (filename) => {
      order.push(`mark:${filename}`)
    })
    const file = path.join(root, 'src/page.vue')
    try {
      session.sourceChange(file, 'update', ['compiler-content:tailwind'])
      harness.callbacks!.onBatch({
        changedFiles: [file],
        updates: [
          { clientId: 'first', update: { type: 'Patch', code: 'order.push("first")', filename: 'first.js', changedIds: ['first-module'] } },
          { clientId: 'second', update: { type: 'Patch', code: 'order.push("second")', filename: 'second.js', changedIds: ['first-module', 'second-module'] } },
        ],
      })
      await vi.advanceTimersByTimeAsync(50)
      expect(session.rebuild).toHaveBeenCalledOnce()
      expect(delta).toHaveBeenCalledOnce()
      expect(harness.writeOutput).toHaveBeenCalledOnce()
      expect(delta.mock.calls[0]![1]).toEqual(['first-module', 'second-module'])
      const executed: string[] = []
      runInNewContext(delta.mock.calls[0]![0], { order: executed })
      expect(executed).toEqual(['first', 'second'])
      expect(order).toEqual(['write:.probe { color: blue; }', 'publish'])

      expect(session.patch(['compiler-content:tailwind'])).toBe(true)
      await vi.advanceTimersByTimeAsync(50)
      expect(session.rebuild).toHaveBeenCalledTimes(2)
      expect(delta).toHaveBeenCalledOnce()
      expect(harness.writeOutput).toHaveBeenCalledOnce()
      expect(harness.markPayloadDelivered).not.toHaveBeenCalled()

      applied.resolve()
      await vi.advanceTimersByTimeAsync(1)
      await session.whenSettled()
      expect(delta).toHaveBeenCalledTimes(2)
      expect(harness.writeOutput).toHaveBeenCalledTimes(2)
      expect(order).toEqual([
        'write:.probe { color: blue; }',
        'publish',
        'register:order.push("first")',
        'mark:first.js',
        'register:order.push("second")',
        'mark:second.js',
        'write:.probe { color: green; }',
        'publish',
        'register:void 0',
        'mark:update.js',
      ])
      expect(harness.fullBuild).not.toHaveBeenCalled()
    }
    finally {
      applied.resolve()
    }
  })

  it.each(['page.js', 'page.vue'])('issue #1081: publishes a script-only %s patch without writing unchanged styles', async (sourceName) => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    harness.writeOutput.mockClear()
    const file = path.join(root, 'src', sourceName)
    session.sourceChange(file)
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    await session.whenSettled()
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.registerPatchModules).toHaveBeenCalledExactlyOnceWith('void 0')
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('update.js')
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    harness.nativeOutput = []
    harness.initialOutput = true
    harness.nativeSettlement.mockReset().mockResolvedValue()
    harness.writeOutput.mockReset().mockResolvedValue()
    harness.beforeInitialReady.mockReset().mockResolvedValue()
    harness.beforeFullPrepare.mockReset().mockResolvedValue()
    harness.registerBundleModules.mockReset().mockResolvedValue(1)
    harness.registerPatchModules.mockReset().mockResolvedValue()
    harness.markPayloadDelivered.mockReset().mockResolvedValue()
    harness.closeAdapter.mockReset().mockResolvedValue()
    harness.closeServer.mockReset().mockResolvedValue()
    harness.fullBuild.mockReset().mockImplementation(async () => {
      harness.callbacks!.onOutput(appOutput())
    })
    harness.createServer.mockImplementation(async (options: InlineConfig) => {
      const server = {
        config: {
          inlineConfig: options,
          root: options.root,
          publicDir: path.join(root, 'static-assets'),
          build: { copyPublicDir: true },
          server: {},
          logger: { info: vi.fn(), error: vi.fn() },
        },
        moduleGraph: { getModulesByFile: () => undefined },
        watcher: Object.assign(new EventEmitter(), { add: vi.fn() }),
        middlewares: { use: vi.fn() },
        httpServer: { address: () => undefined },
        close: harness.closeServer,
        restart: vi.fn().mockResolvedValue(undefined),
        async listen() {
          if (!harness.initialOutput) {
            return
          }
          harness.callbacks!.onOutput(appOutput())
          await harness.beforeInitialReady()
          await harness.callbacks!.waitForInitialBundle()
        },
      }
      return server
    })
  })

  it('applies configured build polling to the Vite source watcher', async () => {
    await start(snapshot('red'), [], { build: { watch: { chokidar: { usePolling: true, interval: 50 } } } })
    expect(harness.createServer.mock.calls.at(-1)?.[0].server.watch).toMatchObject({ usePolling: true, interval: 50 })
  })

  it('retains the core ingress event across the session listener and snapshot publication', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    const file = path.join(root, 'src/page.wxss')
    const sourceEvent = { eventId: 'core-ingress', event: 'update' as const, file, receivedAtMs: performance.now() }
    samples.splice(0)
    session.ctx.onStatefulHmrSourceChange!(file, ['style-sidecar:1'], sourceEvent)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(samples.filter(sample => sample.profileMode === 'refresh')).toEqual([
      expect.objectContaining({ status: 'complete', eventId: 'core-ingress', sourceEvents: [sourceEvent] }),
    ])
  })

  it.each(['write', 'register'] as const)('keeps a transferred profile pending until replacement %s succeeds', async (stage) => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const original = new StatefulHmrProfile({ root })
    original.source('app.json')
    const profile = original.transfer(original.begin(['app.json'], 'delivery'))!
    await original.close()
    const gate = Promise.withResolvers<void>()
    if (stage === 'write') {
      harness.writeOutput.mockImplementationOnce(() => gate.promise)
    }
    else {
      harness.registerBundleModules.mockImplementationOnce(async () => {
        await gate.promise
        return 1
      })
    }
    const starting = start(snapshot('blue'), [], {}, new Map(), profile)
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.writeOutput).toHaveBeenCalledOnce()
    expect(samples).toEqual([])
    gate.resolve()
    const replacement = await starting
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'complete', completionBoundary: 'output-published', profileMode: 'full' })
    await replacement.close()
    expect(samples).toHaveLength(1)
  })

  it('ends the original profile when a newer source event arrives before replacement publication', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const original = new StatefulHmrProfile({ root })
    original.source('app.json')
    const profile = original.transfer(original.begin(['app.json'], 'delivery'))!
    await original.close()
    const gate = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => gate.promise)
    let context: MutableCompilerContext | undefined
    const starting = start(snapshot('blue'), [], {}, new Map(), profile, (ctx) => {
      context = ctx
    })
    await vi.advanceTimersByTimeAsync(1)
    context!.onStatefulHmrSourceChange!(path.join(root, 'src/app.json'), [])
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'incomplete', file: 'app.json' })
    gate.resolve()
    const replacement = await starting
    await replacement.close()
    expect(samples).toHaveLength(1)
    expect(samples[0]!.totalMs).toBeUndefined()
  })

  it.each(['write', 'register'] as const)('preserves failed replacement %s in the transferred profile', async (stage) => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const original = new StatefulHmrProfile({ root })
    original.source('app.json')
    const profile = original.transfer(original.begin(['app.json'], 'delivery'))!
    await original.close()
    const failure = new Error('replacement publication failed')
    if (stage === 'write') {
      harness.writeOutput.mockRejectedValueOnce(failure)
    }
    else {
      harness.registerBundleModules.mockRejectedValueOnce(failure)
    }
    await expect(start(snapshot('blue'), [], {}, new Map(), profile)).rejects.toBe(failure)
    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({ status: 'failed', completionBoundary: 'output-published' })
    expect(samples[0]!.totalMs).toBeUndefined()
  })

  it('rejects old-engine patches and retains successful assets until a metadata topology change replaces the engine', async () => {
    const page = path.join(root, 'src/page.js')
    const child = path.join(root, 'src/added-child.js')
    const session = await start(snapshot('red'), [page])
    expect(session.patch([])).toBe(true)
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, child] })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    expect(session.patch([])).toBe(false)
    const currentStyle = writtenAssets().filter(item => item.fileName === `${styleFile}`).at(-1)
    expect(currentStyle?.source).toContain('color: red')
    expect(currentStyle?.source).not.toContain('color: blue')
  })

  afterEach(async () => {
    await Promise.all(watchers.splice(0).map(watcher => watcher.close()))
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('delivers a native child component patch without rebuilding its parent page', async () => {
    const component = path.join(root, 'src/counter.js')
    const page = path.join(root, 'src/page.js')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta')
    const session = await start(snapshot('red'), [component, page])
    const changedIds = [
      'src/counter.js',
      createSidecarSourceSpecifier(page, 'src/counter.js', 'using-component'),
    ]
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'Component({ methods: { increment() { return 2 } } });',
      filename: 'update.js',
      changedIds,
    })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(delta).toHaveBeenCalledWith(expect.stringContaining('increment'), changedIds, expect.any(Function))
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps atomic child restoration as a patch when the watcher also reports parent directory metadata', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/child-restore-'))
    temporaryDirectories.push(directory)
    const component = path.join(directory, 'index.js')
    const page = path.join(root, 'src/page.js')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start(snapshot('red'), [component, page])
    const patch = (step: number) => ({
      type: 'Patch' as const,
      code: `Component({ methods: { increment() { return ${step} } } });`,
      filename: 'update.js',
      changedIds: [component, createSidecarSourceSpecifier(page, component, 'using-component')],
    })
    await writeFile(component, 'Component({ step: 2 })')
    session.sourceChange(component)
    expect(harness.callbacks!.onPatch([component], patch(2))).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    const temporary = path.join(directory, '.atomic-save.tmp')
    await writeFile(temporary, 'Component({ step: 1 })')
    await rename(temporary, component)
    session.sourceChange(directory)
    session.sourceChange(component)
    expect(harness.callbacks!.onPatch([directory, component], patch(1))).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(delta).toHaveBeenCalledTimes(2)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('preserves real directory creation and deletion after a metadata-only update', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/child-topology-'))
    temporaryDirectories.push(directory)
    const session = await start()
    session.sourceChange(directory)
    harness.callbacks!.onPatch([directory], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).not.toHaveBeenCalled()

    session.sourceChange(directory, 'create')
    harness.callbacks!.onPatch([directory], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(session.rebuild).toHaveBeenLastCalledWith([directory])

    await rm(directory, { recursive: true })
    session.sourceChange(directory, 'delete')
    harness.callbacks!.onPatch([directory], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(session.rebuild).toHaveBeenLastCalledWith([directory])
  })

  it('keeps new sidecars and executable entry topology updates actionable after directory metadata', async () => {
    await mkdir(path.join(root, 'src'), { recursive: true })
    const directory = await mkdtemp(path.join(root, 'src/new-sidecar-'))
    temporaryDirectories.push(directory)
    const session = await start()
    const style = path.join(directory, 'index.wxss')
    await writeFile(style, '.new { color: red; }')
    session.sourceChange(directory)
    session.sourceChange(style, 'create')
    harness.callbacks!.onPatch([directory, style], { type: 'FullReload' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([style])

    session.rebuild.mockClear()
    const source = path.join(directory, 'index.js')
    await writeFile(source, 'Component({})')
    session.sourceChange(directory)
    session.sourceChange(source, 'create')
    harness.callbacks!.onPatch([directory, source], { type: 'FullReload', reason: 'new entry topology' })
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([source])
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
  })

  it('publishes a mixed visual edit as a patch plus changed assets without a full build', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    harness.writeOutput.mockClear()

    expect(session.patch(['entry-mixed-asset:1'])).toBe(true)
    await vi.advanceTimersByTimeAsync(100)

    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({
      fileName: `${route}.wxss`,
      source: expect.stringContaining('color: blue'),
    }))
    expect(delta).toHaveBeenCalledTimes(1)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it.each(['Patch', 'Noop'] as const)('keeps a style edit local after a native script is restored to its persisted input (%s)', async (restoreType) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "before" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    expect(getCompilerHmrHost(session.ctx).enabled).toBe(false)
    const patch = async (source: string, type: 'Patch' | 'Noop' = 'Patch') => {
      session.sourceChange(script, 'update', ['entry-direct:1'])
      getCompilerHmrHost(session.ctx).captureNative(script, source)
      harness.callbacks!.onPatch([script], type === 'Noop' ? { type } : { type, code: 'void 0', filename: 'native-update.js', changedIds: [script] })
      await vi.advanceTimersByTimeAsync(100)
    }
    await patch('Page({ data: { marker: "after" } })')
    await patch(original, restoreType)
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    harness.callbacks!.onPatch([style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)

    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ source: expect.stringContaining('color: blue') }))
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it.each(['success', 'failure'] as const)('tracks the input captured before a full native publication (%s)', async (outcome) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "original" } })'
    const persisted = 'Page({ data: { marker: "persisted" } })'
    const later = 'Page({ data: { marker: "later" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const host = getCompilerHmrHost(session.ctx)
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, persisted)
    const write = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => write.promise)
    const publication = harness.callbacks!.onOutput(appOutput())
    const settled = publication.catch(error => error)
    await vi.advanceTimersByTimeAsync(1)
    // 原生输出已经封存；异步写盘期间的新编译输入不能被记成该产物的源码。
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, later)
    if (outcome === 'failure') {
      write.reject(new Error('partial native write'))
      expect(await settled).toBeInstanceOf(Error)
    }
    else {
      write.resolve()
      await settled
    }
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, outcome === 'success' ? persisted : original)
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'restore.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)

    expect(harness.fullBuild).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1)
  })

  it('keeps a newer script edit dirty while an older restoration patch is being delivered', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "before" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const host = getCompilerHmrHost(session.ctx)
    const delivered = Promise.withResolvers<void>()
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async () => delivered.promise)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, original)
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'restore.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(1)
    expect(delta).toHaveBeenCalledOnce()
    session.sourceChange(script, 'update', ['entry-direct:1'])
    host.captureNative(script, 'Page({ data: { marker: "newer" } })')
    delivered.resolve()
    await vi.advanceTimersByTimeAsync(1)
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)

    expect(harness.fullBuild).toHaveBeenCalledOnce()
  })

  it.each(['script-first', 'asset-first', 'asset-running'] as const)('persists native scripts when watcher batches split a mixed update (%s)', async (order) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const nativeOutput = (marker: string): StatefulHmrOutputFile[] => [{
      type: 'chunk',
      fileName: 'pages/index/index.js',
      code: `Page({ data: { marker: '${marker}' } });`,
      modules: {},
    }]
    harness.nativeOutput = nativeOutput('before')
    const session = await start(snapshot('red'), [script])
    const published = new Map(harness.nativeOutput.map(item => [item.fileName, item.type === 'chunk' ? item.code : item.source]))
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        published.set(item.fileName, item.type === 'chunk' ? item.code : item.source)
      }
    })
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    harness.nativeOutput = nativeOutput('after')
    const changeScript = () => {
      session.sourceChange(script, 'update', ['entry-direct:1'])
      harness.callbacks!.onPatch([script], {
        type: 'Patch',
        code: 'void 0',
        filename: 'script-update.js',
        changedIds: [script],
      })
    }
    const changeAsset = () => {
      session.sourceChange(style, 'update', ['style-sidecar:1'])
      harness.callbacks!.onPatch([style], { type: 'Noop' })
    }
    if (order === 'script-first') {
      changeScript()
      await vi.advanceTimersByTimeAsync(100)
      expect(harness.fullBuild).not.toHaveBeenCalled()
      changeAsset()
    }
    else {
      const ready = Promise.withResolvers<StatefulHmrSnapshot>()
      if (order === 'asset-running') {
        session.rebuild.mockImplementationOnce(async () => ready.promise)
      }
      changeAsset()
      if (order === 'asset-running') {
        await vi.advanceTimersByTimeAsync(50)
        expect(session.rebuild).toHaveBeenCalledTimes(1)
      }
      changeScript()
      ready.resolve(snapshot('blue'))
    }
    await vi.advanceTimersByTimeAsync(100)

    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
    expect(published.get('pages/index/index.js')).toContain('after')

    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
  })

  it('keeps a native patch local after asset settlement and persists it on the next asset refresh', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    harness.nativeOutput = [{ type: 'chunk', fileName: 'pages/index/index.js', code: original, modules: {} }]
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const published = new Map([['pages/index/index.js', original]])
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        published.set(item.fileName, String(item.type === 'chunk' ? item.code : item.source))
      }
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    harness.callbacks!.onPatch([style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(published.get(styleFile)).toContain('color: blue')

    // 已稳定的资产批次不能使后续独立脚本编辑被强制完整重载。
    harness.nativeOutput = [{ type: 'chunk', fileName: 'pages/index/index.js', code: current, modules: {} }]
    session.sourceChange(script, 'update', ['entry-direct:1'])
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    expect(harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'native-update.js', changedIds: [script] })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(published.get('pages/index/index.js')).toBe(original)

    // 下一次资产刷新以未持久化的实际脚本输入升级完整发布。
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    harness.callbacks!.onPatch([style], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(published.get('pages/index/index.js')).toContain(current)
  })

  it('persists a native input already consumed by settled assets when its real notification arrives late', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValue({
      ...snapshot('blue'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]),
    })
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })

    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: blue; }' }))

    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'late-native.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).not.toHaveBeenCalled()

    // 完整发布消费实际输入后，同版本通知与后续独立编辑均不应再次完整构建。
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Noop' })
    getCompilerHmrHost(session.ctx).captureNative(script, `${current}\n// independent`)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'independent-native.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).toHaveBeenCalledOnce()
  })

  it('does not adopt native input debt from an asset write that fails', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValueOnce({
      ...snapshot('blue'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]),
    })
    harness.writeOutput.mockRejectedValueOnce(new Error('asset publication failed'))
    session.refresh()
    const failed = expect(session.whenSettled()).rejects.toThrow('asset publication failed')
    await vi.advanceTimersByTimeAsync(100)
    await failed
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'native-after-failure.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(delta).toHaveBeenCalledOnce()
  })

  it.each(['prepare', 'write'] as const)('joins a real native notification received during independent delivery snapshot %s', async (phase) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const component = path.join(root, 'src/component.vue')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script, component], {}, new Map([[script, original]]))
    const consumed = { ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]) }
    const prepared = Promise.withResolvers<StatefulHmrSnapshot>()
    const published = Promise.withResolvers<void>()
    session.rebuild.mockResolvedValue(consumed)
    if (phase === 'prepare') {
      session.rebuild.mockImplementationOnce(() => prepared.promise)
    }
    else {
      harness.writeOutput.mockImplementationOnce(() => published.promise)
    }
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    session.sourceChange(component, 'update', ['entry-mixed-asset:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Patch', code: 'void 0', filename: 'component.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledOnce()

    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    expect(harness.fullBuild).not.toHaveBeenCalled()
    prepared.resolve(consumed)
    published.resolve()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(delta).not.toHaveBeenCalled()
  })

  it('discards native input facts from an asset snapshot superseded before publication', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const prepared = Promise.withResolvers<StatefulHmrSnapshot>()
    session.rebuild.mockImplementationOnce(() => prepared.promise).mockResolvedValue({
      ...snapshot('green'),
      nativeScriptVersions: new Map([[script, createHash('sha256').update(original).digest('hex')]]),
    })
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    session.refresh()
    prepared.resolve({ ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]) })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(writtenAssets().filter(item => item.fileName === styleFile).at(-1)?.source).toContain('color: green')
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Patch', code: 'void 0', filename: 'independent.js', changedIds: [script] })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(delta).toHaveBeenCalledOnce()
  })

  it('retains committed asset input debt when the correcting native full write fails', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const current = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValue({ ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(current).digest('hex')]]) })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    getCompilerHmrHost(session.ctx).captureNative(script, current)
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput(appOutput())
    })
    harness.writeOutput.mockRejectedValueOnce(new Error('native full write failed'))
    session.sourceChange(script, 'update', ['entry-direct:1'])
    const failed = expect(session.whenSettled()).rejects.toThrow('native full write failed')
    await vi.advanceTimersByTimeAsync(100)
    await failed
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it('restores assets with a full publication even when the delayed native edit reverted to persisted input', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const changed = 'Page({ data: { marker: "after" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), nativeScriptVersions: new Map([[script, createHash('sha256').update(changed).digest('hex')]]) })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    session.rebuild.mockResolvedValue({ ...snapshot('red'), nativeScriptVersions: new Map([[script, createHash('sha256').update(original).digest('hex')]]) })
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Noop' })
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    expect(writtenAssets().filter(item => item.fileName === styleFile).at(-1)?.source).toContain('color: red')
  })

  it('preserves a newer native event during the correcting full write and clears only consumed input debt', async () => {
    const script = path.join(root, 'src/pages/index/index.js')
    const original = 'Page({ data: { marker: "before" } })'
    const changed = 'Page({ data: { marker: "after" } })'
    const newest = 'Page({ data: { marker: "newest" } })'
    const session = await start(snapshot('red'), [script], {}, new Map([[script, original]]))
    const versioned = (color: string, source: string) => ({ ...snapshot(color), nativeScriptVersions: new Map([[script, createHash('sha256').update(source).digest('hex')]]) })
    session.rebuild.mockResolvedValue(versioned('blue', changed))
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    const published = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => published.promise)
    getCompilerHmrHost(session.ctx).captureNative(script, changed)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    session.rebuild.mockResolvedValue(versioned('green', newest))
    getCompilerHmrHost(session.ctx).captureNative(script, newest)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    published.resolve()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    session.sourceChange(script, 'update', ['entry-direct:1'])
    harness.callbacks!.onPatch([script], { type: 'Noop' })
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it.each(['failed', 'superseded'] as const)('retains unpersisted native scripts across a %s full build', async (outcome) => {
    const script = path.join(root, 'src/pages/index/index.js')
    const style = path.join(root, 'src/pages/index/index.wxss')
    const session = await start(snapshot('red'), [script])
    const ready = Promise.withResolvers<void>()
    harness.fullBuild.mockImplementationOnce(async () => {
      await ready.promise
      if (outcome === 'failed') {
        throw new Error('native publication failed')
      }
      await harness.callbacks!.onOutput(appOutput())
    })
    session.sourceChange(script, 'update', ['entry-direct:1'])
    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)

    if (outcome === 'superseded') {
      session.sourceChange(script, 'update', ['entry-direct:1'])
    }
    ready.resolve()
    await vi.advanceTimersByTimeAsync(1)
    if (outcome === 'failed') {
      expect(harness.fullBuild).toHaveBeenCalledTimes(1)
      session.sourceChange(style, 'update', ['style-sidecar:1'])
    }
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(session.rebuild.mock.calls[1]?.[0]).toContain(script)

    session.sourceChange(style, 'update', ['style-sidecar:1'])
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
  })

  it.each(['running', 'written'] as const)('builds one mixed snapshot at the native patch boundary (%s)', async (phase) => {
    vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const session = await start()
    const file = path.join(root, 'src/page.vue')
    const ready = Promise.withResolvers<StatefulHmrSnapshot>()
    session.rebuild.mockImplementationOnce(async () => ready.promise)
    session.sourceChange(file, 'update', ['entry-mixed-asset:1'])
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).not.toHaveBeenCalled()
    expect(harness.callbacks!.onPatch([file], { type: 'Patch', code: 'void 0', filename: 'update.js' })).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    if (phase === 'written') {
      ready.resolve(snapshot('blue'))
      await vi.advanceTimersByTimeAsync(50)
    }
    expect(harness.callbacks!.onPatch([file], { type: 'Noop' })).toBe(false)
    ready.resolve(snapshot('blue'))
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: blue; }' }))
  })

  it('keeps source classifications across unrelated profile writes and consumes only the delivered files', async () => {
    const component = path.join(root, 'src/component.vue')
    const other = path.join(root, 'src/other.vue')
    const session = await start(snapshot('red'), [component, other])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    session.sourceChange(other, 'update', ['entry-local-asset:1'])
    session.changeProfile(['entry-direct:1'])
    const patch = { type: 'Patch' as const, code: 'void 0', filename: 'update.js' }

    expect(harness.callbacks!.onPatch([component], patch)).toBe(false)
    expect(harness.callbacks!.onPatch([other], patch)).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([component, other])
    expect(harness.fullBuild).not.toHaveBeenCalled()
    expect(writtenAssets()).toContainEqual(expect.objectContaining({
      fileName: `${route}.wxss`,
      source: expect.stringContaining('color: blue'),
    }))
  })

  it('uses the latest same-file event rather than an earlier style classification', async () => {
    const component = path.join(root, 'src/component.vue')
    const session = await start(snapshot('red'), [component])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    session.sourceChange(component, 'update', ['entry-direct:1'])
    session.changeProfile(['entry-style-only:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
    })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('consumes classifications for Noop batches without retaining them for a later update', async () => {
    const component = path.join(root, 'src/component.vue')
    const session = await start(snapshot('red'), [component])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    expect(harness.callbacks!.onPatch([component], { type: 'Noop' })).toBe(false)
    session.changeProfile(['entry-local-asset:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
    })).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps the source classification until a native patch arrives after its snapshot', async () => {
    const component = path.join(root, 'src/component.vue')
    const session = await start(snapshot('red'), [component])
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    await vi.advanceTimersByTimeAsync(100)
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([component])
    session.changeProfile(['entry-direct:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'update.js',
      changedIds: [createSidecarSourceSpecifier(path.join(root, 'src/page.js'), component, 'using-component')],
    })).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('prepares a refresh from the raw source captured before its notification', async () => {
    const style = path.join(root, 'src/page.wxss')
    const previous = '.probe { color: red; }'
    const changed = '.probe { color: blue; }'
    const session = await start(snapshot('red'), [], {}, new Map([[style, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    const prepare = vi.fn(async (_input: WeappCompilerHmrRequest) => ({}))
    host.register('source-provider', prepare)
    host.captureNative(style, changed)
    session.sourceChange(style, 'update', ['style-sidecar:1'])

    // 定时器只派发既定 debounce；是否使用本轮输入由真实 preparation/rebuild 观察证明。
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()

    expect(prepare).toHaveBeenCalledOnce()
    expect(prepare.mock.calls[0]?.[0]).toMatchObject({ changedFiles: [style] })
    const sources = session.rebuild.mock.calls[0]?.[1]
    expect(sources?.get(style)).toBe(changed)
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('waits for refresh output and preparation disposal before completing its event and profile', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    await session.whenSettled()
    const written = Promise.withResolvers<void>()
    const disposed = Promise.withResolvers<void>()
    const dispose = vi.fn(() => disposed.promise)
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    const events = vi.fn()
    session.events.watcher.on('event', events)
    events.mockClear()
    samples.splice(0)
    harness.writeOutput.mockClear().mockImplementationOnce(() => written.promise)
    try {
      session.refresh()
      const settled = session.whenSettled()
      await vi.advanceTimersByTimeAsync(40)
      expect(harness.writeOutput).toHaveBeenCalledOnce()
      expect(dispose).not.toHaveBeenCalled()
      expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
      written.resolve()
      await vi.advanceTimersByTimeAsync(0)
      expect(dispose).toHaveBeenCalledOnce()
      expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
      expect(samples).toEqual([])
      disposed.resolve()
      await settled
      expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
      expect(samples).toEqual([expect.objectContaining({ profileMode: 'refresh', status: 'complete' })])
    }
    finally {
      written.resolve()
      disposed.resolve()
    }
  })

  it('reports disposal failure while retaining committed output as the next refresh baseline', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    await session.whenSettled()
    const failure = new Error('refresh disposal failed')
    const dispose = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined)
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    const events = vi.fn()
    session.events.watcher.on('event', events)
    events.mockClear()
    samples.splice(0)
    harness.writeOutput.mockClear()
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(40)
    await rejected
    expect(writtenAssets()).toContainEqual(expect.objectContaining({ fileName: styleFile, source: '.probe { color: blue; }' }))
    expect(events).not.toHaveBeenCalledWith(expect.objectContaining({ code: 'END' }))
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERROR', error: failure }))
    expect(samples).toEqual([expect.objectContaining({ profileMode: 'refresh', status: 'failed' })])
    expect(samples[0]!.totalMs).toBeUndefined()

    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(samples.at(-1)).toMatchObject({ profileMode: 'refresh', status: 'complete' })
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('preserves both publication and cleanup failures without entering full resynchronization', async () => {
    const session = await start()
    const original = new Error('refresh write failed')
    const cleanup = new Error('refresh disposal failed')
    const dispose = vi.fn(() => {
      throw cleanup
    })
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    harness.writeOutput.mockClear().mockRejectedValueOnce(original)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toMatchObject({ cause: original, errors: [original, cleanup] })
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(dispose).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('does not transfer a topology profile or restart until refresh disposal succeeds', async () => {
    const samples: HmrProfileJsonSample[] = []
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(sample => samples.push(sample))
    const page = path.join(root, 'src/page.js')
    const session = await start(snapshot('red'), [page], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    const failure = new Error('topology preparation disposal failed')
    const dispose = vi.fn(() => {
      throw failure
    })
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose }))
    session.rebuild.mockResolvedValueOnce({ ...snapshot('blue'), entryIds: [page, path.join(root, 'src/child.js')] })
    harness.writeOutput.mockClear()
    samples.splice(0)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toBe(failure)
    await vi.advanceTimersByTimeAsync(140)
    await rejected
    expect(dispose).toHaveBeenCalledOnce()
    expect(session.restart).not.toHaveBeenCalled()
    expect(harness.writeOutput).not.toHaveBeenCalled()
    expect(samples).toEqual([expect.objectContaining({ profileMode: 'refresh', status: 'failed' })])
  })

  it('waits for pending refresh preparation and its disposal when the session closes', async () => {
    const session = await start()
    await session.whenSettled()
    const prepared = Promise.withResolvers<WeappCompilerHmrPreparation>()
    const disposal = Promise.withResolvers<void>()
    const dispose = vi.fn(() => disposal.promise)
    const prepare = vi.fn(() => prepared.promise)
    getCompilerHmrHost(session.ctx).register('provider', prepare)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    expect(prepare).toHaveBeenCalledOnce()
    let closed = false
    const closing = session.close().then(() => {
      closed = true
    })
    try {
      prepared.resolve({ dispose })
      await vi.advanceTimersByTimeAsync(0)
      expect(dispose).toHaveBeenCalledOnce()
      expect(closed).toBe(false)
      expect(session.rebuild).not.toHaveBeenCalled()
      expect(harness.writeOutput).not.toHaveBeenCalled()
      disposal.resolve()
      await closing
      expect(closed).toBe(true)
    }
    finally {
      prepared.resolve({ dispose })
      disposal.resolve()
      await closing
    }
  })

  it('retains cleanup rejection during pending refresh close and still releases later session resources', async () => {
    vi.spyOn(StatefulHmrProfile.prototype, 'record').mockImplementation(() => {})
    const session = await start(snapshot('red'), [], {}, new Map(), undefined, (ctx) => {
      ctx.configService!.weappViteConfig.hmr = { profileJson: true }
    })
    await session.whenSettled()
    const prepared = Promise.withResolvers<WeappCompilerHmrPreparation>()
    const failure = new Error('closing preparation disposal failed')
    const dispose = vi.fn(() => {
      throw failure
    })
    getCompilerHmrHost(session.ctx).register('provider', () => prepared.promise)
    const closeProfile = vi.spyOn(StatefulHmrProfile.prototype, 'close')
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    const closing = session.close()
    expect(session.close()).toBe(closing)
    const rejected = expect(closing).rejects.toBe(failure)
    // 原 scheduler 已进入 close 等待，再释放 preparation，单独锁住清理拒绝传播。
    await vi.advanceTimersByTimeAsync(0)
    prepared.resolve({ dispose })
    await rejected
    // 已明确验收同一拒绝，不让通用 afterEach 把预期拒绝重复报告为 hook 故障。
    watchers.splice(watchers.indexOf(session.watcher), 1)
    expect(dispose).toHaveBeenCalledOnce()
    expect(harness.closeAdapter).toHaveBeenCalledOnce()
    expect(closeProfile).toHaveBeenCalledOnce()
    expect(harness.closeServer).toHaveBeenCalledOnce()
    await expect(session.close()).rejects.toBe(failure)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('disposes a superseded refresh preparation and rebuilds only the next fixed input', async () => {
    const session = await start()
    const style = path.join(root, 'src/page.wxss')
    const host = getCompilerHmrHost(session.ctx)
    const first = Promise.withResolvers<WeappCompilerHmrPreparation>()
    const firstDispose = vi.fn()
    const secondDispose = vi.fn()
    const prepare = vi.fn((_input: WeappCompilerHmrRequest) => Promise.resolve({ dispose: secondDispose })).mockImplementationOnce(() => first.promise)
    host.register('provider', prepare)
    host.capture(style, 'blue')
    session.refresh()
    await vi.advanceTimersByTimeAsync(40)
    expect(prepare).toHaveBeenCalledOnce()
    host.capture(style, 'green')
    session.refresh()
    first.resolve({ dispose: firstDispose })
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()
    expect(firstDispose).toHaveBeenCalledOnce()
    expect(secondDispose).toHaveBeenCalledOnce()
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare.mock.calls[0]![0].sources.get(style)).toBe('blue')
    expect(prepare.mock.calls[1]![0].sources.get(style)).toBe('green')
    expect(session.rebuild).toHaveBeenCalledExactlyOnceWith([style], prepare.mock.calls[1]![0].sources)
  })

  it('promotes a refresh generation rejection to one full rebuild without preparing newer inputs', async () => {
    const session = await start()
    const file = path.join(root, 'src/page.wxss')
    const rejection = new CompilerHmrResyncError([file], 'frozen roots no longer match')
    const dispose = vi.fn()
    const prepare = vi.fn(async () => ({ dispose }))
    getCompilerHmrHost(session.ctx).register('provider', prepare)
    session.rebuild.mockRejectedValueOnce(rejection)
    session.refresh()
    await vi.advanceTimersByTimeAsync(100)
    await session.whenSettled()
    expect(prepare).toHaveBeenCalledOnce()
    expect(dispose).toHaveBeenCalledOnce()
    expect(session.rebuild.mock.calls).toEqual([[[file], expect.any(Map)], [[file]]])
    expect(harness.fullBuild).toHaveBeenCalledOnce()
    const server = await harness.createServer.mock.results.at(-1)!.value
    expect(server.config.logger.info).toHaveBeenCalledWith(expect.stringContaining(rejection.message))
  })

  it('retains a resync error with cleanup failure instead of treating the generation as released', async () => {
    const session = await start()
    const rejection = new CompilerHmrResyncError([], 'frozen generation rejected')
    const cleanup = new Error('generation still held')
    getCompilerHmrHost(session.ctx).register('provider', async () => ({ dispose: () => {
      throw cleanup
    } }))
    session.rebuild.mockRejectedValueOnce(rejection)
    session.refresh()
    const rejected = expect(session.whenSettled()).rejects.toMatchObject({ cause: rejection, errors: [rejection, cleanup] })
    await vi.advanceTimersByTimeAsync(100)
    await rejected
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('preserves the visual before value for a mixed patch arriving after a refresh', async () => {
    const delta = vi.spyOn(StatefulHmrTransport.prototype, 'addDelta').mockImplementation(async (_code, _ids, delivered) => {
      await delivered?.()
    })
    const component = path.join(root, 'src/component.vue')
    const previous = '<script setup>const count = 1</script><template><view>{{ count }}</view></template><style>view { color: red }</style>'
    const changed = previous.replace('color: red', 'color: blue')
    const session = await start(snapshot('red'), [component], {}, new Map([[component, previous]]))
    const host = getCompilerHmrHost(session.ctx)
    host.register('source-provider', async () => ({}))
    host.captureNative(component, changed)
    session.sourceChange(component, 'update', ['entry-style-only:1'])
    await vi.advanceTimersByTimeAsync(40)
    await session.whenSettled()
    expect(session.rebuild).toHaveBeenCalledOnce()
    expect(host.hasVisualChanges([component])).toBe(true)

    session.sourceChange(component, 'update', ['entry-mixed-asset:1'])
    expect(harness.callbacks!.onPatch([component], {
      type: 'Patch',
      code: 'void 0',
      filename: 'late-mixed.js',
      changedIds: [component],
    })).toBe(true)
    await session.whenSettled()

    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(delta).toHaveBeenCalledOnce()
    expect(harness.markPayloadDelivered).toHaveBeenCalledExactlyOnceWith('late-mixed.js')
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('keeps snapshot-owned component metadata intact when DevEngine delivers additional assets', async () => {
    const componentJson: StatefulHmrOutputFile = {
      type: 'asset',
      fileName: 'components/leaf/index.json',
      source: JSON.stringify({ component: true, options: { multipleSlots: true } }),
    }
    const initial = snapshot('red')
    initial.output.push(componentJson)
    const session = await start(initial)
    session.rebuild.mockResolvedValue(initial)
    const published = new Map(writtenAssets().map(asset => [asset.fileName, asset.source]))
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        if (item.type === 'asset') {
          published.set(item.fileName, item.source)
        }
      }
    })
    harness.callbacks!.onOutput([
      { type: 'asset', fileName: componentJson.fileName, source: JSON.stringify({ options: { multipleSlots: true } }) },
      { type: 'asset', fileName: 'assets/new.svg', source: '<svg />' },
    ], 'additional')
    await vi.advanceTimersByTimeAsync(1)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)

    expect(published.get(componentJson.fileName)).toBe(componentJson.source)
    expect(published.get('assets/new.svg')).toBe('<svg />')
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('boots with the native graph prelude across full, additional and snapshot publications', async () => {
    const scopes = ['', 'feature/']
    const withPrelude = (color: string) => {
      const value = snapshot(color)
      value.output.push(...scopes.map(prefix => ({
        type: 'asset' as const,
        fileName: `${prefix}app.prelude.js`,
        source: `require("./snapshot-installer.js").installWebRuntimeGlobals({ targets: [${JSON.stringify(color === 'red' ? 'fetch' : 'Headers')}] }).ready;`,
      })))
      return value
    }
    const nativeOutput = (version: string): StatefulHmrOutputFile[] => scopes.flatMap(prefix => [
      {
        type: 'asset',
        fileName: `${prefix}app.prelude.js`,
        source: `require("./native-${version}.js").installWebRuntimeGlobals().ready;`,
      },
      {
        type: 'chunk',
        fileName: `${prefix}native-${version}.js`,
        code: `exports.installWebRuntimeGlobals = () => ({ ready: ${JSON.stringify(`${prefix}${version}`)} });`,
      },
      {
        type: 'chunk',
        fileName: `${prefix}snapshot-installer.js`,
        code: '__rolldown_runtime__.registerModule("facade", { exports: {} });',
      },
    ])
    const published = new Map<string, StatefulHmrOutputFile>()
    harness.writeOutput.mockImplementation(async (_outDir, output) => {
      for (const item of output) {
        published.set(item.fileName, item)
      }
    })
    const boot = (prefix: string) => {
      const prelude = published.get(`${prefix}app.prelude.js`)
      if (prelude?.type !== 'asset') {
        throw new Error(`Missing native prelude in ${prefix || 'main'}`)
      }
      return runInNewContext(String(prelude.source), {
        require(request: string) {
          const chunk = published.get(path.join(prefix, request))
          if (chunk?.type !== 'chunk') {
            throw new Error(`Missing native installer: ${request}`)
          }
          const exports = {}
          runInNewContext(chunk.code, { exports, __rolldown_runtime__: { registerModule() {} } })
          return exports
        },
      })
    }
    harness.nativeOutput = nativeOutput('initial')
    const session = await start(withPrelude('red'))
    expect(scopes.map(boot)).toEqual(['initial', 'feature/initial'])

    await harness.callbacks!.onOutput(nativeOutput('additional'), 'additional')
    expect(scopes.map(boot)).toEqual(['additional', 'feature/additional'])

    session.rebuild.mockResolvedValue(withPrelude('blue'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(scopes.map(boot)).toEqual(['additional', 'feature/additional'])
    expect(published.get(styleFile)).toMatchObject({ source: '.probe { color: blue; }' })

    harness.nativeOutput = nativeOutput('rebuilt')
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(scopes.map(boot)).toEqual(['rebuilt', 'feature/rebuilt'])
  })

  it('keeps an older native full output on the adopted snapshot while draining before the new batch', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    harness.beforeFullPrepare.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput(appOutput(), 'full')
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().filter(item => item.fileName === styleFile).map(item => item.source)).toEqual([
      '.probe { color: red; }',
      '.probe { color: blue; }',
    ])
  })

  it('does not acknowledge a full batch from additional chunks and replays its unpublished snapshot', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput([{ type: 'chunk', fileName: 'pages/index.js', code: 'Page({})', modules: {} }], 'additional')
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().some(item => item.fileName === styleFile)).toBe(false)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' })
  })

  it('waits for the actual full callback after additional assets before adopting the snapshot', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear()
    const gate = Promise.withResolvers<void>()
    harness.fullBuild.mockImplementationOnce(async () => {
      await harness.callbacks!.onOutput([{ type: 'asset', fileName: 'extra.svg', source: '<svg/>' }], 'additional')
      await gate.promise
      await harness.callbacks!.onOutput(appOutput(), 'full')
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets().some(item => item.fileName === styleFile)).toBe(false)
    gate.resolve()
    await vi.advanceTimersByTimeAsync(1)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' })
  })

  it('assigns resolved public publication only to the first complete output', async () => {
    const session = await start()
    const initialOutput = harness.writeOutput.mock.calls.find(([, output]) => output.some(item => item.fileName === 'app.js'))
    expect(initialOutput?.[2]).toEqual({ publicDir: path.join(root, 'static-assets'), copyPublicDir: true })
    const controls = harness.writeOutput.mock.calls.filter(([, output]) => !output.some(item => item.fileName === 'app.js'))
    expect(controls.every(([, , publicAssets]) => publicAssets === undefined)).toBe(true)

    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.length).toBeGreaterThan(0)
    expect(harness.writeOutput.mock.calls.some(([, output]) => output.some(item => item.fileName === 'app.js'))).toBe(true)
    expect(harness.writeOutput.mock.calls.every(([, , publicAssets]) => publicAssets === undefined)).toBe(true)
  })

  it('rejects a failed initial publication and publishes public assets on the next startup', async () => {
    const commit = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild')
    const initialPublicAssets = { publicDir: path.join(root, 'static-assets'), copyPublicDir: true }
    harness.writeOutput.mockRejectedValueOnce(new Error('simulated initial public write failure'))
    await expect(start()).rejects.toThrow('simulated initial public write failure')

    expect(harness.writeOutput).toHaveBeenCalledTimes(1)
    expect(harness.writeOutput.mock.calls[0]?.[2]).toEqual(initialPublicAssets)
    expect(commit).not.toHaveBeenCalled()
    const session = await start()
    const completeOutputs = harness.writeOutput.mock.calls.filter(([, output]) => output.some(item => item.fileName === 'app.js'))
    expect(completeOutputs).toHaveLength(2)
    expect(completeOutputs.map(([, , publicAssets]) => publicAssets)).toEqual([initialPublicAssets, initialPublicAssets])
    expect(completeOutputs[1]?.[1]).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.probe { color: red; }'),
    })
    expect(commit).toHaveBeenCalledTimes(1)

    harness.writeOutput.mockClear()
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(harness.writeOutput.mock.calls.some(([, output]) => output.some(item => item.fileName === 'app.js'))).toBe(true)
    expect(harness.writeOutput.mock.calls.every(([, , publicAssets]) => publicAssets === undefined)).toBe(true)
  })

  it('keeps the same output queue recoverable without consuming public assets before its first successful write', async () => {
    const readyGate = Promise.withResolvers<void>()
    harness.beforeInitialReady.mockImplementationOnce(() => readyGate.promise)
    harness.writeOutput.mockRejectedValueOnce(new Error('initial write failed before ready subscription'))
    const starting = expect(start()).rejects.toThrow('initial write failed before ready subscription')
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.writeOutput).toHaveBeenCalledTimes(1)

    // 引擎可在启动方收到失败前再次交付输出；队列恢复不应把首轮失败改成成功。
    harness.callbacks!.onOutput(appOutput())
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.writeOutput).toHaveBeenCalledTimes(2)
    expect(harness.writeOutput.mock.calls.map(([, , publicAssets]) => publicAssets)).toEqual([
      { publicDir: path.join(root, 'static-assets'), copyPublicDir: true },
      { publicDir: path.join(root, 'static-assets'), copyPublicDir: true },
    ])
    readyGate.resolve()
    await starting
  })

  it('uses initial snapshot routes and clears global-only styles when a refresh changes isolation', async () => {
    const session = await start()
    expect(writtenAssets()).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.probe { color: red; }'),
    })
    harness.writeOutput.mockClear()
    session.rebuild.mockResolvedValue(snapshot('blue', []))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual({ type: 'asset', fileName: `${route}.wxss`, source: '' })
    expect(writtenAssets()).not.toContainEqual(expect.objectContaining({ fileName: 'app.wxss' }))
  })

  it('does not retire native-owned preludes missing from an asset refresh', async () => {
    const initial = snapshot('red', [])
    initial.output.push(
      { type: 'asset', fileName: 'app.prelude.js', source: 'native prelude' },
      { type: 'asset', fileName: 'package/app.prelude.js', source: 'native package prelude' },
    )
    const session = await start(initial)
    session.rebuild.mockResolvedValue(snapshot('red', []))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    const retired = harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])
    expect(retired).not.toContain('app.prelude.js')
    expect(retired).not.toContain('package/app.prelude.js')
  })

  it('does not retire native-owned preludes omitted from a later full output', async () => {
    harness.nativeOutput = [{ type: 'asset', fileName: 'app.prelude.js', source: 'native prelude' }]
    const session = await start(snapshot('red'))
    session.full()
    await vi.advanceTimersByTimeAsync(50)

    harness.nativeOutput = []
    harness.writeOutput.mockClear()
    session.full()
    await vi.advanceTimersByTimeAsync(50)

    const retired = harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])
    expect(retired).not.toContain('app.prelude.js')
  })

  it('retires copied assets and republishes identical bytes after restoration', async () => {
    const copied = { type: 'asset' as const, fileName: 'resources/copied.txt', source: 'original' }
    const initial = snapshot('red', [])
    initial.output.push(copied)
    const session = await start(initial)
    session.rebuild.mockResolvedValue(snapshot('red', []))
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.at(-1)?.[3]).toContain(copied.fileName)
    session.rebuild.mockResolvedValue(initial)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(copied)
  })

  it('refreshes public assets from filesystem changes using the resolved public directory', async () => {
    vi.useRealTimers()
    const publicRoot = path.join(root, 'static-assets')
    await mkdir(publicRoot, { recursive: true })
    const directory = await mkdtemp(path.join(publicRoot, 'watch-lifecycle-'))
    temporaryDirectories.push(directory)
    const source = path.join(directory, 'config.js')
    const fileName = path.relative(publicRoot, source)
    const publicAsset = { type: 'asset' as const, fileName, source: 'original' }
    await writeFile(source, publicAsset.source)
    const initial = snapshot('red', [])
    initial.output.push(publicAsset)
    const session = await start(initial)
    session.rebuild.mockImplementation(async () => {
      const next = snapshot('red', [])
      const content = await readFile(source, 'utf8').catch(() => undefined)
      if (content !== undefined) {
        next.output.push({ ...publicAsset, source: content })
      }
      return next
    })
    for (const content of ['updated', undefined, 'original']) {
      harness.writeOutput.mockClear()
      if (content === undefined) {
        await rm(source)
        await vi.waitFor(() => expect(harness.writeOutput.mock.calls.flatMap(call => call[3] ?? [])).toContain(fileName))
      }
      else {
        await writeFile(source, content)
        await vi.waitFor(() => expect(writtenAssets()).toContainEqual({ ...publicAsset, source: content }))
      }
    }
    expect(session.rebuild).toHaveBeenCalledWith([source])
    expect(harness.fullBuild).not.toHaveBeenCalled()
  })

  it('restores original bytes when deletion is superseded during native write', async () => {
    const copied = { type: 'asset' as const, fileName: 'resources/copied.txt', source: 'original' }
    const initial = snapshot('red', [])
    initial.output.push(copied)
    const session = await start(initial)
    session.rebuild.mockResolvedValueOnce(snapshot('red', [])).mockResolvedValue(initial)
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => blocked.promise)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.at(-1)?.[3]).toContain(copied.fileName)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(copied)
  })

  it.each(['refresh', 'full'] as const)('retires newly written assets from a failed %s when the next snapshot omits them', async (mode) => {
    const initial = snapshot('red', [])
    const added = { type: 'asset' as const, fileName: 'resources/transient.txt', source: 'partial write' }
    const failed = snapshot('red', [])
    failed.output.push(added)
    const session = await start(initial)
    session.rebuild.mockResolvedValueOnce(failed).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('write failed after adding a file'))
    session[mode]()
    await vi.advanceTimersByTimeAsync(50)
    harness.writeOutput.mockClear()
    session[mode]()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput.mock.calls.at(-1)?.[3]).toContain(added.fileName)
  })

  it('rewrites original bytes after a deletion write reports partial failure', async () => {
    const copied = { type: 'asset' as const, fileName: 'resources/copied.txt', source: 'original' }
    const initial = snapshot('red', [])
    initial.output.push(copied)
    const session = await start(initial)
    session.rebuild.mockResolvedValueOnce(snapshot('red', [])).mockResolvedValue(initial)
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('partial deletion failed'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toContainEqual(copied)
  })

  it('retries the complete asset diff after a failed refresh instead of adopting unwritten styles', async () => {
    const session = await start(snapshot('red', []))
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('simulated write failure'))
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(writtenAssets()).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' },
      { type: 'asset', fileName: `${route}.wxss`, source: expect.stringContaining('.probe { color: blue; }') },
    ]))
  })

  it('does not adopt a refresh superseded while waiting for the serial output queue', async () => {
    const session = await start(snapshot('red', []))
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => await blocked.promise)
    void harness.callbacks!.onOutput([{ type: 'asset', fileName: 'pending.txt', source: 'pending' }], 'additional')
    await vi.advanceTimersByTimeAsync(1)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(2)
    expect(writtenAssets().filter(item => item.fileName === styleFile)).toEqual([
      { type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' },
    ])
    expect(writtenAssets()).toContainEqual({
      type: 'asset',
      fileName: `${route}.wxss`,
      source: expect.stringContaining('.probe { color: blue; }'),
    })
  })

  it('keeps full-build transport and snapshot state unchanged until the full output succeeds', async () => {
    const commit = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild')
    const session = await start()
    expect(commit).toHaveBeenCalledTimes(1)
    session.rebuild.mockResolvedValue(snapshot('blue', []))
    harness.writeOutput.mockClear().mockRejectedValueOnce(new Error('simulated full write failure'))
    const outputReady = Promise.withResolvers<void>()
    harness.fullBuild.mockImplementationOnce(async () => {
      // 对应 ensureLatestBuildOutput 在异步输出回调完成后才返回的边界。
      await outputReady.promise
      harness.callbacks!.onOutput(appOutput())
    })
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    outputReady.resolve()
    await vi.advanceTimersByTimeAsync(1)
    expect(commit).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)
    harness.writeOutput.mockClear()
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(session.rebuild.mock.calls[1]?.[0]).toEqual([
      path.join(root, 'src/page.vue'),
      path.join(root, 'src/page.wxss'),
    ])
    expect(commit).toHaveBeenCalledTimes(2)
    expect(writtenAssets()).toEqual(expect.arrayContaining([
      { type: 'asset', fileName: styleFile, source: '.probe { color: blue; }' },
      { type: 'asset', fileName: `${route}.wxss`, source: '' },
    ]))
  })

  it('retains a full batch when the adapter finishes without delivering output', async () => {
    const session = await start()
    harness.writeOutput.mockClear()
    harness.fullBuild.mockResolvedValueOnce(undefined)
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.writeOutput).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(harness.fullBuild).toHaveBeenCalledTimes(1)

    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(harness.fullBuild).toHaveBeenCalledTimes(2)
    expect(harness.writeOutput.mock.calls.some(([, output]) => output.some(item => item.fileName === 'app.js'))).toBe(true)
  })

  it('discards superseded full snapshots before writing and adopts the replacement metadata atomically', async () => {
    const commit = vi.spyOn(StatefulHmrTransport.prototype, 'commitFullBuild')
    const session = await start()
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockClear().mockImplementationOnce(async () => await blocked.promise)
    void harness.callbacks!.onOutput([{ type: 'asset', fileName: 'pending.txt', source: 'pending' }], 'additional')
    await vi.advanceTimersByTimeAsync(1)
    session.rebuild.mockResolvedValueOnce(snapshot('blue', [])).mockResolvedValue(snapshot('green'))
    session.full()
    await vi.advanceTimersByTimeAsync(50)
    expect(session.rebuild).toHaveBeenCalledTimes(1)
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(commit).toHaveBeenCalledTimes(2)
    expect(writtenAssets().filter(item => item.fileName === styleFile)).toEqual([
      { type: 'asset', fileName: styleFile, source: '.probe { color: green; }' },
    ])
    expect(writtenAssets().filter(item => item.fileName === `${route}.wxss`)).toEqual([
      { type: 'asset', fileName: `${route}.wxss`, source: expect.stringContaining('.probe { color: green; }') },
    ])
  })

  it('never publishes fixed diagnostics from a refresh superseded during its write', async () => {
    const session = await start(analyzedSnapshot(false))
    // start() 的上下文已初始化，消费者只读取分析结果。
    const consumer = session.ctx as CompilerContext
    const reports: string[][] = []
    session.events.watcher.on('event', (event) => {
      if (event.code === 'END') {
        reports.push(createGlassEaselAnalyzeResult(consumer).diagnostics.map(item => item.code))
      }
    })
    session.rebuild.mockResolvedValueOnce(analyzedSnapshot(true)).mockResolvedValue(analyzedSnapshot(false))
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => blocked.promise)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics.map(item => item.code)).toEqual(['GE001'])
    session.refresh()
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(reports).toEqual([['GE001'], ['GE001']])
  })

  it('keeps a newer native script result when an older asset snapshot commits', async () => {
    const session = await start(analyzedSnapshot(true, '.1-old'))
    // 同一活动上下文同时消费 native script 与资产快照。
    const consumer = session.ctx as CompilerContext
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics.map(item => item.code)).toEqual(['GE005'])
    session.rebuild.mockResolvedValue(analyzedSnapshot(true, '.1-old'))
    const blocked = Promise.withResolvers<void>()
    harness.writeOutput.mockImplementationOnce(() => blocked.promise)
    session.refresh()
    await vi.advanceTimersByTimeAsync(50)
    refreshGlassEaselNativeScripts(consumer, [{
      file: 'page.js',
      modules: [{
        id: path.join(root, 'src/page.js'),
        code: 'wx.createSelectorQuery().select(\".valid\").exec()',
      }],
    }])
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics).toEqual([])
    blocked.resolve()
    await vi.advanceTimersByTimeAsync(50)
    expect(createGlassEaselAnalyzeResult(consumer).diagnostics).toEqual([])
  })
})
