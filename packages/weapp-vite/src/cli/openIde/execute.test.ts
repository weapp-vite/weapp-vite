import { beforeEach, describe, expect, it, vi } from 'vitest'

const clearWechatIdeCacheByAutomatorMock = vi.hoisted(() => vi.fn())
const clearWechatIdeCacheMock = vi.hoisted(() => vi.fn())
const compileWechatIdeByAutomatorMock = vi.hoisted(() => vi.fn())
const closeWechatIdeProjectMock = vi.hoisted(() => vi.fn())
const parseMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const openWechatIdeProjectByHttpMock = vi.hoisted(() => vi.fn())
const promptWechatIdeLoginRetryMock = vi.hoisted(() => vi.fn())
const quitWechatIdeMock = vi.hoisted(() => vi.fn())
const resetWechatIdeFileUtilsByHttpMock = vi.hoisted(() => vi.fn())
const runWechatIdeEngineBuildMock = vi.hoisted(() => vi.fn())
const runWithSuspendedSharedInputMock = vi.hoisted(() => vi.fn())
const runRetryableCommandMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('weapp-ide-cli', () => ({
  clearWechatIdeCacheByAutomator: clearWechatIdeCacheByAutomatorMock,
  clearWechatIdeCache: clearWechatIdeCacheMock,
  compileWechatIdeByAutomator: compileWechatIdeByAutomatorMock,
  closeWechatIdeProject: closeWechatIdeProjectMock,
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  openWechatIdeProjectByHttp: openWechatIdeProjectByHttpMock,
  parse: parseMock,
  promptWechatIdeLoginRetry: promptWechatIdeLoginRetryMock,
  quitWechatIde: quitWechatIdeMock,
  resetWechatIdeFileUtilsByHttp: resetWechatIdeFileUtilsByHttpMock,
  runWechatIdeEngineBuild: runWechatIdeEngineBuildMock,
  runWithSuspendedSharedInput: runWithSuspendedSharedInputMock,
  runRetryableCommand: runRetryableCommandMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

describe('executeWechatIdeCliCommand', () => {
  beforeEach(() => {
    clearWechatIdeCacheByAutomatorMock.mockReset()
    clearWechatIdeCacheMock.mockReset()
    compileWechatIdeByAutomatorMock.mockReset()
    closeWechatIdeProjectMock.mockReset()
    parseMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    openWechatIdeProjectByHttpMock.mockReset()
    promptWechatIdeLoginRetryMock.mockReset()
    quitWechatIdeMock.mockReset()
    resetWechatIdeFileUtilsByHttpMock.mockReset()
    runWechatIdeEngineBuildMock.mockReset()
    runWithSuspendedSharedInputMock.mockReset()
    runRetryableCommandMock.mockReset()
    loggerMock.error.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    clearWechatIdeCacheByAutomatorMock.mockResolvedValue(undefined)
    clearWechatIdeCacheMock.mockResolvedValue(undefined)
    compileWechatIdeByAutomatorMock.mockResolvedValue(undefined)
    closeWechatIdeProjectMock.mockResolvedValue(undefined)
    parseMock.mockResolvedValue(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    openWechatIdeProjectByHttpMock.mockResolvedValue('OK')
    resetWechatIdeFileUtilsByHttpMock.mockResolvedValue('OK')
    quitWechatIdeMock.mockResolvedValue(undefined)
    runWechatIdeEngineBuildMock.mockResolvedValue({
      body: '{"status":"END"}',
      done: true,
      failed: false,
      status: 'END',
    })
    runWithSuspendedSharedInputMock.mockImplementation(async (runner: () => Promise<unknown>) => await runner())
    runRetryableCommandMock.mockImplementation(async (options) => {
      const result = await options.execute()
      if (!options.isRetryableResult(result)) {
        return result
      }
      const action = await options.promptRetry(result, 0)
      if (options.shouldRetry(action)) {
        options.onRetry?.()
        return await options.execute()
      }
      options.onCancel?.(result)
      throw options.createCancelError(result)
    })
  })

  it('retries login-required ide commands until parse succeeds', async () => {
    const loginRequiredError = new Error('需要重新登录')
    parseMock.mockRejectedValueOnce(loginRequiredError).mockResolvedValueOnce(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(true)
    promptWechatIdeLoginRetryMock.mockResolvedValue('retry')
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['compile', '--project', '/project/dist'], {
      cancelLevel: 'warn',
      onRetry: () => loggerMock.info('正在重试连接微信开发者工具...'),
    })

    expect(parseMock).toHaveBeenCalledTimes(2)
    expect(promptWechatIdeLoginRetryMock).toHaveBeenCalledWith({
      cancelLevel: 'warn',
      error: loginRequiredError,
      logger: loggerMock,
    })
    expect(runWithSuspendedSharedInputMock).toHaveBeenCalledTimes(1)
    expect(loggerMock.info).toHaveBeenCalledWith('正在重试连接微信开发者工具...')
  })

  it('prefers http open for compile when projectPath is provided', async () => {
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['compile', '--project', '/project/dist'], {
      projectPath: '/project/dist',
    })

    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledWith('/project/dist')
    expect(compileWechatIdeByAutomatorMock).not.toHaveBeenCalled()
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('throws http error when httpMode is require', async () => {
    openWechatIdeProjectByHttpMock.mockRejectedValueOnce(new Error('http open failed'))
    const { executeWechatIdeCliCommand } = await import('./execute')

    await expect(executeWechatIdeCliCommand(['compile', '--project', '/project/dist'], {
      httpMode: 'require',
      projectPath: '/project/dist',
    })).rejects.toThrow('http open failed')

    expect(parseMock).not.toHaveBeenCalled()
  })

  it('falls back to automator compile helper when http compile fails', async () => {
    openWechatIdeProjectByHttpMock.mockRejectedValueOnce(new Error('http open failed'))
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['compile', '--project', '/project/dist'], {
      projectPath: '/project/dist',
    })

    expect(compileWechatIdeByAutomatorMock).toHaveBeenCalledWith({
      projectPath: '/project/dist',
    })
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('prefers http reset-fileutils when projectPath is provided', async () => {
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['reset-fileutils'], {
      projectPath: '/project/dist',
    })

    expect(resetWechatIdeFileUtilsByHttpMock).toHaveBeenCalledWith('/project/dist')
    expect(openWechatIdeProjectByHttpMock).not.toHaveBeenCalled()
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('prefers http engine build when projectPath is provided', async () => {
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['engine', 'build'], {
      projectPath: '/project/dist',
    })

    expect(runWechatIdeEngineBuildMock).toHaveBeenCalledWith('/project/dist', {
      logPath: undefined,
    })
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('swallows non-login errors when custom handler is provided', async () => {
    const commandError = new Error('unexpected failure')
    const onNonLoginError = vi.fn()
    clearWechatIdeCacheByAutomatorMock.mockRejectedValueOnce(new Error('no automator'))
    clearWechatIdeCacheMock.mockRejectedValueOnce(commandError)
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['cache', '--clean', 'all'], {
      onNonLoginError,
      projectPath: '/project/dist',
    })

    expect(onNonLoginError).toHaveBeenCalledWith(commandError)
    expect(runWithSuspendedSharedInputMock).toHaveBeenCalledTimes(1)
    expect(promptWechatIdeLoginRetryMock).not.toHaveBeenCalled()
  })

  it('prefers helper cache command when automator path is unavailable', async () => {
    clearWechatIdeCacheByAutomatorMock.mockRejectedValueOnce(new Error('no automator'))
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['cache', '--clean', 'all'], {
      projectPath: '/project/dist',
    })

    expect(clearWechatIdeCacheByAutomatorMock).toHaveBeenCalledWith({
      clean: 'all',
      projectPath: '/project/dist',
    })
    expect(clearWechatIdeCacheMock).toHaveBeenCalledWith({ clean: 'all' })
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('prefers helper close command before parse fallback', async () => {
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['close'])

    expect(closeWechatIdeProjectMock).toHaveBeenCalledTimes(1)
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('prefers helper quit command before parse fallback', async () => {
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['quit'])

    expect(quitWechatIdeMock).toHaveBeenCalledTimes(1)
    expect(parseMock).not.toHaveBeenCalled()
  })
})
