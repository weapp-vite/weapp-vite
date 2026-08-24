import { describe, expect, it, vi } from 'vitest'
import { arrangePlugins, normalizePluginOptions } from './plugins'

const vitePluginWeappMock = vi.hoisted(() => vi.fn(() => [
  { name: 'weapp-vite:context' },
  { name: 'weapp-vite:output-finalizer' },
]))

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

  it('places weapp plugins first, keeps output finalizer last, and removes duplicates', () => {
    const config: any = {
      plugins: [
        { name: 'user-a' },
        [{ name: 'vite-tsconfig-paths' }],
        { name: 'weapp-vite:context' },
        {
          name: 'user-enforce-post',
          enforce: 'post',
        },
        {
          name: 'user-order-post',
          generateBundle: {
            order: 'post',
            handler: vi.fn(),
          },
        },
      ],
    }

    arrangePlugins(config, {} as any, undefined)

    expect(vitePluginWeappMock).toHaveBeenCalledWith({}, undefined)
    expect(config.plugins).toEqual([
      { name: 'weapp-vite:context' },
      { name: 'user-a' },
      expect.objectContaining({ name: 'user-enforce-post' }),
      expect.objectContaining({ name: 'user-order-post' }),
      { name: 'vite-tsconfig-paths' },
      { name: 'weapp-vite:output-finalizer' },
    ])
  })
})
