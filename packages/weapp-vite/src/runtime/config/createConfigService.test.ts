import fs from 'node:fs'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupportedMiniProgramPlatforms } from '../../platform'
import { createConfigService } from './createConfigService'

const ALL_MP_PLATFORMS = [...getSupportedMiniProgramPlatforms()]

const {
  configureLoggerMock,
  loggerInfoMock,
  detectMock,
  loadConfigImplMock,
  mergeWorkersMock,
  mergeMock,
  mergeWebMock,
  mergeInlineConfigMock,
} = vi.hoisted(() => ({
  configureLoggerMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  detectMock: vi.fn(),
  loadConfigImplMock: vi.fn(),
  mergeWorkersMock: vi.fn(),
  mergeMock: vi.fn(),
  mergeWebMock: vi.fn(),
  mergeInlineConfigMock: vi.fn(),
}))

vi.mock('../../logger', () => ({
  default: {
    info: loggerInfoMock,
  },
  configureLogger: configureLoggerMock,
}))

vi.mock('local-pkg', () => ({
  getPackageInfoSync: vi.fn(() => ({
    name: 'weapp-vite',
    version: '0.0.0-test',
  })),
}))

vi.mock('package-manager-detector/detect', () => ({
  detect: detectMock,
}))

vi.mock('../packageAliases', () => ({
  resolveBuiltinPackageAliases: vi.fn(() => ({})),
}))

vi.mock('../oxcRuntime', () => ({
  createOxcRuntimeSupport: vi.fn(() => ({
    alias: {},
    rolldownPlugin: { name: 'mock-rolldown-plugin' },
    vitePlugin: { name: 'mock-vite-plugin' },
  })),
}))

vi.mock('./internal/alias', () => ({
  createAliasManager: vi.fn(() => ({
    injectBuiltinAliases: vi.fn((entries: any[]) => entries),
  })),
}))

vi.mock('./internal/loadConfig', () => ({
  createLoadConfig: vi.fn(() => loadConfigImplMock),
}))

vi.mock('./internal/merge', () => ({
  createMergeFactories: vi.fn((args: any) => {
    mergeWebMock.mockImplementation(() => {
      args.applyRuntimePlatform('web')
    })
    return {
      mergeWorkers: mergeWorkersMock,
      merge: mergeMock,
      mergeWeb: mergeWebMock,
      mergeInlineConfig: mergeInlineConfigMock,
    }
  }),
}))

function createBaseOptions(overrides: Record<string, any> = {}) {
  return {
    cwd: '/project',
    isDev: false,
    mode: 'development',
    mpDistRoot: 'dist',
    srcRoot: 'src',
    currentSubPackageRoot: undefined,
    config: {
      weapp: {},
    },
    packageJson: {},
    projectConfig: {},
    projectConfigPath: '/project/project.config.json',
    projectPrivateConfigPath: '/project/project.private.config.json',
    platform: 'weapp',
    multiPlatform: {
      enabled: false,
      projectConfigRoot: 'config',
      targets: ALL_MP_PLATFORMS,
    },
    configFilePath: '/project/weapp-vite.config.ts',
    weappWeb: undefined,
    weappLib: undefined,
    weappLibOutputMap: undefined,
    outputExtensions: {
      script: '.js',
      style: '.wxss',
      template: '.wxml',
      config: '.json',
      wxs: '.wxs',
    },
    aliasEntries: [],
    relativeSrcRoot: (p: string) => path.relative('/project/src', p) || '.',
    ...overrides,
  }
}

function createCtx(optionsOverrides: Record<string, any> = {}) {
  const options = createBaseOptions(optionsOverrides)
  return {
    runtimeState: {
      config: {
        packageInfo: {} as any,
        defineEnv: {},
        importMetaEnvDefineOverride: undefined,
        packageManager: {
          agent: 'npm',
          name: 'npm',
        },
        options,
      },
    },
  } as any
}

describe('createConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    detectMock.mockResolvedValue({
      agent: 'pnpm',
      name: 'pnpm',
    })
    loadConfigImplMock.mockResolvedValue({
      cwd: '/work',
      isDev: true,
      mode: 'production',
      config: {
        weapp: {
          logger: 'silent',
          pluginRoot: 'src/plugin',
        },
      },
      packageJson: {
        name: 'demo',
      },
      projectConfig: {
        pluginRoot: 'dist/plugin-output',
      },
      srcRoot: 'src',
      platform: 'weapp',
      mpDistRoot: 'dist',
      outputExtensions: {
        script: '.js',
      },
      configMergeInfo: {
        merged: false,
      },
      aliasEntries: [],
      relativeSrcRoot: (p: string) => path.relative('/work/src', p) || '.',
    })
  })

  it('loads config, updates package manager and emits define env map', async () => {
    const service = createConfigService(createCtx())
    const loaded = await service.load({
      cwd: '/work',
      mode: 'production',
      isDev: true,
    })

    expect(loadConfigImplMock).toHaveBeenCalledWith({
      cwd: '/work',
      emitDefaultAutoImportOutputs: true,
      isDev: true,
      mode: 'production',
    })
    expect(configureLoggerMock).toHaveBeenCalledWith('silent')
    expect(service.packageManager).toEqual({
      agent: 'pnpm',
      name: 'pnpm',
    })
    expect(loaded.weappWeb).toBeUndefined()
    expect(loaded.currentSubPackageRoot).toBeUndefined()
    expect(loggerInfoMock).not.toHaveBeenCalled()

    service.setDefineEnv('CUSTOM_FLAG', 1)
    const importMetaDefineEntries = service.importMetaDefineEntries
    const define = service.defineImportMetaEnv
    expect(importMetaDefineEntries).toEqual(define)
    expect(define['import.meta.env.PLATFORM']).toBe(JSON.stringify('weapp'))
    expect(define['import.meta.env.MP_PLATFORM']).toBe(JSON.stringify('weapp'))
    expect(define['import.meta.env.CUSTOM_FLAG']).toBe('1')
    expect(define['import.meta.env']).toMatch(/^JSON\.parse\(/)
    const serializedEnv = define['import.meta.env'].slice('JSON.parse('.length, -1)
    expect(JSON.parse(JSON.parse(serializedEnv)).CUSTOM_FLAG).toBe(1)
  })

  it('preserves user-defined import.meta.env member overrides for downstream preprocessors', () => {
    const service = createConfigService(createCtx({
      config: {
        define: {
          'import.meta.env.ISSUE_484_FLAG': '123456',
        },
        weapp: {},
      },
    }))

    const define = service.defineImportMetaEnv

    expect(service.importMetaDefineEntries).toEqual(define)
    expect(define['import.meta.env.ISSUE_484_FLAG']).toBe('123456')
    const serializedEnv = define['import.meta.env'].slice('JSON.parse('.length, -1)
    expect(JSON.parse(JSON.parse(serializedEnv)).ISSUE_484_FLAG).toBeUndefined()
    expect(service.importMetaDefineRegistry.envMemberAccess.ISSUE_484_FLAG).toBe(123456)
    expect(service.importMetaDefineRegistry.envObject.ISSUE_484_FLAG).toBeUndefined()
  })

  it('resolves plugin roots and remaps output path for plugin sources', () => {
    const service = createConfigService(createCtx({
      config: {
        weapp: {
          pluginRoot: 'src/plugin',
        },
      },
      projectConfig: {
        pluginRoot: 'dist/plugin-dist',
      },
    }))

    expect(service.absolutePluginRoot).toBe('/project/src/plugin')
    expect(service.absolutePluginOutputRoot).toBe('/project/dist/plugin-dist')
    expect(service.relativeAbsoluteSrcRoot('/project/src/plugin/pages/home/index.ts')).toBe('plugin/pages/home/index.ts')
    expect(service.relativeOutputPath('/project/src/plugin/pages/home/index.ts')).toBe('plugin-dist/pages/home/index.ts')
  })

  it('applies lib output mapping and handles plugin output fallback to source base', () => {
    const libMap = new Map<string, string>([
      ['plugin/pages/home/index', 'mapped/pages/home/index'],
    ])
    const service = createConfigService(createCtx({
      config: {
        weapp: {
          pluginRoot: 'src/plugin',
        },
      },
      projectConfig: {
        pluginRoot: 'dist',
      },
      weappLibOutputMap: libMap,
    }))

    expect(service.absolutePluginOutputRoot).toBe('/project/dist')
    expect(service.relativeOutputPath('/project/src/plugin/pages/home/index.ts')).toBe('mapped/pages/home/index.ts')
    expect(service.relativeOutputPath('/project/src/plugin/components/card.js')).toBe('plugin/components/card.js')
  })

  it('falls back to plugin source base when plugin output root is outside outDir', () => {
    const service = createConfigService(createCtx({
      config: {
        weapp: {
          pluginRoot: 'plugin',
        },
      },
      projectConfig: {
        pluginRoot: 'dist-plugin',
      },
      srcRoot: 'miniprogram',
      relativeSrcRoot: (p: string) => path.relative('/project/miniprogram', p) || '.',
    }))

    expect(service.absolutePluginRoot).toBe('/project/plugin')
    expect(service.absolutePluginOutputRoot).toBe('/project/dist-plugin')
    expect(service.relativeAbsoluteSrcRoot('/project/plugin/components/card.ts')).toBe('plugin/components/card.ts')
    expect(service.relativeOutputPath('/project/plugin/components/card.ts')).toBe('plugin/components/card.ts')
  })

  it('falls back to cwd-relative path when file is outside src and plugin root', () => {
    const service = createConfigService(createCtx({
      config: {
        weapp: {
          pluginRoot: 'src/plugin',
        },
      },
    }))

    expect(service.relativeAbsoluteSrcRoot('/project/src/pages/index.ts')).toBe('pages/index.ts')
    expect(service.relativeAbsoluteSrcRoot('/project/other/file.ts')).toBe('other/file.ts')
  })

  it('normalizes symlinked temp paths before computing src-relative output names', () => {
    const nativeSpy = vi.spyOn(fs.realpathSync, 'native').mockImplementation((input: fs.PathLike) => {
      const next = String(input)
      if (input === '/var/folders/demo/project/src') {
        return '/private/var/folders/demo/project/src'
      }
      if (input === '/var/folders/demo/project') {
        return '/private/var/folders/demo/project'
      }
      return next
    })

    const service = createConfigService(createCtx({
      cwd: '/var/folders/demo/project',
      srcRoot: 'src',
      relativeSrcRoot: (p: string) => path.relative('/var/folders/demo/project/src', p) || '.',
    }))

    expect(service.relativeAbsoluteSrcRoot('/private/var/folders/demo/project/src/app.vue')).toBe('app.vue')
    expect(service.relativeAbsoluteSrcRoot('/private/var/folders/demo/project/src/app.json')).toBe('app.json')

    nativeSpy.mockRestore()
  })

  it('switches define env to web runtime via mergeWeb factory hook', () => {
    const service = createConfigService(createCtx())
    service.mergeWeb()

    const define = service.defineImportMetaEnv
    expect(define['import.meta.env.PLATFORM']).toBe(JSON.stringify('web'))
    expect(define['import.meta.env.MP_PLATFORM']).toBe(JSON.stringify('web'))
    expect(define['import.meta.env.IS_WEB']).toBe('true')
    expect(define['import.meta.env.IS_MINIPROGRAM']).toBe('false')
  })

  it('falls back to npm package manager and exposes core getters/setters', async () => {
    detectMock.mockResolvedValue(undefined)
    const service = createConfigService(createCtx({
      aliasEntries: [{ find: '@', replacement: '/project/src' }],
      weappWeb: { enabled: true },
      weappLib: { enabled: true },
      weappLibOutputMap: new Map<string, string>([['pages/index/index', 'lib/pages/index/index']]),
    }))

    await service.load({
      cwd: '/work',
    })

    expect(service.packageManager).toEqual({
      agent: 'npm',
      name: 'npm',
    })

    service.outputExtensions = {
      script: '.mjs',
    } as any
    expect(service.outputExtensions).toEqual({
      script: '.mjs',
    })

    expect(service.absoluteSrcRoot).toBe('/work/src')
    expect(service.mode).toBe('production')
    expect(service.aliasEntries).toEqual([])
    expect(service.platform).toBe('weapp')
    expect(service.configFilePath).toBeUndefined()
    expect(service.weappWebConfig).toBeUndefined()
    expect(service.weappLibConfig).toBeUndefined()
    expect(service.weappLibOutputMap).toBeUndefined()
    expect(service.relativeCwd('/work/src/pages/index.ts')).toBe('src/pages/index.ts')
    expect(service.relativeSrcRoot('/work/src/pages/index.ts')).toBe('pages/index.ts')
  })

  it('returns empty relative output when relativeAbsoluteSrcRoot is empty', () => {
    const service = createConfigService(createCtx())
    const withEmptyRelative = {
      ...service,
      relativeAbsoluteSrcRoot: () => '',
    } as typeof service

    expect(service.relativeOutputPath.call(withEmptyRelative, '/project/src/app.ts')).toBe('')
  })

  it('logs merged config priority when vite.config.ts and weapp-vite.config.ts both exist', async () => {
    loadConfigImplMock.mockResolvedValueOnce({
      cwd: '/work',
      isDev: true,
      mode: 'production',
      config: {
        weapp: {
          logger: 'silent',
        },
      },
      packageJson: {
        name: 'demo',
      },
      projectConfig: {},
      srcRoot: 'src',
      platform: 'weapp',
      mpDistRoot: 'dist',
      outputExtensions: {
        script: '.js',
      },
      configFilePath: '/work/weapp-vite.config.ts',
      configMergeInfo: {
        merged: true,
        viteConfigPath: '/work/vite.config.ts',
        weappConfigPath: '/work/weapp-vite.config.ts',
      },
      aliasEntries: [],
      relativeSrcRoot: (p: string) => path.relative('/work/src', p) || '.',
    })

    const service = createConfigService(createCtx())
    await service.load({
      cwd: '/work',
      mode: 'production',
      isDev: true,
    })

    expect(loggerInfoMock).toHaveBeenCalledWith('[config] 检测到同时存在 weapp-vite.config.ts 与 vite.config.ts，已合并两份 Vite 配置，优先级：weapp-vite.config.ts > vite.config.ts')
  })
})
