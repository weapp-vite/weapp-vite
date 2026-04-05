import { beforeEach, describe, expect, it, vi } from 'vitest'

const tryRunIdeCommandMock = vi.hoisted(() => vi.fn())

vi.mock('./cli/ide', () => ({
  tryRunIdeCommand: tryRunIdeCommandMock,
}))

vi.mock('./cli/commands/analyze', () => ({ registerAnalyzeCommand: vi.fn() }))
vi.mock('./cli/commands/build', () => ({ registerBuildCommand: vi.fn() }))
vi.mock('./cli/commands/close', () => ({ registerCloseCommand: vi.fn() }))
vi.mock('./cli/commands/generate', () => ({ registerGenerateCommand: vi.fn() }))
vi.mock('./cli/commands/ide', () => ({ registerIdeCommand: vi.fn() }))
vi.mock('./cli/commands/init', () => ({ registerInitCommand: vi.fn() }))
vi.mock('./cli/commands/mcp', () => ({ registerMcpCommand: vi.fn() }))
vi.mock('./cli/commands/npm', () => ({ registerNpmCommand: vi.fn() }))
vi.mock('./cli/commands/open', () => ({ registerOpenCommand: vi.fn() }))
vi.mock('./cli/commands/prepare', () => ({ registerPrepareCommand: vi.fn() }))
vi.mock('./cli/commands/serve', () => ({ registerServeCommand: vi.fn() }))
vi.mock('./cli/error', () => ({ handleCLIError: vi.fn() }))
vi.mock('./cli/mcpAutoStart', () => ({ maybeAutoStartMcpServer: vi.fn() }))
vi.mock('./cli/prepareGuard', () => ({ handlePrepareLifecycleError: vi.fn(() => false) }))
vi.mock('./runtime/tsconfigSupport', () => ({ syncManagedTsconfigBootstrapFiles: vi.fn() }))
vi.mock('./utils', () => ({ checkRuntime: vi.fn() }))
vi.mock('./constants', () => ({ VERSION: 'test-version' }))

describe('weapp-vite cli entry', () => {
  beforeEach(() => {
    vi.resetModules()
    tryRunIdeCommandMock.mockReset()
  })

  it('waits for forwarded ide commands to finish before resolving module evaluation', async () => {
    let forwardedResolved = false
    tryRunIdeCommandMock.mockReturnValueOnce(new Promise<boolean>((resolve) => {
      setTimeout(() => {
        forwardedResolved = true
        resolve(true)
      }, 0)
    }))

    const originalArgv = process.argv
    process.argv = ['node', 'weapp-vite', 'screenshot']

    try {
      await import('./cli.ts?case=forwarded-await')
    }
    finally {
      process.argv = originalArgv
    }

    expect(tryRunIdeCommandMock).toHaveBeenCalledWith(['screenshot'])
    expect(forwardedResolved).toBe(true)
  })
})
