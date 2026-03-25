import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLoadConfig } from './loadConfig'

const loadConfigFromFileMock = vi.hoisted(() => vi.fn())
const tsconfigPathsMock = vi.hoisted(() => vi.fn((options?: Record<string, unknown>) => ({ name: 'tsconfig-paths', options })))
const getOutputExtensionsMock = vi.hoisted(() => vi.fn(() => ({ json: 'json' })))
const getWeappViteConfigMock = vi.hoisted(() => vi.fn(() => ({})))
const normalizeMiniPlatformMock = vi.hoisted(() => vi.fn((value?: string) => value))
const resolveWeappConfigFileMock = vi.hoisted(() => vi.fn(async () => undefined))
const createCjsConfigLoadErrorMock = vi.hoisted(() => vi.fn(() => null))
const getAliasEntriesMock = vi.hoisted(() => vi.fn(() => []))
const getProjectConfigMock = vi.hoisted(() => vi.fn(async () => ({ miniprogramRoot: 'dist' })))
const getProjectConfigFileNameMock = vi.hoisted(() => vi.fn(() => 'project.config.json'))
const getProjectPrivateConfigFileNameMock = vi.hoisted(() => vi.fn(() => 'project.private.config.json'))
const resolveProjectConfigRootMock = vi.hoisted(() => vi.fn(() => 'dist'))
const getProjectConfigRootKeysMock = vi.hoisted(() => vi.fn(() => ['miniprogramRoot']))
const hasLibEntryMock = vi.hoisted(() => vi.fn(() => false))
const resolveWeappLibConfigMock = vi.hoisted(() => vi.fn(() => undefined))
const createLibEntryFileNameResolverMock = vi.hoisted(() => vi.fn(() => undefined))
const hasDeprecatedEnhanceUsageMock = vi.hoisted(() => vi.fn(() => false))
const migrateEnhanceOptionsMock = vi.hoisted(() => vi.fn())
const createLegacyEs5PluginMock = vi.hoisted(() => vi.fn(() => ({ name: 'weapp-runtime:swc-es5-transform' })))
const sanitizeBuildTargetMock = vi.hoisted(() => vi.fn(() => ({ hasTarget: false, sanitized: undefined })))
const getDefaultBuildTargetMock = vi.hoisted(() => vi.fn(() => undefined))
const isNonConcreteBuildTargetMock = vi.hoisted(() => vi.fn(() => false))
const resolveWeappWebConfigMock = vi.hoisted(() => vi.fn(() => ({ enabled: false })))
const loggerWarnMock = vi.hoisted(() => vi.fn())

vi.mock('vite', () => ({
  loadConfigFromFile: loadConfigFromFileMock,
}))

vi.mock('vite-tsconfig-paths', () => ({
  default: tsconfigPathsMock,
}))

vi.mock('../../../defaults', () => ({
  getOutputExtensions: getOutputExtensionsMock,
  getWeappViteConfig: getWeappViteConfigMock,
}))

vi.mock('../../../logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

vi.mock('../../../platform', () => ({
  DEFAULT_MP_PLATFORM: 'weapp',
  normalizeMiniPlatform: normalizeMiniPlatformMock,
}))

vi.mock('../../../utils', () => ({
  createCjsConfigLoadError: createCjsConfigLoadErrorMock,
  getAliasEntries: getAliasEntriesMock,
  getProjectConfig: getProjectConfigMock,
  getProjectConfigFileName: getProjectConfigFileNameMock,
  getProjectConfigRootKeys: getProjectConfigRootKeysMock,
  getProjectPrivateConfigFileName: getProjectPrivateConfigFileNameMock,
  resolveProjectConfigRoot: resolveProjectConfigRootMock,
  resolveWeappConfigFile: resolveWeappConfigFileMock,
}))

vi.mock('../../lib', () => ({
  createLibEntryFileNameResolver: createLibEntryFileNameResolverMock,
  hasLibEntry: hasLibEntryMock,
  resolveWeappLibConfig: resolveWeappLibConfigMock,
}))

vi.mock('../enhance', () => ({
  hasDeprecatedEnhanceUsage: hasDeprecatedEnhanceUsageMock,
  migrateEnhanceOptions: migrateEnhanceOptionsMock,
}))

vi.mock('../legacyEs5', () => ({
  createLegacyEs5Plugin: createLegacyEs5PluginMock,
}))

vi.mock('../targets', () => ({
  getDefaultBuildTarget: getDefaultBuildTargetMock,
  isNonConcreteBuildTarget: isNonConcreteBuildTargetMock,
  sanitizeBuildTarget: sanitizeBuildTargetMock,
}))

vi.mock('../web', () => ({
  resolveWeappWebConfig: resolveWeappWebConfigMock,
}))

function createFactory() {
  return createLoadConfig({
    injectBuiltinAliases: vi.fn(),
    oxcRolldownPlugin: { name: 'oxc-rolldown' } as any,
    oxcVitePlugin: { name: 'oxc-vite' } as any,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  loadConfigFromFileMock.mockResolvedValue({
    config: {},
    path: '/project/vite.config.ts',
  })
})

describe('runtime config internal loadConfig', () => {
  it('wraps cjs config load errors', async () => {
    const wrapped = new Error('cjs wrapped')
    loadConfigFromFileMock.mockRejectedValueOnce(new Error('boom'))
    createCjsConfigLoadErrorMock.mockReturnValueOnce(wrapped)

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: undefined,
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('cjs wrapped')
  })

  it('rethrows original error when cjs wrapper is unavailable', async () => {
    loadConfigFromFileMock.mockRejectedValueOnce(new Error('raw boom'))
    createCjsConfigLoadErrorMock.mockReturnValueOnce(null)

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: undefined,
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('raw boom')
  })

  it('throws when weapp.lib is configured without a valid entry', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          lib: {},
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('未提供有效的 entry')
  })

  it('throws when multiPlatform is enabled but cli platform is not provided', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          multiPlatform: true,
        },
      },
      path: '/project/vite.config.ts',
    })
    normalizeMiniPlatformMock.mockReturnValueOnce(undefined)

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: undefined,
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('请通过 --platform 指定目标小程序平台')
  })

  it('resolves project config paths and injects rolldown/vite plugins on success path', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        build: {
          rolldownOptions: {},
        },
        weapp: {
          platform: 'weapp',
          multiPlatform: {
            enabled: true,
            projectConfigRoot: 'config',
          },
          tsconfigPaths: {
            projects: ['tsconfig.json'],
          },
          jsFormat: 'cjs',
          es5: true,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)
    const injectBuiltinAliases = vi.fn()
    const oxcRolldownPlugin = { name: 'oxc-rolldown' } as any
    const oxcVitePlugin = { name: 'oxc-vite' } as any
    const loadConfig = createLoadConfig({
      injectBuiltinAliases,
      oxcRolldownPlugin,
      oxcVitePlugin,
    })

    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
      projectConfigPath: undefined,
    } as any)

    expect(result.platform).toBe('weapp')
    expect(result.mpDistRoot).toBe('dist/weapp/dist')
    expect(result.config.build?.target).toBe('es2015')
    const rolldownPlugins = result.config.build?.rolldownOptions?.plugins as any[]
    expect(rolldownPlugins[0]).toBe(oxcRolldownPlugin)
    expect(rolldownPlugins.some(plugin => plugin?.name === 'weapp-runtime:swc-es5-transform')).toBe(true)
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('`weapp.es5` / `@swc/core` 降级方案已废弃'))
    expect(result.config.plugins?.[0]).toBe(oxcVitePlugin)
    expect(result.config.plugins?.some((plugin: any) => plugin?.name === 'tsconfig-paths')).toBe(true)
    expect(result.config.build?.outDir).toBe('dist/weapp/dist')
    expect(result.relativeSrcRoot('/project/src/pages/index.ts')).toBe('/project/src/pages/index.ts')
    expect(injectBuiltinAliases).toHaveBeenCalledTimes(1)
    expect(getProjectConfigMock).toHaveBeenCalledWith('/project', {
      basePath: 'config/weapp/project.config.json',
      privatePath: 'config/weapp/project.private.config.json',
    })
  })

  it('enables native resolve.tsconfigPaths by default without advanced options', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
          srcRoot: 'src',
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(result.config.resolve?.tsconfigPaths).toBe(true)
    expect(result.config.resolve?.alias).toEqual(expect.arrayContaining([
      expect.objectContaining({
        find: '@',
        replacement: '/project/src',
      }),
    ]))
    expect(result.config.plugins?.some((plugin: any) => plugin?.name === 'tsconfig-paths')).toBe(false)
    expect(tsconfigPathsMock).not.toHaveBeenCalled()
  })

  it('does not override user-defined @ alias', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        resolve: {
          alias: {
            '@': '/project/custom-src',
          },
        },
        weapp: {
          platform: 'weapp',
          srcRoot: 'src',
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(result.config.resolve?.alias).toEqual(expect.arrayContaining([
      expect.objectContaining({
        find: '@',
        replacement: '/project/custom-src',
      }),
    ]))
  })

  it('enables native resolve.tsconfigPaths when weapp.tsconfigPaths is true', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
          tsconfigPaths: true,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(result.config.resolve?.tsconfigPaths).toBe(true)
    expect(result.config.plugins?.some((plugin: any) => plugin?.name === 'tsconfig-paths')).toBe(false)
    expect(tsconfigPathsMock).not.toHaveBeenCalled()
  })

  it('throws when es5 is enabled but jsFormat is not cjs', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          jsFormat: 'esm',
          es5: true,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('`weapp.es5` 仅支持在 `weapp.jsFormat` 为 "cjs" 时使用')
  })

  it('throws when project config root is missing in non-lib runtime', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)
    resolveProjectConfigRootMock.mockReturnValueOnce('')
    getProjectConfigRootKeysMock.mockReturnValueOnce(['miniprogramRoot', 'compileType'])

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('请在 project.config.json 里设置 miniprogramRoot 或 compileType')
  })

  it('throws when multiPlatform is enabled and --project-config is passed', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
          multiPlatform: {
            enabled: true,
            projectConfigRoot: 'config',
          },
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
      projectConfigPath: 'project.config.json',
    } as any)).rejects.toThrow('已开启 weapp.multiPlatform，--project-config 不再支持')
  })

  it('reuses loaded config when resolved weapp config path equals loaded path', async () => {
    resolveWeappConfigFileMock.mockResolvedValueOnce('/project/vite.config.ts')
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)
    resolveProjectConfigRootMock.mockReturnValueOnce('dist')

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(loadConfigFromFileMock).toHaveBeenCalledTimes(1)
    expect(result.configFilePath).toBe('/project/vite.config.ts')
  })

  it('wraps cjs errors from weapp-specific config loading', async () => {
    resolveWeappConfigFileMock.mockResolvedValueOnce('/project/weapp-vite.config.ts')
    loadConfigFromFileMock
      .mockResolvedValueOnce({
        config: {
          weapp: {
            platform: 'weapp',
          },
        },
        path: '/project/vite.config.ts',
      })
      .mockRejectedValueOnce(new Error('weapp config boom'))
    createCjsConfigLoadErrorMock.mockReturnValueOnce(new Error('weapp wrapped'))

    const loadConfig = createFactory()

    await expect(loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)).rejects.toThrow('weapp wrapped')
  })

  it('uses explicit project config path when multiPlatform is disabled', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
          multiPlatform: false,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)
    resolveProjectConfigRootMock.mockReturnValueOnce('dist')

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
      projectConfigPath: 'foo/custom.project.config.json',
    } as any)

    expect(getProjectConfigMock).toHaveBeenCalledWith('/project', {
      basePath: 'foo/custom.project.config.json',
      privatePath: 'foo/project.private.config.weapp.json',
    })
    expect(result.projectConfigPath).toBe('/project/foo/custom.project.config.json')
    expect(result.projectPrivateConfigPath).toBe('/project/foo/project.private.config.weapp.json')
  })

  it('keeps default rolldown entryFileNames pattern on success path', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          platform: 'weapp',
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)
    resolveProjectConfigRootMock.mockReturnValueOnce('dist')

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    const entryFileNames = result.config.build?.rolldownOptions?.output?.entryFileNames as (chunk: { name: string }) => string
    expect(entryFileNames({ name: 'pages/index/index' })).toBe('pages/index/index.js')
  })

  it('skips project config loading in lib mode and keeps existing swc plugin', async () => {
    const existingSwcPlugin = { name: 'weapp-runtime:swc-es5-transform' }
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        build: {
          rolldownOptions: {
            output: [{}, {}],
            plugins: [existingSwcPlugin],
          },
        },
        weapp: {
          platform: 'weapp',
          jsFormat: 'cjs',
          es5: true,
          lib: {
            entry: 'index.ts',
            root: '/project/lib-src',
          },
          tsconfigPaths: false,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(true)
    resolveWeappLibConfigMock.mockReturnValueOnce({
      enabled: true,
      outDir: 'dist-lib',
      root: '/project/lib-src',
      entry: 'index.ts',
    })

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    const outputs = result.config.build?.rolldownOptions?.output as Array<{ format?: string }>
    expect(outputs.every(output => output.format === 'cjs')).toBe(true)
    expect(result.mpDistRoot).toBe('dist-lib')
    expect(result.projectConfigPath).toBeUndefined()
    expect(result.projectPrivateConfigPath).toBeUndefined()
    expect(getProjectConfigMock).not.toHaveBeenCalled()
    expect(createLegacyEs5PluginMock).not.toHaveBeenCalled()
    expect(result.config.plugins?.some((plugin: any) => plugin?.name === 'tsconfig-paths')).toBe(false)
    expect(result.relativeSrcRoot('/project/lib-src/components/button/index.ts')).toBe('components/button/index.ts')
  })

  it('applies lib entry file name resolver on object output and falls back to dist outDir', async () => {
    const entryFileNames = vi.fn((chunk: { name: string }) => `lib/${chunk.name}.js`)
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        build: {
          rolldownOptions: {},
        },
        weapp: {
          platform: 'weapp',
          jsFormat: 'cjs',
          lib: {
            entry: 'index.ts',
            root: '/project/lib-src',
          },
          tsconfigPaths: false,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(true)
    resolveWeappLibConfigMock.mockReturnValueOnce({
      enabled: true,
      root: '/project/lib-src',
      entry: 'index.ts',
    })
    createLibEntryFileNameResolverMock.mockReturnValueOnce(entryFileNames)

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(result.config.build?.outDir).toBe('dist')
    const output = result.config.build?.rolldownOptions?.output as { entryFileNames?: typeof entryFileNames, format?: string }
    expect(output.format).toBe('cjs')
    expect(output.entryFileNames).toBe(entryFileNames)
    expect(result.mpDistRoot).toBe('dist')
    expect(getProjectConfigMock).not.toHaveBeenCalled()
  })

  it('preserves plugin entry exports in pluginOnly mode', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        build: {
          rolldownOptions: {},
        },
        weapp: {
          platform: 'weapp',
          pluginRoot: 'plugin',
          tsconfigPaths: false,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {
        build: {
          outDir: 'dist-plugin',
        },
      },
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
      pluginOnly: true,
    } as any)

    expect(result.config.build?.rolldownOptions?.preserveEntrySignatures).toBe('exports-only')
    expect(result.mpDistRoot).toBe('dist-plugin')
  })

  it('removes rollupOptions and applies lib entryFileNames on array outputs', async () => {
    const entryFileNames = vi.fn((chunk: { name: string }) => `lib/${chunk.name}.js`)
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        build: {
          rollupOptions: {
            output: {
              format: 'esm',
            },
          },
          rolldownOptions: {
            output: [{}, {}],
          },
        },
        weapp: {
          platform: 'weapp',
          jsFormat: 'cjs',
          lib: {
            entry: 'index.ts',
            root: '/project/lib-src',
          },
          tsconfigPaths: false,
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(true)
    resolveWeappLibConfigMock.mockReturnValueOnce({
      enabled: true,
      outDir: 'dist-lib',
      root: '/project/lib-src',
      entry: 'index.ts',
    })
    createLibEntryFileNameResolverMock.mockReturnValueOnce(entryFileNames)
    getDefaultBuildTargetMock.mockReturnValueOnce('es2021')

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(result.config.build?.rollupOptions).toBeUndefined()
    expect(result.config.build?.target).toBe('es2021')
    const outputs = result.config.build?.rolldownOptions?.output as Array<{ entryFileNames?: typeof entryFileNames }>
    expect(outputs.every(output => output.entryFileNames === entryFileNames)).toBe(true)
  })

  it('uses default target for non-concrete build target', async () => {
    loadConfigFromFileMock.mockResolvedValueOnce({
      config: {
        build: {
          target: 'esnext',
        },
        weapp: {
          platform: 'weapp',
        },
      },
      path: '/project/vite.config.ts',
    })
    hasLibEntryMock.mockReturnValueOnce(false)
    sanitizeBuildTargetMock.mockReturnValueOnce({
      hasTarget: true,
      sanitized: 'esnext',
    })
    getDefaultBuildTargetMock.mockReturnValueOnce('es2020')
    isNonConcreteBuildTargetMock.mockReturnValueOnce(true)
    resolveProjectConfigRootMock.mockReturnValueOnce('dist')

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(result.config.build?.target).toBe('es2020')
  })

  it('loads weapp-specific config file and keeps target from sanitize result', async () => {
    resolveWeappConfigFileMock.mockResolvedValueOnce('/project/weapp-vite.config.ts')
    loadConfigFromFileMock
      .mockResolvedValueOnce({
        config: {
          build: {
            target: 'esnext',
          },
          weapp: {
            platform: 'weapp',
          },
        },
        path: '/project/vite.config.ts',
      })
      .mockResolvedValueOnce({
        config: {
          weapp: {
            platform: 'weapp',
            chunks: {
              duplicateWarningBytes: 1,
            },
          },
        },
        path: '/project/weapp-vite.config.ts',
      })
    hasLibEntryMock.mockReturnValueOnce(false)
    sanitizeBuildTargetMock.mockReturnValueOnce({
      hasTarget: true,
      sanitized: 'es2020',
    })
    isNonConcreteBuildTargetMock.mockReturnValueOnce(false)
    resolveProjectConfigRootMock.mockReturnValueOnce('dist')

    const loadConfig = createFactory()
    const result = await loadConfig({
      cwd: '/project',
      isDev: false,
      mode: 'production',
      inlineConfig: {},
      cliPlatform: 'weapp',
      configFile: '/project/vite.config.ts',
    } as any)

    expect(loadConfigFromFileMock).toHaveBeenCalledTimes(2)
    expect(result.configFilePath).toBe('/project/weapp-vite.config.ts')
    expect(result.chunksConfigured).toBe(true)
    expect(result.config.build?.target).toBe('es2020')
  })
})
