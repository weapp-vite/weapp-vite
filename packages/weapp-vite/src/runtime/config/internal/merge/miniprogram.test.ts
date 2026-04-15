import { describe, expect, it, vi } from 'vitest'
import {
  mergeMiniprogram,
  resolveMiniprogramWatchInclude,
} from './miniprogram'

const arrangePluginsMock = vi.hoisted(() => vi.fn())
const resolveBuiltinPackageAliasesMock = vi.hoisted(() => vi.fn(() => []))

vi.mock('./plugins', () => {
  return {
    arrangePlugins: arrangePluginsMock,
  }
})

vi.mock('../../../packageAliases', () => {
  return {
    resolveBuiltinPackageAliases: resolveBuiltinPackageAliasesMock,
  }
})

describe('runtime config merge miniprogram', () => {
  it('resolves miniprogram watch include patterns for src and plugin roots', () => {
    expect(resolveMiniprogramWatchInclude({
      cwd: '/project',
      srcRoot: 'src',
    })).toEqual([
      '/project/src/**',
    ])

    expect(resolveMiniprogramWatchInclude({
      cwd: '/project',
      srcRoot: 'src',
      pluginRoot: '../plugin-root',
    })).toEqual([
      '/project/src/**',
      '/plugin-root/**',
    ])

    expect(resolveMiniprogramWatchInclude({
      cwd: '/project',
      srcRoot: 'src',
      pluginRoot: 'src/plugin',
    })).toEqual([
      '/project/src/**',
      '/project/src/plugin/**',
    ])
  })

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
    expect(result.logLevel).toBe('warn')
    expect(result.define).toMatchObject({
      __PROD__: true,
      __VITE_IS_MODERN__: 'false',
    })
    expect(result.build?.minify).toBe(false)
    expect(result.build?.emptyOutDir).toBe(false)
    expect(result.build?.modulePreload).toBe(false)
    expect((result.build as any).rollupOptions).toBeUndefined()
    expect(arrangePluginsMock).toHaveBeenCalled()
    expect(injectBuiltinAliases).toHaveBeenCalledWith(result)
    expect(setOptions).toHaveBeenCalledWith({
      currentSubPackageRoot: 'packageA',
    })
  })

  it('externalizes explicit npm build candidates and matching builtin alias paths', () => {
    resolveBuiltinPackageAliasesMock.mockReturnValue([
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/index.mjs',
      },
      {
        find: 'wevu/router',
        replacement: '/project/node_modules/wevu/dist/router.mjs',
      },
      {
        find: '@vant/weapp',
        replacement: '/project/node_modules/@vant/weapp/dist/index.js',
      },
    ])

    const result = mergeMiniprogram(
      {
        ctx: {
          configService: {
            cwd: '/project',
            weappViteConfig: {
              npm: {
                include: ['wevu'],
              },
            },
          },
        } as any,
        subPackageMeta: undefined,
        config: {} as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: {
          dependencies: {
            dayjs: '^1.0.0',
          },
          devDependencies: {
            'wevu': '^1.0.0',
            '@vant/weapp': '^1.11.6',
          },
        } as any,
        isDev: false,
        applyRuntimePlatform: vi.fn(),
        injectBuiltinAliases: vi.fn(),
        getDefineImportMetaEnv: () => ({}),
        setOptions: vi.fn(),
        oxcRolldownPlugin: undefined,
      },
      undefined,
    )

    const external = ((result.build as any)?.rolldownOptions?.external ?? []) as RegExp[]

    expect(external.some(pattern => pattern.test('wevu'))).toBe(true)
    expect(external.some(pattern => pattern.test('wevu/router'))).toBe(true)
    expect(external.some(pattern => pattern.test('/project/node_modules/wevu/dist/index.mjs'))).toBe(true)
    expect(external.some(pattern => pattern.test('/project/node_modules/wevu/dist/router.mjs'))).toBe(true)
    expect(external.some(pattern => pattern.test('@vant/weapp'))).toBe(false)
    expect(external.some(pattern => pattern.test('/project/node_modules/@vant/weapp/dist/index.js'))).toBe(false)
  })

  it('does not externalize ordinary dependencies in explicit mode when they are not npm build candidates', () => {
    resolveBuiltinPackageAliasesMock.mockReturnValue([
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/index.mjs',
      },
    ])

    const result = mergeMiniprogram(
      {
        ctx: {
          configService: {
            cwd: '/project',
            weappViteConfig: {},
          },
        } as any,
        subPackageMeta: undefined,
        config: {} as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: {
          dependencies: {
            wevu: '^1.0.0',
          },
          devDependencies: {
            dayjs: '^1.0.0',
          },
        } as any,
        isDev: false,
        applyRuntimePlatform: vi.fn(),
        injectBuiltinAliases: vi.fn(),
        getDefineImportMetaEnv: () => ({}),
        setOptions: vi.fn(),
        oxcRolldownPlugin: undefined,
      },
      undefined,
    )

    expect(((result.build as any)?.rolldownOptions?.external ?? [])).toEqual([])
  })

  it('externalizes root dependencies in legacy mode', () => {
    resolveBuiltinPackageAliasesMock.mockReturnValue([
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/index.mjs',
      },
    ])

    const result = mergeMiniprogram(
      {
        ctx: {
          configService: {
            cwd: '/project',
            weappViteConfig: {
              npm: {
                strategy: 'legacy',
              },
            },
          },
        } as any,
        subPackageMeta: undefined,
        config: {} as any,
        cwd: '/project',
        srcRoot: 'src',
        packageJson: {
          dependencies: {
            wevu: '^1.0.0',
          },
        } as any,
        isDev: false,
        applyRuntimePlatform: vi.fn(),
        injectBuiltinAliases: vi.fn(),
        getDefineImportMetaEnv: () => ({}),
        setOptions: vi.fn(),
        oxcRolldownPlugin: undefined,
      },
      undefined,
    )

    const external = ((result.build as any)?.rolldownOptions?.external ?? []) as RegExp[]
    expect(external.some(pattern => pattern.test('wevu'))).toBe(true)
    expect(external.some(pattern => pattern.test('/project/node_modules/wevu/dist/index.mjs'))).toBe(true)
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
