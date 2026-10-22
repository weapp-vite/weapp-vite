import type { ResolvedConfig, ViteDevServer } from 'vite'
import type { CorePluginState } from '../helpers'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../../moduleGraph/protocol'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { beginHmrStyleUpdatePlan, createHmrStyleUpdatePlan, getHmrStyleUpdatePlan, recordHmrStyleUpdate, settleHmrStyleUpdatePlan, withHmrStyleUpdatePlan } from '../../../runtime/hmrStyleUpdate'
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
  const createStyleLifecycle = () => {
    const configService = { isDev: true, weappViteConfig: {} }
    const moduleGraphService = createModuleGraphService()
    const state = {
      ctx: { configService, moduleGraphService, runtimeState: { build: { hmr: {} } } },
      hmrState: { hasBuiltOnce: true },
      resolvedConfig: { command: 'build', build: { write: true, watch: {} } },
    } as unknown as CorePluginState
    const plugin = createCoreLifecyclePlugin(state)
    const context = { meta: { watchMode: true }, getModuleIds: () => [] }
    return { configService, plugin, context }
  }

  it('keeps native style facts through write hooks until the watcher settles the whole generation', async () => {
    const { configService, plugin, context } = createStyleLifecycle()
    recordHmrStyleUpdate(configService, '/src/page.vue', { compilerContentOwners: [['/src/app.vue', 'tailwind-content']] })
    await (plugin.buildStart as () => Promise<void>).call(context)
    const current = getHmrStyleUpdatePlan(configService)!
    const writeBundle = plugin.writeBundle as { handler: () => Promise<void> }
    await writeBundle.handler.call(context)
    ;(plugin.closeBundle as () => void).call(context)
    expect(getHmrStyleUpdatePlan(configService)).toBe(current)
    settleHmrStyleUpdatePlan(configService, current, false)
    const release = beginHmrStyleUpdatePlan(configService, ['/src/page.vue'])
    expect(getHmrStyleUpdatePlan(configService)!.compilerContentOwners.get('/src/app.vue')).toBe('tailwind-content')
    release()
    ;(plugin.closeWatcher as () => void)()
    ;(plugin.closeWatcher as () => void)()
    expect(getHmrStyleUpdatePlan(configService)).toBeUndefined()
  })

  it('borrows the outer snapshot style plan without marking a late post-write failure successful', async () => {
    const { configService, plugin, context } = createStyleLifecycle()
    const plan = createHmrStyleUpdatePlan(['/src/page.vue'], { compilerContentOwners: [['/src/app.vue', 'tailwind-content']] })
    await expect(withHmrStyleUpdatePlan(configService, plan, async () => {
      await (plugin.buildStart as () => Promise<void>).call(context)
      await (plugin.writeBundle as { handler: () => Promise<void> }).handler.call(context)
      ;(plugin.closeBundle as () => void).call(context)
      settleHmrStyleUpdatePlan(configService, plan, true)
      expect(getHmrStyleUpdatePlan(configService)).toBe(plan)
      throw new Error('later write hook failed')
    })).rejects.toThrow('later write hook failed')
    expect(getHmrStyleUpdatePlan(configService)).toBeUndefined()
    const release = beginHmrStyleUpdatePlan(configService, ['/src/page.vue'])
    expect(getHmrStyleUpdatePlan(configService)!.compilerContentOwners.get('/src/app.vue')).toBe('tailwind-content')
    release()
    ;(plugin.closeWatcher as () => void)()
  })

  it('synchronizes output compiler dependencies after writing and before releasing the build scope', async () => {
    const moduleGraphService = createModuleGraphService()
    const state = { ctx: { moduleGraphService } } as unknown as CorePluginState
    const plugin = createCoreLifecyclePlugin(state)
    const source = '/project/src/app.css'
    const dependency = '/project/src/tailwind-config.ts'
    const context = { meta: { watchMode: false }, getModuleIds: () => [source] }
    moduleGraphService.bindBuildContext(state, context)
    const observed: string[][] = []
    vi.spyOn(moduleGraphService, 'syncDevGraph').mockImplementation(async () => {
      expect(moduleGraphService.hasModule(source)).toBe(true)
      observed.push(moduleGraphService.getTransformDependencies(source))
    })
    await (plugin.buildEnd as () => Promise<void>).call(context)
    expect(observed).toEqual([])
    moduleGraphService.replaceTransformDependencies(source, [dependency])
    const writeBundle = plugin.writeBundle as { order: string, sequential: boolean, handler: () => Promise<void> }
    expect(writeBundle).toMatchObject({ order: 'post', sequential: true })
    await writeBundle.handler.call(context)
    expect(observed).toEqual([[dependency]])
    ;(plugin.closeBundle as () => void).call(context)
    expect(moduleGraphService.hasModule(source)).toBe(false)
  })

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
    // Rolldown 不保证 closeBundle 与 load/buildEnd 复用同一个 JS context 包装对象。
    closeBundle.call({ meta: { watchMode: false } })
    closeBundle.call({ meta: { watchMode: false } })
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
