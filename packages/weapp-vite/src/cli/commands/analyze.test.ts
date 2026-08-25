import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeHmrProfile } from '../../analyze/hmr'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { createWebAnalyzeResult, registerAnalyzeCommand } from './analyze'

const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const analyzeBackendCloseMock = vi.hoisted(() => vi.fn())
const terminateStaleSassEmbeddedProcessMock = vi.hoisted(() => vi.fn())
const resolveRuntimeTargetsMock = vi.hoisted(() => {
  const miniBackend = {
    descriptor: {
      id: 'miniprogram',
      capabilities: {
        analyze: true,
      },
    },
    platform: 'weapp',
    driver: {
      close: analyzeBackendCloseMock,
    },
  }
  return vi.fn(() => ({
    kind: 'miniprogram',
    label: 'weapp',
    entries: [miniBackend],
    platform: 'weapp',
    rawPlatform: 'weapp',
    get: (id: string) => id === 'miniprogram' ? miniBackend : undefined,
  }))
})
const createInlineConfigMock = vi.hoisted(() => vi.fn(() => ({})))
const logRuntimeTargetMock = vi.hoisted(() => vi.fn())
const createCompilerContextMock = vi.hoisted(() => vi.fn())
const analyzeSubpackagesMock = vi.hoisted(() => vi.fn())
const analyzeHmrProfileMock = vi.hoisted(() => vi.fn())
const analyzePreloadRulesMock = vi.hoisted(() => vi.fn())
const readLatestAnalyzeHistorySnapshotMock = vi.hoisted(() => vi.fn())
const writeAnalyzeHistorySnapshotMock = vi.hoisted(() => vi.fn())
const startAnalyzeDashboardMock = vi.hoisted(() => vi.fn())
const ensureDirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())
const resolveHmrProfileJsonPathMock = vi.hoisted(() => vi.fn(({ cwd, option }) => (
  option ? `${cwd}/${option}` : `${cwd}/.weapp-vite/hmr-profile.jsonl`
)))
const loggerMock = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
  colors: {
    green: (input: string) => input,
    bold: (input: string) => input,
  },
}))

vi.mock('@weapp-core/shared/fs', () => ({
  fs: {
    ensureDir: ensureDirMock,
    writeFile: writeFileMock,
  },
}))

vi.mock('../../utils/hmrProfile', () => ({
  resolveHmrProfileJsonPath: resolveHmrProfileJsonPathMock,
}))

vi.mock('../options', () => ({
  filterDuplicateOptions: filterDuplicateOptionsMock,
  resolveConfigFile: resolveConfigFileMock,
  coerceBooleanOption: vi.fn((input: unknown) => Boolean(input)),
}))

vi.mock('../runtime', () => ({
  resolveRuntimeTargets: resolveRuntimeTargetsMock,
  createInlineConfig: createInlineConfigMock,
  logRuntimeTarget: logRuntimeTargetMock,
}))

vi.mock('../processCleanup', () => ({
  terminateStaleSassEmbeddedProcess: terminateStaleSassEmbeddedProcessMock,
}))

vi.mock('../../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('../../analyze/subpackages', () => ({
  analyzeSubpackages: analyzeSubpackagesMock,
}))

vi.mock('../../analyze/hmr', () => ({
  analyzeHmrProfile: analyzeHmrProfileMock,
}))

vi.mock('../../analyze/preload', () => ({
  analyzePreloadRules: analyzePreloadRulesMock,
}))

vi.mock('../../analyze/subpackages/history', () => ({
  readLatestAnalyzeHistorySnapshot: readLatestAnalyzeHistorySnapshotMock,
  writeAnalyzeHistorySnapshot: writeAnalyzeHistorySnapshotMock,
}))

vi.mock('../analyze/dashboard', () => ({
  startAnalyzeDashboard: startAnalyzeDashboardMock,
}))

function createAnalyzeActionHandler() {
  let actionHandler: ((root: string, options: any) => Promise<void>) | undefined
  const chain = {
    option: vi.fn(() => chain),
    action: vi.fn((handler: (root: string, options: any) => Promise<void>) => {
      actionHandler = handler
      return chain
    }),
  }
  const cli = {
    command: vi.fn(() => chain),
  }

  registerAnalyzeCommand(cli as any)
  if (!actionHandler) {
    throw new Error('failed to capture analyze action handler')
  }
  return actionHandler
}

describe('analyze cli command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
    resolveConfigFileMock.mockReturnValue(undefined)
    readLatestAnalyzeHistorySnapshotMock.mockResolvedValue(null)
    writeAnalyzeHistorySnapshotMock.mockResolvedValue('/project/.weapp-vite/analyze-history/latest.json')
    ensureDirMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
    createCompilerContextMock.mockResolvedValue({
      runtimeState: {
        glassEasel: {
          silent: false,
        },
      },
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        configFilePath: '/project/weapp-vite.config.ts',
        relativeCwd: (input: string) => input.replace('/project/', ''),
        weappViteConfig: {
          hmr: {
            profileJson: false,
          },
        },
      },
    })
    analyzeSubpackagesMock.mockResolvedValue({
      packages: [],
      modules: [],
      subPackages: [],
      glassEasel: {
        detected: false,
        minimumBaseLibrary: '3.8.12',
        migrationGuide: 'https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html',
        diagnostics: [],
        summary: { errors: 0, warnings: 0 },
      },
    })
    analyzeHmrProfileMock.mockResolvedValue({
      runtime: 'mini',
      kind: 'hmr-profile',
      generatedAt: '2026-04-23T12:00:00.000Z',
      profilePath: '/project/.weapp-vite/hmr-profile.jsonl',
      sampleCount: 2,
      skippedLineCount: 0,
      firstTimestamp: '2026-04-23T10:00:00.000Z',
      lastTimestamp: '2026-04-23T10:01:00.000Z',
      metrics: {
        totalMs: { count: 2, averageMs: 40, maxMs: 60 },
        buildCoreMs: { count: 0 },
        buildStartMs: { count: 2, averageMs: 2, maxMs: 3 },
        pluginResolveMs: { count: 2, averageMs: 0.2, maxMs: 0.3 },
        transformMs: { count: 0 },
        coreTransformMs: { count: 0 },
        wevuTransformMs: { count: 0 },
        vueTransformMs: { count: 0 },
        vueReadSourceMs: { count: 0 },
        vueCompileMs: { count: 0 },
        vueFinalizeCompiledMs: { count: 0 },
        vueFinalizeCodeMs: { count: 0 },
        coreLoadMs: { count: 2, averageMs: 5, maxMs: 6 },
        entryLoadMs: { count: 2, averageMs: 3, maxMs: 4 },
        entryCodeReadMs: { count: 0 },
        entrySidecarResolveMs: { count: 0 },
        entryJsonReadMs: { count: 0 },
        entryVueConfigMs: { count: 0 },
        entryTemplateScanMs: { count: 0 },
        entryScriptSetupMs: { count: 0 },
        entryVueSignatureMs: { count: 0 },
        entryAutoImportMs: { count: 0 },
        entryPrepareMs: { count: 0 },
        entryEmitOutputMs: { count: 0 },
        entryStyleScanMs: { count: 0 },
        entryStyleReadMs: { count: 0 },
        entryResolveMs: { count: 0 },
        entryChunkEmitMs: { count: 0 },
        entryChunkLoadMs: { count: 0 },
        entryChunkEmitFileMs: { count: 0 },
        entryLayoutMs: { count: 0 },
        requestGlobalsMs: { count: 2, averageMs: 1, maxMs: 1.5 },
        weapiResolveMs: { count: 0 },
        renderStartMs: { count: 0 },
        generateBundleMs: { count: 0 },
        generateSharedMs: { count: 0 },
        generateRewriteMs: { count: 0 },
        generateModuleGraphMs: { count: 0 },
        snapshotResolveMs: { count: 0 },
        snapshotBuildMs: { count: 0 },
        writeMs: { count: 0 },
        watchToDirtyMs: { count: 2, averageMs: 3, maxMs: 4 },
        emitMs: { count: 2, averageMs: 11, maxMs: 12 },
        sharedChunkResolveMs: { count: 2, averageMs: 1.5, maxMs: 2 },
      },
      operations: {
        chunkEmitCount: { count: 0 },
        loadCount: { count: 0 },
        resolveCount: { count: 2, average: 4, max: 5 },
        skippedLoadedCount: { count: 0 },
      },
      events: [{ name: 'update', count: 2 }],
      dirtyReasons: [{ name: 'entry-direct:1', count: 2 }],
      pendingReasons: [{ name: 'shared-chunk(common.js)+1:direct', count: 2 }],
      slowestSamples: [
        {
          totalMs: 60,
          event: 'update',
          file: '/project/src/pages/home/index.vue',
        },
      ],
    })
    analyzePreloadRulesMock.mockResolvedValue({
      runtime: 'mini',
      kind: 'preload',
      generatedAt: '2026-04-23T12:00:00.000Z',
      platform: 'weapp',
      pages: ['pages/index/index'],
      configuredRules: {},
      suggestions: [{
        page: 'pages/index/index',
        packages: ['packages/order'],
        evidence: [{
          target: 'packages/order/index',
          packageRoot: 'packages/order',
          source: 'script',
        }],
        alreadyConfigured: [],
      }],
      budgets: [],
      uncoveredPages: [],
      limitations: ['静态分析限制'],
    })
  })

  it('runs preload analysis without opening the dashboard', async () => {
    const action = createAnalyzeActionHandler()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await action('/project', {
      platform: 'weapp',
      preload: true,
      json: true,
    })

    expect(analyzeSubpackagesMock).toHaveBeenCalledTimes(1)
    expect(analyzePreloadRulesMock).toHaveBeenCalledWith(
      expect.anything(),
      { packageAnalysis: expect.objectContaining({ packages: [], modules: [], subPackages: [] }) },
    )
    expect(startAnalyzeDashboard).not.toHaveBeenCalled()
    expect(analyzeBackendCloseMock).toHaveBeenCalledTimes(1)
    expect(terminateStaleSassEmbeddedProcessMock).toHaveBeenCalledTimes(1)
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"kind": "preload"'))
    writeSpy.mockRestore()
  })

  it('closes analyze backends in reverse order and always runs process cleanup', async () => {
    const closeOrder: string[] = []
    const backends = ['first', 'second'].map(id => ({
      descriptor: {
        id,
        capabilities: { analyze: true },
      },
      driver: {
        close: vi.fn(async () => closeOrder.push(id)),
      },
      platform: 'weapp',
    }))
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'miniprogram',
      label: 'weapp',
      entries: backends,
      platform: 'weapp',
      rawPlatform: 'weapp',
      get: (id: string) => backends.find(backend => backend.descriptor.id === id),
    })
    const action = createAnalyzeActionHandler()

    await action('/project', {
      platform: 'weapp',
      preload: true,
      json: true,
    })

    expect(closeOrder).toEqual(['second', 'first'])
    expect(terminateStaleSassEmbeddedProcessMock).toHaveBeenCalledTimes(1)
  })

  it('rejects preload analysis for non-WeChat targets', async () => {
    const action = createAnalyzeActionHandler()
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'alipay',
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        weappViteConfig: {},
      },
    })

    await action('/project', { platform: 'alipay', preload: true })

    expect(analyzePreloadRulesMock).not.toHaveBeenCalled()
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      message: 'preloadRule 分析目前仅支持微信小程序平台。',
    }))
    expect(process.exitCode).toBe(1)
  })

  it('rejects preload analysis for the web runtime before web analysis', async () => {
    const webBackend = {
      descriptor: {
        id: 'web',
        capabilities: { analyze: true },
      },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      platform: undefined,
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    const action = createAnalyzeActionHandler()

    await action('/project', { platform: 'web', preload: true })

    expect(analyzePreloadRulesMock).not.toHaveBeenCalled()
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      message: 'preloadRule 分析目前仅支持微信小程序平台。',
    }))
    expect(process.exitCode).toBe(1)
  })

  it('analyzes hmr profile with default fallback path and skips dashboard', async () => {
    const action = createAnalyzeActionHandler()

    await action('/project', {
      platform: 'weapp',
      hmrProfile: true,
    })

    expect(createCompilerContext).toHaveBeenCalledWith(expect.objectContaining({
      cwd: '/project',
    }))
    expect(analyzeHmrProfile).toHaveBeenCalledWith({
      profilePath: '/project/.weapp-vite/hmr-profile.jsonl',
    })
    expect(analyzeSubpackages).not.toHaveBeenCalled()
    expect(startAnalyzeDashboard).not.toHaveBeenCalled()
    expect(loggerMock.success).toHaveBeenCalledWith('HMR profile 分析完成')
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('事件分布'))
  })

  it('reports skipped hmr profile records and unavailable profile paths', async () => {
    const profileResult = await analyzeHmrProfileMock()
    analyzeHmrProfileMock.mockClear()
    analyzeHmrProfileMock.mockResolvedValueOnce({
      ...profileResult,
      skippedLineCount: 2,
    })
    const action = createAnalyzeActionHandler()

    await action('/project', { hmrProfile: true })
    expect(loggerMock.warn).toHaveBeenCalledWith('- 跳过 2 条无法解析的 profile 记录')

    resolveHmrProfileJsonPathMock.mockReturnValueOnce(undefined)
    await action('/project', { hmrProfile: true })
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      message: '未找到可用的 HMR profile 文件路径',
    }))
    expect(process.exitCode).toBe(1)
  })

  it('prints empty and fallback-valued hmr profile summaries', async () => {
    const profileResult = await analyzeHmrProfileMock()
    analyzeHmrProfileMock.mockClear()
    const action = createAnalyzeActionHandler()

    analyzeHmrProfileMock.mockResolvedValueOnce({
      ...profileResult,
      dirtyReasons: [],
      events: [],
      firstTimestamp: undefined,
      lastTimestamp: undefined,
      pendingReasons: [],
      slowestSamples: [],
    })
    await action('/project', { hmrProfile: 'custom-profile.jsonl' })
    expect(resolveHmrProfileJsonPathMock).toHaveBeenCalledWith(expect.objectContaining({
      option: 'custom-profile.jsonl',
    }))

    analyzeHmrProfileMock.mockResolvedValueOnce({
      ...profileResult,
      slowestSamples: [{}],
    })
    await action('/project', { hmrProfile: true })
    expect(loggerMock.info).toHaveBeenCalledWith('  - 0.00 ms，unknown，(unknown)')
  })

  it('prefers config-defined hmr profile path when option has no explicit file', async () => {
    const action = createAnalyzeActionHandler()
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        configFilePath: '/project/weapp-vite.config.ts',
        relativeCwd: (input: string) => input.replace('/project/', ''),
        weappViteConfig: {
          hmr: {
            profileJson: '.reports/custom-hmr.jsonl',
          },
        },
      },
    })

    await action('/project', {
      platform: 'weapp',
      hmrProfile: true,
    })

    expect(analyzeHmrProfile).toHaveBeenCalledWith({
      profilePath: '/project/.reports/custom-hmr.jsonl',
    })
  })

  it('fails budget check without opening dashboard when a package exceeds budget', async () => {
    const action = createAnalyzeActionHandler()
    analyzeSubpackagesMock.mockResolvedValueOnce({
      metadata: {
        generatedAt: '2026-04-30T00:00:00.000Z',
        budgets: {
          totalBytes: 10_000,
          mainBytes: 1_000,
          subPackageBytes: 1_000,
          independentBytes: 1_000,
          warningRatio: 0.85,
          source: 'config',
        },
        history: {
          enabled: true,
          dir: '.weapp-vite/analyze-history',
          limit: 20,
        },
      },
      packages: [
        {
          id: '__main__',
          label: '主包',
          type: 'main',
          files: [
            {
              file: 'app.js',
              type: 'chunk',
              from: 'main',
              size: 2_000,
            },
          ],
        },
      ],
      modules: [],
      subPackages: [],
    })

    await action('/project', {
      platform: 'weapp',
      budgetCheck: true,
    })

    expect(process.exitCode).toBe(1)
    expect(startAnalyzeDashboard).not.toHaveBeenCalled()
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('包体预算检查失败'))
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('主包'))
  })

  it('prints PR report without opening dashboard', async () => {
    const action = createAnalyzeActionHandler()
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    readLatestAnalyzeHistorySnapshotMock.mockResolvedValueOnce({
      packages: [
        {
          id: '__main__',
          label: '主包',
          type: 'main',
          files: [
            {
              file: 'app.js',
              type: 'chunk',
              from: 'main',
              size: 512,
              modules: [{ id: 'shared', source: 'shared.ts', sourceType: 'src', bytes: 128 }],
            },
          ],
        },
      ],
      modules: [],
      subPackages: [],
    })
    analyzeSubpackagesMock.mockResolvedValueOnce({
      packages: [
        {
          id: '__main__',
          label: '主包',
          type: 'main',
          files: [
            {
              file: 'app.js',
              type: 'chunk',
              from: 'main',
              size: 1024,
              modules: [{ id: 'shared', source: 'shared.ts', sourceType: 'src', bytes: 256 }],
            },
          ],
        },
      ],
      modules: [],
      subPackages: [],
    })

    await action('/project', {
      platform: 'weapp',
      report: 'pr',
    })

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('## weapp-vite analyze PR 摘要'))
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('### Top 增量'))
    expect(startAnalyzeDashboard).not.toHaveBeenCalled()
    writeSpy.mockRestore()
  })

  it('prints component suggestions in default mini analyze summary', async () => {
    const action = createAnalyzeActionHandler()
    analyzeSubpackagesMock.mockResolvedValueOnce({
      packages: [],
      modules: [],
      subPackages: [{ root: 'pkgA', independent: false }],
      components: [
        {
          component: 'components/detail-card',
          componentPackage: '__main__',
          totalUsageCount: 1,
          pageUsageCount: 1,
          pages: [{ page: 'pkgA/pages/detail/index', packageId: 'pkgA', usageCount: 1 }],
          suggestions: [
            {
              kind: 'move-to-subpackage',
              component: 'components/detail-card',
              componentPackage: '__main__',
              targetPackage: 'pkgA',
              pagePackages: ['pkgA'],
              message: '主包组件 components/detail-card 仅被分包 pkgA 使用，建议评估移动到该分包。',
            },
          ],
        },
      ],
    })

    await action('/project', {
      platform: 'weapp',
    })

    expect(loggerMock.info).toHaveBeenCalledWith('组件依赖：1 个组件，1 条分包优化建议')
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('components/detail-card'))
    expect(startAnalyzeDashboard).toHaveBeenCalledTimes(1)
  })

  it('uses the web analyze capability without running mini analysis', async () => {
    const webBackend = {
      descriptor: {
        id: 'web',
        capabilities: { analyze: true },
      },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        relativeCwd: (input: string) => input.replace('/project/', ''),
        weappViteConfig: { hmr: { profileJson: false } },
        weappWebConfig: {
          enabled: true,
          root: '/project/web',
          srcDir: 'src',
          outDir: '/project/dist/web',
          pluginOptions: {
            executionMode: 'compat',
          },
        },
      },
    })
    const action = createAnalyzeActionHandler()

    await action('/project', { platform: 'web' })

    expect(analyzeSubpackages).not.toHaveBeenCalled()
    expect(loggerMock.success).toHaveBeenCalledWith('Web 静态分析完成')
  })

  it('prints disabled and default-valued web summaries', async () => {
    const webBackend = {
      descriptor: { id: 'web', capabilities: { analyze: true } },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    const action = createAnalyzeActionHandler()
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        platform: 'weapp',
        relativeCwd: (input: string) => input,
        weappViteConfig: {},
        weappWebConfig: { enabled: false, pluginOptions: {} },
      },
    })
    await action('/project', { platform: 'web' })
    expect(loggerMock.info).toHaveBeenCalledWith('- 配置状态：未启用 weapp.web')

    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        platform: 'weapp',
        relativeCwd: (input: string) => input,
        weappViteConfig: {},
        weappWebConfig: { enabled: true, pluginOptions: {} },
      },
    })
    await action('/project', { platform: 'web' })
    expect(loggerMock.info).toHaveBeenCalledWith('- root：.')
    expect(loggerMock.info).toHaveBeenCalledWith('- srcDir：.')
    expect(loggerMock.info).toHaveBeenCalledWith('- outDir：dist/web')
  })

  it('describes disabled web config with stable relative paths and timestamp', () => {
    const result = createWebAnalyzeResult({
      configFilePath: '/project/vite.config.ts',
      mode: 'test',
      relativeCwd: () => '',
      weappWebConfig: undefined,
    } as any, {
      now: new Date('2026-07-29T00:00:00.000Z'),
      platform: 'web',
    })
    expect(result).toMatchObject({
      configFile: '.',
      generatedAt: '2026-07-29T00:00:00.000Z',
      limitations: expect.arrayContaining(['未检测到启用的 weapp.web 配置。']),
      web: {
        enabled: false,
        executionMode: 'compat',
      },
    })
  })

  it('rejects unsupported report types and records context creation failures', async () => {
    const action = createAnalyzeActionHandler()
    await expect(action('/project', { report: 'html' })).rejects.toThrow('不支持的 analyze report 类型')

    createCompilerContextMock.mockRejectedValueOnce(new Error('invalid config'))
    await action('/project', {})
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'invalid config' }))
    expect(process.exitCode).toBe(1)
    expect(terminateStaleSassEmbeddedProcessMock).toHaveBeenCalledTimes(1)
  })

  it('prints hmr, web and mini JSON or Markdown when no output file is provided', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const action = createAnalyzeActionHandler()

    await action('/project', { hmrProfile: true, json: true })
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"kind": "hmr-profile"'))

    const webBackend = {
      descriptor: { id: 'web', capabilities: { analyze: true } },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        platform: 'weapp',
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        relativeCwd: (input: string) => input.replace('/project/', ''),
        weappViteConfig: {},
        weappWebConfig: { enabled: false, pluginOptions: {} },
      },
    })
    await action('/project', { json: true, platform: 'web' })
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"runtime": "web"'))

    await action('/project', { markdown: true, platform: 'weapp' })
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('# weapp-vite analyze 报告'))

    await action('/project', { json: true, platform: 'weapp' })
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('"packages"'))
    writeSpy.mockRestore()
  })

  it('writes JSON, Markdown and PR reports to resolved output files', async () => {
    const action = createAnalyzeActionHandler()

    await action('/project', {
      markdown: true,
      output: 'reports/analyze.md',
      platform: 'weapp',
    })
    expect(writeFileMock).toHaveBeenLastCalledWith(
      '/project/reports/analyze.md',
      expect.stringContaining('# weapp-vite analyze 报告'),
      'utf8',
    )

    await action('/project', {
      output: '/tmp/analyze-pr.md',
      platform: 'weapp',
      report: 'pr',
    })
    expect(writeFileMock).toHaveBeenLastCalledWith(
      '/tmp/analyze-pr.md',
      expect.stringContaining('## weapp-vite analyze PR 摘要'),
      'utf8',
    )

    await action('/project', {
      json: true,
      output: 'reports/analyze.json',
      platform: 'weapp',
    })
    expect(writeFileMock).toHaveBeenLastCalledWith(
      '/project/reports/analyze.json',
      expect.stringContaining('"packages"'),
      'utf8',
    )
    expect(ensureDirMock).toHaveBeenCalledWith('/project/reports')
    expect(loggerMock.success).toHaveBeenCalledWith(expect.stringContaining('分析结果已写入'))
  })

  it('writes hmr and web JSON without also printing stdout', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const action = createAnalyzeActionHandler()

    await action('/project', {
      hmrProfile: true,
      json: true,
      output: 'reports/hmr.json',
    })

    const webBackend = {
      descriptor: { id: 'web', capabilities: { analyze: true } },
      platform: 'web',
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'web',
      label: 'web',
      entries: [webBackend],
      rawPlatform: 'web',
      get: (id: string) => id === 'web' ? webBackend : undefined,
    })
    createCompilerContextMock.mockResolvedValueOnce({
      configService: {
        cwd: '/project',
        mode: 'production',
        packageManager: { agent: 'pnpm' },
        platform: 'weapp',
        relativeCwd: (input: string) => input,
        weappViteConfig: {},
        weappWebConfig: { enabled: false, pluginOptions: {} },
      },
    })
    await action('/project', {
      json: true,
      output: 'reports/web.json',
      platform: 'web',
    })

    expect(writeFileMock).toHaveBeenCalledWith(
      '/project/reports/hmr.json',
      expect.stringContaining('"kind": "hmr-profile"'),
      'utf8',
    )
    expect(writeFileMock).toHaveBeenCalledWith(
      '/project/reports/web.json',
      expect.stringContaining('"runtime": "web"'),
      'utf8',
    )
    expect(writeSpy).not.toHaveBeenCalled()
    writeSpy.mockRestore()
  })

  it('warns for targets without analyze capability and returns after a passing budget check', async () => {
    const unsupported = {
      descriptor: { id: 'custom', capabilities: { analyze: false } },
    }
    resolveRuntimeTargetsMock.mockReturnValueOnce({
      kind: 'miniprogram',
      label: 'custom',
      entries: [unsupported],
      rawPlatform: 'custom',
      get: () => undefined,
    })
    const action = createAnalyzeActionHandler()
    await action('/project', {})
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.stringContaining('当前命令不支持该平台'))

    await action('/project', { budgetCheck: true })
    expect(loggerMock.success).toHaveBeenCalledWith('包体预算检查通过')
    expect(startAnalyzeDashboardMock).not.toHaveBeenCalled()
  })

  it('returns a non-zero exit code for glass-easel migration errors', async () => {
    analyzeSubpackagesMock.mockResolvedValueOnce({
      packages: [],
      modules: [],
      subPackages: [],
      glassEasel: {
        detected: true,
        minimumBaseLibrary: '3.8.12',
        migrationGuide: 'https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/migration.html',
        diagnostics: [{
          code: 'GE001',
          severity: 'error',
          file: 'app.json',
          message: 'missing paired config',
        }],
        summary: { errors: 1, warnings: 0 },
      },
    })
    const action = createAnalyzeActionHandler()

    await action('/project', { glassEaselCheck: true })

    expect(process.exitCode).toBe(1)
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringContaining('[GE001] app.json'))
    expect(startAnalyzeDashboardMock).not.toHaveBeenCalled()
  })

  it('prints detailed package, component and duplicate-module summaries', async () => {
    const suggestions = Array.from({ length: 6 }, (_, index) => ({
      kind: 'move-to-subpackage',
      message: `suggestion-${index}`,
    }))
    const modules = Array.from({ length: 11 }, (_, index) => ({
      id: `module-${index}`,
      packages: [
        { packageId: 'main', files: [`main-${index}.js`] },
        { packageId: 'pkg', files: [`pkg-${index}.js`] },
      ],
      source: `src/module-${index}.ts`,
      sourceType: 'src',
    }))
    analyzeSubpackagesMock.mockResolvedValueOnce({
      components: [{ suggestions }],
      modules,
      packages: [
        {
          files: [{ type: 'chunk' }, { type: 'asset' }],
          id: 'main',
          label: '主包',
        },
        { files: [], id: 'pkg', label: '分包' },
      ],
      subPackages: [{ independent: true, name: 'goods', root: 'pkg' }],
    })
    const action = createAnalyzeActionHandler()
    await action('/project', {})
    expect(loggerMock.info).toHaveBeenCalledWith('分包配置：')
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('其余 1 条组件建议'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('跨包复用/复制源码共 11 项'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('其余 1 项'))
  })

  it('prints summary fallbacks without subpackages or component metadata', async () => {
    analyzeSubpackagesMock.mockResolvedValueOnce({
      modules: [{
        id: 'shared',
        packages: [
          { files: ['main.js'], packageId: 'missing-main' },
          { files: ['pkg.js'], packageId: 'missing-pkg' },
        ],
        source: 'src/shared.ts',
        sourceType: 'src',
      }],
      packages: [{ files: [], id: 'main', label: '主包' }],
      subPackages: [],
    })
    const action = createAnalyzeActionHandler()

    await action('/project', {})

    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('覆盖 0 个源码模块'))
    expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('missing-main'))
  })
})
