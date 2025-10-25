import type { RolldownOutput } from 'rolldown'
import type { MutableCompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import logger from '../../logger'
import { createBuildServicePlugin } from '../buildPlugin'
import { createRuntimeState } from '../runtimeState'
import { createWatcherServicePlugin } from '../watcherPlugin'

const buildMock = vi.hoisted(() => vi.fn())

vi.mock('vite', () => ({
  build: buildMock,
}))

function createMockCompilerContext() {
  const runtimeState = createRuntimeState()
  const ctx = {
    runtimeState,
  } as MutableCompilerContext

  ctx.configService = {
    weappViteConfig: {},
    merge: vi.fn((_meta: any, _inline: any, overrides: any) => overrides ?? {}),
    mergeWorkers: vi.fn(),
    relativeAbsoluteSrcRoot: (p: string) => p,
    absoluteSrcRoot: '/project/src',
    relativeCwd: (p: string) => p,
    outDir: '/project/dist',
    mpDistRoot: '',
    isDev: true,
  } as unknown as MutableCompilerContext['configService']

  createWatcherServicePlugin(ctx)

  ctx.npmService = {
    build: vi.fn(),
    checkDependenciesCacheOutdate: vi.fn().mockResolvedValue(true),
  } as unknown as MutableCompilerContext['npmService']

  ctx.scanService = {
    workersDir: undefined,
    independentSubPackageMap: new Map(),
  } as unknown as MutableCompilerContext['scanService']

  createBuildServicePlugin(ctx)
  return ctx
}

const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

function createMeta(root = 'packageB'): SubPackageMetaValue {
  return {
    entries: [`${root}/pages/index`],
    subPackage: {
      root,
      name: root,
      pages: ['pages/index'],
      independent: true,
    },
  }
}

function createChunk(fileName: string) {
  return {
    type: 'chunk' as const,
    code: `console.log('${fileName}')`,
    name: 'index',
    isEntry: true,
    exports: [],
    fileName,
    modules: {},
    imports: [],
    dynamicImports: [],
    facadeModuleId: null,
    isDynamicEntry: false,
    moduleIds: [],
    map: null,
    sourcemapFileName: null,
    preliminaryFileName: fileName,
  }
}

describe('buildService independent bundles', () => {
  beforeEach(() => {
    buildMock.mockReset()
    loggerErrorSpy.mockClear()
  })

  it('builds a bundle and caches the output', async () => {
    const ctx = createMockCompilerContext()
    const buildService = ctx.buildService!
    const meta = createMeta()
    const chunk = createChunk('packageB/index.js')
    const output: RolldownOutput = {
      output: [chunk],
    }
    buildMock.mockResolvedValueOnce(output)

    const result = await buildService.buildIndependentBundle('packageB', meta)
    expect(result).toBe(output)
    expect(buildService.getIndependentOutput('packageB')).toBe(output)

    expect(buildMock).toHaveBeenCalledTimes(1)
    const configArg = buildMock.mock.calls[0]?.[0] as any
    expect(configArg?.build?.write).toBe(false)
    expect(configArg?.build?.watch).toBeNull()
    expect(typeof configArg?.build?.rolldownOptions?.output?.chunkFileNames).toBe('function')
  })

  it('selects the first output when build returns an array', async () => {
    const ctx = createMockCompilerContext()
    const buildService = ctx.buildService!
    const meta = createMeta('packageC')
    const chunkA = createChunk('packageC/index.js')
    const chunkB = createChunk('packageC/pages/other.js')
    const outputs: RolldownOutput[] = [
      { output: [chunkA, chunkB] },
      { output: [chunkB] },
    ]
    buildMock.mockResolvedValueOnce(outputs)

    const result = await buildService.buildIndependentBundle('packageC', meta)
    expect(result.output[0]).toBe(chunkA)
    expect(buildService.getIndependentOutput('packageC')).toBe(result)
  })

  it('invalidates cached output on demand', async () => {
    const ctx = createMockCompilerContext()
    const buildService = ctx.buildService!
    const meta = createMeta('packageE')
    const chunk = createChunk('packageE/index.js')
    const output: RolldownOutput = { output: [chunk] }
    buildMock.mockResolvedValueOnce(output)

    await buildService.buildIndependentBundle('packageE', meta)
    expect(buildService.getIndependentOutput('packageE')).toBe(output)

    buildService.invalidateIndependentOutput('packageE')
    expect(buildService.getIndependentOutput('packageE')).toBeUndefined()
  })

  it('wraps errors and clears cached output', async () => {
    const ctx = createMockCompilerContext()
    const buildService = ctx.buildService!
    const meta = createMeta('packageD')

    buildMock.mockRejectedValueOnce(new Error('boom'))

    await expect(buildService.buildIndependentBundle('packageD', meta)).rejects.toThrow('boom')
    expect(buildService.getIndependentOutput('packageD')).toBeUndefined()
    expect(loggerErrorSpy).toHaveBeenCalledWith('[independent] packageD 构建失败: boom')
  })
})
