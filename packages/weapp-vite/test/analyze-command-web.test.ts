import { beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeSubpackages } from '@/analyze/subpackages'
import { startAnalyzeDashboard } from '@/cli/analyze/dashboard'
import { registerAnalyzeCommand } from '@/cli/commands/analyze'
import { createCompilerContext } from '@/createContext'

vi.mock('@/analyze/subpackages', () => ({
  analyzeSubpackages: vi.fn(),
}))

vi.mock('@/cli/analyze/dashboard', () => ({
  startAnalyzeDashboard: vi.fn(),
}))

vi.mock('@/createContext', () => ({
  createCompilerContext: vi.fn(),
}))

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
    vi.restoreAllMocks()
  })

  it('prints web static result in h5 mode and skips mini analyzer', async () => {
    const action = createCliActionHandler()
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    vi.mocked(createCompilerContext).mockResolvedValue({
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
      },
    } as any)

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
})
