import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMergeFactories } from './index'

const backendGetMock = vi.hoisted(() => vi.fn())
const createSharedBuildOutputMock = vi.hoisted(() => vi.fn(() => ({ chunkFileNames: 'shared.js' })))
const ensureConfigServiceMock = vi.hoisted(() => vi.fn())
const mergeInlineConfigMock = vi.hoisted(() => vi.fn(() => ({ inline: true })))
const mergeMiniprogramMock = vi.hoisted(() => vi.fn(() => ({ runtime: 'miniprogram' })))
const mergeWebMock = vi.hoisted(() => vi.fn(() => ({ runtime: 'web' })))
const mergeWorkersMock = vi.hoisted(() => vi.fn(() => ({ runtime: 'workers' })))

vi.mock('../../../../backends', () => ({
  platformBackendRegistry: {
    get: backendGetMock,
  },
}))

vi.mock('../../../sharedBuildConfig', () => ({
  createSharedBuildOutput: createSharedBuildOutputMock,
}))

vi.mock('./inline', () => ({
  ensureConfigService: ensureConfigServiceMock,
  mergeInlineConfig: mergeInlineConfigMock,
}))

vi.mock('./miniprogram', () => ({ mergeMiniprogram: mergeMiniprogramMock }))
vi.mock('./web', () => ({ mergeWeb: mergeWebMock }))
vi.mock('./workers', () => ({ mergeWorkers: mergeWorkersMock }))

function createHarness(chunksConfigured = false) {
  let currentOptions = {
    config: { root: '/project' },
    configFileDependencies: ['/project/vite.config.ts'],
    cwd: '/project',
    isDev: true,
    mode: 'development',
    mpDistRoot: '/project/dist/mp',
    packageJson: { name: 'demo' },
    srcRoot: '/project/src',
    weappWeb: { enabled: true },
  } as any
  const ctx = {
    configService: {
      options: { chunksConfigured },
      weappViteConfig: {
        autoImportComponents: {
          resolvers: ['resolver'],
        },
        subPackages: {
          goods: {},
        },
        uniApp: { include: ['demo-ui'] },
      },
    },
    scanService: {
      loadAppEntry: vi.fn(async () => ({
        json: { pages: ['pages/index/index', 'pages/detail/index'] },
      })),
    },
  } as any
  const setOptions = vi.fn((next: any) => {
    currentOptions = next
  })
  const factories = createMergeFactories({
    applyRuntimePlatform: vi.fn(),
    ctx,
    getDefineImportMetaEnv: () => ({ runtime: 'web' }),
    getOptions: () => currentOptions,
    injectBuiltinAliases: vi.fn(),
    oxcRolldownPlugin: { name: 'oxc' } as any,
    setOptions,
  })
  return { ctx, factories, getOptions: () => currentOptions, setOptions }
}

function createBackend() {
  return {
    driver: {
      mergeConfig(context: { merge: (...configs: any[]) => any }, ...configs: any[]) {
        return context.merge(...configs)
      },
    },
  }
}

describe('runtime config merge factories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    backendGetMock.mockReturnValue(createBackend())
  })

  it('merges workers with and without shared chunk output', () => {
    const plain = createHarness(false)
    expect(plain.factories.mergeWorkers({ mode: 'plain' } as any)).toEqual({ runtime: 'workers' })
    expect(mergeWorkersMock).toHaveBeenLastCalledWith(expect.any(Object), {}, { mode: 'plain' })

    const shared = createHarness(true)
    expect(shared.factories.mergeWorkers({ mode: 'shared' } as any)).toEqual({ runtime: 'workers' })
    expect(createSharedBuildOutputMock).toHaveBeenCalledWith(
      shared.ctx.configService,
      expect.any(Function),
    )
    const lastSharedOutputCall = createSharedBuildOutputMock.mock.calls[createSharedBuildOutputMock.mock.calls.length - 1]
    expect(lastSharedOutputCall?.[1]()).toEqual(['goods'])
    expect(mergeWorkersMock).toHaveBeenLastCalledWith(expect.any(Object), {
      build: { rolldownOptions: { output: { chunkFileNames: 'shared.js' } } },
    }, { mode: 'shared' })
  })

  it('merges miniprogram config and writes updated load options', () => {
    const harness = createHarness()
    mergeMiniprogramMock.mockImplementationOnce((options: any) => {
      options.setOptions({ mode: 'production' })
      return { runtime: 'miniprogram' }
    })
    expect(harness.factories.merge(undefined, { build: {} })).toEqual({ runtime: 'miniprogram' })
    expect(harness.setOptions).toHaveBeenCalled()
    expect(harness.getOptions().mode).toBe('production')

    backendGetMock.mockReturnValueOnce(undefined)
    expect(() => harness.factories.merge(undefined)).toThrow('小程序平台后端未注册')
  })

  it('merges web config with shared output, auto-import metadata and resolved app config', async () => {
    const harness = createHarness(true)
    expect(harness.factories.mergeWeb({ server: { port: 4173 } })).toEqual({ runtime: 'web' })
    expect(createSharedBuildOutputMock).toHaveBeenCalledWith(
      harness.ctx.configService,
      expect.any(Function),
      { runtime: 'web' },
    )
    const webSharedOutputCall = createSharedBuildOutputMock.mock.calls[createSharedBuildOutputMock.mock.calls.length - 1]
    expect(webSharedOutputCall?.[1]()).toEqual(['goods'])
    expect(mergeWebMock).toHaveBeenCalledWith(expect.objectContaining({
      autoImportResolvers: ['resolver'],
      uniApp: { include: ['demo-ui'] },
    }), {
      build: { rolldownOptions: { output: { chunkFileNames: 'shared.js' } } },
    }, { server: { port: 4173 } })
    const mergeOptions = mergeWebMock.mock.calls[mergeWebMock.mock.calls.length - 1]?.[0]
    await expect(mergeOptions.resolveAppConfig()).resolves.toEqual({
      pages: ['pages/index/index', 'pages/detail/index'],
    })
    expect(harness.ctx.scanService.loadAppEntry).toHaveBeenCalledTimes(1)

    backendGetMock.mockReturnValueOnce(undefined)
    expect(() => harness.factories.mergeWeb()).toThrow('Web 平台后端未注册')
  })

  it('omits optional web resolver metadata and delegates inline merging', () => {
    const harness = createHarness()
    harness.ctx.configService.weappViteConfig.autoImportComponents = true
    harness.ctx.configService.weappViteConfig.subPackages = undefined
    expect(harness.factories.mergeWorkers()).toEqual({ runtime: 'workers' })
    expect(harness.factories.mergeWeb()).toEqual({ runtime: 'web' })
    expect(mergeWebMock).toHaveBeenCalledWith(expect.objectContaining({
      autoImportResolvers: undefined,
    }), {})
    expect(harness.factories.mergeInlineConfig({ mode: 'test' })).toEqual({ inline: true })
    expect(mergeInlineConfigMock).toHaveBeenCalledWith(
      { root: '/project' },
      expect.any(Function),
      { mode: 'test' },
    )
    expect(ensureConfigServiceMock).toHaveBeenCalled()
  })
})
