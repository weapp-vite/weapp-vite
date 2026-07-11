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
