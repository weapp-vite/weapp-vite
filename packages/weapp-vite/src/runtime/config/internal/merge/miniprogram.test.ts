import { describe, expect, it, vi } from 'vitest'
import { mergeMiniprogram } from './miniprogram'

const arrangePluginsMock = vi.hoisted(() => vi.fn())

vi.mock('./plugins', () => {
  return {
    arrangePlugins: arrangePluginsMock,
  }
})

describe('runtime config merge miniprogram', () => {
  it('builds development inline config with watch include/exclude and plugin root outside src', () => {
    const applyRuntimePlatform = vi.fn()
    const injectBuiltinAliases = vi.fn()
    const setOptions = vi.fn()

    const result = mergeMiniprogram(
      {
        ctx: {} as any,
        subPackageMeta: undefined,
        config: {
          weapp: {
            pluginRoot: '../plugin-root',
          },
        } as any,
        cwd: '/project',
        srcRoot: 'src',
        mpDistRoot: 'custom-dist',
        packageJson: {
          dependencies: {
            '@scope/pkg': '^1.0.0',
            'lodash': '^4.0.0',
          },
        },
        isDev: true,
        applyRuntimePlatform,
        injectBuiltinAliases,
        getDefineImportMetaEnv: () => ({
          __DEV__: true,
        }),
        setOptions,
        oxcRolldownPlugin: undefined,
      },
      {
        build: {
          rollupOptions: {
            input: 'src/main.ts',
          },
        },
      } as any,
    )

    expect(applyRuntimePlatform).toHaveBeenCalledWith('miniprogram')
    expect(result.mode).toBe('development')
    expect(result.root).toBe('/project')
    expect(result.weappVite).toEqual({
      name: 'weapp-vite',
      runtime: 'miniprogram',
    })
    expect(result.define).toMatchObject({
      __DEV__: true,
      __VITE_IS_MODERN__: 'false',
    })
    expect(result.build?.minify).toBe(false)
    expect(result.build?.emptyOutDir).toBe(false)
    expect(result.build?.modulePreload).toBe(false)
    expect(result.build?.sourcemap).toBe(false)
    expect((result.build as any).rollupOptions).toBeUndefined()
    expect(result.build?.watch?.include).toEqual([
      '/project/src/**',
      '/plugin-root/**',
    ])
    expect(result.build?.watch?.exclude).toContain('/project/custom-dist/**')
    expect(injectBuiltinAliases).toHaveBeenCalledWith(result)
    expect(arrangePluginsMock).toHaveBeenCalledWith(result, {}, undefined)
    expect(setOptions).not.toHaveBeenCalled()
  })

  it('builds development watch with plugin root inside src and default dist exclusion', () => {
    const result = mergeMiniprogram(
      {
        ctx: {} as any,
        subPackageMeta: undefined,
        config: {
          weapp: {
            pluginRoot: 'src/plugin',
          },
        } as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: undefined,
        isDev: true,
        applyRuntimePlatform: vi.fn(),
        injectBuiltinAliases: vi.fn(),
        getDefineImportMetaEnv: () => ({}),
        setOptions: vi.fn(),
        oxcRolldownPlugin: undefined,
      },
      undefined,
    )

    expect(result.build?.watch?.include).toEqual([
      '/project/src/**',
      '/project/src/plugin/**',
    ])
    expect(result.build?.watch?.exclude).toContain('/project/dist/**')
    expect(result.build?.modulePreload).toBe(false)
  })

  it('builds production inline config and sets current subpackage root', () => {
    const setOptions = vi.fn()
    const applyRuntimePlatform = vi.fn()
    const injectBuiltinAliases = vi.fn()

    const result = mergeMiniprogram(
      {
        ctx: {} as any,
        subPackageMeta: {
          subPackage: {
            root: 'packageA',
          },
        } as any,
        config: {} as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: {
          dependencies: {
            vue: '^3.0.0',
          },
        },
        isDev: false,
        applyRuntimePlatform,
        injectBuiltinAliases,
        getDefineImportMetaEnv: () => ({
          __PROD__: true,
        }),
        setOptions,
        oxcRolldownPlugin: undefined,
      },
      {
        build: {
          rollupOptions: {
            input: 'src/main.ts',
          },
        },
      } as any,
    )

    expect(applyRuntimePlatform).toHaveBeenCalledWith('miniprogram')
    expect(result.mode).toBe('production')
    expect(result.root).toBe('/project')
    expect(result.weappVite).toEqual({
      name: 'weapp-vite',
      runtime: 'miniprogram',
    })
    expect(result.logLevel).toBe('info')
    expect(result.define).toMatchObject({
      __PROD__: true,
      __VITE_IS_MODERN__: 'false',
    })
    expect(result.build?.emptyOutDir).toBe(false)
    expect(result.build?.modulePreload).toBe(false)
    expect((result.build as any).rollupOptions).toBeUndefined()
    expect(arrangePluginsMock).toHaveBeenCalled()
    expect(injectBuiltinAliases).toHaveBeenCalledWith(result)
    expect(setOptions).toHaveBeenCalledWith({
      currentSubPackageRoot: 'packageA',
    })
  })

  it('keeps user-defined modulePreload when explicitly configured', () => {
    const result = mergeMiniprogram(
      {
        ctx: {} as any,
        subPackageMeta: undefined,
        config: {
          build: {
            modulePreload: {
              polyfill: true,
            },
          },
        } as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: undefined,
        isDev: false,
        applyRuntimePlatform: vi.fn(),
        injectBuiltinAliases: vi.fn(),
        getDefineImportMetaEnv: () => ({}),
        setOptions: vi.fn(),
        oxcRolldownPlugin: undefined,
      },
      undefined,
    )

    expect(result.build?.modulePreload).toEqual({
      polyfill: true,
    })
  })

  it('forces __VITE_IS_MODERN__ to false in miniprogram runtime', () => {
    const result = mergeMiniprogram(
      {
        ctx: {} as any,
        subPackageMeta: undefined,
        config: {
          define: {
            __VITE_IS_MODERN__: 'true',
          },
        } as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: undefined,
        isDev: false,
        applyRuntimePlatform: vi.fn(),
        injectBuiltinAliases: vi.fn(),
        getDefineImportMetaEnv: () => ({
          __PROD__: true,
        }),
        setOptions: vi.fn(),
        oxcRolldownPlugin: undefined,
      },
      undefined,
    )

    expect(result.define).toMatchObject({
      __PROD__: true,
      __VITE_IS_MODERN__: 'false',
    })
  })
})
