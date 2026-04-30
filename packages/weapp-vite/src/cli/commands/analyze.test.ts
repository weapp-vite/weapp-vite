import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeHmrProfile } from '../../analyze/hmr'
import { analyzeSubpackages } from '../../analyze/subpackages'
import { createCompilerContext } from '../../createContext'
import { startAnalyzeDashboard } from '../analyze/dashboard'
import { registerAnalyzeCommand } from './analyze'

const filterDuplicateOptionsMock = vi.hoisted(() => vi.fn())
const resolveConfigFileMock = vi.hoisted(() => vi.fn())
const resolveRuntimeTargetsMock = vi.hoisted(() => vi.fn(() => ({
  runMini: true,
  runWeb: false,
  mpPlatform: 'weapp',
  rawPlatform: 'weapp',
})))
const createInlineConfigMock = vi.hoisted(() => vi.fn(() => ({})))
const logRuntimeTargetMock = vi.hoisted(() => vi.fn())
const createCompilerContextMock = vi.hoisted(() => vi.fn())
const analyzeSubpackagesMock = vi.hoisted(() => vi.fn())
const analyzeHmrProfileMock = vi.hoisted(() => vi.fn())
const readLatestAnalyzeHistorySnapshotMock = vi.hoisted(() => vi.fn())
const writeAnalyzeHistorySnapshotMock = vi.hoisted(() => vi.fn())
const startAnalyzeDashboardMock = vi.hoisted(() => vi.fn())
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

vi.mock('../../createContext', () => ({
  createCompilerContext: createCompilerContextMock,
}))

vi.mock('../../analyze/subpackages', () => ({
  analyzeSubpackages: analyzeSubpackagesMock,
}))

vi.mock('../../analyze/hmr', () => ({
  analyzeHmrProfile: analyzeHmrProfileMock,
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
    createCompilerContextMock.mockResolvedValue({
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
        watchToDirtyMs: { count: 2, averageMs: 3, maxMs: 4 },
        emitMs: { count: 2, averageMs: 11, maxMs: 12 },
        sharedChunkResolveMs: { count: 2, averageMs: 1.5, maxMs: 2 },
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
})
