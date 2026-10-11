import type { CAC } from 'cac'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tryRunIdeCommandMock = vi.hoisted(() => vi.fn())
const loadConfigMock = vi.hoisted(() => vi.fn())
const nativeActionMock = vi.hoisted(() => vi.fn())
const handleCLIErrorMock = vi.hoisted(() => vi.fn())
const syncManagedTsconfigBootstrapFilesMock = vi.hoisted(() => vi.fn())

vi.mock('./cli/ide', () => ({
  tryRunIdeCommand: tryRunIdeCommandMock,
}))

vi.mock('./cli/commands/alipay', () => ({ registerAlipayCommand: vi.fn() }))
vi.mock('./cli/commands/analyze', () => ({
  registerAnalyzeCommand: vi.fn((cli: CAC) => cli.command('analyze [root]')
    .option('--ui-host <host>', 'UI host')
    .action(nativeActionMock)),
}))
vi.mock('./cli/commands/build', () => ({
  registerBuildCommand: vi.fn((cli: CAC) => cli.command('build [root]')
    .option('--upload', 'upload')
    .option('--bump <release>', 'bump')
    .option('--ui-host <host>', 'UI host')
    .action(nativeActionMock)),
  scheduleCompletedProductionBuildExit: vi.fn(),
}))
vi.mock('./cli/commands/close', () => ({ registerCloseCommand: vi.fn() }))
vi.mock('./cli/commands/generate', () => ({ registerGenerateCommand: vi.fn() }))
vi.mock('./cli/commands/ide', () => ({ registerIdeCommand: vi.fn() }))
vi.mock('./cli/commands/init', () => ({ registerInitCommand: vi.fn() }))
vi.mock('./cli/commands/mcp', () => ({ registerMcpCommand: vi.fn() }))
vi.mock('./cli/commands/npm', () => ({ registerNpmCommand: vi.fn() }))
vi.mock('./cli/commands/open', () => ({ registerOpenCommand: vi.fn() }))
vi.mock('./cli/commands/prepare', () => ({ registerPrepareCommand: vi.fn() }))
vi.mock('./cli/commands/serve', () => ({
  registerServeCommand: vi.fn((cli: CAC) => cli.command('[root]')
    .alias('dev')
    .alias('serve')
    .option('--ui-host <host>', 'UI host')
    .action(nativeActionMock)),
}))
vi.mock('./cli/commands/upload', () => ({
  registerUploadCommand: vi.fn((cli: CAC) => cli.command('upload [root]')
    .option('--bump <release>', 'bump')
    .option('--json', 'JSON report')
    .option('--timeout <seconds>', 'timeout')
    .option('--platform <platform>', 'platform')
    .option('--uv <version>', 'version')
    .action(nativeActionMock)),
  registerPreviewCommand: vi.fn(),
}))
vi.mock('./cli/error', () => ({ handleCLIError: handleCLIErrorMock }))
vi.mock('./cli/loadConfig', () => ({ loadConfig: loadConfigMock }))
vi.mock('./aiEnvironment', () => ({ detectAiDevelopmentEnvironment: vi.fn(async () => ({ isAgent: false })) }))
vi.mock('./mcp', () => ({
  resolveWeappMcpConfig: vi.fn(() => ({ enabled: false })),
  startWeappViteMcpServer: vi.fn(),
}))
vi.mock('./cli/prepareGuard', () => ({ handlePrepareLifecycleError: vi.fn(() => false) }))
vi.mock('./runtime/tsconfigSupport', () => ({ syncManagedTsconfigBootstrapFiles: syncManagedTsconfigBootstrapFilesMock }))
vi.mock('./utils', () => ({ checkRuntime: vi.fn() }))
vi.mock('./constants', () => ({ VERSION: 'test-version' }))

describe('weapp-vite cli entry', () => {
  beforeEach(() => {
    vi.resetModules()
    tryRunIdeCommandMock.mockReset()
    loadConfigMock.mockReset().mockResolvedValue({ config: { weapp: { mcp: false } } })
    nativeActionMock.mockReset().mockResolvedValue({ schemaVersion: 1, action: 'upload', status: 'success', results: [] })
    handleCLIErrorMock.mockReset()
    syncManagedTsconfigBootstrapFilesMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
      // CLI 在模块求值时读取 argv，必须先安装本用例参数再加载入口。
      await import('./cli.ts?case=forwarded-await')
    }
    finally {
      process.argv = originalArgv
    }

    expect(tryRunIdeCommandMock).toHaveBeenCalledWith(['screenshot'])
    expect(forwardedResolved).toBe(true)
  })

  it.each([
    { args: ['--mode', 'test', 'build', '--upload', '--bump', 'patch'], configReads: 0 },
    { args: ['--config', 'vite.config.mjs', 'upload', '--bump', 'patch'], configReads: 0 },
    { args: ['--mode', 'test', 'dev'], configReads: 0 },
    { args: ['build', '--ui-host', 'invalid', '--ui-host', 'hub'], configReads: 0 },
    { args: ['--mode', 'test'], configReads: 1 },
  ])('does not preload config for explicit commands behind global options: $args', async ({ args, configReads }) => {
    tryRunIdeCommandMock.mockResolvedValue(false)
    const originalArgv = process.argv
    process.argv = ['node', 'weapp-vite', ...args]

    try {
      // 测试入口求值顺序，静态导入会早于本用例的 argv 与 mock 设置。
      await import('./cli.ts?case=leading-options')
    }
    finally {
      process.argv = originalArgv
    }

    expect(nativeActionMock).toHaveBeenCalledTimes(1)
    expect(loadConfigMock).toHaveBeenCalledTimes(configReads)
  })

  it.each([
    { args: ['--ui-host', 'invalid'] },
    { args: ['dev', '--ui-host', 'invalid'] },
    { args: ['build', '--ui-host', 'invalid'] },
    { args: ['analyze', '--ui-host', 'invalid'] },
    { args: ['build', '--ui-host', 'hub', '--ui-host', 'invalid'] },
  ])('rejects invalid UI hosts before bootstrap writes or service startup: $args', async ({ args }) => {
    tryRunIdeCommandMock.mockResolvedValue(false)
    const originalArgv = process.argv
    const originalExitCode = process.exitCode
    process.argv = ['node', 'weapp-vite', ...args]

    try {
      // 入口在模块求值时处理参数，静态导入无法覆盖本用例安装后的 argv。
      await import('./cli.ts?case=invalid-ui-host')
      expect(process.exitCode).toBe(1)
      expect(handleCLIErrorMock).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringMatching(/--ui-host.*standalone.*hub/),
      }))
      expect(syncManagedTsconfigBootstrapFilesMock).not.toHaveBeenCalled()
      expect(loadConfigMock).not.toHaveBeenCalled()
      expect(nativeActionMock).not.toHaveBeenCalled()
    }
    finally {
      process.argv = originalArgv
      process.exitCode = originalExitCode
    }
  })

  it.each([
    { args: ['--timeout'] },
    { args: ['--platform'] },
    { args: ['--uv'] },
    { args: ['--unknown-upload-option'] },
    { args: ['--json', '--timeout'] },
  ])('reports startup validation errors as JSON before invoking upload: $args', async ({ args }) => {
    tryRunIdeCommandMock.mockResolvedValue(false)
    const originalArgv = process.argv
    const originalExitCode = process.exitCode
    const stdout: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array, encodingOrCallback?: unknown, callback?: unknown) => {
      stdout.push(String(chunk))
      const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback
      if (typeof done === 'function') {
        done()
      }
      return true
    }) as typeof process.stdout.write)
    process.argv = ['node', 'weapp-vite', 'upload', '--json', ...args]
    try {
      await import('./cli.ts?case=upload-json-startup')
      expect(JSON.parse(stdout.join(''))).toEqual({
        schemaVersion: 1,
        action: 'upload',
        status: 'failed',
        results: [],
        error: expect.any(String),
      })
      expect(process.exitCode).toBe(1)
      expect(nativeActionMock).not.toHaveBeenCalled()
      expect(loadConfigMock).not.toHaveBeenCalled()
    }
    finally {
      process.argv = originalArgv
      process.exitCode = originalExitCode
    }
  })
})
