import { describe, expect, it, vi } from 'vitest'
import { arrangePlugins, normalizePluginOptions } from './plugins'

const vitePluginWeappMock = vi.hoisted(() => vi.fn(() => ({ name: 'weapp-vite:context' })))

vi.mock('../../../../plugins', () => ({
  WEAPP_VITE_CONTEXT_PLUGIN_NAME: 'weapp-vite:context',
  vitePluginWeapp: vitePluginWeappMock,
}))

describe('runtime config merge plugins', () => {
  it('normalizes nested plugin options into a flat array', () => {
    expect(normalizePluginOptions([
      { name: 'a' },
      [{ name: 'b' }, undefined],
      false as any,
    ] as any)).toEqual([
      { name: 'a' },
      { name: 'b' },
    ])
  })

  it('places weapp context plugin first, keeps tsconfig plugins last, and removes duplicates', () => {
    const config: any = {
      plugins: [
        { name: 'user-a' },
        [{ name: 'vite-tsconfig-paths' }],
        { name: 'weapp-vite:context' },
        { name: 'user-b' },
      ],
    }

    arrangePlugins(config, {} as any, undefined)

    expect(vitePluginWeappMock).toHaveBeenCalledWith({}, undefined)
    expect(config.plugins).toEqual([
      { name: 'weapp-vite:context' },
      { name: 'user-a' },
      { name: 'user-b' },
      { name: 'vite-tsconfig-paths' },
    ])
  })
})
