import type { Plugin } from 'vite'
import { describe, expect, it, vi } from 'vitest'
import { preflight } from './preflight'

const logger = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('../logger', () => ({ default: logger }))

function getPlugin(plugins: Plugin[], name: string) {
  const plugin = plugins.find(candidate => candidate.name === name)
  if (!plugin) {
    throw new Error(`missing plugin: ${name}`)
  }
  return plugin
}

describe('weapp-vite preflight', () => {
  it('removes external Tailwind plugins and warns once for migration', () => {
    logger.warn.mockClear()
    const plugins = preflight({ configService: { setDefineEnv: vi.fn() } } as any)
    const pruner = getPlugin(plugins, 'weapp-vite:preflight')
    const config = {
      plugins: [
        { name: 'weapp-tailwindcss:adaptor:post' },
        { name: 'test:after' },
        { name: 'weapp-tailwindcss:adaptor:css-finalizer' },
      ],
    } as any

    pruner.configResolved?.(config)
    pruner.configResolved?.(config)

    expect(config.plugins.map((plugin: any) => plugin.name)).toEqual(['test:after'])
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('weapp-vite@6.24.0'))
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('无需单独安装或注册 weapp-tailwindcss'))
  })

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
