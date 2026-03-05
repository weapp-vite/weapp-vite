import type { Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { preflight } from './preflight'

function getPlugin(plugins: Plugin[], name: string) {
  const plugin = plugins.find(candidate => candidate.name === name)
  if (!plugin) {
    throw new Error(`missing plugin: ${name}`)
  }
  return plugin
}

describe('weapp-vite preflight', () => {
  it('removes import analysis plugins from resolved config', () => {
    const plugins = preflight({ configService: { setDefineEnv: vi.fn() } } as any)
    const pruner = getPlugin(plugins, 'weapp-vite:preflight')
    const config = {
      plugins: [
        { name: 'test:before' },
        { name: 'vite:build-import-analysis' },
        { name: 'native:import-analysis-build' },
        { name: 'test:after' },
      ],
    } as any

    pruner.configResolved?.(config)

    expect(config.plugins.map((plugin: any) => plugin.name)).toEqual([
      'test:before',
      'test:after',
    ])
  })

  it('syncs resolved env values to config service define env', () => {
    const setDefineEnv = vi.fn()
    const plugins = preflight({ configService: { setDefineEnv } } as any)
    const syncer = getPlugin(plugins, 'weapp-vite:set-env')

    syncer.configResolved?.({
      env: {
        MODE: 'production',
        CUSTOM_FLAG: 'yes',
      },
    } as any)

    expect(setDefineEnv).toHaveBeenCalledWith('MODE', 'production')
    expect(setDefineEnv).toHaveBeenCalledWith('CUSTOM_FLAG', 'yes')
  })
})
