import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createImportMetaDefineRegistry } from '../../utils/importMeta'
import { createRuntimeState } from '../runtimeState'
import { createIndependentBuilder } from './independent'

const buildMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const createCompilerContextInstanceMock = vi.hoisted(() => vi.fn())
const findAutoImportCandidatesMock = vi.hoisted(() => vi.fn())
const getAutoImportConfigMock = vi.hoisted(() => vi.fn())
const createIndependentBuildErrorMock = vi.hoisted(() => vi.fn((root: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`normalized:${root}:${message}`)
}))

vi.mock('vite', () => ({
  build: buildMock,
}))

vi.mock('../../context/createCompilerContextInstance', () => ({
  createCompilerContextInstance: createCompilerContextInstanceMock,
}))

vi.mock('../../plugins/autoImport', () => ({
  findAutoImportCandidates: findAutoImportCandidatesMock,
}))

vi.mock('../autoImport/config', () => ({
  getAutoImportConfig: getAutoImportConfigMock,
}))

vi.mock('../../context/shared', () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

vi.mock('../independentError', () => ({
  createIndependentBuildError: createIndependentBuildErrorMock,
}))

function createConfigService() {
  const defineEnv: Record<string, any> = {}
  let importMetaEnvDefineOverride: Record<string, any> | undefined
  let importMetaDefineRegistry = createImportMetaDefineRegistry({
    baseEnv: defineEnv,
  })
  return {
    defineEnv,
    load: vi.fn(),
    get importMetaEnvDefineOverride() {
      return importMetaEnvDefineOverride
    },
    get importMetaDefineRegistry() {
      return importMetaDefineRegistry
    },
    merge: vi.fn((_meta: unknown, inlineConfig: any, inlineBuildConfig: any) => ({
      ...inlineBuildConfig,
      define: inlineConfig?.define,
    })),
    setDefineEnv: vi.fn((key: string, value: any) => {
      defineEnv[key] = value
      importMetaDefineRegistry = createImportMetaDefineRegistry({
        baseEnv: defineEnv,
      })
    }),
    setImportMetaEnvDefineOverride: vi.fn((define?: Record<string, any>) => {
      importMetaEnvDefineOverride = define
      importMetaDefineRegistry = createImportMetaDefineRegistry({
        baseEnv: defineEnv,
        defineEntries: define,
      })
    }),
  } as any
}

function createBuilder() {
  const runtimeState = createRuntimeState()
  const configService = createConfigService()
  Object.assign(configService, {
    configFilePath: '/project/vite.config.ts',
    cwd: '/project',
    isDev: true,
    mode: 'development',
    platform: 'weapp',
    projectConfigPath: '/project/project.config.json',
  })
  const isolatedConfigService = createConfigService()
  const registerPotentialComponent = vi.fn().mockResolvedValue(undefined)
  const runWithoutOutputWrites = vi.fn(async (task: () => unknown) => await task())
  createCompilerContextInstanceMock.mockReturnValue({
    autoImportService: {
      registerPotentialComponent,
      runWithoutOutputWrites,
    },
    configService: isolatedConfigService,
  })
  return {
    builder: createIndependentBuilder(configService, runtimeState.build),
    configService,
    isolatedConfigService,
    registerPotentialComponent,
    runWithoutOutputWrites,
    runtimeState,
  }
}

describe('runtime buildPlugin independent builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAutoImportConfigMock.mockReturnValue(undefined)
  })

  it('builds and stores independent output with subpackage chunk root', async () => {
    const output = { output: [{ fileName: 'pkg/common.js' }] } as any
    buildMock.mockResolvedValueOnce(output)
    const { builder, configService, isolatedConfigService } = createBuilder()
    const meta = {
      subPackage: {
        root: 'packageA',
        inlineConfig: { mode: 'test' },
      },
    } as any

    const result = await builder.buildIndependentBundle('packageA', meta)

    expect(result).toBe(output)
    expect(buildMock).toHaveBeenCalledTimes(1)
    expect(createCompilerContextInstanceMock).toHaveBeenCalledTimes(1)
    expect(isolatedConfigService.load).toHaveBeenCalledWith({
      cwd: '/project',
      isDev: true,
      mode: 'development',
      configFile: '/project/vite.config.ts',
      cliPlatform: 'weapp',
      projectConfigPath: '/project/project.config.json',
    })
    const inlineConfig = buildMock.mock.calls[0]?.[0]
    expect(inlineConfig.build.write).toBe(false)
    expect(inlineConfig.build.watch).toBeNull()
    expect(inlineConfig.build.rolldownOptions.output.chunkFileNames()).toBe('packageA/[name].js')
    expect(builder.getIndependentOutput('packageA')).toBe(output)
    expect(isolatedConfigService.merge).toHaveBeenCalledTimes(1)
    expect(configService.merge).not.toHaveBeenCalled()
    builder.invalidateIndependentOutput('packageA')
    expect(builder.getIndependentOutput('packageA')).toBeUndefined()
  })

  it('initializes scoped auto imports inside the isolated context without output writes', async () => {
    const output = { output: [{ fileName: 'packageA/index.js' }] } as any
    const candidates = [
      '/project/src/packageA/components/OrderMetrics/OrderMetrics.wxml',
    ]
    buildMock.mockResolvedValueOnce(output)
    getAutoImportConfigMock.mockReturnValue({
      globs: ['packageA/components/**/*.wxml'],
    })
    findAutoImportCandidatesMock.mockResolvedValue(candidates)
    const {
      builder,
      isolatedConfigService,
      registerPotentialComponent,
      runWithoutOutputWrites,
    } = createBuilder()

    await builder.buildIndependentBundle('packageA', {
      subPackage: {
        root: 'packageA',
        inlineConfig: {},
      },
    } as any)

    expect(isolatedConfigService.options.currentSubPackageRoot).toBe('packageA')
    expect(getAutoImportConfigMock).toHaveBeenCalledWith(isolatedConfigService)
    expect(findAutoImportCandidatesMock).toHaveBeenCalledTimes(1)
    expect(runWithoutOutputWrites).toHaveBeenCalledTimes(1)
    expect(registerPotentialComponent).toHaveBeenCalledWith(candidates[0])
  })

  it('syncs subpackage import.meta.env override registry during independent build and restores previous state', async () => {
    const output = { output: [{ fileName: 'pkg/common.js' }] } as any
    buildMock.mockResolvedValueOnce(output)
    const { builder, configService, isolatedConfigService } = createBuilder()
    configService.defineEnv.EXISTING = 'kept'
    isolatedConfigService.defineEnv.EXISTING = 'kept'
    const meta = {
      subPackage: {
        root: 'packageA',
        inlineConfig: {
          define: {
            'import.meta.env.VITE_SUB_PACKAGE_B': '"sub-package-b"',
          },
        },
      },
    } as any

    await builder.buildIndependentBundle('packageA', meta)

    expect(isolatedConfigService.setImportMetaEnvDefineOverride).toHaveBeenCalledWith({
      'import.meta.env.VITE_SUB_PACKAGE_B': '"sub-package-b"',
    })
    expect(configService.defineEnv).toEqual({
      EXISTING: 'kept',
    })
    expect(isolatedConfigService.importMetaDefineRegistry.envMemberAccess.VITE_SUB_PACKAGE_B).toBeUndefined()
    expect(isolatedConfigService.importMetaDefineRegistry.envObject.VITE_SUB_PACKAGE_B).toBeUndefined()
  })

  it('dedupes concurrent independent builds and allows retry after task settles', async () => {
    const firstOutput = { output: [{ fileName: 'pkg/first.js' }] } as any
    const secondOutput = { output: [{ fileName: 'pkg/second.js' }] } as any
    let resolveBuild: ((value: unknown) => void) | undefined
    buildMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveBuild = resolve
    }))
    const { builder } = createBuilder()
    const meta = {
      subPackage: {
        inlineConfig: {},
      },
    } as any

    const taskA = builder.buildIndependentBundle('pkg', meta)
    const taskB = builder.buildIndependentBundle('pkg', meta)

    await vi.waitFor(() => {
      expect(buildMock).toHaveBeenCalledTimes(1)
    })
    resolveBuild?.(firstOutput)
    await expect(taskA).resolves.toBe(firstOutput)
    await expect(taskB).resolves.toBe(firstOutput)

    buildMock.mockResolvedValueOnce(secondOutput)
    await expect(builder.buildIndependentBundle('pkg', meta)).resolves.toBe(secondOutput)
    expect(buildMock).toHaveBeenCalledTimes(2)
  })

  it('normalizes independent build errors and clears stale output state', async () => {
    const { builder, runtimeState } = createBuilder()
    const meta = {
      subPackage: {
        inlineConfig: {},
      },
    } as any
    runtimeState.build.independent.outputs.set('broken', { output: [] } as any)
    buildMock.mockResolvedValueOnce([])

    await expect(builder.buildIndependentBundle('broken', meta)).rejects.toThrow(
      'normalized:broken:独立分包 broken 未产生输出',
    )

    expect(createIndependentBuildErrorMock).toHaveBeenCalledTimes(1)
    expect(loggerErrorMock).toHaveBeenCalledWith('[独立分包] broken 构建失败：normalized:broken:独立分包 broken 未产生输出')
    expect(builder.getIndependentOutput('broken')).toBeUndefined()
  })
})
