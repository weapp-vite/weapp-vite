import type { ResolvedConfig } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { CorePluginState } from '../helpers'
import fs from 'node:fs'
import os from 'node:os'
import chokidar from 'chokidar'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createModuleGraphService } from '../../../moduleGraph'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createWatcherServicePlugin } from '../../../runtime/watcherPlugin'
import { shareWxmlDependencies } from '../../../wxml/processing/dependencies'
import { createCoreLifecyclePlugin } from './index'
import { createBuildStartHook } from './watch'

const watch = vi.hoisted(() => vi.fn())
vi.mock('chokidar', () => ({ default: { watch } }))

type Lifecycle = Pick<ResolvedConfig, 'command'> & { build: { watch?: false | object } }
let fixtureRoot: string

function createFixture(config?: Lifecycle) {
  const root = fixtureRoot
  const ctx = {
    runtimeState: createRuntimeState(),
    moduleGraphService: createModuleGraphService(),
    configService: {
      isDev: true,
      cwd: root,
      absoluteSrcRoot: path.join(root, 'src'),
      outDir: path.join(root, 'dist'),
      inlineConfig: { build: { watch: {} } },
      weappViteConfig: {},
      configFileDependencies: [path.join(root, 'config.ts')],
      relativeCwd: (file: string) => path.relative(root, file),
    },
    scanService: {},
  } as unknown as MutableCompilerContext
  const state = {
    ctx,
    buildTarget: 'app',
    emitDirtyEntries: vi.fn(async () => {}),
    hmrState: {},
  } as unknown as CorePluginState
  const plugin = createCoreLifecyclePlugin(state)
  const service = createWatcherServicePlugin(ctx)
  if (config) {
    const resolveCore = plugin.configResolved as (config: ResolvedConfig) => void
    const resolveService = service.configResolved as (config: ResolvedConfig) => void
    resolveCore(config as ResolvedConfig)
    resolveService(config as ResolvedConfig)
    expect(state.resolvedConfig).toBe(config)
  }
  const addWatchFile = vi.fn()
  const start = (watchMode?: boolean) => createBuildStartHook(state).call({ addWatchFile, meta: { watchMode } })
  const closeBundle = () => (service.closeBundle as () => Promise<void>)()
  return { ctx, state, start, addWatchFile, closeBundle }
}

describe('core sidecar watcher ownership', () => {
  beforeEach(async () => {
    fixtureRoot = path.normalize(await fs.promises.realpath(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'watch-ownership-'))))
    await Promise.all([
      fs.promises.mkdir(path.join(fixtureRoot, 'src/isolated'), { recursive: true }),
      fs.promises.mkdir(path.join(fixtureRoot, 'plugin'), { recursive: true }),
    ])
    await fs.promises.writeFile(path.join(fixtureRoot, 'plugin/plugin.json'), '{}')
    vi.stubEnv('VITEST', '')
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('WEAPP_VITE_DISABLE_SIDECAR_WATCH', '0')
    watch.mockReset()
    watch.mockImplementation(() => ({ on: vi.fn().mockReturnThis(), close: vi.fn(async () => {}) }))
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    await fs.promises.rm(fixtureRoot, { recursive: true, force: true })
  })

  it.each([
    { command: 'build', watch: undefined, meta: false },
    { command: 'build', watch: false, meta: false },
    { command: 'build', watch: undefined, meta: true },
  ] as const)('keeps one-shot $command/$watch compilation free of sidecar watchers (meta: $meta)', async ({ command, watch: mode, meta }) => {
    const fixture = createFixture({ command, build: { watch: mode } })
    const dependency = path.join(fixture.ctx.configService!.cwd, 'templates/shared.wxml')
    fixture.ctx.runtimeState.wxmlProcessing.references.set(dependency, 1)

    await fixture.start(meta)

    expect(chokidar.watch).not.toHaveBeenCalled()
    expect(fixture.addWatchFile).toHaveBeenCalledWith(fixture.ctx.configService!.configFileDependencies[0])
    expect(fixture.addWatchFile).toHaveBeenCalledWith(dependency)
    expect(fixture.state.emitDirtyEntries).toHaveBeenCalledOnce()
    expect(fixture.ctx.runtimeState.build.hmr.profile.buildStartMs).toBeTypeOf('number')
  })

  it.each([undefined, false, true])('requires explicit native watch mode before config resolves: %s', async (watchMode) => {
    const fixture = createFixture()
    await fixture.start(watchMode)
    expect(chokidar.watch).toHaveBeenCalledTimes(watchMode === true ? 1 : 0)
    await fixture.ctx.watcherService!.closeAll()
  })

  it.each([
    { command: 'serve', build: { watch: undefined } },
    { command: 'build', build: { watch: {} } },
  ] satisfies Lifecycle[])('preserves the $command owner across repeated builds and snapshot teardown', async (config) => {
    const active = createFixture(config)
    await active.start(false)
    await active.start(false)
    await active.closeBundle()
    expect(chokidar.watch).toHaveBeenCalledOnce()
    const activeWatcher = watch.mock.results[0]!.value
    expect(activeWatcher.close).not.toHaveBeenCalled()

    const snapshot = createFixture({ command: 'build', build: { watch: undefined } })
    shareWxmlDependencies(active.ctx, snapshot.ctx)
    await snapshot.start(false)
    await snapshot.closeBundle()
    expect(chokidar.watch).toHaveBeenCalledOnce()
    expect(activeWatcher.close).not.toHaveBeenCalled()
    expect(active.ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(1)
    expect(snapshot.ctx.runtimeState.watcher.sidecarWatcherMap.size).toBe(0)

    await active.start(false)
    expect(chokidar.watch).toHaveBeenCalledOnce()
    await active.ctx.watcherService!.closeAll()
    await active.ctx.watcherService!.closeAll()
    expect(activeWatcher.close).toHaveBeenCalledOnce()
  })

  it.each(['app', 'plugin', 'subpackage'] as const)('retains the %s persistent sidecar roots', async (target) => {
    const fixture = createFixture({ command: 'serve', build: { watch: undefined } })
    const config = fixture.ctx.configService!
    const pluginRoot = path.join(config.cwd, 'plugin')
    Object.assign(config, { absolutePluginRoot: pluginRoot })
    if (target === 'plugin') {
      fixture.state.buildTarget = 'plugin'
    }
    if (target === 'subpackage') {
      fixture.state.subPackageMeta = { subPackage: { root: 'isolated' } } as CorePluginState['subPackageMeta']
    }
    await fixture.start(false)
    const expected = target === 'app'
      ? [config.absoluteSrcRoot, pluginRoot]
      : [target === 'plugin' ? pluginRoot : path.join(config.absoluteSrcRoot, 'isolated')]
    expect(watch.mock.calls.map(call => call[0])).toEqual(expected.map(root => [root]))
    await fixture.ctx.watcherService!.closeAll()
  })

  it.each(['app', 'plugin', 'subpackage'] as const)('captures %s one-shot dependencies without directory subscriptions', async (target) => {
    const fixture = createFixture({ command: 'build', build: { watch: undefined } })
    const config = fixture.ctx.configService!
    Object.assign(config, { absolutePluginRoot: path.join(config.cwd, 'plugin') })
    const pluginJson = path.join(config.cwd, 'plugin/plugin.json')
    Object.assign(fixture.ctx.scanService!, { pluginJsonPath: pluginJson })
    if (target === 'plugin') {
      fixture.state.buildTarget = 'plugin'
    }
    if (target === 'subpackage') {
      fixture.state.subPackageMeta = { subPackage: { root: 'isolated' } } as CorePluginState['subPackageMeta']
    }
    await fixture.start(false)
    expect(chokidar.watch).not.toHaveBeenCalled()
    expect(fixture.addWatchFile).toHaveBeenCalledWith(config.configFileDependencies[0])
    if (target === 'plugin') {
      expect(fixture.addWatchFile).toHaveBeenCalledWith(pluginJson)
    }
  })
})
