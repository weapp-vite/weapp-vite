import type { VueBundleState } from './shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MP_PLATFORM } from '../../../../platform'
import { emitResolvedCompiledVueEntryAssets } from './emitCompiledEntry'

const emitCompiledEntryBundleAssetsMock = vi.hoisted(() => vi.fn())

vi.mock('./shared', () => ({
  emitCompiledEntryBundleAssets: emitCompiledEntryBundleAssetsMock,
  handleCompiledEntryPageLayouts: vi.fn(),
  resolveCompiledEntryEmitState: vi.fn(),
  resolveVueBundleAssetContext: vi.fn(),
}))

const appEntry = '/project/src/app.vue'
const pageEntry = '/project/src/pages/index/index.vue'
const updates = [
  { name: 'page style metadata', file: '/project/src/pages/index/index.css', reason: 'style-sidecar:1', entry: pageEntry },
  { name: 'direct app script', file: appEntry, reason: 'entry-direct:1', entry: appEntry },
  { name: 'app JSON', file: appEntry, reason: 'entry-json-only:1', entry: appEntry },
  { name: 'inline routes', file: appEntry, reason: 'entry-auto-routes:1', entry: appEntry },
  { name: 'route topology', file: '/project/src/pages/new/index.vue', reason: 'auto-routes-topology:1', entry: appEntry },
]

function createState(isBundledDev: boolean, update: typeof updates[number]) {
  return {
    isBundledDev,
    pluginCtx: { emitFile: vi.fn() },
    ctx: {
      configService: { isDev: true, platform: DEFAULT_MP_PLATFORM },
      runtimeState: {
        build: {
          output: {
            wevuInternalRuntimeFileName: 'weapp-vendors/runtime.js',
          },
          hmr: {
            isRebuild: true,
            profile: { event: 'update', file: update.file, dirtyReasonSummary: [update.reason] },
            lastHmrEntryIds: new Set([update.entry]),
            lastEmittedChunkFileNames: new Set<string>(),
          },
        },
      },
    },
  }
}

async function emitAppAssets(state: ReturnType<typeof createState>, bundle: Record<string, unknown>) {
  const result = {
    script: 'import { createApp } from "wevu/internal-runtime";createApp({ phase: "compiler" });',
    config: JSON.stringify({ pages: ['pages/index/index', 'pages/new/index'] }),
  }
  await emitResolvedCompiledVueEntryAssets({
    bundle,
    state: state as unknown as VueBundleState,
    filename: appEntry,
    cached: { isPage: false, source: '<script setup />', result },
    result,
    relativeBase: 'app',
    compileOptionsState: {
      reExportResolutionCache: new Map(),
      classStyleRuntimeWarned: { value: false },
    },
    outputExtensions: { wxml: 'wxml', wxss: 'wxss', json: 'json', script: 'js', wxs: 'wxs' } as any,
    templateExtension: 'wxml',
    jsonExtension: 'json',
    scriptExtension: 'js',
    scriptModuleExtension: 'wxs',
    platformAssetOptions: { platform: DEFAULT_MP_PLATFORM, templateExtension: 'wxml', scriptModuleExtension: 'wxs' },
  })
  return result
}

describe.each([false, true])('App script ownership with bundled dev = %s', (isBundledDev) => {
  beforeEach(() => {
    emitCompiledEntryBundleAssetsMock.mockReset()
    emitCompiledEntryBundleAssetsMock.mockReturnValue({ shouldEmitComponentJson: false })
  })

  it.each(updates)('preserves the bundler entry and imports during $name updates', async (update) => {
    const state = createState(isBundledDev, update)
    const entry = {
      type: 'chunk',
      fileName: 'app.js',
      facadeModuleId: appEntry,
      imports: ['startup.js'],
      code: 'const startup = require("./startup.js");startup.registerApp({ phase: "bundler" });',
      modules: { [appEntry]: { renderedExports: [], removedExports: [] } },
    }
    const bundle = { 'app.js': entry }
    const before = structuredClone(entry)

    const result = await emitAppAssets(state, bundle)

    expect(bundle['app.js']).toBe(entry)
    expect(entry).toEqual(before)
    expect(state.pluginCtx.emitFile).not.toHaveBeenCalled()
    expect(state.ctx.runtimeState.build.hmr.lastEmittedChunkFileNames.size).toBe(0)
    // 路由与配置仍进入资产生成流程，不能以保留脚本为由跳过 App 资产刷新。
    expect(emitCompiledEntryBundleAssetsMock).toHaveBeenCalledWith(expect.objectContaining({
      filename: appEntry,
      result,
      relativeBase: 'app',
    }))
  })

  it('does not synthesize an app script when the bundler omits an unchanged entry', async () => {
    const state = createState(isBundledDev, updates[0]!)
    const bundle = {}

    await emitAppAssets(state, bundle)

    expect(bundle).toEqual({})
    expect(state.pluginCtx.emitFile).not.toHaveBeenCalled()
  })
})
