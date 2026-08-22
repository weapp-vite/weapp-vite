import { describe, expect, it, vi } from 'vitest'
import {
  mergeWeb,
  mergeWebPlugins,
} from './web'

const weappWebPluginMock = vi.hoisted(() => vi.fn(() => ({
  name: 'weapp-web-plugin',
})))

vi.mock('@weapp-vite/web', () => ({
  weappWebPlugin: weappWebPluginMock,
}))

describe('runtime config merge web', () => {
  it('merges web plugins while removing duplicated runtime plugin names', () => {
    const webPlugin = { name: 'weapp-web-plugin' }
    const runtimeProviderPlugin = { name: 'weapp-vite:runtime-provider:web-runtime' }

    expect(mergeWebPlugins([
      { name: 'user-plugin' },
      [{ name: 'weapp-web-plugin' }, { name: 'weapp-vite:runtime-provider:web-runtime' }],
      false as any,
    ] as any, webPlugin as any, runtimeProviderPlugin as any)).toEqual([
      { name: 'weapp-vite:runtime-provider:web-runtime' },
      { name: 'weapp-web-plugin' },
      { name: 'user-plugin' },
    ])
  })

  it('accepts a single raw plugin and optional runtime provider', () => {
    const userPlugin = { name: 'user-plugin' }
    expect(mergeWebPlugins(userPlugin as any, { name: 'web' } as any)).toEqual([
      { name: 'web' },
      userPlugin,
    ])
    expect(mergeWebPlugins(undefined, { name: 'web' } as any)).toEqual([{ name: 'web' }])
  })

  it('injects weapp-vite host metadata for web runtime', () => {
    const applyRuntimePlatform = vi.fn()
    const injectBuiltinAliases = vi.fn()
    const resolveAppConfig = vi.fn()

    const result = mergeWeb({
      configService: {
        weappViteConfig: {
          chunks: { preserveModules: ['shared/**'] },
        },
      } as any,
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
      resolveAppConfig,
    })

    expect(applyRuntimePlatform).toHaveBeenCalledWith('web')
    expect(result?.weappVite).toEqual({
      name: 'weapp-vite',
      runtime: 'web',
      platform: 'web',
    })
    expect(result?.build?.rolldownOptions?.preserveEntrySignatures).toBe('allow-extension')
    expect(result?.plugins?.map((plugin: any) => plugin.name)).toEqual([
      'weapp-vite:runtime-provider:web-runtime',
      'weapp-web-plugin',
      'user-plugin',
    ])
    expect(weappWebPluginMock).toHaveBeenCalledWith(expect.objectContaining({
      __runtimeProvider: {
        moduleId: 'virtual:weapp-vite/runtime',
        hmrAcceptCode: 'if (import.meta.hot) { import.meta.hot.accept() }',
      },
      __resolveAppConfig: resolveAppConfig,
    }))
    expect(result?.define).toMatchObject({
      'import.meta.env.RUNTIME': '"web"',
    })
    expect(injectBuiltinAliases).toHaveBeenCalledWith(result, 'build')
    expect(result?.resolve?.alias).toEqual(expect.arrayContaining([
      { find: 'weapp-vite/runtime', replacement: 'virtual:weapp-vite/runtime' },
    ]))
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
    expect(mergeWeb({
      config: {} as any,
      web: undefined,
      mode: 'development',
      isDev: true,
      applyRuntimePlatform: vi.fn(),
      injectBuiltinAliases: vi.fn(),
      getDefineImportMetaEnv: () => ({}),
    })).toBeUndefined()
  })

  it('normalizes object aliases and removes the existing runtime alias', () => {
    const result = mergeWeb({
      config: {
        resolve: {
          alias: {
            'weapp-vite/runtime': '/legacy-runtime',
            'user': '/user',
          },
        },
      } as any,
      web: {
        enabled: true,
        root: '/project/web',
        outDir: '/project/dist-web',
        pluginOptions: {},
        userConfig: {},
      } as any,
      mode: 'development',
      isDev: true,
      applyRuntimePlatform: vi.fn(),
      injectBuiltinAliases: vi.fn(),
      getDefineImportMetaEnv: () => ({}),
    })
    expect(result?.resolve?.alias).toEqual([
      { find: 'weapp-vite/runtime', replacement: 'virtual:weapp-vite/runtime' },
      { find: 'user', replacement: '/user' },
    ])
  })
})
