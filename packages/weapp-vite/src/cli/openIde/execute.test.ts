import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseMock = vi.hoisted(() => vi.fn())
const isWechatIdeLoginRequiredErrorMock = vi.hoisted(() => vi.fn())
const openWechatIdeProjectByHttpMock = vi.hoisted(() => vi.fn())
const promptWechatIdeLoginRetryMock = vi.hoisted(() => vi.fn())
const runWithSuspendedSharedInputMock = vi.hoisted(() => vi.fn())
const runRetryableCommandMock = vi.hoisted(() => vi.fn())
const withMiniProgramMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('weapp-ide-cli', () => ({
  isWechatIdeLoginRequiredError: isWechatIdeLoginRequiredErrorMock,
  openWechatIdeProjectByHttp: openWechatIdeProjectByHttpMock,
  parse: parseMock,
  promptWechatIdeLoginRetry: promptWechatIdeLoginRetryMock,
  runWithSuspendedSharedInput: runWithSuspendedSharedInputMock,
  runRetryableCommand: runRetryableCommandMock,
  withMiniProgram: withMiniProgramMock,
}))

vi.mock('../../logger', () => ({
  default: loggerMock,
}))

describe('executeWechatIdeCliCommand', () => {
  beforeEach(() => {
    parseMock.mockReset()
    isWechatIdeLoginRequiredErrorMock.mockReset()
    openWechatIdeProjectByHttpMock.mockReset()
    promptWechatIdeLoginRetryMock.mockReset()
    runWithSuspendedSharedInputMock.mockReset()
    runRetryableCommandMock.mockReset()
    withMiniProgramMock.mockReset()
    loggerMock.error.mockReset()
    loggerMock.info.mockReset()
    loggerMock.warn.mockReset()
    parseMock.mockResolvedValue(undefined)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    openWechatIdeProjectByHttpMock.mockResolvedValue('OK')
    runWithSuspendedSharedInputMock.mockImplementation(async (runner: () => Promise<unknown>) => await runner())
    withMiniProgramMock.mockRejectedValue(new Error('no automator'))
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
    const toolMock = vi.fn().mockResolvedValue(undefined)
    withMiniProgramMock.mockImplementation(async (_options, runner) => await runner({
      tool: toolMock,
    }))
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['compile', '--project', '/project/dist'], {
      projectPath: '/project/dist',
    })

    expect(openWechatIdeProjectByHttpMock).toHaveBeenCalledWith('/project/dist')
    expect(withMiniProgramMock).not.toHaveBeenCalled()
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

  it('swallows non-login errors when custom handler is provided', async () => {
    const commandError = new Error('unexpected failure')
    const onNonLoginError = vi.fn()
    parseMock.mockRejectedValueOnce(commandError)
    isWechatIdeLoginRequiredErrorMock.mockReturnValue(false)
    const { executeWechatIdeCliCommand } = await import('./execute')

    await executeWechatIdeCliCommand(['cache', '--clean', 'all'], {
      onNonLoginError,
    })

    expect(onNonLoginError).toHaveBeenCalledWith(commandError)
    expect(runWithSuspendedSharedInputMock).toHaveBeenCalledTimes(1)
    expect(promptWechatIdeLoginRetryMock).not.toHaveBeenCalled()
  })
})
