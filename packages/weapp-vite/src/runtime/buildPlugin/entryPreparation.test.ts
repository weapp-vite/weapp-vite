import type { CompilerContext } from '../../context'
import type { CorePluginState } from '../../plugins/core/helpers'
import type { AppEntry } from '../../types'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../moduleGraph/service'
import { createOptionsHook } from '../../plugins/core/lifecycle/load/options'
import { useLoadEntry } from '../../plugins/hooks/useLoadEntry'
import { createRuntimeState } from '../runtimeState'
import { createScanService } from '../scanPlugin/service'
import { beginEntryPreparation, captureEntryPreparation, clearEntryPreparation, recordEntryPreparation, takeEntryPreparation } from './entryPreparation'

vi.mock('../../plugins/hooks/useLoadEntry/loadEntry', () => ({
  createEntryLoader: vi.fn(() => Object.assign(vi.fn(async () => ({ code: '' })), { invalidateResolveCache: vi.fn() })),
}))

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'entry-preparation-'))
  roots.push(root)
  const src = path.join(root, 'src')
  const runtimeState = createRuntimeState()
  runtimeState.build.hmr.fullEntryScan = true
  runtimeState.autoRoutes.dirty = false
  let page = 'pages/first.js'
  const ctx = {
    runtimeState,
    moduleGraphService: createModuleGraphService(),
    configService: {
      options: {},
      isDev: true,
      absoluteSrcRoot: src,
      weappViteConfig: {},
      aliasEntries: [],
      packageJson: {},
      outputExtensions: { wxss: '.wxss' },
      relativeAbsoluteSrcRoot: (id: string) => path.relative(src, id),
      relativeOutputPath: (id: string) => path.relative(src, id),
    },
    wxmlService: { scan: vi.fn(), setWxmlComponentsMap: vi.fn(), wxmlComponentsMap: new Map() },
    autoImportService: { resolve: vi.fn() },
    autoRoutesService: { markDirty: vi.fn(), getSignature: vi.fn(() => 'routes') },
    buildService: { buildIndependentBundle: vi.fn(async () => ({ output: [] })) },
  } as unknown as CompilerContext
  ctx.scanService = createScanService(ctx)
  const loadAppEntry = vi.spyOn(ctx.scanService, 'loadAppEntry').mockImplementation(async () => {
    if (!runtimeState.scan.appEntry || runtimeState.scan.isDirty) {
      runtimeState.scan.appEntry = {
        type: 'app',
        path: path.join(src, 'app.js'),
        json: { pages: [page], subPackages: [{ root: 'isolated', independent: true, pages: ['pages/child'] }] },
      } as AppEntry
    }
    return runtimeState.scan.appEntry
  })
  const hooks = useLoadEntry(ctx)
  const state = { ctx, ...hooks, buildTarget: 'app' } as unknown as CorePluginState
  const options = createOptionsHook(state)
  const plugin = { meta: { watchMode: false }, resolve: vi.fn(async (id: string) => ({ id })) }
  return {
    ctx,
    state,
    hooks,
    options,
    plugin,
    loadAppEntry,
    changePage(value: string) {
      page = value
    },
  }
}

describe('entry preparation between options and full buildStart', () => {
  it('builds independent targets once while retaining the options input and full entry emission', async () => {
    const { ctx, hooks, options, plugin, loadAppEntry } = await fixture()
    const input: { input?: Record<string, string> } = {}
    await options.call(plugin, input)
    const pending = ctx.runtimeState.build.independent.pendingOutputs
    await hooks.emitDirtyEntries.call(plugin as never)

    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(1)
    expect(loadAppEntry).toHaveBeenCalledTimes(1)
    expect(Object.keys(input.input!)).toEqual(['app', 'pages/first'])
    expect(hooks.loadEntry).toHaveBeenCalledWith(ctx.scanService.appEntry!.path, 'app')
    expect(ctx.runtimeState.build.independent.pendingOutputs).toBe(pending)
  })

  it('prepares a fresh input and independent output in each topology generation', async () => {
    const { ctx, hooks, options, plugin, changePage } = await fixture()
    const first: { input?: Record<string, string> } = {}
    await options.call(plugin, first)
    await hooks.emitDirtyEntries.call(plugin as never)
    const previousOutput = ctx.runtimeState.build.independent.pendingOutputs

    changePage('pages/second.js')
    ctx.scanService.markDirty()
    const second: { input?: Record<string, string> } = {}
    await options.call(plugin, second)
    await hooks.emitDirtyEntries.call(plugin as never)

    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
    expect(Object.keys(first.input!)).toEqual(['app', 'pages/first'])
    expect(Object.keys(second.input!)).toEqual(['app', 'pages/second'])
    expect(ctx.scanService.appEntry!.json!.pages).toEqual(['pages/second.js'])
    expect(ctx.runtimeState.build.independent.pendingOutputs).not.toBe(previousOutput)
  })

  it.each(['app', 'config', 'routes', 'pending-routes', 'independent-input', 'independent-output'] as const)('rejects preparation after %s changes between hooks', async (change) => {
    const { ctx, hooks, options, plugin, changePage } = await fixture()
    await options.call(plugin, {})
    if (change === 'app') {
      changePage('pages/second.js')
      ctx.scanService.markDirty()
    }
    else if (change === 'config') {
      ctx.configService.options = { ...ctx.configService.options }
    }
    else if (change === 'routes') {
      vi.mocked(ctx.autoRoutesService!.getSignature).mockReturnValue('new-routes')
    }
    else if (change === 'pending-routes') {
      ctx.runtimeState.autoRoutes.dirty = true
    }
    else if (change === 'independent-input') {
      ctx.scanService.markIndependentDirty('isolated')
    }
    else {
      ctx.runtimeState.build.independent.pendingOutputs = []
    }
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
    expect(ctx.runtimeState.build.independent.pendingOutputs).toHaveLength(1)
    if (change === 'app') {
      expect(ctx.scanService.appEntry!.json!.pages).toEqual(['pages/second.js'])
    }
  })

  it('does not retain a failed independent preparation for buildStart or the next generation', async () => {
    const { ctx, hooks, options, plugin } = await fixture()
    vi.mocked(ctx.buildService.buildIndependentBundle).mockRejectedValueOnce(new Error('independent failed'))
    await options.call(plugin, {})
    const failed = ctx.runtimeState.build.independent.pendingOutputs[0]!
    await expect(failed).rejects.toThrow('independent failed')
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
    await expect(ctx.runtimeState.build.independent.pendingOutputs[0]).resolves.toEqual({ output: [] })

    await options.call(plugin, {})
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(3)
  })

  it('does not publish preparation from options that fails while resolving main input', async () => {
    const { ctx, hooks, options, plugin } = await fixture()
    plugin.resolve.mockRejectedValueOnce(new Error('main input failed'))
    await expect(options.call(plugin, {})).rejects.toThrow('main input failed')
    await options.call(plugin, {})
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
  })

  it('does not capture later resolver changes as if the existing independent output used that config', async () => {
    const { ctx, hooks, options, plugin } = await fixture()
    plugin.resolve.mockImplementationOnce(async (id: string) => {
      ctx.configService.options = { ...ctx.configService.options }
      return { id }
    })
    await options.call(plugin, {})
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['during-build', 'styles'],
    ['during-build', 'inlineConfig'],
    ['between-hooks', 'styles'],
    ['between-hooks', 'inlineConfig'],
  ] as const)('rejects nested independent config changes %s in %s and rebuilds using the new inputs', async (phase, field) => {
    const { ctx, hooks, options, plugin } = await fixture()
    const independentRoot = path.join(ctx.configService.absoluteSrcRoot, 'isolated')
    await mkdir(independentRoot, { recursive: true })
    await writeFile(path.join(independentRoot, 'shared.wxss'), '.shared { color: red; }')
    const subPackage = { styles: [] as string[], inlineConfig: { define: { BUILD_LABEL: 'before' } } }
    ctx.configService.weappViteConfig.subPackages = { isolated: subPackage }
    const seenInputs: Array<{ label: unknown, styles: number }> = []
    const change = () => {
      if (field === 'styles') {
        subPackage.styles.push('shared.wxss')
      }
      else {
        subPackage.inlineConfig.define.BUILD_LABEL = 'after'
      }
    }
    vi.mocked(ctx.buildService.buildIndependentBundle).mockImplementation(async (_root, meta) => {
      seenInputs.push({ label: meta.subPackage.inlineConfig?.define?.BUILD_LABEL, styles: meta.styleEntries?.length ?? 0 })
      if (phase === 'during-build' && seenInputs.length === 1) {
        await Promise.resolve()
        change()
      }
      return { output: [] }
    })
    await options.call(plugin, {})
    if (phase === 'between-hooks') {
      change()
    }
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(seenInputs).toEqual([
      { label: 'before', styles: 0 },
      { label: field === 'inlineConfig' ? 'after' : 'before', styles: field === 'styles' ? 1 : 0 },
    ])
  })

  it('rejects config replacement during asynchronous independent preparation', async () => {
    const { ctx, hooks, options, plugin } = await fixture()
    vi.mocked(ctx.buildService.buildIndependentBundle).mockImplementationOnce(async () => {
      await Promise.resolve()
      ctx.configService.options = { ...ctx.configService.options }
      return { output: [] }
    })
    await options.call(plugin, {})
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
  })

  it('reuses preparation with plugin instances while their lifecycle state changes', async () => {
    const { ctx, hooks, options, plugin } = await fixture()
    class StatefulPlugin {
      name = 'stateful-plugin'
      cache = new Map<string, string>()
      transform = () => this.cache.get('code')
    }
    const stateful = new StatefulPlugin()
    ctx.configService.options.config = { plugins: [stateful], build: { rolldownOptions: { plugins: [stateful] } } }
    ctx.configService.options.sourceConfig = ctx.configService.options.config
    await options.call(plugin, {})
    stateful.cache.set('code', 'next')
    await hooks.emitDirtyEntries.call(plugin as never)
    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(1)
  })

  it('refreshes production watch rounds that do not run options again', async () => {
    const { ctx, hooks, options, plugin, changePage } = await fixture()
    await options.call(plugin, {})
    await hooks.emitDirtyEntries.call(plugin as never)
    ctx.runtimeState.build.hmr.fullEntryScan = false
    ctx.configService.isDev = false
    plugin.meta.watchMode = true
    changePage('pages/watch.js')
    await hooks.emitDirtyEntries.call(plugin as never)

    expect(ctx.buildService.buildIndependentBundle).toHaveBeenCalledTimes(2)
    expect(ctx.scanService.appEntry!.json!.pages).toEqual(['pages/watch.js'])
  })

  it('rejects superseded options and releases unconsumed preparation at teardown', async () => {
    const { ctx, hooks, options, plugin } = await fixture()
    await options.call(plugin, {})
    const previous = beginEntryPreparation(hooks.loadEntry)
    const current = beginEntryPreparation(hooks.loadEntry)
    recordEntryPreparation(hooks.loadEntry, previous, captureEntryPreparation(ctx))
    expect(takeEntryPreparation(hooks.loadEntry, ctx)).toBeUndefined()

    const next = beginEntryPreparation(hooks.loadEntry)
    recordEntryPreparation(hooks.loadEntry, current, captureEntryPreparation(ctx))
    recordEntryPreparation(hooks.loadEntry, next, captureEntryPreparation(ctx))
    clearEntryPreparation(hooks.loadEntry)
    expect(takeEntryPreparation(hooks.loadEntry, ctx)).toBeUndefined()
  })
})
