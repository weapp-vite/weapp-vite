import fs from 'fs-extra'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeSubpackages } from '@/analyze/subpackages'
import { startAnalyzeDashboard } from '@/cli/analyze/dashboard'
import { registerAnalyzeCommand } from '@/cli/commands/analyze'
import { createCompilerContext } from '@/createContext'
import logger from '@/logger'

vi.mock('@/analyze/subpackages', () => ({
  analyzeSubpackages: vi.fn(),
}))

vi.mock('@/cli/analyze/dashboard', () => ({
  startAnalyzeDashboard: vi.fn(),
}))

vi.mock('@/createContext', () => ({
  createCompilerContext: vi.fn(),
}))

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
  },
}))

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  colors: {
    green: (input: string) => input,
    bold: (input: string) => input,
    yellow: (input: string) => input,
  },
}))

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    configService: {
      cwd: '/virtual/project',
      mode: 'production',
      platform: 'weapp',
      configFilePath: '/virtual/project/vite.config.ts',
      weappWebConfig: {
        enabled: true,
        root: '/virtual/project',
        srcDir: 'src',
        outDir: '/virtual/project/dist/web',
        pluginOptions: {
          srcDir: 'src',
          runtime: {
            executionMode: 'safe',
          },
        },
      },
      relativeCwd: (input: string) => input.replace('/virtual/project/', ''),
      ...overrides,
    },
  } as any
}

function createCliActionHandler() {
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

describe('analyze command web branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = 0
  })

  it('prints web static result in h5 mode and skips mini analyzer', async () => {
    const action = createCliActionHandler()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    vi.mocked(createCompilerContext).mockResolvedValue(createContext())

    await action('/virtual/project', {
      platform: 'h5',
      json: true,
    })

    expect(createCompilerContext).toHaveBeenCalledTimes(1)
    expect(analyzeSubpackages).not.toHaveBeenCalled()
    expect(startAnalyzeDashboard).not.toHaveBeenCalled()
    expect(stdout).toHaveBeenCalledTimes(1)
    const output = String(stdout.mock.calls[0]?.[0] ?? '')
    const parsed = JSON.parse(output)
    expect(parsed.runtime).toBe('web')
    expect(parsed.platform).toBe('h5')
    expect(parsed.web.enabled).toBe(true)
    expect(parsed.web.executionMode).toBe('safe')
    expect(parsed.unsupportedScopes).toContain('分包产物体积分析（仅小程序）')
  })

  it('runs mini analyze and prints JSON when --json is enabled', async () => {
    const action = createCliActionHandler()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const miniResult = {
      packages: [],
      modules: [],
      subPackages: [],
    }

    vi.mocked(createCompilerContext).mockResolvedValue(createContext({
      weappWebConfig: undefined,
    }))
    vi.mocked(analyzeSubpackages).mockResolvedValue(miniResult as any)

    await action('/virtual/project', {
      platform: 'weapp',
      json: true,
    })

    expect(analyzeSubpackages).toHaveBeenCalledTimes(1)
    expect(startAnalyzeDashboard).not.toHaveBeenCalled()
    expect(stdout).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0] ?? ''))).toEqual(miniResult)
  })

  it('runs mini analyze summary and opens dashboard in non-json mode', async () => {
    const action = createCliActionHandler()
    const miniResult = {
      packages: [
        {
          id: 'main',
          label: '主包',
          files: [
            { type: 'chunk' },
            { type: 'asset' },
          ],
        },
      ],
      modules: [
        {
          id: 'mod-1',
          source: 'src/pages/index.ts',
          sourceType: 'script',
          packages: [
            {
              packageId: 'main',
              files: ['pages/index.js'],
            },
          ],
        },
      ],
      subPackages: [],
    }

    vi.mocked(createCompilerContext).mockResolvedValue(createContext({
      weappWebConfig: undefined,
    }))
    vi.mocked(analyzeSubpackages).mockResolvedValue(miniResult as any)

    await action('/virtual/project', {
      platform: 'weapp',
    })

    expect(analyzeSubpackages).toHaveBeenCalledTimes(1)
    expect(startAnalyzeDashboard).toHaveBeenCalledWith(miniResult)
    expect(logger.success).toHaveBeenCalledWith('分包分析完成')
  })

  it('writes web analyze result to output file when --output is provided', async () => {
    const action = createCliActionHandler()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.mocked(createCompilerContext).mockResolvedValue(createContext())

    await action('/virtual/project', {
      platform: 'h5',
      json: true,
      output: 'reports/analyze.json',
    })

    expect(fs.ensureDir).toHaveBeenCalledWith('/virtual/project/reports')
    expect(fs.writeFile).toHaveBeenCalledTimes(1)
    expect(stdout).not.toHaveBeenCalled()
  })

  it('sets exitCode when command execution throws', async () => {
    const action = createCliActionHandler()
    vi.mocked(createCompilerContext).mockRejectedValue(new Error('boom'))

    await action('/virtual/project', {
      platform: 'weapp',
    })

    expect(logger.error).toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
