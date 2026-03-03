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
const shouldEnableTsconfigPathsPluginMock = vi.hoisted(() => vi.fn(async () => false))

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

vi.mock('./tsconfigPaths', () => ({
  shouldEnableTsconfigPathsPlugin: shouldEnableTsconfigPathsPluginMock,
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
    shouldEnableTsconfigPathsPluginMock.mockResolvedValueOnce(true)

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
    expect(result.config.plugins?.[0]).toBe(oxcVitePlugin)
    expect(result.config.plugins?.some((plugin: any) => plugin?.name === 'tsconfig-paths')).toBe(true)
    expect(result.config.build?.outDir).toBe('dist/weapp/dist')
    expect(injectBuiltinAliases).toHaveBeenCalledTimes(1)
    expect(getProjectConfigMock).toHaveBeenCalledWith('/project', {
      basePath: 'config/weapp/project.config.json',
      privatePath: 'config/weapp/project.private.config.json',
    })
  })
})
