import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createImportMetaDefineRegistry } from '../../utils/importMeta'
import { createRuntimeState } from '../runtimeState'
import { createIndependentBuilder } from './independent'

const buildMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())
const createIndependentBuildErrorMock = vi.hoisted(() => vi.fn((root: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`normalized:${root}:${message}`)
}))

vi.mock('vite', () => ({
  build: buildMock,
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

describe('runtime buildPlugin independent builder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds and stores independent output with subpackage chunk root', async () => {
    const output = { output: [{ fileName: 'pkg/common.js' }] } as any
    buildMock.mockResolvedValueOnce(output)
    const runtimeState = createRuntimeState()
    const configService = createConfigService()
    const builder = createIndependentBuilder(configService, runtimeState.build)
    const meta = {
      subPackage: {
        root: 'packageA',
        inlineConfig: { mode: 'test' },
      },
    } as any

    const result = await builder.buildIndependentBundle('packageA', meta)

    expect(result).toBe(output)
    expect(buildMock).toHaveBeenCalledTimes(1)
    const inlineConfig = buildMock.mock.calls[0]?.[0]
    expect(inlineConfig.build.write).toBe(false)
    expect(inlineConfig.build.watch).toBeNull()
    expect(inlineConfig.build.rolldownOptions.output.chunkFileNames()).toBe('packageA/[name].js')
    expect(builder.getIndependentOutput('packageA')).toBe(output)
    builder.invalidateIndependentOutput('packageA')
    expect(builder.getIndependentOutput('packageA')).toBeUndefined()
  })

  it('syncs subpackage import.meta.env override registry during independent build and restores previous state', async () => {
    const output = { output: [{ fileName: 'pkg/common.js' }] } as any
    buildMock.mockResolvedValueOnce(output)
    const runtimeState = createRuntimeState()
    const configService = createConfigService()
    configService.defineEnv.EXISTING = 'kept'
    const builder = createIndependentBuilder(configService, runtimeState.build)
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

    expect(configService.setImportMetaEnvDefineOverride).toHaveBeenCalledWith({
      'import.meta.env.VITE_SUB_PACKAGE_B': '"sub-package-b"',
    })
    expect(configService.defineEnv).toEqual({
      EXISTING: 'kept',
    })
    expect(configService.importMetaDefineRegistry.envMemberAccess.VITE_SUB_PACKAGE_B).toBeUndefined()
    expect(configService.importMetaDefineRegistry.envObject.VITE_SUB_PACKAGE_B).toBeUndefined()
  })

  it('dedupes concurrent independent builds and allows retry after task settles', async () => {
    const firstOutput = { output: [{ fileName: 'pkg/first.js' }] } as any
    const secondOutput = { output: [{ fileName: 'pkg/second.js' }] } as any
    let resolveBuild: ((value: unknown) => void) | undefined
    buildMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveBuild = resolve
    }))
    const runtimeState = createRuntimeState()
    const configService = createConfigService()
    const builder = createIndependentBuilder(configService, runtimeState.build)
    const meta = {
      subPackage: {
        inlineConfig: {},
      },
    } as any

    const taskA = builder.buildIndependentBundle('pkg', meta)
    const taskB = builder.buildIndependentBundle('pkg', meta)

    expect(buildMock).toHaveBeenCalledTimes(1)
    resolveBuild?.(firstOutput)
    await expect(taskA).resolves.toBe(firstOutput)
    await expect(taskB).resolves.toBe(firstOutput)

    buildMock.mockResolvedValueOnce(secondOutput)
    await expect(builder.buildIndependentBundle('pkg', meta)).resolves.toBe(secondOutput)
    expect(buildMock).toHaveBeenCalledTimes(2)
  })

  it('normalizes independent build errors and clears stale output state', async () => {
    const runtimeState = createRuntimeState()
    const configService = createConfigService()
    const builder = createIndependentBuilder(configService, runtimeState.build)
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
