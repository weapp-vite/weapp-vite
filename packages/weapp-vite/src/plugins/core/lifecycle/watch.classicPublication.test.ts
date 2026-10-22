import type { CorePluginState } from '../helpers'
import path from 'pathe'
import { afterEach, expect, it, vi } from 'vitest'
import { createRuntimeState } from '../../../runtime/runtimeState'
import { createBuildStartHook } from './watch'

afterEach(() => vi.unstubAllEnvs())

function fixture() {
  const root = path.resolve('classic-root-consumer-fixture')
  const app = path.join(root, 'src/app.ts')
  const page = path.join(root, 'src/pages/index.vue')
  const component = path.join(root, 'src/components/card.vue')
  const layout = path.join(root, 'src/layouts/default.vue')
  const unrelated = path.join(root, 'src/pages/unrelated.ts')
  const deleted = path.join(root, 'src/components/deleted.vue')
  const emitDirtyEntries = vi.fn(async () => {})
  const state = {
    ctx: {
      currentBuildTarget: 'app',
      runtimeState: createRuntimeState(),
      scanService: { appEntry: { path: app }, subPackageMap: new Map() },
      configService: {
        cwd: root,
        absoluteSrcRoot: path.join(root, 'src'),
        isDev: true,
        platform: 'weapp',
        packageJson: {},
        configFileDependencies: [],
        weappViteConfig: { hmr: { runtime: 'classic' } },
      },
    },
    resolvedConfig: { command: 'build', build: { write: true } },
    buildTarget: 'app',
    emitDirtyEntries,
    hmrState: { hasBuiltOnce: true },
    hmrSharedChunksMode: 'auto',
    resolvedEntryMap: new Map([app, page, component, layout, unrelated].map(id => [id, {}])),
    hmrSharedChunksByEntry: new Map([[app, new Set(['weapp-vendors/runtime.js'])]]),
    hmrSharedChunkDependencies: new Map([
      ['weapp-vendors/runtime.js', new Set(['weapp-vendors/reactivity.js'])],
      ['weapp-vendors/reactivity.js', new Set(['weapp-vendors/runtime.js'])],
    ]),
    hmrSharedChunkImporters: new Map([
      ['weapp-vendors/runtime.js', new Set([app, page, component, deleted])],
      ['weapp-vendors/reactivity.js', new Set([app, layout])],
      ['weapp-vendors/unrelated.js', new Set([unrelated])],
    ]),
  } as unknown as CorePluginState
  state.ctx.runtimeState.build.hmr.dirtyEntrySet.add(page)
  return { state, emitDirtyEntries, app, page, component, layout, unrelated }
}

it.each(['auto', 'full', 'off'] as const)('includes the current registration graph before tree-shaking classic root dependencies (%s)', async (mode) => {
  vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  const { state, emitDirtyEntries, app, page, component, layout, unrelated } = fixture()
  state.hmrSharedChunksMode = mode
  await createBuildStartHook(state).call({ addWatchFile() {} })

  expect([...state.hmrState.requiredPublicationEntryIds ?? []].sort()).toEqual([app, page, component, layout, unrelated].sort())
  expect(emitDirtyEntries).toHaveBeenCalledOnce()
})

it.each(['initial', 'stateful', 'bundled-dev', 'snapshot', 'independent', 'plugin', 'other-platform', 'production', 'topology', 'idle'] as const)('keeps root consumer expansion within classic native publication (%s)', async (scope) => {
  vi.stubEnv('WEAPP_VITE_NATIVE', '0')
  const { state, emitDirtyEntries } = fixture()
  if (scope === 'initial') {
    state.hmrState.hasBuiltOnce = false
  }
  else if (scope === 'stateful') {
    state.ctx.configService.weappViteConfig.hmr!.runtime = 'stateful-experimental'
  }
  else if (scope === 'bundled-dev') {
    state.resolvedConfig!.experimental = { bundledDev: true }
  }
  else if (scope === 'snapshot') {
    state.resolvedConfig!.build.write = false
  }
  else if (scope === 'independent') {
    state.subPackageMeta = { subPackage: { root: 'independent', independent: true } } as CorePluginState['subPackageMeta']
  }
  else if (scope === 'plugin') {
    state.buildTarget = 'plugin'
    state.ctx.currentBuildTarget = 'plugin'
  }
  else if (scope === 'other-platform') {
    Object.assign(state.ctx.configService, { platform: 'alipay' })
  }
  else if (scope === 'production') {
    state.ctx.configService.isDev = false
  }
  else if (scope === 'topology') {
    state.ctx.runtimeState.build.hmr.fullEntryScan = true
  }
  else {
    state.ctx.runtimeState.build.hmr.dirtyEntrySet.clear()
  }
  await createBuildStartHook(state).call({ addWatchFile() {} })
  expect(state.hmrState.requiredPublicationEntryIds?.size).toBe(0)
  expect(emitDirtyEntries).toHaveBeenCalledOnce()
})
