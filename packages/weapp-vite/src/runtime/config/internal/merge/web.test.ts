import { describe, expect, it, vi } from 'vitest'
import {
  mergeWeb,
  mergeWebPlugins,
} from './web'

vi.mock('@weapp-vite/web', () => ({
  weappWebPlugin: vi.fn(() => ({
    name: 'weapp-web-plugin',
  })),
}))

describe('runtime config merge web', () => {
  it('merges web plugins while removing duplicated runtime plugin names', () => {
    const webPlugin = { name: 'weapp-web-plugin' }

    expect(mergeWebPlugins([
      { name: 'user-plugin' },
      [{ name: 'weapp-web-plugin' }],
      false as any,
    ] as any, webPlugin as any)).toEqual([
      { name: 'weapp-web-plugin' },
      { name: 'user-plugin' },
    ])
  })

  it('injects weapp-vite host metadata for web runtime', () => {
    const applyRuntimePlatform = vi.fn()
    const injectBuiltinAliases = vi.fn()

    const result = mergeWeb({
      config: {
        plugins: [{ name: 'user-plugin' }],
      } as any,
      web: {
        enabled: true,
        root: '/project/web',
        outDir: '/project/dist-web',
        pluginOptions: {
          srcDir: 'src',
        },
        userConfig: {
          build: {
            emptyOutDir: true,
          },
        },
      } as any,
      mode: 'production',
      isDev: false,
      applyRuntimePlatform,
      injectBuiltinAliases,
      getDefineImportMetaEnv: () => ({
        'import.meta.env.RUNTIME': '"web"',
      }),
    })

    expect(applyRuntimePlatform).toHaveBeenCalledWith('web')
    expect(result?.weappVite).toEqual({
      name: 'weapp-vite',
      runtime: 'web',
      platform: 'web',
    })
    expect(result?.plugins?.map((plugin: any) => plugin.name)).toEqual([
      'weapp-web-plugin',
      'user-plugin',
    ])
    expect(result?.define).toMatchObject({
      'import.meta.env.RUNTIME': '"web"',
    })
    expect(injectBuiltinAliases).toHaveBeenCalledWith(result)
  })

  it('returns undefined when web runtime is disabled', () => {
    const result = mergeWeb({
      config: {} as any,
      web: {
        enabled: false,
      } as any,
      mode: 'development',
      isDev: true,
      applyRuntimePlatform: vi.fn(),
      injectBuiltinAliases: vi.fn(),
      getDefineImportMetaEnv: () => ({}),
    })

    expect(result).toBeUndefined()
  })
})
