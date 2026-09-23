import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { CorePluginState } from '../helpers'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { createCoreLifecyclePlugin } from './index'

vi.mock('./emit', () => ({
  createGenerateBundleHook: vi.fn(() => vi.fn()),
  createRenderStartHook: vi.fn(() => vi.fn()),
}))

vi.mock('./end', () => ({
  createBuildEndHook: vi.fn(() => vi.fn()),
}))

vi.mock('./load', () => ({
  createLoadHook: vi.fn(() => vi.fn()),
  createOptionsHook: vi.fn(() => vi.fn()),
}))

vi.mock('./transform', () => ({
  createTransformHook: vi.fn(() => vi.fn()),
}))

vi.mock('./watch', () => ({
  createBuildStartHook: vi.fn(() => vi.fn()),
  createWatchChangeHook: vi.fn(() => vi.fn()),
}))

describe('createCoreLifecyclePlugin', () => {
  it('declares a rolldown filter for source transform hooks', () => {
    const plugin = createCoreLifecyclePlugin({
      ctx: {
        configService: {
          weappViteConfig: {},
        },
      },
    } as any)

    expect(plugin.transform).toEqual(expect.objectContaining({
      filter: {
        id: expect.any(RegExp),
      },
      handler: expect.any(Function),
    }))
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.ts')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.vue')).toBe(true)
    expect((plugin.transform as any).filter.id.test('/project/src/pages/home.wxss')).toBe(false)
  })

  it('retains watch graphs between bundles and releases only the closing scope', async () => {
    const moduleGraphService = createModuleGraphService()
    const state = {
      ctx: { moduleGraphService, configService: { weappViteConfig: {} } },
    } as unknown as CorePluginState
    const plugin = createCoreLifecyclePlugin(state)
    const file = '/src/watched.ts'
    const entry = '/src/page.ts'
    const logical = createLogicalEntryId(entry, 'page')
    const buildContext = {
      meta: { watchMode: true },
      getModuleIds: () => [file, logical],
      getModuleInfo: (id: string) => id === file ? { importers: [logical] } : {},
    }
    moduleGraphService.bindBuildContext(state, buildContext)
    moduleGraphService.bindPluginContext(state, {
      resolve: async () => ({ id: file }),
      load: async () => ({ exports: ['watched'] }),
    })
    const other = {}
    moduleGraphService.bindBuildContext(other, {
      getModuleIds: () => ['/src/other.ts'],
      getModuleInfo: () => ({}),
    })
    const closeBundle = plugin.closeBundle as (this: { meta: { watchMode: boolean } }) => void
    const closeWatcher = plugin.closeWatcher as () => void
    closeBundle.call({ meta: { watchMode: true } })
    closeBundle.call({ meta: { watchMode: true } })
    expect(moduleGraphService.hasModule(file)).toBe(true)
    expect(moduleGraphService.collectAffectedEntries(file)).toEqual(new Set([entry]))
    await expect(moduleGraphService.load({ id: file })).resolves.toEqual({ exports: ['watched'] })

    closeWatcher()
    closeWatcher()
    expect(moduleGraphService.hasModule(file)).toBe(false)
    expect(moduleGraphService.collectAffectedEntries(file)).toEqual(new Set())
    expect(moduleGraphService.hasModule('/src/other.ts')).toBe(true)
    await expect(moduleGraphService.resolve(file)).rejects.toThrow(TypeError)
    await expect(moduleGraphService.load({ id: file })).rejects.toThrow(TypeError)
  })

  it('releases one-shot graph and plugin references on bundle close', async () => {
    const moduleGraphService = createModuleGraphService()
    const state = {
      ctx: { moduleGraphService, configService: { weappViteConfig: {} } },
    } as unknown as CorePluginState
    const plugin = createCoreLifecyclePlugin(state)
    const buildContext = {
      meta: { watchMode: false },
      getModuleIds: () => ['/src/finished.ts'],
      getModuleInfo: () => ({}),
      resolve: async () => ({ id: '/src/finished.ts' }),
    }
    moduleGraphService.bindBuildContext(state, buildContext)
    moduleGraphService.bindPluginContext(state, buildContext)
    expect(moduleGraphService.hasModule('/src/finished.ts')).toBe(true)
    const closeBundle = plugin.closeBundle as (this: { meta: { watchMode: boolean } }) => void
    closeBundle.call(buildContext)
    closeBundle.call(buildContext)
    expect(moduleGraphService.hasModule('/src/finished.ts')).toBe(false)
    await expect(moduleGraphService.resolve('value')).rejects.toThrow(TypeError)
  })

  it('does not let a stale serve plugin close detach the replacement server', () => {
    const moduleGraphService = createModuleGraphService()
    const createServingPlugin = (file: string) => {
      const state = {
        ctx: { moduleGraphService, configService: { weappViteConfig: {} } },
        resolvedConfig: { command: 'serve' } as ResolvedConfig,
      } as unknown as CorePluginState
      const plugin = createCoreLifecyclePlugin(state)
      const node = { id: file, file }
      const server = {
        moduleGraph: {
          getModuleById: (id: string) => id === file ? node : undefined,
          getModulesByFile: (id: string) => id === file ? new Set([node]) : undefined,
        },
      } as unknown as ViteDevServer
      const configureServer = plugin.configureServer as (server: ViteDevServer) => void
      configureServer(server)
      return plugin.closeBundle as (this: { meta: { watchMode: boolean } }) => void
    }
    const closeOld = createServingPlugin('/src/old.ts')
    const closeCurrent = createServingPlugin('/src/current.ts')
    closeOld.call({ meta: { watchMode: true } })
    closeOld.call({ meta: { watchMode: true } })
    expect(moduleGraphService.hasModule('/src/current.ts')).toBe(true)
    expect(moduleGraphService.hasModule('/src/old.ts')).toBe(false)
    closeCurrent.call({ meta: { watchMode: true } })
    closeCurrent.call({ meta: { watchMode: true } })
    expect(moduleGraphService.hasModule('/src/current.ts')).toBe(false)
  })
})
