import type { OutputBundle, RolldownWatcher } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { CorePluginState } from '../../plugins/core/helpers'
import type { WxmlAssetPayload } from '../../plugins/utils/wxmlEmit'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../moduleGraph/protocol'
import { createModuleGraphService } from '../../moduleGraph/service'
import { createRenderStartHook } from '../../plugins/core/lifecycle/emit'
import { createBuildEndHook } from '../../plugins/core/lifecycle/end'
import { createLogicalEntryLoadHook } from '../../plugins/core/lifecycle/logicalEntry'
import { pruneUnchangedDevHmrOutputs } from '../../plugins/outputFinalizer'
import { createRuntimeState } from '../runtimeState'
import { createWxmlServicePlugin } from '../wxmlPlugin'
import { createBuildService } from './service'

const harness = vi.hoisted(() => ({
  build: vi.fn(),
  change: undefined as ((change: { event: 'update' | 'create', file: string }) => void) | undefined,
  sidecar: undefined as EventEmitter | undefined,
}))
vi.mock('vite', async importOriginal => ({ ...await importOriginal<typeof import('vite')>(), build: harness.build }))
vi.mock('../../moduleGraph/devProvider', () => ({
  createDevModuleGraphProvider: vi.fn(async (_ctx, _config, onChange) => {
    harness.change = onChange
    return { close: vi.fn(async () => {}) }
  }),
}))
vi.mock('chokidar', () => ({ default: { watch: vi.fn(() => harness.sidecar) } }))
vi.mock('../sharedBuildConfig', () => ({ createSharedBuildConfig: vi.fn(() => ({})) }))
vi.mock('./workers', () => ({ checkWorkersOptions: vi.fn(() => ({ hasWorkersDir: false })) }))
vi.mock('../../utils/projectConfig', () => ({ syncProjectConfigToOutput: vi.fn(async () => {}) }))
vi.mock('./outputs', async importOriginal => ({ ...await importOriginal<typeof import('./outputs')>(), cleanOutputs: vi.fn(async () => {}) }))

const cleanups: Array<() => Promise<void>> = []
beforeEach(() => {
  harness.build.mockReset()
  harness.change = undefined
  vi.stubEnv('WEAPP_VITE_HMR_PROFILE_JSON', '')
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
  vi.unstubAllEnvs()
})

async function createFixture() {
  const root = path.normalize(await realpath(await mkdtemp(path.join(os.tmpdir(), 'classic-template-snapshot-'))))
  cleanups.push(async () => await rm(root, { recursive: true, force: true }))
  const absolute = (file: string) => path.join(root, file)
  const owner = absolute('components/layout/index.ts')
  const ownerTemplate = absolute('components/layout/index.wxml')
  const files = {
    'components/layout/index.ts': 'Component({})',
    'components/layout/index.json': '{"component":true}',
    'components/layout/index.wxml': '<import src="../../shared/card.wxml"/><include src="../../shared/wrapper.wxml"/><template is="card"/>',
    'shared/card.wxml': '<template name="card"><view>card initial</view></template>',
    'shared/wrapper.wxml': '<include src="./partial.wxml"/>',
    'shared/partial.wxml': '<view>partial initial</view>',
    'pages/unrelated/index.ts': 'Page({})',
    'pages/unrelated/index.json': '{}',
    'pages/unrelated/index.wxml': '<view>unrelated page</view>',
  }
  for (const [file, source] of Object.entries(files)) {
    await mkdir(path.dirname(absolute(file)), { recursive: true })
    await writeFile(absolute(file), source)
  }
  const runtimeState = createRuntimeState()
  const rollupWatcherMap = new Map()
  const ctx = {
    runtimeState,
    moduleGraphService: createModuleGraphService(),
    configService: {
      cwd: root,
      absoluteSrcRoot: root,
      outDir: absolute('dist'),
      weappViteConfig: { hmr: { runtime: 'classic' }, cleanOutputsInDev: false },
      configFileDependencies: [],
      projectPrivateConfig: {},
      multiPlatform: { enabled: false },
      packageJson: {},
      platform: 'weapp',
      isDev: true,
      outputExtensions: { template: 'wxml', scriptModule: 'wxs' },
      relativeAbsoluteSrcRoot: (file: string) => path.relative(root, file),
      relativeOutputPath: (file: string) => path.relative(root, file),
      relativeCwd: (file: string) => path.relative(root, file),
      merge: () => ({}),
    },
    watcherService: { rollupWatcherMap, sidecarWatcherMap: new Map(), setRollupWatcher: (watcher: RolldownWatcher, key: string) => rollupWatcherMap.set(key, watcher) },
    npmService: {},
    scanService: { isMainPackageFileName: () => true },
  } as unknown as MutableCompilerContext
  createWxmlServicePlugin(ctx)
  const state = {
    ctx,
    jsonEmitFilesMap: new Map(),
    entriesMap: new Map([
      ['components/layout/index', { templatePath: ownerTemplate }],
      ['pages/unrelated/index', { templatePath: absolute('pages/unrelated/index.wxml') }],
    ]),
    resolvedEntryMap: runtimeState.build.hmr.resolvedEntryMap,
    loadedEntrySet: new Set(),
    hmrRootInputIds: new Set(),
    hmrState: { hasBuiltOnce: false, didEmitAllEntries: true },
    buildTarget: 'app',
    // 原生入口的最小 loadEntry 不做额外模板扫描；依赖来自真实 logical entry loader。
    loadEntry: async () => {},
  } as unknown as CorePluginState
  runtimeState.build.hmr.resolvedEntryMap.set(owner, { id: owner } as never)
  const unrelatedOwner = absolute('pages/unrelated/index.ts')
  runtimeState.build.hmr.resolvedEntryMap.set(unrelatedOwner, { id: unrelatedOwner } as never)
  const load = createLogicalEntryLoadHook(state)
  const end = createBuildEndHook(state)
  const render = createRenderStartHook(state)
  const bundles: OutputBundle[] = []
  const controls = { beforeRender: undefined as (() => Promise<void>) | undefined, failAfterRender: false }
  harness.build.mockImplementation(async (config) => {
    state.resolvedConfig = config
    const emitted: WxmlAssetPayload[] = []
    // 与 classic 一次性 build 相同：重新加载 owner，再执行真实 render/finalizer。
    await load.call({ resolve: async () => null } as never, createLogicalEntryId(owner, 'component'))
    await load.call({ resolve: async () => null } as never, createLogicalEntryId(unrelatedOwner, 'page'))
    await controls.beforeRender?.()
    await end.call({ getModuleIds: () => [] })
    await render.call({ emitFile: (asset: WxmlAssetPayload) => emitted.push(asset) })
    const bundle = Object.fromEntries(emitted.map(asset => [asset.fileName, asset])) as unknown as OutputBundle
    pruneUnchangedDevHmrOutputs(ctx, bundle, undefined, { runtimeRewriteDone: true })
    ctx.moduleGraphService.clearPendingChanges()
    if (controls.failAfterRender) {
      controls.failAfterRender = false
      throw new Error('simulated write failure')
    }
    bundles.push(bundle)
    state.hmrState.hasBuiltOnce = true
    state.hmrState.didEmitAllEntries = false
    return { output: Object.values(bundle) }
  })
  const sidecar = Object.assign(new EventEmitter(), { close: async () => {} })
  harness.sidecar = sidecar
  const service = createBuildService(ctx)
  const startup = service.build({ skipNpm: true })
  await Promise.race([startup, vi.waitFor(() => expect(sidecar.listenerCount('ready')).toBe(1))])
  sidecar.emit('ready')
  const watcher = await startup as RolldownWatcher
  cleanups.push(async () => await watcher.close())
  const save = async (file: string, source: string) => {
    const temporary = `${absolute(file)}.save`
    await writeFile(temporary, source)
    await rename(temporary, absolute(file))
  }
  const update = (...files: string[]) => {
    for (const file of files) {
      harness.change!({ event: 'update', file: absolute(file) })
    }
  }
  const nextBundle = async (previousCount: number) => {
    await vi.waitFor(() => expect(bundles).toHaveLength(previousCount + 1))
    return bundles.at(-1)!
  }
  return { ctx, files, absolute, save, update, bundles, nextBundle, sidecar, controls }
}

describe('classic template snapshot source freshness', () => {
  it('refreshes shared template source through the real snapshot scheduler without touching its owner', async () => {
    const fixture = await createFixture()
    expect(fixture.bundles[0]?.['shared/card.wxml']).toMatchObject({ source: fixture.files['shared/card.wxml'] })
    await fixture.save('shared/card.wxml', '<template name="card"><view>card updated</view></template>')
    fixture.update('shared/card.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(fixture.ctx.wxmlService.tokenMap.get(fixture.absolute('shared/card.wxml'))?.code).toContain('card updated')
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card updated') })
    expect(bundle['components/layout/index.wxml']).toBeUndefined()
  })

  it('refreshes every shared import/include in one batch, including nested dependencies', async () => {
    const fixture = await createFixture()
    await fixture.save('shared/card.wxml', '<template name="card"><view>card updated</view></template>')
    await fixture.save('shared/partial.wxml', '<view>partial updated</view>')
    fixture.update('shared/card.wxml', 'shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card updated') })
    expect(bundle['shared/partial.wxml']).toMatchObject({ source: '<view>partial updated</view>' })
  })

  it('tracks an isolated nested include as a real owner dependency', async () => {
    const fixture = await createFixture()
    expect(fixture.ctx.moduleGraphService.hasModule(fixture.absolute('shared/partial.wxml'))).toBe(true)
    await fixture.save('shared/partial.wxml', '<view>partial updated</view>')
    fixture.update('shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/partial.wxml']).toMatchObject({ source: '<view>partial updated</view>' })
  })

  it('keeps changes arriving during a build for the next snapshot', async () => {
    const fixture = await createFixture()
    fixture.controls.beforeRender = async () => {
      fixture.controls.beforeRender = undefined
      await fixture.save('shared/partial.wxml', '<view>partial queued</view>')
      fixture.update('shared/partial.wxml')
      expect(fixture.ctx.moduleGraphService.getPendingChanges().map(change => change.file)).toEqual([
        fixture.absolute('shared/card.wxml'),
      ])
    }
    await fixture.save('shared/card.wxml', '<template name="card"><view>card first batch</view></template>')
    fixture.update('shared/card.wxml')
    await vi.waitFor(() => expect(fixture.bundles).toHaveLength(3))
    expect(fixture.bundles[1]?.['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card first batch') })
    expect(fixture.bundles[1]?.['shared/partial.wxml']).toBeUndefined()
    expect(fixture.bundles[2]?.['shared/partial.wxml']).toMatchObject({ source: '<view>partial queued</view>' })
  })

  it('replays a failed batch with the next request even after output caches were populated', async () => {
    const fixture = await createFixture()
    fixture.controls.failAfterRender = true
    await fixture.save('shared/card.wxml', '<template name="card"><view>card retry</view></template>')
    fixture.update('shared/card.wxml')
    await vi.waitFor(() => expect(harness.build).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(fixture.controls.failAfterRender).toBe(false))
    expect(fixture.bundles).toHaveLength(1)
    await fixture.save('shared/partial.wxml', '<view>partial next request</view>')
    fixture.update('shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card retry') })
    expect(bundle['shared/partial.wxml']).toMatchObject({ source: '<view>partial next request</view>' })
  })

  it('deduplicates cyclic import/include dependencies after a shared topology update', async () => {
    const fixture = await createFixture()
    await fixture.save('shared/card.wxml', '<import src="./wrapper.wxml"/><template name="card"><view>card updated</view></template>')
    await fixture.save('shared/partial.wxml', '<import src="./card.wxml"/><view>partial updated</view>')
    fixture.update('shared/card.wxml', 'shared/partial.wxml')
    const bundle = await fixture.nextBundle(1)
    expect(bundle['shared/card.wxml']).toMatchObject({ source: expect.stringContaining('card updated') })
    const templates = fixture.ctx.moduleGraphService.getEntryDependencies(fixture.absolute('components/layout/index.ts')).filter(item => item.kind === 'template')
    expect(templates.map(item => path.relative(fixture.absolute(''), item.sourceId)).sort()).toEqual([
      'components/layout/index.wxml',
      'shared/card.wxml',
      'shared/partial.wxml',
      'shared/wrapper.wxml',
    ])
  })

  it.each(['initial', 'restored'])('does not retain deleted shared tokens and restores %s content through the same scheduler', async (content) => {
    const fixture = await createFixture()
    const card = fixture.absolute('shared/card.wxml')
    await rm(card)
    fixture.sidecar.emit('all', 'unlink', card)
    const removed = await fixture.nextBundle(1)
    expect(fixture.ctx.wxmlService.tokenMap.has(card)).toBe(false)
    expect(removed['shared/card.wxml']).toBeUndefined()
    expect(removed['pages/unrelated/index.wxml']).toMatchObject({ source: '<view>unrelated page</view>' })
    await fixture.save('shared/card.wxml', `<template name="card"><view>card ${content}</view></template>`)
    harness.change!({ event: 'create', file: card })
    const restored = await fixture.nextBundle(2)
    expect(restored['shared/card.wxml']).toMatchObject({ source: expect.stringContaining(`card ${content}`) })
    expect(restored['pages/unrelated/index.wxml']).toMatchObject({ source: '<view>unrelated page</view>' })
  })
})
