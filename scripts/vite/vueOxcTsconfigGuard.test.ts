import type { ResolvedConfig, ViteDevServer } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { createVueOxcTsconfigGuard } from './vueOxcTsconfigGuard'

function createVuePlugin() {
  const devServer = { config: { root: '/original' } } as ViteDevServer
  const plugin = {
    name: 'vite:vue',
    api: {
      options: {
        devServer,
      },
    },
  }

  return { devServer, plugin }
}

describe('createVueOxcTsconfigGuard', () => {
  it('discovers the Vite Vue plugin and disables Oxc tsconfig lookup during builds', () => {
    const { devServer, plugin: vuePlugin } = createVuePlugin()
    const guard = createVueOxcTsconfigGuard()
    const config = {
      oxc: {
        jsx: {
          runtime: 'automatic',
        },
      },
      plugins: [vuePlugin, guard],
    } as unknown as ResolvedConfig

    const configResolved = guard.configResolved as (config: ResolvedConfig) => void
    const buildStart = guard.buildStart as () => void
    const buildEnd = guard.buildEnd as () => void

    configResolved(config)
    buildStart()

    expect(vuePlugin.api.options.devServer).toMatchObject({
      config: {
        oxc: {
          jsx: {
            runtime: 'automatic',
          },
          tsconfig: false,
        },
      },
    })
    expect(vuePlugin.api.options.devServer?.watcher.on).toEqual(expect.any(Function))

    buildEnd()
    expect(vuePlugin.api.options.devServer).toBe(devServer)
  })

  it('keeps supporting an explicitly provided Vue plugin', () => {
    const { devServer, plugin: vuePlugin } = createVuePlugin()
    const guard = createVueOxcTsconfigGuard(vuePlugin)
    const config = {
      plugins: [guard],
    } as unknown as ResolvedConfig

    const configResolved = guard.configResolved as (config: ResolvedConfig) => void
    const buildStart = guard.buildStart as () => void
    const closeBundle = guard.closeBundle as () => void

    configResolved(config)
    buildStart()
    expect(vuePlugin.api.options.devServer).not.toBe(devServer)

    closeBundle()
    expect(vuePlugin.api.options.devServer).toBe(devServer)
  })

  it('rebinds to the Vue plugin created for each VitePress build phase', () => {
    const { devServer: clientDevServer, plugin: clientVuePlugin } = createVuePlugin()
    const { devServer: ssrDevServer, plugin: ssrVuePlugin } = createVuePlugin()
    const guard = createVueOxcTsconfigGuard()
    const configResolved = guard.configResolved as (config: ResolvedConfig) => void
    const buildStart = guard.buildStart as () => void
    const buildEnd = guard.buildEnd as () => void

    configResolved({
      plugins: [clientVuePlugin, guard],
    } as unknown as ResolvedConfig)
    buildStart()
    expect(clientVuePlugin.api.options.devServer).not.toBe(clientDevServer)
    buildEnd()
    expect(clientVuePlugin.api.options.devServer).toBe(clientDevServer)

    configResolved({
      plugins: [ssrVuePlugin, guard],
    } as unknown as ResolvedConfig)
    buildStart()

    expect(ssrVuePlugin.api.options.devServer).not.toBe(ssrDevServer)
    expect(ssrVuePlugin.api.options.devServer?.config.oxc).toMatchObject({
      tsconfig: false,
    })
    expect(clientVuePlugin.api.options.devServer).toBe(clientDevServer)
  })

  it('provides a no-op watcher compatible with plugin-vue build transforms', () => {
    const { plugin: vuePlugin } = createVuePlugin()
    const guard = createVueOxcTsconfigGuard(vuePlugin)
    const config = { plugins: [guard] } as unknown as ResolvedConfig

    ;(guard.configResolved as (config: ResolvedConfig) => void)(config)
    ;(guard.buildStart as () => void)()

    const on = vuePlugin.api.options.devServer?.watcher.on
    expect(() => on?.('change', vi.fn())).not.toThrow()
  })
})
